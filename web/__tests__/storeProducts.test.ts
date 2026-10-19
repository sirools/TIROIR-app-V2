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

  test('le Pro sur facture en cours n’est jamais touché par les stores', () => {
    expect(nextPlan(ev('EXPIRATION', 'tiroir_pro_monthly'), invoicedPro, TODAY)).toBeNull()
    expect(nextPlan(ev('INITIAL_PURCHASE', 'tiroir_premium_monthly'), invoicedPro, TODAY)).toBeNull()
  })

  test('un ancien Pro sur facture, échu, peut s’abonner au Pro des stores', () => {
    expect(nextPlan(ev('INITIAL_PURCHASE', 'tiroir_pro_monthly'), expiredInvoicedPro, TODAY)).toBe('pro')
    expect(nextPlan(ev('INITIAL_PURCHASE', 'tiroir_premium_monthly'), expiredInvoicedPro, TODAY)).toBe('premium')
  })
})
