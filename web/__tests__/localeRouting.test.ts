import { describe, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { LOCALES, isTranslated, localeUrl, untranslatedRedirect } from '../lib/localeRouting'

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

  test('danois, allemand, espagnol : pages traduites servies, le reste en anglais', () => {
    for (const l of ['da', 'de', 'es']) {
      expect(untranslatedRedirect(l, '/')).toBeNull()
      expect(untranslatedRedirect(l, '/pricing')).toBeNull()
      expect(untranslatedRedirect(l, '/about')).toBe('/en/about')
      expect(untranslatedRedirect(l, '/s/abc123')).toBe('/en/s/abc123')
      expect(untranslatedRedirect(l, '/logo-tiroir.svg')).toBeNull()
      expect(untranslatedRedirect(l, '/api/health')).toBeNull()
    }
  })

  test('français et anglais : rien ne bouge', () => {
    for (const l of ['fr', 'en', undefined]) expect(untranslatedRedirect(l, '/pricing')).toBeNull()
  })

  test('pages traduites et adresses publiques', () => {
    expect(isTranslated('de', '/pricing')).toBe(true)
    expect(isTranslated('de', '/about')).toBe(false)
    expect(isTranslated('en', '/about')).toBe(true)
    expect(localeUrl('https://tiroir.app', 'fr', '/')).toBe('https://tiroir.app/')
    expect(localeUrl('https://tiroir.app', 'de', '/')).toBe('https://tiroir.app/de')
    expect(localeUrl('https://tiroir.app', 'fr', '/pricing')).toBe('https://tiroir.app/pricing')
    expect(localeUrl('https://tiroir.app', 'es', '/pricing')).toBe('https://tiroir.app/es/pricing')
  })
})
