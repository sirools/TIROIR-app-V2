// Pro sur facture → abonnement Stripe Pro (send_invoice), depuis le
// back-office › Comptes Pro. POST { user_id, period, business, name, line1,
// line2?, postal_code, city, country?, vat_number?, billing_email?,
// first_invoice_date? } → { subscription, status, outcome, vatWarning }.
//
// Réservé aux admins (is_admin relu avec la clé service). Le compte reste
// Pro : l'abonnement est appliqué aussitôt (apply_stripe_subscription), le
// webhook confirme ensuite. Logique : lib/stripe/proInvoice.ts.
import type { NextApiRequest, NextApiResponse } from 'next'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { adminSupabase } from '../../../lib/supabase'
import { missingVatConfig, stripeEnv } from '../../../lib/stripeConfig'
import { stripeClient } from '../../../lib/stripe/api'
import { createProInvoiceSubscription, parseProInvoiceInput } from '../../../lib/stripe/proInvoice'
import { individualSubscription, readSubscription, supabaseSubscriberStore } from '../../../lib/stripe/subscriptions'

const LIVE = ['active', 'trialing', 'past_due']

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store')
  if (req.method !== 'POST') return res.status(405).end()
  const { data: { user } } = await createServerSupabaseClient({ req, res }).auth.getUser()
  if (!user) return res.status(401).json({ error: 'Non authentifié' })
  const db = adminSupabase()
  const { data: me } = await db.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!me?.is_admin) return res.status(403).json({ error: 'Accès refusé' })

  const input = parseProInvoiceInput(req.body)
  if (typeof input === 'string') return res.status(400).json({ error: input })
  const env = stripeEnv()
  if (!env) return res.status(503).json({ error: 'Stripe non configuré' })
  const missing = missingVatConfig('exclusive')
  if (missing) return res.status(503).json({ error: `TVA : ${missing} manquant` })

  const [{ data: profile }, { data: account }] = await Promise.all([
    db.from('profiles').select('stripe_customer_id, stripe_livemode, stripe_subscription_id, subscription_status').eq('id', input.userId).maybeSingle(),
    db.auth.admin.getUserById(input.userId),
  ])
  const email = account?.user?.email
  if (!profile || !email) return res.status(404).json({ error: 'Compte introuvable' })
  if (profile.stripe_subscription_id && LIVE.includes(profile.subscription_status ?? '')) {
    return res.status(409).json({ error: 'Ce compte a déjà un abonnement Stripe en cours' })
  }

  const stripe = stripeClient(env)
  try {
    const created = await createProInvoiceSubscription(stripe, input, { email, ...profile })
    // Appliqué tout de suite (le webhook le refera, sans effet de plus).
    const sub = individualSubscription(await readSubscription(stripe, created.subscriptionId))
    const outcome = sub ? await supabaseSubscriberStore(db).apply(input.userId, sub) : 'abonnement non reconnu'
    await db.from('activity_log').insert({
      user_id: input.userId, action: 'admin.pro_invoice_subscription',
      payload: { by: user.id, subscription: created.subscriptionId, period: input.period, first_invoice_date: input.firstInvoiceDate },
    })
    return res.status(200).json({ subscription: created.subscriptionId, status: created.status, outcome, vatWarning: created.vatWarning })
  } catch (e) {
    console.error('[pro-subscription]', (e as Error).message)
    return res.status(502).json({ error: `Stripe : ${(e as Error).message}` })
  }
}
