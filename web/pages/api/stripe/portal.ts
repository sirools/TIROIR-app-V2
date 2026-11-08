// « Gérer mon abonnement » : ouvre le portail client Stripe (carte,
// changement d'offre, résiliation, factures) pour le compte connecté.
// Ce qui est permis dans le portail se règle dans le tableau de bord
// Stripe (Settings › Billing › Customer portal). Les changements faits là
// reviennent par le webhook (customer.subscription.updated / deleted).
//
// POST { locale } → { url }
import type { NextApiRequest, NextApiResponse } from 'next'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { siteUrl, stripeEnv } from '../../../lib/stripeConfig'
import { stripeClient } from '../../../lib/stripe/api'
import { adminSupabase } from '../../../lib/supabase'
import { asLocale, localePrefix } from '../../../lib/localeRouting'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store')
  if (req.method !== 'POST') return res.status(405).json({ error: 'METHOD' })

  const env = stripeEnv()
  if (!env) return res.status(503).json({ error: 'PAYMENT_CLOSED' })

  const { data: { user } } = await createServerSupabaseClient({ req, res }).auth.getUser()
  if (!user) return res.status(401).json({ error: 'AUTH' })

  const { data: profile, error } = await adminSupabase().from('profiles')
    .select('stripe_customer_id, stripe_livemode').eq('id', user.id).maybeSingle()
  if (error) return res.status(503).json({ error: 'NOT_READY' })
  if (!profile?.stripe_customer_id || profile.stripe_livemode !== (env.mode === 'live')) {
    return res.status(404).json({ error: 'NO_CUSTOMER' })
  }

  const locale = asLocale(req.body?.locale)
  try {
    const session = await stripeClient(env)<{ url: string }>('POST', '/v1/billing_portal/sessions', {
      customer: profile.stripe_customer_id,
      return_url: `${siteUrl()}${localePrefix(locale)}/mon-compte`,
    })
    return res.status(200).json({ url: session.url })
  } catch (e) {
    console.error('[stripe/portal]', (e as Error).message)
    return res.status(502).json({ error: 'STRIPE' })
  }
}
