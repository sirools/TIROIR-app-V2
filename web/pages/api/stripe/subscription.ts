// Abonnement Premium ou Pro d'un particulier, acheté sur le site.
//
// POST { tier: 'premium', period: 'yearly', locale } → { url }
//   Crée la session Stripe Checkout (mode subscription) pour le compte
//   connecté et renvoie son adresse. Le client Stripe est créé au premier
//   achat et rattaché au compte. Le palier n'est activé QUE par le
//   webhook (/api/stripe/webhook), jamais par le retour du navigateur.
//   409 ALREADY_SUBSCRIBED : déjà abonné sur le site (→ portail) ;
//   409 PAID_ELSEWHERE : palier payant venu de l'app, d'une facture ou
//   d'une organisation.
//
// GET → { plan, status, source, periodEnd, cancelAtPeriodEnd }
//   État lu en base, pour la page de confirmation (qui attend le webhook).
import type { NextApiRequest, NextApiResponse } from 'next'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { consumerInvoiceFooter, envPriceId, missingVatConfig, siteUrl, stripeEnv, stripeTaxRates, subscriptionPlanFor, type StripeEnv } from '../../../lib/stripeConfig'
import { priceIdFor, stripeClient, type StripeCall } from '../../../lib/stripe/api'
import { adminSupabase } from '../../../lib/supabase'
import { asLocale, localePrefix } from '../../../lib/localeRouting'
import { checkoutReturnPaths } from '../../../lib/subscribeFlow'

type Admin = ReturnType<typeof adminSupabase>

/** Client Stripe du compte : celui déjà rattaché (même mode), sinon un nouveau. */
async function customerFor(db: Admin, stripe: StripeCall, env: StripeEnv, user: { id: string; email?: string }): Promise<string> {
  const { data: profile, error } = await db.from('profiles')
    .select('stripe_customer_id, stripe_livemode').eq('id', user.id).maybeSingle()
  if (error) throw new Error(`profiles : ${error.message}`)
  const livemode = env.mode === 'live'
  if (profile?.stripe_customer_id && profile.stripe_livemode === livemode) {
    // Mentions de l'EI tenues à jour (client créé avant la TVA, adresse changée…).
    await stripe('POST', `/v1/customers/${profile.stripe_customer_id}`, { invoice_settings: { footer: consumerInvoiceFooter() } })
      .catch(e => console.warn('[stripe/subscription] pied de facture', (e as Error).message))
    return profile.stripe_customer_id
  }

  const customer = await stripe<{ id: string }>('POST', '/v1/customers', {
    email: user.email,
    metadata: { user_id: user.id },
    // Mentions de l'EI sur toutes les factures du client (échéances comprises).
    invoice_settings: { footer: consumerInvoiceFooter() },
  }, { idempotencyKey: `tiroir-customer-${env.mode}-${user.id}` })
  // Deux onglets en même temps : la base garde le premier client posé.
  const { data: kept, error: setError } = await db.rpc('set_stripe_customer', {
    p_user_id: user.id, p_customer_id: customer.id, p_livemode: livemode,
  })
  if (setError) throw new Error(`set_stripe_customer : ${setError.message}`)
  return String(kept)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store')
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'METHOD' })

  const { data: { user } } = await createServerSupabaseClient({ req, res }).auth.getUser()
  if (!user) return res.status(401).json({ error: 'AUTH' })
  const db = adminSupabase()

  if (req.method === 'GET') {
    const { data, error } = await db.from('profiles')
      .select('plan, plan_source, subscription_status, subscription_period_end, subscription_cancel_at_period_end')
      .eq('id', user.id).maybeSingle()
    if (error || !data) return res.status(503).json({ error: 'NOT_READY' })
    return res.status(200).json({
      plan: data.plan, source: data.plan_source, status: data.subscription_status,
      periodEnd: data.subscription_period_end, cancelAtPeriodEnd: data.subscription_cancel_at_period_end,
    })
  }

  const env = stripeEnv()
  if (!env) return res.status(503).json({ error: 'PAYMENT_CLOSED' })
  const vatMissing = missingVatConfig('exclusive')
  if (vatMissing) {
    console.error(`[stripe/subscription] TVA : ${vatMissing} manquante, paiement refusé`)
    return res.status(503).json({ error: 'VAT_CONFIG' })
  }

  const plan = subscriptionPlanFor(req.body?.tier, req.body?.period)
  if (!plan) return res.status(400).json({ error: 'PLAN' })
  // Accès immédiat demandé, renonciation au droit de rétractation
  // (art. L221-28 du Code de la consommation) : case cochée sur /abonnement.
  if (req.body?.waiver !== true) return res.status(400).json({ error: 'WAIVER' })

  const { data: gate, error: gateError } = await db.rpc('stripe_subscription_gate', { p_user_id: user.id })
  if (gateError) {
    console.error('[stripe/subscription] stripe_subscription_gate', gateError.message)
    return res.status(503).json({ error: 'NOT_READY' })
  }
  if (gate === 'WEB') return res.status(409).json({ error: 'ALREADY_SUBSCRIBED' })
  if (gate === 'OTHER') return res.status(409).json({ error: 'PAID_ELSEWHERE' })

  const locale = asLocale(req.body?.locale)
  const { success, cancel } = checkoutReturnPaths(plan.tier, plan.period)
  const base = `${siteUrl()}${localePrefix(locale)}`

  try {
    const stripe = stripeClient(env)
    const customer = await customerFor(db, stripe, env, user)
    const tax = stripeTaxRates().exclusive
    const waiverAt = new Date().toISOString()
    const session = await stripe<{ url: string }>('POST', '/v1/checkout/sessions', {
      mode: 'subscription',
      // Tiroir vend en son nom (EI, franchise de TVA, factures à son nom) :
      // pas de « Managed Payments » (Stripe revendeur), activé par défaut
      // sur les nouveaux comptes. Voir strategie/paiements-stripe.md § 6.
      managed_payments: { enabled: false },
      customer,
      client_reference_id: user.id,
      // Prix HT + TVA 20 % (assujetti) : HT, TVA et TTC au Checkout et sur la facture.
      line_items: [{ price: envPriceId(plan) ?? await priceIdFor(stripe, plan.lookupKey), quantity: 1, ...(tax ? { tax_rates: [tax] } : {}) }],
      // Adresse de facturation obligatoire, n° de TVA facultatif (clients pros).
      billing_address_collection: 'required',
      tax_id_collection: { enabled: true },
      customer_update: { address: 'auto', name: 'auto' },
      metadata: { kind: 'subscription', user_id: user.id, plan: plan.key, waiver_at: waiverAt },
      // Recopiées sur l'abonnement : le webhook retrouve le compte même
      // sans la session (renouvellement, changement dans le portail).
      subscription_data: { metadata: { kind: 'individual', user_id: user.id, plan: plan.key, waiver_at: waiverAt } },
      // Pas de payment_method_types : Stripe propose carte, Apple Pay,
      // Google Pay… selon les moyens activés dans le tableau de bord.
      locale: locale === 'de' || locale === 'es' || locale === 'en' ? locale : 'fr',
      success_url: `${base}${success}`,
      cancel_url: `${base}${cancel}`,
      custom_text: {
        submit: {
          message: locale === 'fr'
            ? 'Accès immédiat : vous avez demandé l’exécution du service dès le paiement et renoncé à votre droit de rétractation. Résiliable à tout moment depuis votre compte.'
            : 'Immediate access: you asked for the service to start upon payment and waived your right of withdrawal. Cancel anytime from your account.',
        },
      },
    })
    return res.status(200).json({ url: session.url })
  } catch (e) {
    console.error('[stripe/subscription]', (e as Error).message)
    return res.status(502).json({ error: 'STRIPE' })
  }
}
