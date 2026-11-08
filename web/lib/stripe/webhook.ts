// Traitement des événements Stripe reçus par /api/stripe/webhook.
//
// Chaque traitement est idempotent : Stripe peut renvoyer un événement,
// ou les envoyer dans le désordre. La base porte les garde-fous (référence
// unique par achat, reprise cumulée par remboursement) ; la route API, en
// plus, ne traite qu'une fois chaque événement (table stripe_events).
//
// La base est derrière BillingStore : la route passe l'implémentation
// Supabase (supabaseBillingStore), les tests une implémentation en mémoire.
import type { SupabaseClient } from '@supabase/supabase-js'
import { packByKey } from '../stripeConfig'
import type { Params, StripeCall } from './api'
import {
  accessUntil, idOf, invoiceOrgId, invoiceRow, invoiceSubscriptionId, subscriptionSnapshot,
  type InvoiceRow, type SubscriptionSnapshot,
} from './business'
import {
  SUBSCRIPTION_EXPAND, individualInvoiceChanged, isIndividualInvoice, individualSubscriptionChanged, subscriptionCheckoutCompleted, type SubscriberStore,
} from './subscriptions'

export type StripeEvent = { id: string; type: string; livemode: boolean; data: { object: Record<string, unknown> } }

export type OrgRow = {
  id: string
  name: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  subscription_status: string | null
  seat_quantity: number | null
  pro_access_until: string | null
}

export type OrgPatch = Partial<{
  stripe_customer_id: string
  stripe_subscription_id: string
  subscription_status: string | null
  seat_quantity: number | null
  seat_unit_amount: number | null
  current_period_end: string | null
  pro_access_until: string | null
  livemode: boolean
}>

export interface BillingStore {
  recordCreditPurchase(p: {
    sessionId: string; paymentIntent: string | null; userId: string; email: string | null
    pack: string; credits: number; amountTotal: number; currency: string; paymentMethod: string | null; livemode: boolean
  }): Promise<boolean>
  reverseCreditPurchase(paymentIntent: string, amountRefunded: number): Promise<number | null>
  findOrg(by: { orgId?: string | null; subscriptionId?: string | null; customerId?: string | null }): Promise<OrgRow | null>
  updateOrg(orgId: string, patch: OrgPatch): Promise<void>
  syncEntitlements(orgId: string): Promise<void>
  upsertInvoice(row: InvoiceRow & { org_id: string | null; payment_method: string | null }): Promise<void>
  logActivity(userId: string, action: string, payload: Record<string, unknown>): Promise<void>
}

/** `subscribers` : abonnements Premium et Pro des particuliers (lib/stripe/subscriptions.ts). */
export type WebhookDeps = { store: BillingStore; stripe: StripeCall; subscribers?: SubscriberStore; now?: () => Date }

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {})
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)

/** Type du moyen de paiement d'une charge (« card », « sepa_debit »…), sans jamais échouer. */
async function chargePaymentMethod(stripe: StripeCall, charge: unknown): Promise<string | null> {
  try {
    const c = typeof charge === 'string' ? await stripe('GET', `/v1/charges/${charge}`) : obj(charge)
    return str(obj(c.payment_method_details).type)
  } catch {
    return null
  }
}

/** Version actuelle d'un objet Stripe ; à défaut, celle de l'événement. */
async function fresh(stripe: StripeCall, path: string, o: Record<string, unknown>, params?: Params): Promise<Record<string, unknown>> {
  const id = str(o.id)
  if (!id) return o
  try {
    return await stripe('GET', `${path}${id}`, params)
  } catch {
    return o
  }
}

export async function handleStripeEvent(event: StripeEvent, deps: WebhookDeps): Promise<string> {
  const o = event.data.object
  const { subscribers } = deps
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      // Abonnement Premium / Pro d'un particulier : rattaché au compte.
      if (o.mode === 'subscription' && obj(o.metadata).kind === 'subscription' && subscribers) {
        return subscriptionCheckoutCompleted(o, { subscribers, stripe: deps.stripe })
      }
      return creditPurchase(o, deps)
    case 'charge.refunded':
      return refund(o, deps)
    // Abonnements et factures : on relit l'état actuel chez Stripe, pour
    // qu'un événement arrivé en retard n'écrase pas un état plus récent.
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const current = await fresh(deps.stripe, '/v1/subscriptions/', o, SUBSCRIPTION_EXPAND)
      if (subscribers) {
        const outcome = await individualSubscriptionChanged(current, { subscribers, stripe: deps.stripe })
        if (outcome !== null) return outcome
      }
      return subscriptionChanged(subscriptionSnapshot(current), deps)
    }
    case 'invoice.paid':
    case 'invoice.payment_failed': {
      const invoice = await fresh(deps.stripe, '/v1/invoices/', o)
      if (subscribers) {
        const outcome = await individualInvoiceChanged(event.type, invoice, invoiceSubscriptionId(invoice), { subscribers, stripe: deps.stripe })
        if (outcome !== null) return outcome
      }
      return invoiceChanged(event.type, invoice, deps)
    }
    case 'invoice.finalized':
    case 'invoice.voided':
    case 'invoice.marked_uncollectible': {
      const invoice = await fresh(deps.stripe, '/v1/invoices/', o)
      // Facture d'un abonnement de particulier : Stripe l'envoie lui-même ;
      // rien à noter côté Business (billing_invoices ne suit que les
      // organisations).
      if (subscribers && await isIndividualInvoice(invoiceSubscriptionId(invoice), deps.stripe)) {
        return 'ignoré (facture d’un particulier)'
      }
      return invoiceChanged(event.type, invoice, deps)
    }
    default:
      return 'ignoré'
  }
}

// ── Crédits ───────────────────────────────────────────────────────
async function creditPurchase(session: Record<string, unknown>, { store, stripe }: WebhookDeps): Promise<string> {
  const meta = obj(session.metadata)
  if (session.mode !== 'payment' || meta.kind !== 'credits') return 'ignoré (pas un achat de crédits)'
  // Moyen de paiement différé (SEPA…) : on crédite à
  // checkout.session.async_payment_succeeded.
  if (session.payment_status !== 'paid') return 'en attente du paiement'

  const pack = packByKey(meta.pack)
  const userId = str(session.client_reference_id) ?? str(meta.user_id)
  const sessionId = str(session.id)
  if (!pack || !userId || !sessionId) throw new Error(`Session ${sessionId ?? '?'} incomplète (pack ou compte manquant)`)

  const paymentIntent = idOf(session.payment_intent)
  let paymentMethod: string | null = null
  if (paymentIntent) {
    try {
      const pi = await stripe('GET', `/v1/payment_intents/${paymentIntent}`)
      paymentMethod = await chargePaymentMethod(stripe, pi.latest_charge)
    } catch { /* moyen de paiement : information de confort */ }
  }

  // Le nombre de crédits vient de NOTRE config, jamais des métadonnées.
  const credited = await store.recordCreditPurchase({
    sessionId,
    paymentIntent,
    userId,
    email: str(obj(session.customer_details).email) ?? str(session.customer_email),
    pack: pack.key,
    credits: pack.credits,
    amountTotal: typeof session.amount_total === 'number' ? session.amount_total : pack.amount,
    currency: str(session.currency) ?? 'eur',
    paymentMethod,
    livemode: session.livemode === true,
  })
  if (credited) {
    await store.logActivity(userId, 'purchase.credits', { credits: pack.credits, pack: pack.key, store: 'stripe' })
    return `+${pack.credits} crédits`
  }
  return 'déjà crédité'
}

async function refund(charge: Record<string, unknown>, { store }: WebhookDeps): Promise<string> {
  const paymentIntent = idOf(charge.payment_intent)
  if (!paymentIntent) return 'ignoré (sans paiement)'
  const amountRefunded = typeof charge.amount_refunded === 'number' ? charge.amount_refunded : 0
  const reversed = await store.reverseCreditPurchase(paymentIntent, amountRefunded)
  if (reversed === null) return 'ignoré (pas un achat de crédits)'
  return `−${reversed} crédits`
}

// ── Business ──────────────────────────────────────────────────────
async function subscriptionChanged(sub: SubscriptionSnapshot, { store, now }: WebhookDeps): Promise<string> {
  const org = await store.findOrg({ orgId: sub.orgId, subscriptionId: sub.id, customerId: sub.customerId })
  if (!org) return 'ignoré (aucune organisation)'
  // La fin d'un ancien abonnement de l'organisation n'écrase pas le
  // courant. Un nouvel abonnement vivant, lui, le remplace (son webhook
  // peut arriver avant que le back-office n'ait enregistré son id).
  const ended = !['active', 'trialing', 'past_due', 'incomplete'].includes(sub.status ?? '')
  if (ended && org.stripe_subscription_id && org.stripe_subscription_id !== sub.id) return 'ignoré (ancien abonnement)'

  const until = accessUntil({ status: sub.status, periodEnd: sub.periodEnd, previous: org.pro_access_until, now: (now ?? (() => new Date()))() })
  await store.updateOrg(org.id, {
    stripe_subscription_id: sub.id,
    ...(sub.customerId ? { stripe_customer_id: sub.customerId } : {}),
    subscription_status: sub.status,
    seat_quantity: sub.quantity,
    seat_unit_amount: sub.unitAmount,
    current_period_end: sub.periodEnd ? sub.periodEnd.toISOString() : null,
    pro_access_until: until,
    livemode: sub.livemode,
  })
  await store.syncEntitlements(org.id)
  return `organisation ${org.id} : ${sub.status}, droits jusqu'au ${until ?? '—'}`
}

async function invoiceChanged(type: string, invoice: Record<string, unknown>, deps: WebhookDeps): Promise<string> {
  const { store, stripe } = deps
  const subscriptionId = invoiceSubscriptionId(invoice)
  const org = await store.findOrg({ orgId: invoiceOrgId(invoice), subscriptionId, customerId: idOf(invoice.customer) })
  if (!org) return 'ignoré (aucune organisation)'

  const row = invoiceRow(invoice)
  let paymentMethod: string | null = null
  if (type === 'invoice.paid') {
    paymentMethod = invoice.paid_out_of_band === true ? 'out_of_band' : await chargePaymentMethod(stripe, invoice.charge ?? null)
  }
  await store.upsertInvoice({ ...row, org_id: org.id, payment_method: paymentMethod })

  // Payée : on relit l'abonnement (période suivante) ; impayée : la grâce
  // commence.
  if (type === 'invoice.paid' && subscriptionId) {
    const sub = await stripe('GET', `/v1/subscriptions/${subscriptionId}`)
    await subscriptionChanged(subscriptionSnapshot(sub), deps)
  } else if (type === 'invoice.payment_failed') {
    const until = accessUntil({ status: 'past_due', periodEnd: null, previous: org.pro_access_until, now: (deps.now ?? (() => new Date()))() })
    await store.updateOrg(org.id, { pro_access_until: until })
    await store.syncEntitlements(org.id)
  }
  return `facture ${row.number ?? row.stripe_invoice_id} : ${row.status}`
}

// ── Implémentation Supabase (clé service) ─────────────────────────
export function supabaseBillingStore(db: SupabaseClient): BillingStore {
  const fail = (what: string, error: { message: string } | null) => {
    if (error) throw new Error(`${what} : ${error.message}`)
  }
  const ORG_COLUMNS = 'id, name, stripe_customer_id, stripe_subscription_id, subscription_status, seat_quantity, pro_access_until'
  return {
    async recordCreditPurchase(p) {
      const { data, error } = await db.rpc('record_stripe_credit_purchase', {
        p_session_id: p.sessionId, p_payment_intent: p.paymentIntent, p_user_id: p.userId, p_email: p.email,
        p_pack: p.pack, p_credits: p.credits, p_amount_total: p.amountTotal, p_currency: p.currency,
        p_payment_method: p.paymentMethod, p_livemode: p.livemode,
      })
      fail('record_stripe_credit_purchase', error)
      return data === true
    },
    async reverseCreditPurchase(paymentIntent, amountRefunded) {
      const { data, error } = await db.rpc('reverse_stripe_credit_purchase', { p_payment_intent: paymentIntent, p_amount_refunded: amountRefunded })
      fail('reverse_stripe_credit_purchase', error)
      return typeof data === 'number' ? data : null
    },
    async findOrg({ orgId, subscriptionId, customerId }) {
      for (const [column, value] of [['id', orgId], ['stripe_subscription_id', subscriptionId], ['stripe_customer_id', customerId]] as const) {
        if (!value) continue
        const { data, error } = await db.from('organizations').select(ORG_COLUMNS).eq(column, value).maybeSingle()
        // Formule Business pas encore installée (business_billing.sql) :
        // aucune organisation, ce n'est pas une erreur.
        if (error && (error.code === 'PGRST205' || error.code === '42P01')) return null
        fail('organizations', error)
        if (data) return data as OrgRow
      }
      return null
    },
    async updateOrg(orgId, patch) {
      const { error } = await db.from('organizations').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', orgId)
      fail('organizations', error)
    },
    async syncEntitlements(orgId) {
      const { error } = await db.rpc('sync_org_entitlements', { p_org_id: orgId })
      fail('sync_org_entitlements', error)
    },
    async upsertInvoice(row) {
      // Un moyen de paiement déjà connu n'est pas effacé par un événement
      // qui ne le porte pas.
      const { payment_method, ...rest } = row
      const { error } = await db.from('billing_invoices')
        .upsert({ ...rest, ...(payment_method ? { payment_method } : {}), updated_at: new Date().toISOString() }, { onConflict: 'stripe_invoice_id' })
      fail('billing_invoices', error)
    },
    async logActivity(userId, action, payload) {
      const { error } = await db.from('activity_log').insert({ user_id: userId, action, payload })
      if (error) console.warn('[stripe-webhook] activity_log', error.message)
    },
  }
}
