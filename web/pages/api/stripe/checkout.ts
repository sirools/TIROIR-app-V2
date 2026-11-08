// Achat d'un pack de crédits IA sur le site : crée une session Stripe
// Checkout pour le compte connecté et renvoie son adresse. Le compte n'est
// crédité que par le webhook (/api/stripe/webhook), une fois le paiement
// confirmé par Stripe — jamais par le retour du navigateur.
//
// POST { pack: 'credits_150', locale } → { url }
// Renoncement au droit de rétractation : case obligatoire dans le Checkout
// Stripe (lib/checkoutConsent.ts), enregistrée par le webhook.
// Comptes Pro : refusé (403 PRO), l'IA y est incluse sans recharge.
import type { NextApiRequest, NextApiResponse } from 'next'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { consumerInvoiceFooter, creditsSaleOpen, missingVatConfig, packByKey, siteUrl, stripeEnv, stripeTaxRates } from '../../../lib/stripeConfig'
import { priceIdFor, stripeClient } from '../../../lib/stripe/api'
import { asLocale, localePrefix } from '../../../lib/localeRouting'
import { adminSupabase } from '../../../lib/supabase'
import { CONSENT_TEXT_VERSION, consentParams } from '../../../lib/checkoutConsent'
import { creditsAllowedFor } from '../../../lib/creditsAccess'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store')
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD' })

  const env = stripeEnv()
  if (!env || !creditsSaleOpen()) return res.status(503).json({ error: 'PAYMENT_CLOSED' })
  const vatMissing = missingVatConfig('inclusive')
  if (vatMissing) {
    console.error(`[stripe/checkout] TVA : ${vatMissing} manquante, paiement refusé`)
    return res.status(503).json({ error: 'VAT_CONFIG' })
  }

  const { data: { user } } = await createServerSupabaseClient({ req, res }).auth.getUser()
  if (!user) return res.status(401).json({ error: 'AUTH' })

  const pack = packByKey(req.body?.pack)
  if (!pack) return res.status(400).json({ error: 'PACK' })

  const { data: profile } = await adminSupabase().from('profiles')
    .select('plan, pro_expires_at, stripe_customer_id, stripe_livemode').eq('id', user.id).maybeSingle()
  if (!creditsAllowedFor(profile)) return res.status(403).json({ error: 'PRO' })

  const locale = asLocale(req.body?.locale)
  const back = `${siteUrl()}${localePrefix(locale)}/credits`
  const meta = { kind: 'credits', user_id: user.id, pack: pack.key, credits: pack.credits, consent_version: CONSENT_TEXT_VERSION }

  try {
    const stripe = stripeClient(env)
    const taxIncl = stripeTaxRates().inclusive
    // Client Stripe du compte s'il existe (abonné) : ses factures de crédits
    // apparaissent avec les autres dans Mon compte et le portail.
    const customer = profile?.stripe_customer_id && profile.stripe_livemode === (env.mode === 'live') ? profile.stripe_customer_id : null
    const session = await stripe<{ url: string }>('POST', '/v1/checkout/sessions', {
      mode: 'payment',
      // Tiroir vend en son nom (EI, franchise de TVA, factures à son nom) :
      // pas de « Managed Payments » (Stripe revendeur), activé par défaut
      // sur les nouveaux comptes. Voir strategie/paiements-stripe.md § 6.
      managed_payments: { enabled: false },
      // Packs vendus TTC : TVA 20 % comprise (assujetti), détaillée sur la facture.
      line_items: [{ price: await priceIdFor(stripe, pack.lookupKey), quantity: 1, ...(taxIncl ? { tax_rates: [taxIncl] } : {}) }],
      billing_address_collection: 'required',
      tax_id_collection: { enabled: true },
      // Une facture par achat, envoyée par e-mail.
      invoice_creation: { enabled: true, invoice_data: { footer: consumerInvoiceFooter(), metadata: meta } },
      client_reference_id: user.id,
      ...(customer ? { customer, customer_update: { address: 'auto', name: 'auto' } } : { customer_email: user.email }),
      metadata: meta,
      payment_intent_data: { metadata: meta, description: `Tiroir — ${pack.credits} crédits IA` },
      locale: locale === 'de' || locale === 'es' || locale === 'en' ? locale : 'fr',
      success_url: `${back}?achat=ok`,
      cancel_url: `${back}?achat=annule`,
      // Case obligatoire, non pré-cochée : accès immédiat et renoncement
      // au droit de rétractation (art. L221-28). Enregistrée par le webhook.
      ...consentParams('credits', locale, `${siteUrl()}${localePrefix(locale)}/cgu`),
    })
    return res.status(200).json({ url: session.url })
  } catch (e) {
    console.error('[stripe/checkout]', (e as Error).message)
    return res.status(502).json({ error: 'STRIPE' })
  }
}
