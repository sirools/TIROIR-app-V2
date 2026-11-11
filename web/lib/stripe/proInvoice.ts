// Pro sur facture, par Stripe : un compte Tiroir passe d'un Pro attribué à
// la main à un abonnement Stripe Pro au tarif standard (50 € HT par mois ou
// 500 € HT par an), TVA ajoutée, payé sur facture envoyée par mail
// (collection_method = send_invoice), à PRO_INVOICE.daysUntilDue jours.
//
// Le compte reste Pro pendant la bascule : l'abonnement porte
// metadata.user_id, le webhook (et l'appel direct de l'API admin) l'applique
// par apply_stripe_subscription : Pro → Pro, plan_source = 'web', dates du
// Pro manuel effacées. Ensuite c'est Stripe qui pilote l'accès (retard :
// accès gardé pendant les relances ; abonnement arrêté : retour au gratuit).
//
// Logique pure ici (validation, paramètres, mentions) ; les appels Stripe
// sont en bas, serveur seulement.
import { consumerInvoiceFooter, envPriceId, invoiceFooter, stripeTaxRates, subscriptionPlanFor, type Env } from '../stripeConfig'
import { priceIdFor, type StripeCall } from './api'

export const PRO_INVOICE = {
  /** Délai de paiement d'une facture (jours). */
  daysUntilDue: 15,
  /** Carte, ou virement (IBAN dédié du client chez Stripe), depuis la facture en ligne. */
  paymentMethodTypes: ['card', 'customer_balance'] as const,
} as const

export type ProInvoiceInput = {
  userId: string
  period: 'monthly' | 'yearly'
  /** Professionnel (mentions de retard, n° de TVA) ou particulier. */
  business: boolean
  name: string
  line1: string
  line2: string | null
  postalCode: string
  city: string
  country: string
  vatNumber: string | null
  /** E-mail de facturation (sinon celui du compte). */
  billingEmail: string | null
  /** Date de la première facture (AAAA-MM-JJ) ; vide ou passée : tout de suite. */
  firstInvoiceDate: string | null
}

const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Corps de la requête admin → entrée validée, ou message d'erreur. */
export function parseProInvoiceInput(body: unknown): ProInvoiceInput | string {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const userId = s(b.user_id)
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return 'Compte manquant'
  const period = b.period === 'yearly' ? 'yearly' : b.period === 'monthly' ? 'monthly' : null
  if (!period) return 'Formule : mensuelle ou annuelle'
  const name = s(b.name)
  if (!name) return 'Nom ou raison sociale manquant'
  const line1 = s(b.line1), postalCode = s(b.postal_code), city = s(b.city)
  if (!line1 || !postalCode || !city) return 'Adresse de facturation incomplète'
  const country = (s(b.country) || 'FR').toUpperCase()
  if (!/^[A-Z]{2}$/.test(country)) return 'Pays : code à deux lettres (FR)'
  const billingEmail = s(b.billing_email) || null
  if (billingEmail && !EMAIL.test(billingEmail)) return 'E-mail de facturation invalide'
  const firstInvoiceDate = s(b.first_invoice_date) || null
  if (firstInvoiceDate && !/^\d{4}-\d{2}-\d{2}$/.test(firstInvoiceDate)) return 'Date de première facture : AAAA-MM-JJ'
  const business = b.business === true
  const vatNumber = business ? (s(b.vat_number).replace(/\s/g, '').toUpperCase() || null) : null
  return {
    userId, period, business, name, line1, line2: s(b.line2) || null, postalCode, city, country,
    vatNumber, billingEmail, firstInvoiceDate,
  }
}

/** Mentions de bas de facture : celles des professionnels (retard, 40 €) ou des particuliers. */
export function proInvoiceFooter(business: boolean, env: Env = process.env): string {
  if (business) return invoiceFooter(env, PRO_INVOICE.daysUntilDue)
  // Particulier : identité de l'EI et TVA, sans la mention de renoncement
  // (aucune case cochée au Checkout ici), avec l'échéance.
  const lines = consumerInvoiceFooter(env).split('\n').filter(l => !/rétractation/i.test(l))
  lines.push(`Paiement à ${PRO_INVOICE.daysUntilDue} jours, par carte ou virement depuis la facture en ligne.`)
  return lines.join('\n')
}

/**
 * Date de première facture → ancre de facturation (secondes Unix, midi UTC),
 * ou null pour facturer tout de suite (date vide, passée ou aujourd'hui).
 */
export function billingAnchor(firstInvoiceDate: string | null, now = new Date()): number | null {
  if (!firstInvoiceDate || firstInvoiceDate <= now.toISOString().slice(0, 10)) return null
  const t = Date.parse(`${firstInvoiceDate}T12:00:00Z`)
  return Number.isFinite(t) ? Math.floor(t / 1000) : null
}

/** Paramètres de l'abonnement Stripe. */
export function proSubscriptionParams(input: ProInvoiceInput, args: { customerId: string; priceId: string; taxRate: string | null; now?: Date }) {
  const anchor = billingAnchor(input.firstInvoiceDate, args.now)
  return {
    customer: args.customerId,
    items: [{ price: args.priceId, quantity: 1 }],
    collection_method: 'send_invoice',
    days_until_due: PRO_INVOICE.daysUntilDue,
    payment_settings: {
      payment_method_types: [...PRO_INVOICE.paymentMethodTypes],
      payment_method_options: {
        customer_balance: { funding_type: 'bank_transfer', bank_transfer: { type: 'eu_bank_transfer', eu_bank_transfer: { country: 'FR' } } },
      },
    },
    default_tax_rates: args.taxRate ? [args.taxRate] : undefined,
    // Première facture plus tard (période déjà réglée hors Stripe) : pas de
    // prorata, rien n'est facturé avant la date.
    ...(anchor ? { billing_cycle_anchor: anchor, proration_behavior: 'none' } : {}),
    metadata: { user_id: input.userId, kind: 'individual', tier: 'pro', period: input.period, source: 'pro_invoice' },
  }
}

// ── Appels Stripe (serveur) ─────────────────────────────────────────

type Profile = { email: string; stripe_customer_id: string | null; stripe_livemode: boolean | null }

/** Crée (ou met à jour) le client Stripe du compte, puis son abonnement Pro sur facture. */
export async function createProInvoiceSubscription(stripe: StripeCall, input: ProInvoiceInput, profile: Profile, env: Env = process.env) {
  const live = env.STRIPE_MODE === 'live'
  const customerFields = {
    name: input.name,
    email: input.billingEmail ?? profile.email,
    preferred_locales: ['fr'],
    address: { line1: input.line1, line2: input.line2 ?? '', postal_code: input.postalCode, city: input.city, country: input.country },
    invoice_settings: { footer: proInvoiceFooter(input.business, env) },
    metadata: { user_id: input.userId },
  }
  // Un client Stripe du même mode existe déjà (achat de crédits, ancien
  // abonnement) : on le garde, coordonnées mises à jour.
  const reuse = profile.stripe_customer_id && profile.stripe_livemode === live ? profile.stripe_customer_id : null
  const customer = reuse
    ? await stripe<{ id: string }>('POST', `/v1/customers/${reuse}`, customerFields)
    : await stripe<{ id: string }>('POST', '/v1/customers', {
      ...customerFields,
      test_clock: env.STRIPE_MODE === 'test' ? env.STRIPE_TEST_CLOCK_ID?.trim() || undefined : undefined,
    }, { idempotencyKey: `pro-invoice-customer-${input.userId}-${live ? 'live' : 'test'}` })

  // N° de TVA : refusé par Stripe s'il est mal formé, sans bloquer.
  let vatWarning: string | null = null
  if (input.vatNumber) {
    try {
      await stripe('POST', `/v1/customers/${customer.id}/tax_ids`, { type: 'eu_vat', value: input.vatNumber })
    } catch (e) {
      vatWarning = (e as Error).message
    }
  }

  const plan = subscriptionPlanFor('pro', input.period)!
  const priceId = envPriceId(plan, env) ?? await priceIdFor(stripe, plan.lookupKey)
  const sub = await stripe<Record<string, unknown>>('POST', '/v1/subscriptions',
    proSubscriptionParams(input, { customerId: customer.id, priceId, taxRate: stripeTaxRates(env).exclusive }),
    { idempotencyKey: `pro-invoice-subscription-${input.userId}-${customer.id}-${input.period}` })
  return { customerId: customer.id, subscriptionId: String(sub.id), status: String(sub.status), vatWarning }
}
