import { describe, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { endsAccess } from '../../supabase/functions/_shared/subscriptionEnd'

const NOW = Date.UTC(2026, 9, 19, 12)

describe('fin de l’accès payant (webhook RevenueCat)', () => {
  test('la période payée est finie', () => {
    expect(endsAccess({ type: 'EXPIRATION' }, NOW)).toBe(true)
  })

  test('résiliation : l’accès continue jusqu’à la fin de la période payée', () => {
    expect(endsAccess({ type: 'CANCELLATION', expiration_at_ms: NOW + 10 * 86_400_000 }, NOW)).toBe(false)
    expect(endsAccess({ type: 'CANCELLATION' }, NOW)).toBe(false)
  })

  test('remboursement : l’accès s’arrête', () => {
    expect(endsAccess({ type: 'CANCELLATION', expiration_at_ms: NOW - 1000 }, NOW)).toBe(true)
  })

  test('problème de paiement, alias : rien ne change', () => {
    expect(endsAccess({ type: 'BILLING_ISSUE' }, NOW)).toBe(false)
    expect(endsAccess({ type: 'SUBSCRIBER_ALIAS' }, NOW)).toBe(false)
  })

  test('le webhook s’en sert', () => {
    const src = readFileSync(path.join(__dirname, '../../supabase/functions/revenuecat-webhook/index.ts'), 'utf8')
    expect(src).toContain("from '../_shared/subscriptionEnd.ts'")
    expect(src).not.toContain('INACTIVE_EVENTS')
  })
})
