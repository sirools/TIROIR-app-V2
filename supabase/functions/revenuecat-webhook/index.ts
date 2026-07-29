import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const REVENUECAT_WEBHOOK_SECRET = Deno.env.get('REVENUECAT_WEBHOOK_SECRET')!
const SUPABASE_URL               = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Events RevenueCat qui signifient que l'utilisateur a un abonnement actif
const ACTIVE_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
  'TRANSFER',
])

// Events qui signifient que l'abonnement est terminé/annulé
const INACTIVE_EVENTS = new Set([
  'EXPIRATION',
  'CANCELLATION',
  'BILLING_ISSUE',
  'SUBSCRIBER_ALIAS',
])

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  // Vérification du secret webhook
  const authHeader = req.headers.get('Authorization')
  if (authHeader !== REVENUECAT_WEBHOOK_SECRET) {
    console.warn('[revenuecat-webhook] Unauthorized request')
    return new Response('Unauthorized', { status: 401 })
  }

  const body = await req.json()
  const event = body.event

  if (!event) {
    return new Response('Bad request', { status: 400 })
  }

  const eventType  = event.type as string
  const appUserId  = event.app_user_id as string  // = user Supabase ID

  console.log(`[revenuecat-webhook] ${eventType} for user ${appUserId}`)

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  let newPlan: 'free' | 'premium' | null = null

  if (ACTIVE_EVENTS.has(eventType)) {
    newPlan = 'premium'
  } else if (INACTIVE_EVENTS.has(eventType)) {
    newPlan = 'free'
  }

  if (newPlan) {
    // Le palier Professionnel est vendu en direct sur facture : RevenueCat
    // n'en sait rien. Sans ce garde-fou, un EXPIRATION ou un TRANSFER
    // rétrograderait un client Pro en gratuit.
    const { error } = await admin
      .from('profiles')
      .update({ plan: newPlan })
      .eq('id', appUserId)
      .neq('plan', 'pro')

    if (error) {
      console.error(`[revenuecat-webhook] Failed to update plan:`, error.message)
      return new Response('Internal error', { status: 500 })
    }

    console.log(`[revenuecat-webhook] plan → ${newPlan} for ${appUserId} (comptes Pro exclus)`)
  }

  return new Response('OK', { status: 200 })
})
