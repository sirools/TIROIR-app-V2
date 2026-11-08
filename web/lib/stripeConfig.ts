// Configuration Stripe : seule source des produits vendus sur le site, de
// leurs prix et des règles de facturation Business. Les prix viennent de
// OFFERS_V4 (lib/offers.ts) ; le script scripts/stripe-setup.mjs crée dans
// Stripe exactement ces produits, et le webhook ne crédite que ces packs.
//
// Pas d'identifiant Stripe (price_…) en dur : chaque prix porte une
// `lookup_key` stable, la même en mode test et en mode réel. Le site
// retrouve l'identifiant du compte Stripe auquel il parle (clé de test en
// préprod, clé réelle en prod) : impossible de mélanger les deux.
//
// Les clés restent dans l'environnement du serveur (stripeEnv) : jamais
// dans ce fichier, jamais côté navigateur.
//
// Module sans dépendance Next, testable.
import { OFFERS_V4 } from './offers'

/** Version d'API figée : la forme des objets reçus ne change pas sous nos pieds. */
export const STRIPE_API_VERSION = '2024-06-20'

export type CreditPack = {
  /** Clé interne, envoyée par la page d'achat et gardée dans l'achat. */
  key: string
  /** lookup_key du prix dans Stripe. */
  lookupKey: string
  credits: number
  /** Centimes TTC. */
  amount: number
}

export const CREDIT_PACKS: readonly CreditPack[] = OFFERS_V4.packs.map(p => ({
  key: `credits_${p.credits}`,
  lookupKey: `tiroir_web_credits_${p.credits}`,
  credits: p.credits,
  amount: Math.round(p.priceTtc * 100),
}))

export function packByKey(key: unknown): CreditPack | null {
  return CREDIT_PACKS.find(p => p.key === key) ?? null
}

/**
 * Abonnements des particuliers vendus sur le site (grille OFFERS_V4) :
 * Premium mensuel ou annuel, Pro mensuel. Un produit Stripe par palier,
 * un prix par période. Mêmes paliers que profiles.plan.
 */
export type PlanTier = 'premium' | 'pro'
export type BillingPeriod = 'monthly' | 'yearly'
export type SubscriptionPlan = {
  /** Clé interne. */
  key: string
  tier: PlanTier
  period: BillingPeriod
  lookupKey: string
  /** Centimes TTC par période. */
  amount: number
  interval: 'month' | 'year'
}

export const SUBSCRIPTION_PLANS: readonly SubscriptionPlan[] = [
  { key: 'premium_monthly', tier: 'premium', period: 'monthly', lookupKey: 'tiroir_web_premium_monthly', amount: Math.round(OFFERS_V4.premium.monthlyTtc * 100), interval: 'month' },
  { key: 'premium_yearly', tier: 'premium', period: 'yearly', lookupKey: 'tiroir_web_premium_yearly', amount: Math.round(OFFERS_V4.premium.yearlyTtc * 100), interval: 'year' },
  { key: 'pro_monthly', tier: 'pro', period: 'monthly', lookupKey: 'tiroir_web_pro_monthly', amount: Math.round(OFFERS_V4.pro.monthlyTtc * 100), interval: 'month' },
]

/** Offre demandée par la page (`premium` + `yearly`), ou null si elle n'est pas vendue. */
export function subscriptionPlanFor(tier: unknown, period: unknown): SubscriptionPlan | null {
  return SUBSCRIPTION_PLANS.find(p => p.tier === tier && p.period === period) ?? null
}

/** Palier d'un prix Stripe, retrouvé par sa lookup_key (jamais par les métadonnées). */
export function planByLookupKey(lookupKey: unknown): SubscriptionPlan | null {
  return SUBSCRIPTION_PLANS.find(p => p.lookupKey === lookupKey) ?? null
}

/** Les périodes vendues pour un palier (Pro : mensuel seulement). */
export function periodsFor(tier: PlanTier): BillingPeriod[] {
  return SUBSCRIPTION_PLANS.filter(p => p.tier === tier).map(p => p.period)
}

/**
 * Proratisation quand le nombre de sièges change (Stripe :
 * proration_behavior). Option décidée par le fondateur le 26/10/2026 :
 *   - un membre ajouté en cours de mois est facturé au prorata, sur la
 *     facture suivante (pas de petite facture à chaque ajout) ;
 *   - un membre retiré : son siège reste payé jusqu'à la fin du mois, pas
 *     d'avoir ; il disparaît de la facture suivante.
 * Autres choix possibles : 'always_invoice' (facture immédiate à chaque
 * changement), 'none' partout (changement pris en compte au mois suivant,
 * sans prorata). Voir strategie/paiements-stripe.md § Business.
 */
export type Proration = 'create_prorations' | 'always_invoice' | 'none'

export const BUSINESS = {
  productName: 'Tiroir Business — siège',
  lookupKey: 'tiroir_business_seat_monthly',
  /** Centimes TTC par siège et par mois. */
  seatAmount: Math.round(OFFERS_V4.business.seatMonthly * 100),
  daysUntilDue: 30,
  /** Jours de droits Pro gardés après une échéance impayée (décidé le 26/10/2026). */
  graceDays: 14,
  /** Virement (solde client Stripe, IBAN dédié) et prélèvement SEPA. */
  paymentMethodTypes: ['customer_balance', 'sepa_debit'] as const,
  proration: { increase: 'create_prorations', decrease: 'none' } as Record<'increase' | 'decrease', Proration>,
} as const

export function prorationFor(fromSeats: number, toSeats: number): Proration {
  return toSeats > fromSeats ? BUSINESS.proration.increase : BUSINESS.proration.decrease
}

export type StripeMode = 'test' | 'live'

export type StripeEnv = {
  secretKey: string
  webhookSecret: string | null
  mode: StripeMode
}

type Env = Record<string, string | undefined>

/**
 * Clés Stripe du serveur, ou null si le paiement n'est pas configuré
 * (le site affiche alors « Bientôt disponible »).
 *
 * STRIPE_MODE est obligatoire et doit correspondre à la clé : une clé
 * réelle posée par erreur en préprod (ou l'inverse) est refusée.
 */
export function stripeEnv(env: Env = process.env): StripeEnv | null {
  const secretKey = env.STRIPE_SECRET_KEY?.trim()
  const mode = env.STRIPE_MODE?.trim()
  if (!secretKey || (mode !== 'test' && mode !== 'live')) return null
  const keyMode = /^(sk|rk)_live_/.test(secretKey) ? 'live' : /^(sk|rk)_test_/.test(secretKey) ? 'test' : null
  if (keyMode !== mode) {
    console.error(`[stripe] STRIPE_MODE=${mode} ne correspond pas à la clé (${keyMode ?? 'inconnue'}) : paiement fermé.`)
    return null
  }
  return { secretKey, webhookSecret: env.STRIPE_WEBHOOK_SECRET?.trim() || null, mode }
}

/** Adresse publique du site, pour les retours de Stripe Checkout. */
export function siteUrl(env: Env = process.env): string {
  const raw = env.SITE_URL?.trim() || `https://${env.SITE_HOST?.trim() || 'tiroir.app'}`
  return raw.replace(/\/+$/, '')
}

/**
 * Régime de TVA de Tiroir. Franchise en base, confirmée par le fondateur
 * le 26/10/2026 : aucune TVA facturée, prix TTC = HT. Seul
 * BILLING_VAT_MODE=assujetti (le jour où le seuil est dépassé) fait
 * appliquer la TVA.
 */
export function vatMode(env: Env = process.env): 'franchise' | 'assujetti' {
  return env.BILLING_VAT_MODE?.trim() === 'assujetti' ? 'assujetti' : 'franchise'
}

/**
 * Mentions de bas de facture (Business), lues dans l'environnement : ce
 * sont les coordonnées de l'EI du fondateur, pas du code.
 */
export function invoiceFooter(env: Env = process.env): string {
  const lines: string[] = []
  const issuer = [env.BILLING_LEGAL_NAME, env.BILLING_SIRET && `SIRET ${env.BILLING_SIRET}`, env.BILLING_ADDRESS]
    .map(s => s?.trim()).filter(Boolean)
  if (issuer.length) lines.push(issuer.join(' — '))
  if (vatMode(env) === 'franchise') lines.push('TVA non applicable, art. 293 B du CGI.')
  else if (env.BILLING_VAT_NUMBER?.trim()) lines.push(`N° de TVA intracommunautaire : ${env.BILLING_VAT_NUMBER.trim()}`)
  lines.push(
    'Nature des opérations : prestations de services.',
    'Paiement à 30 jours. Pas d’escompte pour paiement anticipé.',
    'En cas de retard : pénalités au taux d’intérêt de la BCE majoré de 10 points, et indemnité forfaitaire de 40 € pour frais de recouvrement (art. L441-10 et D441-5 du Code de commerce).',
  )
  return lines.join('\n')
}
