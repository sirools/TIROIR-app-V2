// Webhook Stripe : la seule porte par laquelle un paiement change quelque
// chose dans Tiroir (crédits, droits Business, factures).
//
//   1. signature vérifiée sur le corps brut (STRIPE_WEBHOOK_SECRET) ;
//   2. mode vérifié : un événement de test n'est jamais traité par un
//      serveur en mode réel, et inversement ;
//   3. chaque événement n'est traité qu'une fois (table stripe_events) ;
//      en cas d'erreur, réponse 500 : Stripe renvoie l'événement plus tard,
//      et le traitement, idempotent, reprend sans double crédit.
//
// Événements à cocher dans le dashboard Stripe : voir
// strategie/paiements-stripe.md (actions manuelles).
import type { NextApiRequest, NextApiResponse } from 'next'
import { stripeEnv } from '../../../lib/stripeConfig'
import { verifyStripeSignature } from '../../../lib/stripe/signature'
import { stripeClient } from '../../../lib/stripe/api'
import { handleStripeEvent, supabaseBillingStore, type StripeEvent } from '../../../lib/stripe/webhook'
import { adminSupabase } from '../../../lib/supabase'

// Corps brut : la signature porte sur les octets exacts reçus.
export const config = { api: { bodyParser: false } }

async function rawBody(req: NextApiRequest): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
  return Buffer.concat(chunks).toString('utf8')
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const env = stripeEnv()
  if (!env?.webhookSecret) return res.status(503).json({ error: 'not configured' })

  const payload = await rawBody(req)
  const header = req.headers['stripe-signature']
  if (!verifyStripeSignature(payload, Array.isArray(header) ? header[0] : header, env.webhookSecret)) {
    console.warn('[stripe-webhook] signature invalide')
    return res.status(400).json({ error: 'signature' })
  }

  let event: StripeEvent
  try {
    event = JSON.parse(payload)
  } catch {
    return res.status(400).json({ error: 'json' })
  }
  if (event.livemode !== (env.mode === 'live')) {
    console.warn(`[stripe-webhook] ${event.id} : mode ${event.livemode ? 'réel' : 'test'} refusé par un serveur en mode ${env.mode}`)
    return res.status(400).json({ error: 'mode' })
  }

  const db = adminSupabase()
  const { data: seen, error: seenError } = await db.from('stripe_events').select('processed_at').eq('id', event.id).maybeSingle()
  if (seenError) return res.status(500).json({ error: 'db' })
  if (seen?.processed_at) return res.status(200).json({ received: true, duplicate: true })
  if (!seen) {
    await db.from('stripe_events').upsert(
      { id: event.id, type: event.type, livemode: event.livemode },
      { onConflict: 'id', ignoreDuplicates: true },
    )
  }

  try {
    const outcome = await handleStripeEvent(event, { store: supabaseBillingStore(db), stripe: stripeClient(env) })
    await db.from('stripe_events').update({ processed_at: new Date().toISOString(), error: null }).eq('id', event.id)
    console.log(`[stripe-webhook] ${event.type} ${event.id} → ${outcome}`)
    return res.status(200).json({ received: true })
  } catch (e) {
    const message = (e as Error).message
    console.error(`[stripe-webhook] ${event.type} ${event.id}`, message)
    await db.from('stripe_events').update({ error: message.slice(0, 500) }).eq('id', event.id)
    return res.status(500).json({ error: 'processing' })
  }
}
