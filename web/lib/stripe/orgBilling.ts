// Appels Stripe de la formule Business : créer le client et l'abonnement
// d'une organisation, ajuster le nombre de sièges. Serveur seulement.
import { BUSINESS, invoiceFooter, prorationFor, vatMode } from '../stripeConfig'
import { priceIdFor, type StripeCall } from './api'

export type OrgForBilling = {
  id: string
  name: string
  legal_name: string | null
  siren: string | null
  vat_number: string | null
  billing_email: string
  address_line1: string | null
  address_line2: string | null
  postal_code: string | null
  city: string | null
  country: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  seat_quantity: number | null
}

/** Client Stripe de l'organisation : coordonnées et mentions de ses factures. */
export async function ensureCustomer(stripe: StripeCall, org: OrgForBilling, env = process.env): Promise<string> {
  if (org.stripe_customer_id) return org.stripe_customer_id
  const customFields = org.siren ? [{ name: 'SIREN client', value: org.siren }] : []
  const customer = await stripe<{ id: string }>('POST', '/v1/customers', {
    name: org.legal_name || org.name,
    email: org.billing_email,
    preferred_locales: ['fr'],
    address: {
      line1: org.address_line1, line2: org.address_line2, postal_code: org.postal_code, city: org.city, country: org.country,
    },
    metadata: { org_id: org.id },
    invoice_settings: { footer: invoiceFooter(env), custom_fields: customFields },
    // Préprod : horloge de test Stripe, pour simuler un mois, une échéance
    // dépassée, un impayé (strategie/paiements-stripe.md, plan de tests).
    test_clock: env.STRIPE_MODE === 'test' ? env.STRIPE_TEST_CLOCK_ID?.trim() || undefined : undefined,
  }, { idempotencyKey: `org-customer-${org.id}` })

  // N° de TVA du client (facultatif) : refusé par Stripe s'il est mal formé,
  // sans bloquer la création du client.
  if (org.vat_number) {
    try {
      await stripe('POST', `/v1/customers/${customer.id}/tax_ids`, { type: 'eu_vat', value: org.vat_number })
    } catch (e) {
      console.warn('[business] n° de TVA refusé par Stripe', (e as Error).message)
    }
  }
  return customer.id
}

/**
 * Abonnement par siège, sur facture : virement ou SEPA, échéance à 30
 * jours. Les droits suivent par le webhook (customer.subscription.created).
 */
export async function createSeatSubscription(stripe: StripeCall, customerId: string, org: OrgForBilling, seats: number, env = process.env) {
  const price = await priceIdFor(stripe, BUSINESS.lookupKey)
  // Franchise en base : jamais de taux de TVA, même si un id traîne dans l'environnement.
  const taxRate = vatMode(env) === 'assujetti' ? env.STRIPE_TAX_RATE_ID?.trim() : undefined
  return stripe<{ id: string; status: string }>('POST', '/v1/subscriptions', {
    customer: customerId,
    items: [{ price, quantity: Math.max(1, seats) }],
    collection_method: 'send_invoice',
    days_until_due: BUSINESS.daysUntilDue,
    payment_settings: {
      payment_method_types: [...BUSINESS.paymentMethodTypes],
      payment_method_options: {
        customer_balance: { funding_type: 'bank_transfer', bank_transfer: { type: 'eu_bank_transfer', eu_bank_transfer: { country: 'FR' } } },
      },
    },
    default_tax_rates: taxRate ? [taxRate] : undefined,
    metadata: { org_id: org.id },
  }, { idempotencyKey: `org-subscription-${org.id}-${customerId}` })
}

/** Ajuste la quantité de sièges de l'abonnement, selon la règle de prorata. */
export async function updateSeats(stripe: StripeCall, subscriptionId: string, fromSeats: number, toSeats: number) {
  const sub = await stripe<{ items: { data: { id: string; quantity: number }[] } }>('GET', `/v1/subscriptions/${subscriptionId}`)
  const item = sub.items.data[0]
  if (!item) throw new Error(`Abonnement ${subscriptionId} sans élément`)
  const target = Math.max(1, toSeats)
  if (item.quantity === target) return
  await stripe('POST', `/v1/subscriptions/${subscriptionId}`, {
    items: [{ id: item.id, quantity: target }],
    proration_behavior: prorationFor(fromSeats || item.quantity, target),
  })
}
