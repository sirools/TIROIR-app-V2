import { beforeAll, describe, expect, test } from 'vitest'
import { isSignedCookieValid, signedCookieValue } from '../lib/shareCookieSignature'
import { hasValidCookie } from '../lib/shareAuth'

beforeAll(() => { process.env.SHARE_COOKIE_SECRET = 'secret-de-test' })

describe('cookie de partage signé', () => {
  test('accepté pour son partage', () => {
    expect(isSignedCookieValid('abc123', signedCookieValue('abc123'))).toBe(true)
  })

  test('refusé pour un autre partage', () => {
    expect(isSignedCookieValid('autre', signedCookieValue('abc123'))).toBe(false)
  })

  test('l’ancien format, fabricable, ne suffit pas pour écrire', () => {
    expect(isSignedCookieValid('abc123', `${Date.now()}.ok`)).toBe(false)
    expect(isSignedCookieValid('abc123', `${Date.now()}.faux.ok`)).toBe(false)
  })

  test('périmé après 7 jours', () => {
    const old = Date.now() - 8 * 86400_000
    expect(isSignedCookieValid('abc123', signedCookieValue('abc123', old))).toBe(false)
  })

  test('le nouveau format reste lisible par la vérification de lecture', () => {
    const ctx = { req: { headers: { cookie: `tiroir_share_abc123=${signedCookieValue('abc123')}` } } }
    expect(hasValidCookie('abc123', ctx as any)).toBe(true)
  })
})
