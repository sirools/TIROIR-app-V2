import { describe, expect, test } from 'vitest'
import { linkErrorMessage, providerRows } from '../lib/identities'

const row = (rows: ReturnType<typeof providerRows>, p: string) => rows.find(r => r.provider === p)!

describe('providerRows : un seul compte, plusieurs moyens de connexion', () => {
  test('compte Apple seul (créé dans l’app) : on peut ajouter un mot de passe et Google, pas retirer Apple', () => {
    const rows = providerRows([{ provider: 'apple', identity_data: { email: 'abc@privaterelay.appleid.com' } }], false)
    expect(row(rows, 'apple')).toMatchObject({ linked: true, action: null, email: 'abc@privaterelay.appleid.com' })
    expect(row(rows, 'email').action).toBe('set-password')
    expect(row(rows, 'google').action).toBe('link')
  })

  test('deux moyens reliés : chacun peut être retiré', () => {
    const rows = providerRows([{ provider: 'email' }, { provider: 'google' }], false)
    expect(row(rows, 'email').action).toBe('unlink')
    expect(row(rows, 'google').action).toBe('unlink')
  })

  test('Apple non relié : depuis l’app tant que la connexion Apple web est coupée', () => {
    expect(row(providerRows([{ provider: 'email' }], false), 'apple').action).toBe('app-only')
    expect(row(providerRows([{ provider: 'email' }], true), 'apple').action).toBe('link')
  })

  test('toujours trois lignes, dans le même ordre', () => {
    expect(providerRows([]).map(r => r.provider)).toEqual(['email', 'google', 'apple'])
  })
})

describe('linkErrorMessage', () => {
  test('liaison non activée dans Supabase', () => {
    expect(linkErrorMessage('Manual linking is disabled')).toMatch(/Allow manual linking/)
  })
  test('compte déjà rattaché ailleurs', () => {
    expect(linkErrorMessage('Identity is already linked to another user')).toMatch(/déjà rattaché/)
  })
  test('autre erreur : message d’origine', () => {
    expect(linkErrorMessage('boom')).toBe('boom')
  })
})
