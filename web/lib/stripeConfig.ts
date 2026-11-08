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
import { OFFERS_V4, VAT_RATE } from './offers'
import { invoiceConsentNote } from './checkoutConsent'

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
 * Premium et Pro, mensuel ou annuel. Un produit Stripe par palier, un
 * prix par période. Mêmes paliers que profiles.plan.
 *
 * Identifiant du prix Stripe : la variable d'environnement `priceEnv`
 * (price_…, différent en test et en réel), sinon le prix actif qui porte
 * la `lookup_key` (créé par scripts/stripe-setup.mjs).
 */
type Env = Record<string, string | undefined>

export type PlanTier = 'premium' | 'pro'
export type BillingPeriod = 'monthly' | 'yearly'
export type SubscriptionPlan = {
  /** Clé interne. */
  key: string
  tier: PlanTier
  period: BillingPeriod
  lookupKey: string
  /** Centimes HT par période (la TVA s'ajoute, voir vatRate). */
  amount: number
  interval: 'month' | 'year'
  /** Variable d'environnement qui donne l'identifiant du prix (price_…). */
  priceEnv: string
}

export const SUBSCRIPTION_PLANS: readonly SubscriptionPlan[] = [
  { key: 'premium_monthly', tier: 'premium', period: 'monthly', lookupKey: 'tiroir_web_premium_monthly', amount: Math.round(OFFERS_V4.premium.monthlyHt * 100), interval: 'month', priceEnv: 'STRIPE_PRICE_PREMIUM_MONTHLY' },
  { key: 'premium_yearly', tier: 'premium', period: 'yearly', lookupKey: 'tiroir_web_premium_yearly', amount: Math.round(OFFERS_V4.premium.yearlyHt * 100), interval: 'year', priceEnv: 'STRIPE_PRICE_PREMIUM_YEARLY' },
  { key: 'pro_monthly', tier: 'pro', period: 'monthly', lookupKey: 'tiroir_web_pro_monthly', amount: Math.round(OFFERS_V4.pro.monthlyHt * 100), interval: 'month', priceEnv: 'STRIPE_PRICE_PRO_MONTHLY' },
  { key: 'pro_yearly', tier: 'pro', period: 'yearly', lookupKey: 'tiroir_web_pro_yearly', amount: Math.round(OFFERS_V4.pro.yearlyHt * 100), interval: 'year', priceEnv: 'STRIPE_PRICE_PRO_YEARLY' },
]

/** Identifiant de prix posé dans l'environnement pour cette offre, ou null. */
export function envPriceId(plan: SubscriptionPlan, env: Env = process.env): string | null {
  const id = env[plan.priceEnv]?.trim()
  return id && id.startsWith('price_') ? id : null
}

/**
 * Offre d'un prix Stripe : par son identifiant (variables d'environnement),
 * sinon par sa lookup_key. Jamais par les métadonnées.
 */
export function planByPrice(price: { id?: unknown; lookup_key?: unknown } | null | undefined, env: Env = process.env): SubscriptionPlan | null {
  if (!price) return null
  return SUBSCRIPTION_PLANS.find(p => typeof price.id === 'string' && envPriceId(p, env) === price.id)
    ?? planByLookupKey(price.lookup_key)
}

/** Offre demandée par la page (`premium` + `yearly`), ou null si elle n'est pas vendue. */
export function subscriptionPlanFor(tier: unknown, period: unknown): SubscriptionPlan | null {
  return SUBSCRIPTION_PLANS.find(p => p.tier === tier && p.period === period) ?? null
}

/** Palier d'un prix Stripe, retrouvé par sa lookup_key (jamais par les métadonnées). */
export function planByLookupKey(lookupKey: unknown): SubscriptionPlan | null {
  return SUBSCRIPTION_PLANS.find(p => p.lookupKey === lookupKey) ?? null
}

/** Les périodes vendues pour un palier. */
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

/**
 * Vente de packs de crédits sur le site : fermée tant que
 * STRIPE_CREDITS_OPEN=1 n'est pas posé, même si Stripe est configuré.
 * Les abonnements peuvent ouvrir avant les crédits : ceux-ci demandent
 * les tables de stripe_credits.sql et la dépense par crédits
 * (ai_credits_spend.sql + fonctions IA redéployées) en prod.
 */
export function creditsSaleOpen(env: Env = process.env): boolean {
  return stripeEnv(env) !== null && env.STRIPE_CREDITS_OPEN?.trim() === '1'
}

/** Adresse publique du site, pour les retours de Stripe Checkout. */
export function siteUrl(env: Env = process.env): string {
  const raw = env.SITE_URL?.trim() || `https://${env.SITE_HOST?.trim() || 'tiroir.app'}`
  return raw.replace(/\/+$/, '')
}

/**
 * Régime de TVA de Tiroir. Franchise en base jusqu'au 08/11/2026 ; le
 * fondateur a confirmé ce jour-là que l'EI est assujettie (TVA 20 %) :
 * BILLING_VAT_MODE=assujetti dans l'environnement (test et prod), avec
 * BILLING_VAT_NUMBER. Sans la variable, le code reste en franchise : aucune
 * TVA ajoutée, mention art. 293 B.
 */
export function vatMode(env: Env = process.env): 'franchise' | 'assujetti' {
  return env.BILLING_VAT_MODE?.trim() === 'assujetti' ? 'assujetti' : 'franchise'
}

/** Taux de TVA facturé : 20 % si assujetti, 0 en franchise. */
export function vatRate(env: Env = process.env): number {
  return vatMode(env) === 'assujetti' ? VAT_RATE : 0
}

/**
 * Taux de TVA Stripe (Tax Rates, créés par scripts/stripe-setup.mjs) :
 *   - STRIPE_TAX_RATE_ID : 20 % ajoutés au prix (abonnements, prix HT ;
 *     aussi utilisé par la facturation Business) ;
 *   - STRIPE_TAX_RATE_INCLUSIVE_ID : 20 % compris dans le prix (packs de
 *     crédits, vendus TTC).
 * Null en franchise : rien n'est ajouté.
 */
export function stripeTaxRates(env: Env = process.env): { exclusive: string | null; inclusive: string | null } {
  if (vatMode(env) !== 'assujetti') return { exclusive: null, inclusive: null }
  const id = (v: string | undefined) => (v?.trim().startsWith('txr_') ? v.trim() : null)
  return { exclusive: id(env.STRIPE_TAX_RATE_ID), inclusive: id(env.STRIPE_TAX_RATE_INCLUSIVE_ID) }
}

/**
 * Pied des factures des particuliers (abonnements, crédits) : identité de
 * l'EI, n° de TVA ou mention de franchise. Le détail HT / TVA / TTC est
 * sur la facture elle-même (taux de TVA Stripe).
 */
export function consumerInvoiceFooter(env: Env = process.env): string {
  const lines: string[] = []
  const issuer = [env.BILLING_LEGAL_NAME, env.BILLING_SIRET && `SIRET ${env.BILLING_SIRET}`, env.BILLING_ADDRESS]
    .map(s => s?.trim()).filter(Boolean)
  if (issuer.length) lines.push(issuer.join(' — '))
  if (vatMode(env) === 'franchise') lines.push('TVA non applicable, art. 293 B du CGI.')
  else if (env.BILLING_VAT_NUMBER?.trim()) lines.push(`N° de TVA intracommunautaire : ${env.BILLING_VAT_NUMBER.trim()}`)
  lines.push('Prestation de services numériques.')
  lines.push(invoiceConsentNote('fr'))
  return lines.join('\n')
}

/**
 * Assujetti mais taux de TVA Stripe absent : on refuse d'encaisser plutôt
 * que de débiter le prix HT affiché TTC (ou une facture sans TVA). Renvoie
 * le nom de la variable manquante, ou null si la configuration est sûre.
 */
export function missingVatConfig(kind: 'exclusive' | 'inclusive', env: Env = process.env): string | null {
  if (vatMode(env) !== 'assujetti') return null
  const rates = stripeTaxRates(env)
  if (kind === 'exclusive' && !rates.exclusive) return 'STRIPE_TAX_RATE_ID'
  if (kind === 'inclusive' && !rates.inclusive) return 'STRIPE_TAX_RATE_INCLUSIVE_ID'
  return null
}

/** Centimes TTC d'un abonnement (prix HT de la grille + TVA). */
export function amountWithVat(plan: SubscriptionPlan, rate: number): number {
  return Math.round(plan.amount * (1 + rate))
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
