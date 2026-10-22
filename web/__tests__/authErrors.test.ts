import { describe, expect, test } from 'vitest'
import { authErrorFromUrl, authErrorKey, linkErrorKey, suggestsLogin, suggestsSignup } from '../lib/authErrors'
import { COPIES } from '../locales'
import { LOCALES } from '../lib/localeRouting'

describe('erreurs Supabase Auth → clé traduite', () => {
  test('le code prime sur le message', () => {
    expect(authErrorKey({ code: 'invalid_credentials', message: 'whatever' })).toBe('invalidCredentials')
    expect(authErrorKey({ code: 'email_exists' })).toBe('userAlreadyExists')
    expect(authErrorKey({ code: 'user_already_exists' })).toBe('userAlreadyExists')
    expect(authErrorKey({ code: 'weak_password' })).toBe('weakPassword')
    expect(authErrorKey({ code: 'same_password' })).toBe('samePassword')
    expect(authErrorKey({ code: 'over_email_send_rate_limit' })).toBe('rateLimit')
    expect(authErrorKey({ code: 'over_request_rate_limit' })).toBe('rateLimit')
    expect(authErrorKey({ code: 'otp_expired' })).toBe('linkExpired')
    expect(authErrorKey({ code: 'email_not_confirmed' })).toBe('emailNotConfirmed')
  })

  test('repli sur le message et le statut', () => {
    expect(authErrorKey({ message: 'Invalid login credentials' })).toBe('invalidCredentials')
    expect(authErrorKey('User already registered')).toBe('userAlreadyExists')
    expect(authErrorKey({ code: 'validation_failed', message: 'Unable to validate email address: invalid format' })).toBe('invalidEmail')
    expect(authErrorKey({ message: 'New password should be different from the old password.' })).toBe('samePassword')
    expect(authErrorKey({ message: 'slow down', status: 429 })).toBe('rateLimit')
    expect(authErrorKey({ name: 'AuthRetryableFetchError', message: 'Failed to fetch' })).toBe('network')
  })

  test('inconnu : message générique, jamais le texte brut', () => {
    expect(authErrorKey({ message: 'Database error saving new user' })).toBe('generic')
    expect(authErrorKey(null)).toBe('generic')
  })

  test('erreur lue dans l’URL', () => {
    const params = new URLSearchParams('error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired')
    expect(authErrorFromUrl(k => params.get(k))).toBe('linkExpired')
    expect(authErrorFromUrl(k => new URLSearchParams('error=access_denied').get(k))).toBe('accessDenied')
    expect(authErrorFromUrl(() => null)).toBeNull()
  })

  test('liaison de comptes', () => {
    expect(linkErrorKey({ code: 'manual_linking_disabled' })).toBe('linkingDisabled')
    expect(linkErrorKey({ code: 'identity_already_exists' })).toBe('identityTaken')
    expect(linkErrorKey({ code: 'single_identity_not_deletable' })).toBe('lastIdentity')
    expect(linkErrorKey({ message: 'Identity is already linked to another user' })).toBe('identityTaken')
    expect(linkErrorKey({ message: 'boom' })).toBe('generic')
  })

  test('portes de sortie', () => {
    expect(suggestsSignup('invalidCredentials')).toBe(true)
    expect(suggestsLogin('userAlreadyExists')).toBe(true)
    expect(suggestsSignup('rateLimit')).toBe(false)
  })

  test('chaque clé a un texte non vide dans chaque langue', () => {
    const keys = ['invalidCredentials', 'emailNotConfirmed', 'userAlreadyExists', 'weakPassword', 'samePassword',
      'invalidEmail', 'rateLimit', 'linkExpired', 'accessDenied', 'network', 'generic',
      'linkingDisabled', 'identityTaken', 'lastIdentity'] as const
    for (const l of LOCALES) {
      for (const k of keys) expect(COPIES[l].account.errors[k].length).toBeGreaterThan(0)
    }
  })
})
