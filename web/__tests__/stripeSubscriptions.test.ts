import { describe, expect, test } from 'vitest'
import { OFFERS_V4 } from '../lib/offers'
import { SUBSCRIPTION_PLANS, planByLookupKey, subscriptionPlanFor } from '../lib/stripeConfig'
import type { StripeCall } from '../lib/stripe/api'
import { individualSubscription, type IndividualSubscription, type SubscriberStore } from '../lib/stripe/subscriptions'
import { handleStripeEvent, type BillingStore, type StripeEvent } from '../lib/stripe/webhook'
import { checkoutReturnPaths, offerFromNext, offerFromQuery, subscribePath } from '../lib/subscribeFlow'
import { nextPlan } from '../../supabase/functions/_shared/storeProducts'

describe('grille des abonnements', () => {
  test('Premium mensuel / annuel et Pro mensuel, aux prix de OFFERS_V4', () => {
    expect(SUBSCRIPTION_PLANS.map(p => [p.key, p.amount, p.interval])).toEqual([
      ['premium_monthly', Math.round(OFFERS_V4.premium.monthlyTtc * 100), 'month'],
      ['premium_yearly', Math.round(OFFERS_V4.premium.yearlyTtc * 100), 'year'],
      ['pro_monthly', Math.round(OFFERS_V4.pro.monthlyTtc * 100), 'month'],
    ])
    expect(subscriptionPlanFor('pro', 'yearly')).toBeNull()
    expect(subscriptionPlanFor('business', 'monthly')).toBeNull()
    expect(planByLookupKey('tiroir_business_seat_monthly')).toBeNull()
  })
})

describe('tunnel', () => {
  test('l’offre voyage dans l’adresse, en français', () => {
    expect(subscribePath('premium', 'yearly')).toBe('/abonnement?offre=premium&periode=annuel')
    expect(offerFromQuery({ offre: 'premium', periode: 'annuel' })?.plan.key).toBe('premium_yearly')
    expect(offerFromQuery({ offre: 'premium' })?.plan.key).toBe('premium_monthly')
    // Pro annuel n'existe pas : mensuel.
    expect(offerFromQuery({ offre: 'pro', periode: 'annuel' })?.plan.key).toBe('pro_monthly')
    expect(offerFromQuery({ offre: 'business' })).toBeNull()
    expect(offerFromQuery({})).toBeNull()
  })

  test('retour après connexion : l’offre est retrouvée', () => {
    expect(offerFromNext('/abonnement?offre=pro&periode=mensuel')?.tier).toBe('pro')
    expect(offerFromNext('/s/abc')).toBeNull()
    expect(offerFromNext(null)).toBeNull()
  })

  test('abandon de Checkout : retour aux tarifs, offre gardée ; succès : page de confirmation', () => {
    const r = checkoutReturnPaths('premium', 'yearly')
    expect(r.cancel).toBe('/pricing?offre=premium&periode=annuel&paiement=annule')
    expect(r.success).toContain('/abonnement/merci?offre=premium&periode=annuel')
    expect(r.success).toContain('session_id={CHECKOUT_SESSION_ID}')
  })
})

// ── Webhook ───────────────────────────────────────────────────────
// Base simulée : mêmes règles que apply_stripe_subscription (testée en SQL).
type Profile = { plan: string; source: string | null; sub: string | null; status: string | null; customer: string | null; cancel: boolean }

function subscriberStore() {
  const profiles = new Map<string, Profile>([['user-1', { plan: 'free', source: null, sub: null, status: null, customer: 'cus_1', cancel: false }]])
  const log: string[] = []
  const store: SubscriberStore = {
    async findUser({ subscriptionId, customerId }) {
      for (const [id, p] of profiles) if ((subscriptionId && p.sub === subscriptionId) || (customerId && p.customer === customerId)) return id
      return null
    },
    async apply(userId, s: IndividualSubscription) {
      const p = profiles.get(userId)!
      const live = ['active', 'trialing', 'past_due'].includes(s.status)
      if (!live && p.sub && p.sub !== s.id && ['active', 'trialing', 'past_due'].includes(p.status ?? '')) return 'ignoré (ancien abonnement)'
      Object.assign(p, { sub: s.id, status: s.status, cancel: s.cancelAtPeriodEnd })
      if (live) { Object.assign(p, { plan: s.tier, source: 'web' }); return `${s.tier} (${s.status})` }
      if (p.source === 'web') { Object.assign(p, { plan: 'free', source: null }); return `gratuit (${s.status})` }
      return 'inchangé'
    },
    async logActivity(_u, action) { log.push(action) },
  }
  return { store, profiles, log }
}

const noOrgs: BillingStore = {
  async recordCreditPurchase() { return false },
  async reverseCreditPurchase() { return null },
  async findOrg() { return null },
  async updateOrg() {},
  async syncEntitlements() {},
  async upsertInvoice() {},
  async logActivity() {},
}

const ev = (type: string, object: Record<string, unknown>): StripeEvent => ({ id: `evt_${type}`, type, livemode: false, data: { object } })
const sub = (over: Record<string, unknown> = {}) => ({
  id: 'sub_1', customer: 'cus_1', status: 'active', livemode: false, cancel_at_period_end: false, cancel_at: null,
  metadata: { kind: 'individual', user_id: 'user-1' },
  items: { data: [{ price: { lookup_key: 'tiroir_web_premium_yearly' }, current_period_end: 1_800_000_000 }] },
  ...over,
})
/** Stripe simulé : l'état ACTUEL des objets, relu par le webhook. */
const stripeWith = (state: { sub: Record<string, unknown>; invoice?: Record<string, unknown> }): StripeCall =>
  (async (_m: string, path: string) => {
    if (path.startsWith('/v1/subscriptions/')) return state.sub
    if (path.startsWith('/v1/invoices/') && state.invoice) return state.invoice
    throw new Error(`inconnu ${path}`)
  }) as StripeCall

describe('webhook : abonnements des particuliers', () => {
  const checkout = { id: 'cs_1', mode: 'subscription', subscription: 'sub_1', client_reference_id: 'user-1', metadata: { kind: 'subscription', user_id: 'user-1' } }

  test('paiement réussi → Premium ; rejeu sans effet', async () => {
    const m = subscriberStore()
    const deps = { store: noOrgs, subscribers: m.store, stripe: stripeWith({ sub: sub() }) }
    expect(await handleStripeEvent(ev('checkout.session.completed', checkout), deps)).toBe('premium (active)')
    expect(await handleStripeEvent(ev('checkout.session.completed', checkout), deps)).toBe('premium (active)')
    expect(m.profiles.get('user-1')).toMatchObject({ plan: 'premium', source: 'web', sub: 'sub_1' })
    expect(m.log).toContain('purchase.completed')
  })

  test('le palier vient du prix (lookup_key), jamais des métadonnées', () => {
    const s = individualSubscription(sub({ metadata: { user_id: 'user-1', plan: 'pro_monthly' } }))
    expect(s?.tier).toBe('premium')
    // Abonnement Business (prix siège) : pas un abonnement de particulier.
    expect(individualSubscription(sub({ items: { data: [{ price: { lookup_key: 'tiroir_business_seat_monthly' } }] } }))).toBeNull()
  })

  test('3D Secure en attente (incomplete) : rien d’activé', async () => {
    const m = subscriberStore()
    const state = { sub: sub({ status: 'incomplete' }) }
    await handleStripeEvent(ev('customer.subscription.created', state.sub), { store: noOrgs, subscribers: m.store, stripe: stripeWith(state) })
    expect(m.profiles.get('user-1')!.plan).toBe('free')
    state.sub = sub()
    await handleStripeEvent(ev('customer.subscription.updated', state.sub), { store: noOrgs, subscribers: m.store, stripe: stripeWith(state) })
    expect(m.profiles.get('user-1')!.plan).toBe('premium')
  })

  test('paiement échoué → en retard, accès gardé ; payé ensuite → actif', async () => {
    const m = subscriberStore()
    const state = { sub: sub(), invoice: { id: 'in_1', status: 'open', subscription: 'sub_1', customer: 'cus_1' } as Record<string, unknown> }
    const deps = { store: noOrgs, subscribers: m.store, stripe: stripeWith(state) }
    await handleStripeEvent(ev('checkout.session.completed', checkout), deps)
    // Stripe n'a pas encore passé l'abonnement en past_due : on le note.
    expect(await handleStripeEvent(ev('invoice.payment_failed', state.invoice), deps)).toBe('premium (past_due)')
    expect(m.profiles.get('user-1')).toMatchObject({ plan: 'premium', status: 'past_due' })
    state.invoice = { ...state.invoice, status: 'paid', billing_reason: 'subscription_cycle' }
    expect(await handleStripeEvent(ev('invoice.paid', state.invoice), deps)).toBe('premium (active)')
    expect(m.log).toContain('purchase.renewed')
  })

  test('échec reçu après le paiement (désordre) : la facture relue est payée, rien ne régresse', async () => {
    const m = subscriberStore()
    const state = { sub: sub(), invoice: { id: 'in_1', status: 'paid', subscription: 'sub_1' } }
    await handleStripeEvent(ev('invoice.payment_failed', state.invoice), { store: noOrgs, subscribers: m.store, stripe: stripeWith(state) })
    expect(m.profiles.get('user-1')!.status).toBe('active')
  })

  test('résiliation dans le portail : Premium jusqu’à la fin de la période, puis gratuit', async () => {
    const m = subscriberStore()
    const state = { sub: sub() }
    const deps = { store: noOrgs, subscribers: m.store, stripe: stripeWith(state) }
    await handleStripeEvent(ev('checkout.session.completed', checkout), deps)
    state.sub = sub({ cancel_at_period_end: true })
    await handleStripeEvent(ev('customer.subscription.updated', state.sub), deps)
    expect(m.profiles.get('user-1')).toMatchObject({ plan: 'premium', cancel: true })
    state.sub = sub({ status: 'canceled', cancel_at_period_end: true })
    await handleStripeEvent(ev('customer.subscription.deleted', state.sub), deps)
    expect(m.profiles.get('user-1')).toMatchObject({ plan: 'free', source: null, status: 'canceled' })
    // Un « updated » ancien qui arrive après : relu chez Stripe (canceled), rien ne revient.
    await handleStripeEvent(ev('customer.subscription.updated', sub()), deps)
    expect(m.profiles.get('user-1')!.plan).toBe('free')
  })

  test('changement d’offre dans le portail → Pro', async () => {
    const m = subscriberStore()
    const state = { sub: sub() }
    const deps = { store: noOrgs, subscribers: m.store, stripe: stripeWith(state) }
    await handleStripeEvent(ev('checkout.session.completed', checkout), deps)
    state.sub = sub({ items: { data: [{ price: { lookup_key: 'tiroir_web_pro_monthly' } }] } })
    await handleStripeEvent(ev('customer.subscription.updated', state.sub), deps)
    expect(m.profiles.get('user-1')!.plan).toBe('pro')
  })

  test('compte retrouvé par le client Stripe si l’abonnement n’a pas de métadonnée', async () => {
    const m = subscriberStore()
    const state = { sub: sub({ metadata: {} }) }
    await handleStripeEvent(ev('customer.subscription.created', state.sub), { store: noOrgs, subscribers: m.store, stripe: stripeWith(state) })
    expect(m.profiles.get('user-1')!.plan).toBe('premium')
  })

  test('abonnement sans compte : erreur (Stripe renverra l’événement)', async () => {
    const m = subscriberStore()
    const state = { sub: sub({ metadata: {}, customer: 'cus_inconnu' }) }
    await expect(handleStripeEvent(ev('customer.subscription.created', state.sub), { store: noOrgs, subscribers: m.store, stripe: stripeWith(state) })).rejects.toThrow()
  })

  test('abonnement Business : laissé au traitement des organisations', async () => {
    const m = subscriberStore()
    const state = { sub: sub({ metadata: { org_id: 'org-x' }, items: { data: [{ quantity: 3, price: { lookup_key: 'tiroir_business_seat_monthly' } }] } }) }
    expect(await handleStripeEvent(ev('customer.subscription.updated', state.sub), { store: noOrgs, subscribers: m.store, stripe: stripeWith(state) })).toBe('ignoré (aucune organisation)')
    expect(m.profiles.get('user-1')!.plan).toBe('free')
  })
})

describe('RevenueCat ne touche pas un abonné du site', () => {
  const web = { plan: 'premium', pro_since: null, pro_expires_at: null, plan_source: 'web', subscription_status: 'active' }
  test('expiration d’un abonnement store : Premium du site gardé', () => {
    expect(nextPlan({ type: 'EXPIRATION', product_id: 'tiroir_premium_monthly' }, web)).toBeNull()
    expect(nextPlan({ type: 'INITIAL_PURCHASE', product_id: 'tiroir_pro_monthly' }, web)).toBeNull()
  })
  test('abonnement du site terminé : les stores reprennent la main', () => {
    expect(nextPlan({ type: 'INITIAL_PURCHASE', product_id: 'tiroir_premium_monthly' }, { ...web, plan: 'free', subscription_status: 'canceled' })).toBe('premium')
  })
})
