// Tunnel d'abonnement du site : tarifs → compte → Stripe Checkout →
// confirmation (ou retour aux tarifs si le paiement est abandonné).
// L'offre choisie voyage dans l'adresse, en clair et en français :
//   /abonnement?offre=premium&periode=annuel
// Module sans dépendance, testable.
import { periodsFor, subscriptionPlanFor, type BillingPeriod, type PlanTier, type SubscriptionPlan } from './stripeConfig'

const PERIOD_PARAM: Record<BillingPeriod, string> = { monthly: 'mensuel', yearly: 'annuel' }

export type Offer = { tier: PlanTier; period: BillingPeriod }

/** Offre lue dans l'adresse (?offre=premium&periode=annuel), ou null si elle n'est pas vendue. */
export function offerFromQuery(query: Record<string, unknown>): (Offer & { plan: SubscriptionPlan }) | null {
  const tier = query.offre
  if (tier !== 'premium' && tier !== 'pro') return null
  const raw = query.periode
  const period: BillingPeriod = raw === 'annuel' ? 'yearly' : 'monthly'
  // Une période qui n'existe pas pour ce palier (Pro annuel) : la première vendue.
  const chosen = periodsFor(tier).includes(period) ? period : periodsFor(tier)[0]
  const plan = subscriptionPlanFor(tier, chosen)
  return plan ? { tier, period: chosen, plan } : null
}

function offerQuery(tier: PlanTier, period: BillingPeriod): string {
  return `offre=${tier}&periode=${PERIOD_PARAM[period]}`
}

/** Étape 2 du tunnel : récapitulatif, puis paiement. */
export function subscribePath(tier: PlanTier, period: BillingPeriod): string {
  return `/abonnement?${offerQuery(tier, period)}`
}

/** Retours de Stripe Checkout (chemins sans préfixe de langue). */
export function checkoutReturnPaths(tier: PlanTier, period: BillingPeriod): { success: string; cancel: string } {
  return {
    success: `/abonnement/merci?${offerQuery(tier, period)}&session_id={CHECKOUT_SESSION_ID}`,
    // Sans ancre : la page défile elle-même jusqu'aux formules.
    cancel: `/pricing?${offerQuery(tier, period)}&paiement=annule`,
  }
}

/** Offre portée par un retour après connexion (?next=/abonnement?offre=…), ou null. */
export function offerFromNext(next: string | null | undefined) {
  if (!next) return null
  const [path, query = ''] = next.split('#')[0].split('?')
  if (path !== '/abonnement') return null
  return offerFromQuery(Object.fromEntries(new URLSearchParams(query)))
}
