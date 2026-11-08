import { describe, it, expect } from 'vitest'
import { accountLocale } from '../lib/accountLocale'

describe('accountLocale', () => {
  it('garde les langues du site', () => {
    for (const l of ['fr', 'en', 'de', 'es']) expect(accountLocale(l)).toBe(l)
  })
  it('ramène une langue régionale à sa langue', () => {
    expect(accountLocale('de-DE')).toBe('de')
    expect(accountLocale(' EN ')).toBe('en')
  })
  it('refuse le reste', () => {
    expect(accountLocale('it')).toBeNull()
    // Danois retiré du site le 08/11/2026 (PR #85).
    expect(accountLocale('da')).toBeNull()
    expect(accountLocale('')).toBeNull()
    expect(accountLocale(undefined)).toBeNull()
    expect(accountLocale(42)).toBeNull()
  })
})
