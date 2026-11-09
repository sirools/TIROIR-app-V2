import { describe, expect, test } from 'vitest'
import { storeSubscribeGate } from '../../mobile/src/lib/plan'

// Écran d'abonnement de l'app : jamais un deuxième abonnement payé
// (audit du 09/11/2026). Le webhook RevenueCat ignore un achat des stores
// sur un compte payé ailleurs : l'app ne doit donc pas le proposer.
const TODAY = '2026-11-09'

describe('storeSubscribeGate', () => {
  test('gratuit : Premium et Pro', () => {
    expect(storeSubscribeGate({ plan: 'free' }, TODAY)).toBe('all')
    expect(storeSubscribeGate(null, TODAY)).toBe('all')
  })

  test('Premium acheté dans l’app : seulement la montée en Pro', () => {
    expect(storeSubscribeGate({ plan: 'premium', plan_source: 'app' }, TODAY)).toBe('pro_only')
  })

  test('déjà payé ailleurs ou déjà Pro : aucun abonnement', () => {
    expect(storeSubscribeGate({ plan: 'premium', plan_source: 'web' }, TODAY)).toBe('none')
    expect(storeSubscribeGate({ plan: 'pro', plan_source: 'web' }, TODAY)).toBe('none')
    expect(storeSubscribeGate({ plan: 'pro', plan_source: 'app' }, TODAY)).toBe('none')
    // Compte offert à la main, Pro sur facture, ancien abonné sans source.
    expect(storeSubscribeGate({ plan: 'premium', plan_source: null }, TODAY)).toBe('none')
    expect(storeSubscribeGate({ plan: 'pro', plan_source: null, pro_expires_at: null }, TODAY)).toBe('none')
    expect(storeSubscribeGate({ plan: 'pro', plan_source: null, pro_expires_at: '2030-02-16' }, TODAY)).toBe('none')
  })

  test('Pro sur facture échu : redevenu gratuit, peut s’abonner', () => {
    expect(storeSubscribeGate({ plan: 'pro', plan_source: null, pro_expires_at: '2026-11-08' }, TODAY)).toBe('all')
  })
})
