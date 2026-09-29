import { describe, expect, test } from 'vitest'
import { authErrorHint, authHref, safeNext, shareReturnPath } from '../lib/authFlow'

describe('retour après connexion', () => {
  test('chemin interne seulement', () => {
    expect(safeNext('/s/abc?suggerer=1')).toBe('/s/abc?suggerer=1')
    expect(safeNext('//evil.com')).toBe('/')
    expect(safeNext('/\\evil.com')).toBe('/')
    expect(safeNext('https://evil.com')).toBe('/')
    expect(safeNext(undefined)).toBe('/')
  })

  test('le partage rouvre le formulaire de suggestion', () => {
    expect(shareReturnPath('abc')).toBe('/s/abc?suggerer=1')
    expect(authHref('/inscription', shareReturnPath('abc'))).toBe('/inscription?next=%2Fs%2Fabc%3Fsuggerer%3D1')
    expect(authHref('/login', null)).toBe('/login')
    expect(authHref('/login', '//evil.com')).toBe('/login')
  })
})

describe('erreurs de connexion en clair', () => {
  test('mauvais identifiants : propose de créer un compte', () => {
    const h = authErrorHint('Invalid login credentials')
    expect(h.message).toContain('Pas encore de compte')
    expect(h.suggestSignup).toBe(true)
  })

  test('compte déjà existant : propose de se connecter', () => {
    const h = authErrorHint('User already registered')
    expect(h.suggestLogin).toBe(true)
  })

  test('adresse non confirmée, mot de passe court, message inconnu', () => {
    expect(authErrorHint('Email not confirmed').message).toContain('confirmée')
    expect(authErrorHint('Password should be at least 6 characters').message).toContain('6 caractères')
    expect(authErrorHint('Something else').message).toBe('Something else')
  })
})
