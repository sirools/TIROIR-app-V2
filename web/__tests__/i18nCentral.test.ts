import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { LOCALES } from '../lib/localeRouting'
import { resolveLanguage } from '../../mobile/src/i18n/resolve'
import { SHARE_EMAIL_COPY, shareEmailLang, shareEmailUrl } from '../../supabase/functions/_shared/shareEmailCopy'

// Les traductions de l'app, du site et des e-mails ont une seule source : design/i18n/.
// Les fichiers générés sont vérifiés par designTokens.test.ts
// (node design/generate.mjs --check) ; ici, la liste des langues et la
// complétude des textes.
const ROOT = path.resolve(__dirname, '../..')
const meta = JSON.parse(readFileSync(path.join(ROOT, 'design/i18n/languages.json'), 'utf8'))
// Préfixe du site : siteCode s'il est donné (pt-BR → pt).
const siteLanguages: string[] = meta.languages
  .filter((l: { site: boolean }) => l.site)
  .map((l: { code: string; siteCode?: string }) => l.siteCode ?? l.code)

describe('design/i18n', () => {
  test('aucune langue trouée, variables identiques (scripts/i18n-check.mjs)', () => {
    const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/i18n-check.mjs')], { encoding: 'utf8' })
    expect(r.stdout + r.stderr).not.toMatch(/MANQUANT|inconnue de|variables différentes|ÉCHEC/)
    expect(r.status).toBe(0)
  })

  test('les langues du site sont celles de languages.json, partout', () => {
    expect([...LOCALES].sort()).toEqual([...siteLanguages].sort())
    const nextConfig = readFileSync(path.join(ROOT, 'web/next.config.js'), 'utf8')
    const locales = nextConfig.match(/locales:\s*\[([^\]]*)\]/)?.[1].match(/'[^']+'/g)?.map(s => s.slice(1, -1))
    expect([...(locales ?? [])].sort()).toEqual([...siteLanguages].sort())
  })

  test('la langue de l’appareil donne la bonne langue de l’app', () => {
    expect(resolveLanguage('pt', 'BR')).toBe('pt-BR')
    expect(resolveLanguage('pt', 'PT')).toBe('pt-PT')
    expect(resolveLanguage('pt', 'AO')).toBe('pt-PT')
    expect(resolveLanguage('pt', null)).toBe('pt-BR')
    expect(resolveLanguage('PT', 'pt')).toBe('pt-PT')
    expect(resolveLanguage('de', 'AT')).toBe('de')
    expect(resolveLanguage('it', 'IT')).toBe('en')
    expect(resolveLanguage(null, null)).toBe('en')
  })

  test('e-mail de partage : la langue de l’expéditeur, sinon le français', () => {
    expect(shareEmailLang('de-AT')).toBe('de')
    expect(shareEmailLang('pt-BR')).toBe('pt-BR')
    expect(shareEmailLang('pt_PT')).toBe('pt-PT')
    expect(shareEmailLang('pt')).toBe('pt-BR')
    expect(shareEmailLang('it')).toBe('fr')
    expect(shareEmailLang(undefined)).toBe('fr')
  })

  test('e-mail de partage : le lien ouvre le site dans une langue qu’il parle', () => {
    expect(shareEmailUrl('fr', 'T')).toBe('https://tiroir.app/s/T')
    expect(shareEmailUrl('de', 'T')).toBe('https://tiroir.app/de/s/T')
    expect(shareEmailUrl('pt-BR', 'T')).toBe('https://tiroir.app/en/s/T')
  })

  test('e-mail de partage : textes mis en forme comme avant la centralisation', () => {
    const fr = SHARE_EMAIL_COPY.fr
    expect(fr.greeting('Ana')).toBe('Bonjour Ana,')
    expect(fr.greeting('')).toBe('Bonjour,')
    expect(fr.objects(1)).toBe('1 objet')
    expect(fr.body('<strong>Léa</strong>', fr.objects(3), fr.quote('Vinyles')))
      .toBe('<strong>Léa</strong> vient de partager une liste de 3 objets « Vinyles » avec vous sur Tiroir.')
    expect(SHARE_EMAIL_COPY.es.greeting('Ana')).toBe('Hola, Ana:')
    // pt-PT hérite de pt-BR ce qu'il ne redéfinit pas.
    expect(SHARE_EMAIL_COPY['pt-PT'].greeting('Ana')).toBe(SHARE_EMAIL_COPY['pt-BR'].greeting('Ana'))
    expect(SHARE_EMAIL_COPY['pt-PT'].button).toBe('VER OS OBJETOS PARTILHADOS')
    // Une valeur insérée n'est jamais relue comme un marqueur.
    expect(fr.subject('{sender}')).toBe('{sender} a partagé des objets avec vous sur Tiroir')
  })
})
