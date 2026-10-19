import { describe, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { LOCALES, untranslatedRedirect } from '../lib/localeRouting'

describe('langues du site', () => {
  test('next.config déclare les mêmes langues que lib/localeRouting', () => {
    const cfg = readFileSync(path.join(__dirname, '../next.config.js'), 'utf8')
    expect(cfg).toContain(`locales: [${LOCALES.map(l => `'${l}'`).join(', ')}]`)
  })


  test('danois, allemand, espagnol : homepage servie, le reste en anglais', () => {
    for (const l of ['da', 'de', 'es']) {
      expect(untranslatedRedirect(l, '/')).toBeNull()
      expect(untranslatedRedirect(l, '/pricing')).toBe('/en/pricing')
      expect(untranslatedRedirect(l, '/s/abc123')).toBe('/en/s/abc123')
      expect(untranslatedRedirect(l, '/logo-tiroir.svg')).toBeNull()
      expect(untranslatedRedirect(l, '/api/health')).toBeNull()
    }
  })

  test('français et anglais : rien ne bouge', () => {
    for (const l of ['fr', 'en', undefined]) expect(untranslatedRedirect(l, '/pricing')).toBeNull()
  })
})
