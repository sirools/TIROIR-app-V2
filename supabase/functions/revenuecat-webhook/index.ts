import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { endsAccess } from '../_shared/subscriptionEnd.ts'

const REVENUECAT_WEBHOOK_SECRET = Deno.env.get('REVENUECAT_WEBHOOK_SECRET')!
const SUPABASE_URL               = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Packs de crédits IA (produits consommables) — mêmes identifiants que
// mobile/src/lib/creditPacks.ts. Un achat arrive en NON_RENEWING_PURCHASE ;
// il crédite le compte et ne touche JAMAIS au plan d'abonnement.
const CREDIT_PACKS: Record<string, number> = {
  tiroir_credits_30: 30,
  tiroir_credits_80: 80,
}
function creditsForProduct(productId: unknown): number | null {
  if (typeof productId !== 'string') return null
  return CREDIT_PACKS[productId.split(':')[0]] ?? null
}

// Events RevenueCat qui signifient que l'utilisateur a un abonnement actif
const ACTIVE_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
  'TRANSFER',
])

// Fin de l'accès payant : _shared/subscriptionEnd.ts (une résiliation
// laisse l'accès jusqu'au bout de la période payée).

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

  // ── Pack de crédits : créditer, une seule fois par transaction ──
  const packCredits = creditsForProduct(event.product_id)
  if (packCredits !== null) {
    if (eventType === 'NON_RENEWING_PURCHASE' && appUserId) {
      const ref = String(event.transaction_id ?? event.id ?? '')
      if (!ref) return new Response('Bad request', { status: 400 })
      // grant_ai_credits est idempotent : rejouer le même événement ne
      // crédite rien de plus (référence unique par achat).
      const { error: grantError } = await admin.rpc('grant_ai_credits', {
        p_user_id: appUserId, p_amount: packCredits, p_reason: 'purchase', p_ref: `rc:${ref}`,
      })
      if (grantError) {
        console.error('[revenuecat-webhook] crédits', grantError.message)
        return new Response('Internal error', { status: 500 })
      }
      await admin.from('activity_log').insert({
        user_id: appUserId,
        action: 'purchase.credits',
        payload: { product_id: event.product_id ?? null, credits: packCredits, store: event.store ?? null },
      })
      console.log(`[revenuecat-webhook] +${packCredits} crédits pour ${appUserId}`)
    }
    // Un remboursement de pack (CANCELLATION) ne doit pas rétrograder un
    // abonné : on s'arrête là. Reprise des crédits : manuelle pour l'instant.
    return new Response('OK', { status: 200 })
  }

  let newPlan: 'free' | 'premium' | null = null

  if (ACTIVE_EVENTS.has(eventType)) {
    newPlan = 'premium'
  } else if (endsAccess(event)) {
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

  // Funnel : conversion (achat initial) + renouvellements, tracés dans activity_log.
  // Source serveur fiable (le client peut fermer l'app avant de confirmer).
  const purchaseAction =
    eventType === 'INITIAL_PURCHASE' ? 'purchase.completed'
    : eventType === 'RENEWAL'        ? 'purchase.renewed'
    : null
  if (purchaseAction && appUserId) {
    const { error: logError } = await admin
      .from('activity_log')
      .insert({
        user_id: appUserId,
        action: purchaseAction,
        payload: {
          event_type: eventType,
          product_id: event.product_id ?? null,
          period_type: event.period_type ?? null,
          store: event.store ?? null,
        },
      })
    if (logError) {
      // Ne jamais faire échouer le webhook pour un log manqué.
      console.warn(`[revenuecat-webhook] activity_log insert failed:`, logError.message)
    }
  }

  return new Response('OK', { status: 200 })
})
