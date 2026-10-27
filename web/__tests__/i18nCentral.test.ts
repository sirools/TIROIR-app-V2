import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { LOCALES } from '../lib/localeRouting'
import { resolveLanguage } from '../../mobile/src/i18n/resolve'

// Les traductions de l'app et du site ont une seule source : design/i18n/.
// Les fichiers générés sont vérifiés par designTokens.test.ts
// (node design/generate.mjs --check) ; ici, la liste des langues et la
// complétude des textes.
const ROOT = path.resolve(__dirname, '../..')
const meta = JSON.parse(readFileSync(path.join(ROOT, 'design/i18n/languages.json'), 'utf8'))
const siteLanguages: string[] = meta.languages.filter((l: { site: boolean }) => l.site).map((l: { code: string }) => l.code)

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
})
