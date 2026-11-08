// Lecture serveur de la santé des paiements : stripe_events (base) et
// l'API Stripe (paiements refusés, litiges). Une erreur Stripe ne casse pas
// la page : elle est signalée (stripeUnavailable).
import type { SupabaseClient } from '@supabase/supabase-js'
import { stripeEnv } from '../stripeConfig'
import { stripeClient } from './api'
import { paymentHealth, type PaymentHealth, type StripeEventRow } from './health'

export async function loadPaymentHealth(db: SupabaseClient, now = new Date()): Promise<PaymentHealth> {
  const since30d = new Date(now.getTime() - 30 * 86400_000)
  const { data: events } = await db.from('stripe_events')
    .select('id, type, received_at, processed_at, error')
    .gte('received_at', since30d.toISOString())
    .or('error.not.is.null,processed_at.is.null')
    .order('received_at', { ascending: false })
    .limit(200)

  let charges: unknown[] = []
  let disputes: unknown[] = []
  let stripeUnavailable = false
  const env = stripeEnv()
  if (!env) stripeUnavailable = true
  else {
    const stripe = stripeClient(env)
    try {
      const [c, d] = await Promise.all([
        stripe<{ data: unknown[] }>('GET', '/v1/charges', { limit: 100, created: { gte: Math.floor(since30d.getTime() / 1000) } }),
        stripe<{ data: unknown[] }>('GET', '/v1/disputes', { limit: 100, created: { gte: Math.floor(now.getTime() / 1000) - 90 * 86400 } }),
      ])
      charges = c.data
      disputes = d.data
    } catch (e) {
      console.error('[payment-health]', (e as Error).message)
      stripeUnavailable = true
    }
  }
  return paymentHealth({ events: (events ?? []) as StripeEventRow[], charges, disputes, stripeUnavailable, now })
}
