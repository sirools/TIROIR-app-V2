import { describe, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { LOCALES, isRecipientPage, isTranslated, localeUrl, recipientLocale, retiredLocaleRedirect, untranslatedRedirect } from '../lib/localeRouting'

describe('langues du site', () => {
  test('next.config déclare les mêmes langues que lib/localeRouting', () => {
    const cfg = readFileSync(path.join(__dirname, '../next.config.js'), 'utf8')
    expect(cfg).toContain(`locales: [${LOCALES.map(l => `'${l}'`).join(', ')}]`)
  })


  test('/concept redirige vers la homepage, dans toutes les langues', () => {
    const cfg = readFileSync(path.join(__dirname, '../next.config.js'), 'utf8')
    expect(cfg).toMatch(/source: '\/concept', destination: '\/', permanent: true/)
    // Pas de `locale: false` : Next applique la règle à chaque langue.
    expect(cfg).not.toMatch(/locale: false/)
  })

  test('langues de Tiroir : fr, en, de, es sur le site (pt pas encore), pas de danois', () => {
    expect([...LOCALES].sort()).toEqual(['de', 'en', 'es', 'fr'])
  })

  test('anciennes adresses danoises : vers l’anglais', () => {
    expect(retiredLocaleRedirect('/da')).toBe('/en')
    expect(retiredLocaleRedirect('/da/pricing')).toBe('/en/pricing')
    expect(retiredLocaleRedirect('/da/s/abc123')).toBe('/en/s/abc123')
    expect(retiredLocaleRedirect('/dashboard')).toBeNull()
    expect(retiredLocaleRedirect('/pricing')).toBeNull()
  })

  test('allemand, espagnol : pages traduites servies, le reste en anglais', () => {
    for (const l of ['de', 'es']) {
      expect(untranslatedRedirect(l, '/')).toBeNull()
      expect(untranslatedRedirect(l, '/pricing')).toBeNull()
      expect(untranslatedRedirect(l, '/about')).toBeNull()
      expect(untranslatedRedirect(l, '/s/abc123')).toBeNull()
      expect(untranslatedRedirect(l, '/login')).toBeNull()
      expect(untranslatedRedirect(l, '/cgu')).toBeNull()
      expect(untranslatedRedirect(l, '/admin')).toBe('/en/admin')
      expect(untranslatedRedirect(l, '/logo-tiroir.svg')).toBeNull()
      expect(untranslatedRedirect(l, '/api/health')).toBeNull()
    }
  })

  test('français et anglais : rien ne bouge', () => {
    for (const l of ['fr', 'en', undefined]) expect(untranslatedRedirect(l, '/pricing')).toBeNull()
  })

  test('pages traduites et adresses publiques', () => {
    expect(isTranslated('de', '/pricing')).toBe(true)
    expect(isTranslated('de', '/admin')).toBe(false)
    expect(isTranslated('en', '/about')).toBe(true)
    expect(localeUrl('https://tiroir.app', 'fr', '/')).toBe('https://tiroir.app/')
    expect(localeUrl('https://tiroir.app', 'de', '/')).toBe('https://tiroir.app/de')
    expect(localeUrl('https://tiroir.app', 'fr', '/pricing')).toBe('https://tiroir.app/pricing')
    expect(localeUrl('https://tiroir.app', 'es', '/pricing')).toBe('https://tiroir.app/es/pricing')
  })

  test('destinataire d’un partage : langue du navigateur', () => {
    expect(recipientLocale('de-DE,de;q=0.9,en;q=0.8')).toBe('de')
    expect(recipientLocale('en-GB')).toBe('en')
    expect(recipientLocale('fr-FR,fr;q=0.9,en;q=0.8')).toBeNull()
    expect(recipientLocale('it-IT,it;q=0.9,es;q=0.5')).toBe('es')
    expect(recipientLocale('ja')).toBeNull()
    expect(recipientLocale('en;q=0.4,da;q=0.9')).toBe('en')
    expect(recipientLocale(null)).toBeNull()
    expect(isRecipientPage('/s/abc/123')).toBe(true)
    expect(isRecipientPage('/pricing')).toBe(false)
  })
})
