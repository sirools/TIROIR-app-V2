import { describe, expect, test } from 'vitest'
import { CREDIT_PACKS, consumerInvoiceFooter } from '../lib/stripeConfig'
import { OFFERS_V4 } from '../lib/offers'
import { CONSENT_TEXT_VERSION, consentFromSession, consentParams, type ConsentRecord } from '../lib/checkoutConsent'
import { creditsAllowedFor, effectivePlan } from '../lib/creditsAccess'
import { handleStripeEvent, type BillingStore, type StripeEvent } from '../lib/stripe/webhook'
import type { StripeCall } from '../lib/stripe/api'

// Base simulée : un achat ne crédite qu'une fois par session (la vraie base
// le garantit par une référence unique, testé en SQL).
function store() {
  const purchases = new Map<string, number>()
  const consents = new Map<string, ConsentRecord>()
  const s: BillingStore = {
    async recordCreditPurchase(p) { if (purchases.has(p.sessionId)) return false; purchases.set(p.sessionId, p.credits); return true },
    async reverseCreditPurchase() { return null },
    async findOrg() { return null },
    async updateOrg() {},
    async syncEntitlements() {},
    async upsertInvoice() {},
    async logActivity() {},
    async recordConsent(c) { if (!consents.has(c.sessionId)) consents.set(c.sessionId, c) },
  }
  const balance = () => [...purchases.values()].reduce((a, b) => a + b, 0)
  return { s, purchases, consents, balance }
}
const stripe = (async () => ({})) as unknown as StripeCall
const ev = (type: string, object: Record<string, unknown>, id = `evt_${type}`): StripeEvent => ({ id, type, livemode: false, created: 1_800_000_000, data: { object } })
const session = (pack: string, over: Record<string, unknown> = {}) => ({
  id: `cs_${pack}`, mode: 'payment', payment_status: 'paid', client_reference_id: 'user-1', amount_total: 0, currency: 'eur', livemode: false, locale: 'fr',
  consent: { terms_of_service: 'accepted' },
  metadata: { kind: 'credits', pack, credits: '1', user_id: 'user-1', consent_version: CONSENT_TEXT_VERSION },
  ...over,
})

describe('packs de crédits', () => {
  test('grille : 50 à 2,99 €, 150 à 6,99 € (le plus choisi), 500 à 19,99 €, TTC', () => {
    expect(CREDIT_PACKS.map(p => [p.key, p.credits, p.amount])).toEqual([['credits_50', 50, 299], ['credits_150', 150, 699], ['credits_500', 500, 1999]])
    expect(OFFERS_V4.packs.find(p => p.popular)?.credits).toBe(150)
  })

  test.each(CREDIT_PACKS.map(p => [p.key, p.credits] as const))('achat %s : %i crédits, jamais les métadonnées', async (key, credits) => {
    const m = store()
    expect(await handleStripeEvent(ev('checkout.session.completed', session(key)), { store: m.s, stripe })).toBe(`+${credits} crédits`)
    expect(m.balance()).toBe(credits)
  })

  test('double webhook : crédité une seule fois', async () => {
    const m = store()
    await handleStripeEvent(ev('checkout.session.completed', session('credits_150')), { store: m.s, stripe })
    expect(await handleStripeEvent(ev('checkout.session.completed', session('credits_150'), 'evt_bis'), { store: m.s, stripe })).toBe('déjà crédité')
    expect(m.balance()).toBe(150)
    expect(m.consents.size).toBe(1)
  })

  test('achat refusé ou non payé : rien de crédité', async () => {
    const m = store()
    expect(await handleStripeEvent(ev('checkout.session.completed', session('credits_50', { payment_status: 'unpaid' })), { store: m.s, stripe })).toBe('en attente du paiement')
    expect(m.balance()).toBe(0)
    await expect(handleStripeEvent(ev('checkout.session.completed', session('credits_9999')), { store: m.s, stripe })).rejects.toThrow()
    expect(m.balance()).toBe(0)
  })

  test('compte Pro : achat refusé ; Pro sur facture échu, Premium et Free : autorisé', () => {
    expect(creditsAllowedFor({ plan: 'pro' })).toBe(false)
    expect(creditsAllowedFor({ plan: 'pro', pro_expires_at: '2099-01-01' }, '2026-11-08')).toBe(false)
    expect(creditsAllowedFor({ plan: 'pro', pro_expires_at: '2026-01-01' }, '2026-11-08')).toBe(true)
    expect(effectivePlan({ plan: 'pro', pro_expires_at: '2026-01-01' }, '2026-11-08')).toBe('free')
    expect(creditsAllowedFor({ plan: 'premium' })).toBe(true)
    expect(creditsAllowedFor(null)).toBe(true)
  })
})

describe('droit de rétractation au Checkout', () => {
  test('case Stripe obligatoire, texte selon l’achat et la langue, lien vers les CGU', () => {
    const p = consentParams('credits', 'fr', 'https://www.tiroir.app/cgu')
    expect(p.consent_collection).toEqual({ terms_of_service: 'required' })
    expect(p.custom_text.terms_of_service_acceptance.message).toContain('mes crédits')
    expect(p.custom_text.terms_of_service_acceptance.message).toContain('L221-28')
    expect(p.custom_text.terms_of_service_acceptance.message).toContain('(https://www.tiroir.app/cgu)')
    expect(consentParams('subscription', 'fr', 'u').custom_text.terms_of_service_acceptance.message).toContain('mon abonnement')
    for (const l of ['en', 'es', 'de', 'pt-BR', 'pt-PT']) {
      const m = consentParams('subscription', l, 'u').custom_text.terms_of_service_acceptance.message
      expect(m).not.toContain('{cgu}')
      expect(m).not.toContain('Je demande')
    }
    // Langue inconnue : français.
    expect(consentParams('credits', 'it', 'u').custom_text.terms_of_service_acceptance.message).toContain('Je demande')
  })

  test('accord enregistré avec la date de fin du Checkout et la version du texte affiché', async () => {
    const m = store()
    await handleStripeEvent(ev('checkout.session.completed', session('credits_50')), { store: m.s, stripe })
    const c = m.consents.get('cs_credits_50')!
    expect(c).toMatchObject({ userId: 'user-1', kind: 'credits', item: 'credits_50', locale: 'fr', textVersion: CONSENT_TEXT_VERSION })
    expect(c.acceptedAt.toISOString()).toBe(new Date(1_800_000_000 * 1000).toISOString())
  })

  test('sans case cochée (ancienne session) : rien d’enregistré', () => {
    expect(consentFromSession(session('credits_50', { consent: null }))).toBeNull()
    expect(consentFromSession({ ...session('credits_50'), consent: { terms_of_service: 'accepted' }, metadata: { kind: 'subscription', plan: 'premium_monthly' } })?.kind).toBe('subscription')
  })

  test('mention de rétractation en pied de facture', () => {
    expect(consumerInvoiceFooter({ BILLING_VAT_MODE: 'assujetti' })).toContain('renonciation au droit de rétractation')
  })
})
