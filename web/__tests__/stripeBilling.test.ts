import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { OFFERS_V4 } from '../lib/offers'
import { BUSINESS, CREDIT_PACKS, SUBSCRIPTION_PLANS, invoiceFooter, packByKey, prorationFor, stripeEnv, vatMode } from '../lib/stripeConfig'
import { signPayload, verifyStripeSignature } from '../lib/stripe/signature'
import { encodeForm, type StripeCall } from '../lib/stripe/api'
import { accessUntil, invoiceRow, subscriptionSnapshot } from '../lib/stripe/business'
import { handleStripeEvent, type BillingStore, type OrgRow, type StripeEvent } from '../lib/stripe/webhook'
import { billingLines, businessMrr, nextChristmas, projectRevenue, type CreditPurchaseRow } from '../lib/revenue'

const root = path.resolve(__dirname, '../..')

describe('config Stripe', () => {
  test('les packs vendus sur le site sont ceux de la grille V4', () => {
    expect(CREDIT_PACKS.map(p => [p.credits, p.amount])).toEqual(OFFERS_V4.packs.map(p => [p.credits, Math.round(p.priceTtc * 100)]))
    expect(packByKey('credits_150')?.credits).toBe(150)
    expect(packByKey('credits_9999')).toBeNull()
    expect(BUSINESS.seatAmount).toBe(OFFERS_V4.business.seatMonthly * 100)
  })

  test('le script de création Stripe crée exactement ces produits', async () => {
    const { PRODUCTS } = await import('../../scripts/stripe-setup.mjs')
    expect(PRODUCTS.map((p: { lookupKey: string; amount: number }) => [p.lookupKey, p.amount])).toEqual([
      ...CREDIT_PACKS.map(p => [p.lookupKey, p.amount]),
      [BUSINESS.lookupKey, BUSINESS.seatAmount],
      ...SUBSCRIPTION_PLANS.map(p => [p.lookupKey, p.amount]),
    ])
  })

  test('mode test / réel : la clé doit correspondre à STRIPE_MODE', () => {
    expect(stripeEnv({})).toBeNull()
    expect(stripeEnv({ STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_MODE: 'test' })?.mode).toBe('test')
    expect(stripeEnv({ STRIPE_SECRET_KEY: 'sk_live_x', STRIPE_MODE: 'test' })).toBeNull()
    expect(stripeEnv({ STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_MODE: 'live' })).toBeNull()
    expect(stripeEnv({ STRIPE_SECRET_KEY: 'rk_live_x', STRIPE_MODE: 'live', STRIPE_WEBHOOK_SECRET: 'whsec_1' })).toEqual({ secretKey: 'rk_live_x', mode: 'live', webhookSecret: 'whsec_1' })
  })

  test('aucune clé Stripe en dur dans le code', () => {
    for (const file of ['web/lib/stripeConfig.ts', 'web/lib/stripe/api.ts', 'web/pages/api/stripe/webhook.ts', 'web/pages/api/stripe/checkout.ts', 'web/pages/api/stripe/subscription.ts', 'web/pages/api/stripe/portal.ts', 'web/lib/stripe/subscriptions.ts', 'scripts/stripe-setup.mjs']) {
      expect(readFileSync(path.join(root, file), 'utf8')).not.toMatch(/(sk|rk)_(test|live)_[A-Za-z0-9]{8,}|whsec_[A-Za-z0-9]{8,}/)
    }
  })

  test('prorata : ajout au prorata, retrait sans avoir', () => {
    expect(prorationFor(3, 4)).toBe('create_prorations')
    expect(prorationFor(4, 3)).toBe('none')
  })

  test('mentions de facture : franchise en base de TVA', () => {
    const footer = invoiceFooter({ BILLING_LEGAL_NAME: 'Jean Martin EI', BILLING_SIRET: '123', BILLING_VAT_MODE: 'franchise' })
    expect(footer).toContain('Jean Martin EI — SIRET 123')
    expect(footer).toContain('TVA non applicable, art. 293 B du CGI.')
    expect(footer).toContain('40 €')
    expect(invoiceFooter({ BILLING_VAT_MODE: 'assujetti', BILLING_VAT_NUMBER: 'FR00123' })).not.toContain('293 B')
  })

  test('franchise en base par défaut (confirmée le 26/10/2026)', () => {
    expect(vatMode({})).toBe('franchise')
    expect(invoiceFooter({})).toContain('TVA non applicable, art. 293 B du CGI.')
    expect(vatMode({ BILLING_VAT_MODE: 'assujetti' })).toBe('assujetti')
  })
})

describe('signature du webhook', () => {
  const secret = 'whsec_test'
  const body = '{"id":"evt_1"}'
  const now = 1_800_000_000
  test('valide', () => {
    expect(verifyStripeSignature(body, `t=${now},v1=${signPayload(body, secret, now)}`, secret, now)).toBe(true)
  })
  test('corps modifié, mauvais secret, trop vieux, en-tête absent : refusé', () => {
    const header = `t=${now},v1=${signPayload(body, secret, now)}`
    expect(verifyStripeSignature(body + ' ', header, secret, now)).toBe(false)
    expect(verifyStripeSignature(body, header, 'whsec_autre', now)).toBe(false)
    expect(verifyStripeSignature(body, header, secret, now + 301)).toBe(false)
    expect(verifyStripeSignature(body, null, secret, now)).toBe(false)
    expect(verifyStripeSignature(body, `t=${now},v1=zz`, secret, now)).toBe(false)
  })
  test('plusieurs signatures (rotation du secret)', () => {
    expect(verifyStripeSignature(body, `t=${now},v1=${'0'.repeat(64)},v1=${signPayload(body, secret, now)}`, secret, now)).toBe(true)
  })
})

test('encodage des paramètres Stripe', () => {
  expect(encodeForm({ a: 1, items: [{ price: 'p', quantity: 2 }], m: { k: 'v w' }, skip: undefined }))
    .toBe('a=1&items%5B0%5D%5Bprice%5D=p&items%5B0%5D%5Bquantity%5D=2&m%5Bk%5D=v%20w')
})

describe('droits Business', () => {
  const now = new Date('2026-11-10T12:00:00Z')
  const periodEnd = new Date('2026-12-01T00:00:00Z')
  test('actif : fin de période + 14 jours de grâce', () => {
    expect(accessUntil({ status: 'active', periodEnd, previous: null, now })).toBe('2026-12-15')
  })
  test('impayé : la grâce court depuis le premier impayé, sans être repoussée', () => {
    const first = accessUntil({ status: 'past_due', periodEnd, previous: '2026-12-15', now })
    expect(first).toBe('2026-11-24')
    expect(accessUntil({ status: 'past_due', periodEnd, previous: first, now: new Date('2026-11-20T00:00:00Z') })).toBe('2026-11-24')
  })
  test('impayé définitif, résilié : plus de droits', () => {
    for (const status of ['unpaid', 'canceled', 'incomplete_expired', 'incomplete', null]) {
      expect(accessUntil({ status, periodEnd, previous: '2026-12-15', now })).toBeNull()
    }
  })
  test('lecture d’un abonnement, période sur l’élément (API 2025+)', () => {
    const snap = subscriptionSnapshot({
      id: 'sub_1', customer: 'cus_1', status: 'active', livemode: false, metadata: { org_id: 'org-1' },
      items: { data: [{ quantity: 3, current_period_end: 1_796_083_200, price: { unit_amount: 3900 } }] },
    })
    expect(snap).toMatchObject({ id: 'sub_1', customerId: 'cus_1', orgId: 'org-1', quantity: 3, unitAmount: 3900 })
    expect(snap.periodEnd?.toISOString()).toBe('2026-12-01T00:00:00.000Z')
  })
  test('lecture d’une facture : sièges hors lignes de prorata', () => {
    const row = invoiceRow({
      id: 'in_1', number: 'TIROIR-0001', status: 'open', amount_due: 11700, livemode: false, created: 1_793_000_000, due_date: 1_795_600_000,
      lines: { data: [{ proration: true, quantity: 1 }, { proration: false, quantity: 3, period: { start: 1_793_000_000, end: 1_795_600_000 } }] },
    })
    expect(row).toMatchObject({ stripe_invoice_id: 'in_1', number: 'TIROIR-0001', seats: 3, amount_due: 11700 })
  })
})

// Base en mémoire, mêmes garanties que le SQL (référence unique par achat).
function memoryStore() {
  const ledger: { user: string; delta: number; ref: string }[] = []
  const purchases = new Map<string, { pi: string | null; user: string; credits: number; amount: number; reversed: number }>()
  const orgs = new Map<string, OrgRow & Record<string, unknown>>()
  const invoices = new Map<string, Record<string, unknown>>()
  const synced: string[] = []
  const store: BillingStore = {
    async recordCreditPurchase(p) {
      if (!purchases.has(p.sessionId)) purchases.set(p.sessionId, { pi: p.paymentIntent, user: p.userId, credits: p.credits, amount: p.amountTotal, reversed: 0 })
      const ref = `stripe:${p.sessionId}`
      if (ledger.some(l => l.ref === ref)) return false
      ledger.push({ user: p.userId, delta: p.credits, ref })
      return true
    },
    async reverseCreditPurchase(pi, refunded) {
      const p = [...purchases.values()].find(x => x.pi === pi)
      if (!p) return null
      const target = refunded >= p.amount ? p.credits : Math.floor(p.credits * refunded / p.amount)
      const delta = Math.max(0, target - p.reversed)
      if (delta) ledger.push({ user: p.user, delta: -delta, ref: `stripe:${pi}:${target}` })
      p.reversed = Math.max(p.reversed, target)
      return delta
    },
    async findOrg({ orgId, subscriptionId, customerId }) {
      return [...orgs.values()].find(o => o.id === orgId || (subscriptionId && o.stripe_subscription_id === subscriptionId) || (customerId && o.stripe_customer_id === customerId)) ?? null
    },
    async updateOrg(id, patch) { Object.assign(orgs.get(id)!, patch) },
    async syncEntitlements(id) { synced.push(id) },
    async upsertInvoice(row) { invoices.set(row.stripe_invoice_id, { ...invoices.get(row.stripe_invoice_id), ...row }) },
    async logActivity() {},
  }
  const balance = (user: string) => ledger.filter(l => l.user === user).reduce((s, l) => s + l.delta, 0)
  return { store, orgs, invoices, synced, balance }
}

const ev = (type: string, object: Record<string, unknown>): StripeEvent => ({ id: `evt_${type}`, type, livemode: false, data: { object } })

describe('webhook Stripe', () => {
  // Stripe simulé : renvoie les objets qu'on lui donne.
  const fakeStripe = (objects: Record<string, unknown>): StripeCall =>
    (async (_m: string, p: string) => {
      if (p in objects) return objects[p]
      throw new Error(`inconnu ${p}`)
    }) as StripeCall

  const session = {
    id: 'cs_1', mode: 'payment', payment_status: 'paid', client_reference_id: 'user-1', payment_intent: 'pi_1',
    amount_total: 699, currency: 'eur', livemode: false,
    metadata: { kind: 'credits', pack: 'credits_150', credits: '99999', user_id: 'user-1' },
  }

  test('achat : crédité une seule fois, avec le nombre de crédits de la config (pas des métadonnées)', async () => {
    const m = memoryStore()
    const stripe = fakeStripe({ '/v1/payment_intents/pi_1': { latest_charge: { payment_method_details: { type: 'card' } } } })
    expect(await handleStripeEvent(ev('checkout.session.completed', session), { store: m.store, stripe })).toBe('+150 crédits')
    expect(await handleStripeEvent(ev('checkout.session.completed', session), { store: m.store, stripe })).toBe('déjà crédité')
    expect(m.balance('user-1')).toBe(150)
  })

  test('paiement différé : crédité seulement au succès', async () => {
    const m = memoryStore()
    const stripe = fakeStripe({})
    await handleStripeEvent(ev('checkout.session.completed', { ...session, payment_status: 'unpaid' }), { store: m.store, stripe })
    expect(m.balance('user-1')).toBe(0)
    await handleStripeEvent(ev('checkout.session.async_payment_succeeded', session), { store: m.store, stripe })
    expect(m.balance('user-1')).toBe(150)
  })

  test('pack inconnu : erreur (Stripe renverra l’événement), rien de crédité', async () => {
    const m = memoryStore()
    await expect(handleStripeEvent(ev('checkout.session.completed', { ...session, metadata: { ...session.metadata, pack: 'credits_9999' } }), { store: m.store, stripe: fakeStripe({}) })).rejects.toThrow()
    expect(m.balance('user-1')).toBe(0)
  })

  test('remboursement : écriture négative, une seule fois', async () => {
    const m = memoryStore()
    const stripe = fakeStripe({})
    await handleStripeEvent(ev('checkout.session.completed', session), { store: m.store, stripe })
    const charge = { payment_intent: 'pi_1', amount_refunded: 699 }
    expect(await handleStripeEvent(ev('charge.refunded', charge), { store: m.store, stripe })).toBe('−150 crédits')
    expect(await handleStripeEvent(ev('charge.refunded', charge), { store: m.store, stripe })).toBe('−0 crédits')
    expect(m.balance('user-1')).toBe(0)
    expect(await handleStripeEvent(ev('charge.refunded', { payment_intent: 'pi_facture', amount_refunded: 100 }), { store: m.store, stripe })).toBe('ignoré (pas un achat de crédits)')
  })

  test('Business : abonnement actif puis impayé, droits et sièges suivis', async () => {
    const m = memoryStore()
    m.orgs.set('org-1', { id: 'org-1', name: 'Dupont', stripe_customer_id: 'cus_1', stripe_subscription_id: null, subscription_status: null, seat_quantity: null, pro_access_until: null })
    const sub = { id: 'sub_1', customer: 'cus_1', status: 'active', metadata: { org_id: 'org-1' }, current_period_end: 1_796_083_200, items: { data: [{ quantity: 4, price: { unit_amount: 3900 } }] } }
    const now = () => new Date('2026-11-10T12:00:00Z')
    let stripe = fakeStripe({ '/v1/subscriptions/sub_1': sub })
    await handleStripeEvent(ev('customer.subscription.created', sub), { store: m.store, stripe, now })
    expect(m.orgs.get('org-1')).toMatchObject({ stripe_subscription_id: 'sub_1', subscription_status: 'active', seat_quantity: 4, pro_access_until: '2026-12-15' })
    expect(m.synced).toEqual(['org-1'])

    const invoice = { id: 'in_1', customer: 'cus_1', subscription: 'sub_1', status: 'open', number: 'TIROIR-0001', amount_due: 15600, livemode: false, created: 1_793_000_000 }
    stripe = fakeStripe({ '/v1/subscriptions/sub_1': sub, '/v1/invoices/in_1': invoice })
    await handleStripeEvent(ev('invoice.payment_failed', invoice), { store: m.store, stripe, now })
    expect(m.orgs.get('org-1')?.pro_access_until).toBe('2026-11-24')
    expect(m.invoices.get('in_1')).toMatchObject({ number: 'TIROIR-0001', org_id: 'org-1', status: 'open' })

    const paid = { ...invoice, status: 'paid', amount_paid: 15600, charge: 'ch_1', status_transitions: { paid_at: 1_793_500_000 } }
    stripe = fakeStripe({ '/v1/subscriptions/sub_1': sub, '/v1/invoices/in_1': paid, '/v1/charges/ch_1': { payment_method_details: { type: 'sepa_debit' } } })
    await handleStripeEvent(ev('invoice.paid', paid), { store: m.store, stripe, now })
    expect(m.invoices.get('in_1')).toMatchObject({ status: 'paid', payment_method: 'sepa_debit' })
    expect(m.orgs.get('org-1')?.pro_access_until).toBe('2026-12-15')
  })

  test('Business : la fin d’un ancien abonnement n’écrase pas le nouveau', async () => {
    const m = memoryStore()
    m.orgs.set('org-1', { id: 'org-1', name: 'Dupont', stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_new', subscription_status: 'active', seat_quantity: 2, pro_access_until: '2026-12-15' })
    const old = { id: 'sub_old', customer: 'cus_1', status: 'canceled', metadata: { org_id: 'org-1' }, items: { data: [] } }
    expect(await handleStripeEvent(ev('customer.subscription.deleted', old), { store: m.store, stripe: fakeStripe({}) })).toBe('ignoré (ancien abonnement)')
    expect(m.orgs.get('org-1')?.pro_access_until).toBe('2026-12-15')
  })

  test('événement non géré : ignoré', async () => {
    expect(await handleStripeEvent(ev('customer.created', {}), { store: memoryStore().store, stripe: fakeStripe({}) })).toBe('ignoré')
  })
})

describe('revenus', () => {
  const now = new Date('2026-11-01T00:00:00Z')
  const purchase = (paid_at: string, amount: number, refunded = 0): CreditPurchaseRow => ({
    paid_at, customer_email: 'a@x.fr', pack: 'credits_150', credits: 150, amount_total: amount, amount_refunded: refunded, payment_method: 'card', status: refunded ? 'refunded' : 'paid',
  })

  test('MRR : sièges facturés des abonnements vivants', () => {
    expect(businessMrr([
      { name: 'A', subscription_status: 'active', seat_quantity: 3, seat_unit_amount: 3900 },
      { name: 'B', subscription_status: 'past_due', seat_quantity: 1, seat_unit_amount: 3900 },
      { name: 'C', subscription_status: 'canceled', seat_quantity: 10, seat_unit_amount: 3900 },
    ])).toBe(4 * 3900)
  })

  test('projection jusqu’à Noël', () => {
    expect(nextChristmas(now).toISOString().slice(0, 10)).toBe('2026-12-25')
    expect(nextChristmas(new Date('2026-12-26T00:00:00Z')).toISOString().slice(0, 10)).toBe('2027-12-25')
    const p = projectRevenue({
      now, target: new Date('2026-12-01T00:00:00Z'), mrr: 11700,
      // 30 € nets sur les 30 derniers jours (le premier achat date de 30 jours).
      purchases: [purchase('2026-10-02T00:00:00Z', 2000), purchase('2026-10-20T00:00:00Z', 1500, 500), purchase('2025-01-01T00:00:00Z', 99999)],
      invoices: [{ org_name: 'A', number: '1', status: 'open', amount_due: 11700, amount_paid: 0, amount_remaining: 11700, seats: 3, created_at: '2026-10-01', due_date: '2026-10-31', paid_at: null, payment_method: null }],
    })
    expect(p.days).toBe(30)
    expect(p.credits).toBe(3000)
    expect(p.business).toBe(Math.round(11700 * 30 / (365.25 / 12)))
    expect(p.outstanding).toBe(11700)
    expect(p.total).toBe(p.business + p.credits + p.outstanding)
  })

  test('projection : abonnements réels prolongés ; crédits jamais sur moins de 30 jours', () => {
    // Trois achats ce jour-ci (12,97 €) : prolongés tels quels sur 30 jours,
    // ils promettaient 389,10 € ; au rythme de 30 jours, 12,97 €.
    const p = projectRevenue({
      now, target: new Date('2026-12-01T00:00:00Z'), mrr: 0, subscriptionsMrr: 6500,
      purchases: [purchase(now.toISOString(), 699), purchase(now.toISOString(), 299), purchase(now.toISOString(), 299)],
      invoices: [],
    })
    expect(p.days).toBe(30)
    expect(p.credits).toBe(Math.round(1297 / 30 * 30))
    expect(p.subscriptions).toBe(Math.round(6500 * 30 / (365.25 / 12)))
    expect(p.total).toBe(p.subscriptions + p.credits)
  })

  test('qui facture qui : crédits nets et factures, le plus récent d’abord', () => {
    const lines = billingLines([purchase('2026-10-02T00:00:00Z', 699, 699)], [
      { org_name: 'Dupont', number: 'TIROIR-0002', status: 'paid', amount_due: 7800, amount_paid: 7800, amount_remaining: 0, seats: 2, created_at: '2026-10-01T00:00:00Z', due_date: null, paid_at: '2026-10-15T00:00:00Z', payment_method: 'customer_balance' },
      { org_name: 'Dupont', number: null, status: 'draft', amount_due: 7800, amount_paid: 0, amount_remaining: 7800, seats: 2, created_at: '2026-10-30T00:00:00Z', due_date: null, paid_at: null, payment_method: null },
    ])
    expect(lines.map(l => [l.client, l.amount, l.status])).toEqual([
      ['Dupont', 7800, 'payée'],
      ['a@x.fr', 0, 'remboursé'],
    ])
    expect(lines[0].what).toBe('Business · 2 sièges · TIROIR-0002')
  })
})

describe('vente de crédits', () => {
  test('fermée tant que STRIPE_CREDITS_OPEN=1 n’est pas posé, même avec Stripe configuré', async () => {
    const { creditsSaleOpen } = await import('../lib/stripeConfig')
    const stripe = { STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_MODE: 'test' }
    expect(creditsSaleOpen(stripe)).toBe(false)
    expect(creditsSaleOpen({ ...stripe, STRIPE_CREDITS_OPEN: '1' })).toBe(true)
    expect(creditsSaleOpen({ STRIPE_CREDITS_OPEN: '1' })).toBe(false)
  })
})
