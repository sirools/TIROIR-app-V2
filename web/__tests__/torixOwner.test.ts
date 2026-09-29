import { afterEach, describe, expect, test } from 'vitest'
import { DEFAULT_OWNER_EMAIL, isTorixOwner } from '../lib/torixOwner'

const confirmed = '2026-01-01T00:00:00Z'
const original = process.env.TORIX_OWNER_EMAIL

afterEach(() => {
  if (original === undefined) delete process.env.TORIX_OWNER_EMAIL
  else process.env.TORIX_OWNER_EMAIL = original
})

describe('isTorixOwner', () => {
  test('sans TORIX_OWNER_EMAIL, le propriétaire par défaut — et lui seul', () => {
    delete process.env.TORIX_OWNER_EMAIL
    expect(isTorixOwner({ email: DEFAULT_OWNER_EMAIL, email_confirmed_at: confirmed })).toBe(true)
    expect(isTorixOwner({ email: 'associe@example.com', email_confirmed_at: confirmed })).toBe(false)
    expect(isTorixOwner({ email: DEFAULT_OWNER_EMAIL, email_confirmed_at: null })).toBe(false)
  })

  test('la variable, si elle est définie, l’emporte sur le défaut', () => {
    process.env.TORIX_OWNER_EMAIL = 'autre@example.com'
    expect(isTorixOwner({ email: DEFAULT_OWNER_EMAIL, email_confirmed_at: confirmed })).toBe(false)
  })

  test('le propriétaire, casse et espaces ignorés', () => {
    process.env.TORIX_OWNER_EMAIL = '  Fondateur@Example.com '
    expect(isTorixOwner({ email: 'fondateur@example.com', email_confirmed_at: confirmed })).toBe(true)
  })

  test('un autre admin : non', () => {
    process.env.TORIX_OWNER_EMAIL = 'fondateur@example.com'
    expect(isTorixOwner({ email: 'associe@example.com', email_confirmed_at: confirmed })).toBe(false)
  })

  test('la bonne adresse mais non confirmée : non', () => {
    process.env.TORIX_OWNER_EMAIL = 'fondateur@example.com'
    expect(isTorixOwner({ email: 'fondateur@example.com', email_confirmed_at: null })).toBe(false)
    expect(isTorixOwner(null)).toBe(false)
  })
})
