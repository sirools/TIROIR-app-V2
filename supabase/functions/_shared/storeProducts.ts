// Produits vendus dans les stores (App Store, Google Play), via RevenueCat.
// Grille V4 figée le 19/10/2026 (strategie/offres.md) ; identifiants créés
// selon strategie/packs-stores.md, et les mêmes que
// mobile/src/lib/creditPacks.ts (un test le vérifie).
//
// Module sans autre dépendance que subscriptionEnd.ts : importé par le
// webhook RevenueCat (Deno) et par les tests du site (vitest).
import { endsAccess } from './subscriptionEnd.ts'

/** Packs de crédits (consommables) : identifiant → crédits accordés. */
export const CREDIT_PACKS: Record<string, number> = {
  tiroir_credits_50: 50,
  tiroir_credits_150: 150,
  tiroir_credits_500: 500,
  // Ancienne grille, retirée de la vente : reconnue pour les achats passés.
  tiroir_credits_30: 30,
  tiroir_credits_80: 80,
}

/** Abonnements Pro : tout identifiant qui commence ainsi (tiroir_pro_monthly…). */
const PRO_PREFIX = 'tiroir_pro'

// Google Play peut suffixer l'identifiant (« tiroir_credits_50:… »).
const baseId = (productId: unknown): string | null =>
  typeof productId === 'string' && productId ? productId.split(':')[0] : null

export function creditsForProduct(productId: unknown): number | null {
  const id = baseId(productId)
  return id ? CREDIT_PACKS[id] ?? null : null
}

export type StoreTier = 'premium' | 'pro'

/** Palier qu'ouvre un abonnement des stores (null pour un pack ou un inconnu). */
export function tierForProduct(productId: unknown): StoreTier | null {
  const id = baseId(productId)
  if (!id || id in CREDIT_PACKS) return null
  return id.startsWith(PRO_PREFIX) ? 'pro' : 'premium'
}

// Événements RevenueCat : abonnement actif…
export const ACTIVE_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
  'TRANSFER',
])

// La fin de l'accès payant (EXPIRATION, remboursement) : endsAccess(),
// _shared/subscriptionEnd.ts. Une résiliation laisse l'accès jusqu'au bout
// de la période payée.

export type StoreEvent = {
  type: string
  product_id?: unknown
  new_product_id?: unknown
  expiration_at_ms?: unknown
}
export type CurrentProfile = {
  plan: string
  pro_since: string | null
  pro_expires_at: string | null
  /** Origine du palier payant : 'web' (Stripe, site) ou 'app' (stores). */
  plan_source?: string | null
  /** Statut Stripe de l'abonnement du site. */
  subscription_status?: string | null
}

/** Abonnement du site (Stripe) en cours : son palier ne regarde que Stripe. */
export const hasLiveWebSubscription = (p: CurrentProfile) =>
  p.plan_source === 'web' && ['active', 'trialing', 'past_due'].includes(p.subscription_status ?? '')

/** Pro sur facture encore en cours (posé et daté par le back-office). */
const isInvoicedPro = (p: CurrentProfile, today: string) =>
  p.plan === 'pro' && !!p.pro_since && (!p.pro_expires_at || p.pro_expires_at >= today)

/**
 * Palier à écrire après un événement d'abonnement, ou null s'il ne faut
 * rien toucher.
 *
 * - Un client Pro sur facture en cours (pro_since posé par le back-office,
 *   période non échue) n'est jamais modifié par les stores.
 * - Un abonné du site (Stripe) en cours non plus : son palier ne suit que
 *   le webhook Stripe (apply_stripe_subscription).
 * - Changement de produit : c'est le nouveau produit qui compte.
 * - Fin de l'accès (endsAccess) : on ne retombe en gratuit que si c'est
 *   l'abonnement en cours qui s'arrête (la fin d'un Premium remplacé par un
 *   Pro ne coupe pas le Pro).
 */
export function nextPlan(
  event: StoreEvent,
  profile: CurrentProfile,
  today: string = new Date().toISOString().slice(0, 10),
): 'free' | StoreTier | null {
  if (isInvoicedPro(profile, today)) return null
  if (hasLiveWebSubscription(profile)) return null

  if (ACTIVE_EVENTS.has(event.type)) {
    const product = event.type === 'PRODUCT_CHANGE' ? event.new_product_id ?? event.product_id : event.product_id
    const tier = tierForProduct(product)
    if (!tier) return null
    // Un ancien Pro sur facture, échu, qui s'abonne au Pro des stores : on
    // réécrit le palier pour effacer ses dates de facture.
    const staleInvoice = tier === 'pro' && !!profile.pro_since
    return tier !== profile.plan || staleInvoice ? tier : null
  }

  if (endsAccess(event)) {
    const tier = tierForProduct(event.product_id)
    return tier && tier === profile.plan ? 'free' : null
  }

  return null
}

/** Ligne du journal public.subscriptions pour un événement RevenueCat, ou null. */
export type StoreSubscriptionRow = {
  source: 'apple' | 'google'
  external_id: string
  tier: StoreTier
  period: 'monthly' | 'yearly'
  status: 'active' | 'past_due' | 'expired'
  period_end: string | null
  cancel_at_period_end: boolean
}

export function storeSubscriptionRow(event: StoreEvent & {
  store?: unknown; original_transaction_id?: unknown; transaction_id?: unknown
}): StoreSubscriptionRow | null {
  const source = event.store === 'APP_STORE' || event.store === 'MAC_APP_STORE' ? 'apple'
    : event.store === 'PLAY_STORE' ? 'google' : null
  const product = event.type === 'PRODUCT_CHANGE' ? event.new_product_id ?? event.product_id : event.product_id
  const tier = tierForProduct(product)
  const id = event.original_transaction_id ?? event.transaction_id
  if (!source || !tier || (typeof id !== 'string' && typeof id !== 'number')) return null
  const status = ACTIVE_EVENTS.has(event.type) || event.type === 'CANCELLATION' ? 'active'
    : event.type === 'BILLING_ISSUE' ? 'past_due'
    : event.type === 'EXPIRATION' ? 'expired' : null
  if (!status) return null
  const ms = typeof event.expiration_at_ms === 'number' ? event.expiration_at_ms : null
  return {
    source,
    external_id: String(id),
    tier,
    period: /annual|yearly|year/.test(String(baseId(product))) ? 'yearly' : 'monthly',
    status,
    period_end: ms ? new Date(ms).toISOString() : null,
    cancel_at_period_end: event.type === 'CANCELLATION',
  }
}
