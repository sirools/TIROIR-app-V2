import { describe, expect, test } from 'vitest'
import { creditsForProduct, nextPlan, tierForProduct } from '../../supabase/functions/_shared/storeProducts'

// Règle du palier appliquée par le webhook RevenueCat (grille V4).
const TODAY = '2026-10-19'
const free = { plan: 'free', pro_since: null, pro_expires_at: null }
const premium = { plan: 'premium', pro_since: null, pro_expires_at: null }
const storePro = { plan: 'pro', pro_since: null, pro_expires_at: null }
const invoicedPro = { plan: 'pro', pro_since: '2026-08-01', pro_expires_at: null }
const expiredInvoicedPro = { plan: 'pro', pro_since: '2026-08-01', pro_expires_at: '2026-09-30' }

describe('produits des stores', () => {
  test('packs de la grille V4, et anciens packs toujours reconnus', () => {
    expect(creditsForProduct('tiroir_credits_50')).toBe(50)
    expect(creditsForProduct('tiroir_credits_150')).toBe(150)
    expect(creditsForProduct('tiroir_credits_500:p1')).toBe(500)
    expect(creditsForProduct('tiroir_credits_30')).toBe(30)
    expect(creditsForProduct('tiroir_premium_monthly')).toBeNull()
  })

  test('palier selon le produit', () => {
    expect(tierForProduct('tiroir_premium_monthly')).toBe('premium')
    expect(tierForProduct('tiroir_premium_annual:base')).toBe('premium')
    expect(tierForProduct('tiroir_pro_monthly')).toBe('pro')
    expect(tierForProduct('tiroir_pro_annual')).toBe('pro')
    expect(tierForProduct('tiroir_pro_annual:p1y')).toBe('pro')
    expect(tierForProduct('tiroir_credits_50')).toBeNull()
    expect(tierForProduct(undefined)).toBeNull()
  })
})

describe('nextPlan', () => {
  const ev = (type: string, product_id?: string, new_product_id?: string) => ({ type, product_id, new_product_id })

  test('achat Premium, puis Pro', () => {
    expect(nextPlan(ev('INITIAL_PURCHASE', 'tiroir_premium_monthly'), free, TODAY)).toBe('premium')
    expect(nextPlan(ev('INITIAL_PURCHASE', 'tiroir_pro_monthly'), free, TODAY)).toBe('pro')
    expect(nextPlan(ev('PRODUCT_CHANGE', 'tiroir_premium_monthly', 'tiroir_pro_monthly'), premium, TODAY)).toBe('pro')
    expect(nextPlan(ev('PRODUCT_CHANGE', 'tiroir_pro_monthly', 'tiroir_premium_annual'), storePro, TODAY)).toBe('premium')
  })

  test('renouvellement sans changement : rien à écrire', () => {
    expect(nextPlan(ev('RENEWAL', 'tiroir_pro_monthly'), storePro, TODAY)).toBeNull()
  })

  test('fin d’abonnement : seulement celle de l’abonnement en cours', () => {
    expect(nextPlan(ev('EXPIRATION', 'tiroir_pro_monthly'), storePro, TODAY)).toBe('free')
    expect(nextPlan(ev('EXPIRATION', 'tiroir_premium_monthly'), storePro, TODAY)).toBeNull()
    expect(nextPlan(ev('EXPIRATION', 'tiroir_premium_monthly'), premium, TODAY)).toBe('free')
  })

  test('résiliation : le palier reste jusqu’à la fin de la période payée', () => {
    const later = Date.now() + 10 * 86_400_000
    expect(nextPlan({ type: 'CANCELLATION', product_id: 'tiroir_pro_monthly', expiration_at_ms: later }, storePro, TODAY)).toBeNull()
    expect(nextPlan(ev('BILLING_ISSUE', 'tiroir_premium_monthly'), premium, TODAY)).toBeNull()
    // Remboursement : expiration déjà passée.
    expect(nextPlan({ type: 'CANCELLATION', product_id: 'tiroir_pro_monthly', expiration_at_ms: 1 }, storePro, TODAY)).toBe('free')
  })

  test('le Pro sur facture en cours n’est jamais touché par les stores', () => {
    expect(nextPlan(ev('EXPIRATION', 'tiroir_pro_monthly'), invoicedPro, TODAY)).toBeNull()
    expect(nextPlan(ev('INITIAL_PURCHASE', 'tiroir_premium_monthly'), invoicedPro, TODAY)).toBeNull()
  })

  test('un ancien Pro sur facture, échu, peut s’abonner au Pro des stores', () => {
    expect(nextPlan(ev('INITIAL_PURCHASE', 'tiroir_pro_monthly'), expiredInvoicedPro, TODAY)).toBe('pro')
    expect(nextPlan(ev('INITIAL_PURCHASE', 'tiroir_premium_monthly'), expiredInvoicedPro, TODAY)).toBe('premium')
  })
})

describe('journal des abonnements (stores)', () => {
  test('achat, problème de paiement, résiliation, expiration', async () => {
    const { storeSubscriptionRow } = await import('../../supabase/functions/_shared/storeProducts')
    const base = { store: 'APP_STORE', original_transaction_id: '1000', product_id: 'tiroir_premium_annual', expiration_at_ms: 1_800_000_000_000 }
    expect(storeSubscriptionRow({ ...base, type: 'INITIAL_PURCHASE' })).toMatchObject({ source: 'apple', tier: 'premium', period: 'yearly', status: 'active', cancel_at_period_end: false })
    expect(storeSubscriptionRow({ ...base, type: 'BILLING_ISSUE' })?.status).toBe('past_due')
    expect(storeSubscriptionRow({ ...base, type: 'CANCELLATION' })).toMatchObject({ status: 'active', cancel_at_period_end: true })
    expect(storeSubscriptionRow({ ...base, type: 'EXPIRATION', store: 'PLAY_STORE', product_id: 'tiroir_pro_monthly' })).toMatchObject({ source: 'google', tier: 'pro', period: 'monthly', status: 'expired' })
    // Pack de crédits, store inconnu : pas d'abonnement.
    expect(storeSubscriptionRow({ ...base, type: 'NON_RENEWING_PURCHASE', product_id: 'tiroir_credits_50' })).toBeNull()
    expect(storeSubscriptionRow({ ...base, type: 'INITIAL_PURCHASE', store: 'STRIPE' })).toBeNull()
  })
})

describe('double abonnement (audit du 09/11/2026)', () => {
  const ev = (type: string, product_id?: string, new_product_id?: string) => ({ type, product_id, new_product_id })
  const webPremium = { plan: 'premium', pro_since: null, pro_expires_at: null, plan_source: 'web', subscription_status: 'active' }
  const webEnded = { ...webPremium, plan: 'free', plan_source: null, subscription_status: 'canceled' }

  test('achat des stores sur un compte payé sur le site : ignoré mais signalé', async () => {
    const { duplicateSubscription } = await import('../../supabase/functions/_shared/storeProducts')
    expect(nextPlan(ev('INITIAL_PURCHASE', 'tiroir_pro_monthly'), webPremium, TODAY)).toBeNull()
    expect(duplicateSubscription(ev('INITIAL_PURCHASE', 'tiroir_pro_monthly'), webPremium, TODAY)).toBe('web')
    expect(duplicateSubscription(ev('RENEWAL', 'premiummensuel'), webPremium, TODAY)).toBe('web')
    expect(duplicateSubscription(ev('PRODUCT_CHANGE', 'tiroir_premium_monthly', 'tiroir_pro_annual'), webPremium, TODAY)).toBe('web')
  })

  test('Pro sur facture en cours : signalé ; échu : achat normal', async () => {
    const { duplicateSubscription } = await import('../../supabase/functions/_shared/storeProducts')
    expect(duplicateSubscription(ev('INITIAL_PURCHASE', 'tiroir_premium_annual'), invoicedPro, TODAY)).toBe('invoice')
    expect(duplicateSubscription(ev('INITIAL_PURCHASE', 'tiroir_premium_annual'), expiredInvoicedPro, TODAY)).toBeNull()
  })

  test('rien à signaler : compte gratuit, abonné des stores, pack, fin d’accès, transfert', async () => {
    const { duplicateSubscription } = await import('../../supabase/functions/_shared/storeProducts')
    expect(duplicateSubscription(ev('INITIAL_PURCHASE', 'tiroir_premium_monthly'), free, TODAY)).toBeNull()
    expect(duplicateSubscription(ev('INITIAL_PURCHASE', 'tiroir_premium_monthly'), webEnded, TODAY)).toBeNull()
    expect(duplicateSubscription(ev('RENEWAL', 'tiroir_premium_monthly'), { ...premium, plan_source: 'app' }, TODAY)).toBeNull()
    expect(duplicateSubscription(ev('NON_RENEWING_PURCHASE', 'tiroir_credits_50'), webPremium, TODAY)).toBeNull()
    expect(duplicateSubscription(ev('EXPIRATION', 'tiroir_premium_monthly'), webPremium, TODAY)).toBeNull()
    expect(duplicateSubscription(ev('TRANSFER', 'tiroir_premium_monthly'), webPremium, TODAY)).toBeNull()
  })
})
