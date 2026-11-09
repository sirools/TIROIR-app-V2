import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { isAuthorized, looksLikeJwt, secretWeakness } from '../../supabase/functions/_shared/webhookAuth'

// Webhook RevenueCat : déployé sans vérification JWT, protégé par un secret
// long et privé (audit du 09/11/2026). Avec la vérification JWT, le secret
// devait être un JWT — en pratique la clé anon, publique : n'importe qui
// pouvait forger un achat.
const root = path.resolve(__dirname, '../..')
const ANON_LIKE = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.c2lnbmF0dXJlLWZhdXNzZQ'
const GOOD = 'rc_7f3a9c1e5b2d4f6a8c0e1b3d5f7a9c2e4b6d8f0a'

describe('authentification du webhook RevenueCat', () => {
  test('verify_jwt désactivé pour la fonction', () => {
    const toml = readFileSync(path.join(root, 'supabase/config.toml'), 'utf8')
    expect(toml).toMatch(/\[functions\.revenuecat-webhook\]\s*\nverify_jwt = false/)
  })

  test('le webhook passe par isAuthorized, plus par une comparaison directe', () => {
    const src = readFileSync(path.join(root, 'supabase/functions/revenuecat-webhook/index.ts'), 'utf8')
    expect(src).toContain('isAuthorized(req.headers.get(\'Authorization\'), REVENUECAT_WEBHOOK_SECRET)')
    expect(src).not.toMatch(/authHeader !== REVENUECAT_WEBHOOK_SECRET/)
  })

  test('en-tête exact seulement', () => {
    expect(isAuthorized(GOOD, GOOD)).toBe(true)
    expect(isAuthorized(`Bearer ${GOOD}`, GOOD)).toBe(false)
    expect(isAuthorized(GOOD.slice(0, -1), GOOD)).toBe(false)
    expect(isAuthorized(`${GOOD}x`, GOOD)).toBe(false)
    expect(isAuthorized(null, GOOD)).toBe(false)
    expect(isAuthorized('', '')).toBe(false)
    expect(isAuthorized(undefined, undefined)).toBe(false)
  })

  test('secret faible signalé : absent, JWT (clé anon), trop court', () => {
    expect(secretWeakness(undefined)).toBe('missing')
    expect(secretWeakness(ANON_LIKE)).toBe('jwt')
    expect(looksLikeJwt(ANON_LIKE.replace('Bearer ', ''))).toBe(true)
    expect(secretWeakness('motdepasse')).toBe('short')
    expect(secretWeakness(GOOD)).toBeNull()
  })
})
