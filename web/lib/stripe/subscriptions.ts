// Abonnements Premium et Pro des particuliers, vendus sur le site par
// Stripe Checkout : lecture des objets Stripe et traitement des
// événements du webhook. Le palier du compte n'est changé QUE par ici
// (règle d'or : la page de confirmation n'active jamais rien).
//
// Le palier vient du prix de l'abonnement (identifiant posé dans
// l'environnement, ou lookup_key → config du serveur), jamais des
// métadonnées. L'état appliqué est toujours celui
// relu chez Stripe : rejouer un événement, ou les recevoir dans le
// désordre, donne le même résultat. La base garde les règles (ne pas
// retirer un palier venu de l'app ou d'une facture) :
// apply_stripe_subscription, supabase/drafts/stripe_subscriptions.sql.
//
// La base est derrière SubscriberStore : la route passe l'implémentation
// Supabase, les tests une implémentation en mémoire.
import type { SupabaseClient } from '@supabase/supabase-js'
import { planByPrice, type BillingPeriod, type PlanTier } from '../stripeConfig'
import type { StripeCall } from './api'
import { fromEpoch, idOf } from './business'

type Obj = Record<string, unknown>
const obj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {})
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)

/** Statuts Stripe qui donnent accès au palier payant (past_due : en retard, accès gardé). */
export const LIVE_STATUSES = ['active', 'trialing', 'past_due'] as const

export type IndividualSubscription = {
  id: string
  customerId: string | null
  /** Compte Tiroir, posé en métadonnée par /api/stripe/subscription. */
  userId: string | null
  tier: PlanTier
  period: BillingPeriod | null
  status: string
  periodEnd: Date | null
  cancelAtPeriodEnd: boolean
  livemode: boolean
}

/**
 * Abonnement d'un particulier, ou null si ce n'est pas un des nôtres
 * (Business, autre produit) : le prix doit être un prix de la grille.
 */
export function individualSubscription(sub: unknown): IndividualSubscription | null {
  const s = obj(sub)
  const item = obj((obj(s.items).data as unknown[] | undefined)?.[0])
  const price = obj(item.price)
  const known = planByPrice(price)
  const tier = known?.tier ?? archivedTier(price)
  const interval = str(obj(price.recurring).interval)
  const period: BillingPeriod | null = known?.period ?? (interval === 'year' ? 'yearly' : interval === 'month' ? 'monthly' : null)
  const id = str(s.id)
  if (!tier || !id) return null
  return {
    id,
    customerId: idOf(s.customer),
    userId: str(obj(s.metadata).user_id),
    tier,
    period,
    status: str(s.status) ?? 'incomplete',
    // Depuis 2025, la période vit sur l'élément d'abonnement.
    periodEnd: fromEpoch(s.current_period_end) ?? fromEpoch(item.current_period_end),
    cancelAtPeriodEnd: s.cancel_at_period_end === true || typeof s.cancel_at === 'number',
    livemode: s.livemode === true,
  }
}

/**
 * Palier d'un prix archivé (ancien tarif, gardé par les abonnés en cours) :
 * sa lookup_key est passée au nouveau prix, mais le prix et son produit
 * portent la métadonnée `tier` posée par scripts/stripe-setup.mjs.
 */
function archivedTier(price: Obj): PlanTier | null {
  const t = str(obj(price.metadata).tier) ?? str(obj(obj(price.product).metadata).tier)
  return t === 'premium' || t === 'pro' ? t : null
}

/** Abonnement relu chez Stripe, produit du prix développé (prix archivés). */
export const SUBSCRIPTION_EXPAND = { expand: ['items.data.price.product'] }

export interface SubscriberStore {
  /** Compte d'un abonnement : par id d'abonnement, puis par client Stripe. */
  findUser(by: { subscriptionId?: string | null; customerId?: string | null }): Promise<string | null>
  /** apply_stripe_subscription : renvoie ce qui a été fait. */
  apply(userId: string, sub: IndividualSubscription): Promise<string>
  logActivity(userId: string, action: string, payload: Record<string, unknown>): Promise<void>
}

export type SubscriptionDeps = { subscribers: SubscriberStore; stripe: StripeCall }

async function readSubscription(stripe: StripeCall, id: string): Promise<unknown> {
  return stripe('GET', `/v1/subscriptions/${id}`, SUBSCRIPTION_EXPAND)
}

async function apply(sub: IndividualSubscription, hint: string | null, { subscribers }: SubscriptionDeps): Promise<string> {
  const userId = sub.userId ?? hint ?? await subscribers.findUser({ subscriptionId: sub.id, customerId: sub.customerId })
  if (!userId) throw new Error(`Abonnement ${sub.id} sans compte Tiroir`)
  return subscribers.apply(userId, sub)
}

/** La facture appartient-elle à un abonnement de particulier (Premium, Pro) ? */
export async function isIndividualInvoice(subscriptionId: string | null, stripe: StripeCall): Promise<boolean> {
  if (!subscriptionId) return false
  try {
    return individualSubscription(await readSubscription(stripe, subscriptionId)) !== null
  } catch {
    return false
  }
}

/** checkout.session.completed en mode subscription : rattacher l'abonnement au compte. */
export async function subscriptionCheckoutCompleted(session: Obj, deps: SubscriptionDeps): Promise<string> {
  const subscriptionId = idOf(session.subscription)
  if (!subscriptionId) return 'ignoré (session sans abonnement)'
  const sub = individualSubscription(await readSubscription(deps.stripe, subscriptionId))
  if (!sub) return 'ignoré (abonnement hors grille)'
  const userId = str(session.client_reference_id) ?? str(obj(session.metadata).user_id)
  const outcome = await apply(sub, userId, deps)
  if (userId ?? sub.userId) {
    await deps.subscribers.logActivity((userId ?? sub.userId)!, 'purchase.completed', { tier: sub.tier, store: 'stripe', subscription: sub.id })
  }
  return outcome
}

/** customer.subscription.* : état actuel relu chez Stripe, puis appliqué. Null : pas un abonnement de particulier. */
export async function individualSubscriptionChanged(current: unknown, deps: SubscriptionDeps): Promise<string | null> {
  const sub = individualSubscription(current)
  if (!sub) return null
  return apply(sub, null, deps)
}

/**
 * invoice.paid (période suivante payée : accès prolongé) et
 * invoice.payment_failed (en retard, accès gardé). Null : la facture
 * n'est pas celle d'un abonnement de particulier.
 */
export async function individualInvoiceChanged(type: string, invoice: Obj, subscriptionId: string | null, deps: SubscriptionDeps): Promise<string | null> {
  if (!subscriptionId) return null
  const sub = individualSubscription(await readSubscription(deps.stripe, subscriptionId))
  if (!sub) return null
  // Échec de paiement : Stripe passe l'abonnement en past_due ; si
  // l'événement arrive avant, on le note nous-mêmes — sauf si la facture,
  // relue, est déjà payée (événements dans le désordre).
  if (type === 'invoice.payment_failed' && sub.status === 'active' && invoice.status !== 'paid') {
    sub.status = 'past_due'
  }
  const outcome = await apply(sub, null, deps)
  if (type === 'invoice.paid' && invoice.billing_reason === 'subscription_cycle') {
    const userId = sub.userId ?? await deps.subscribers.findUser({ subscriptionId: sub.id, customerId: sub.customerId })
    if (userId) await deps.subscribers.logActivity(userId, 'purchase.renewed', { tier: sub.tier, store: 'stripe', subscription: sub.id })
  }
  return outcome
}

// ── Implémentation Supabase (clé service) ─────────────────────────
export function supabaseSubscriberStore(db: SupabaseClient): SubscriberStore {
  return {
    async findUser({ subscriptionId, customerId }) {
      for (const [column, value] of [['stripe_subscription_id', subscriptionId], ['stripe_customer_id', customerId]] as const) {
        if (!value) continue
        const { data, error } = await db.from('profiles').select('id').eq(column, value).maybeSingle()
        if (error) throw new Error(`profiles : ${error.message}`)
        if (data) return (data as { id: string }).id
      }
      return null
    },
    async apply(userId, sub) {
      const { data, error } = await db.rpc('apply_stripe_subscription', {
        p_user_id: userId,
        p_customer_id: sub.customerId,
        p_subscription_id: sub.id,
        p_plan: sub.tier,
        p_status: sub.status,
        p_period_end: sub.periodEnd ? sub.periodEnd.toISOString() : null,
        p_cancel_at_period_end: sub.cancelAtPeriodEnd,
        p_livemode: sub.livemode,
        p_period: sub.period,
      })
      if (error) throw new Error(`apply_stripe_subscription : ${error.message}`)
      return String(data)
    },
    async logActivity(userId, action, payload) {
      const { error } = await db.from('activity_log').insert({ user_id: userId, action, payload })
      if (error) console.warn('[stripe-webhook] activity_log', error.message)
    },
  }
}
