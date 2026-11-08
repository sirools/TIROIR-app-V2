// Formule Business, côté serveur (clé service) : retrouver un compte par
// son adresse, lire une organisation et ses membres, répercuter un
// changement de sièges sur Stripe.
import type { SupabaseClient } from '@supabase/supabase-js'
import { stripeEnv } from './stripeConfig'
import { stripeClient } from './stripe/api'
import { updateSeats, type OrgForBilling } from './stripe/orgBilling'

export const ORG_COLUMNS =
  'id, name, legal_name, siren, vat_number, billing_email, address_line1, address_line2, postal_code, city, country, ' +
  'stripe_customer_id, stripe_subscription_id, subscription_status, seat_quantity, seat_unit_amount, current_period_end, pro_access_until, created_at'

export type OrgRecord = OrgForBilling & {
  subscription_status: string | null
  seat_unit_amount: number | null
  current_period_end: string | null
  pro_access_until: string | null
  created_at: string
}

/** Compte Tiroir dont l'adresse est exactement `email`, ou null. */
export async function findAccountIdByEmail(db: SupabaseClient, email: string): Promise<string | null> {
  const wanted = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(wanted)) return null
  const { data } = await db.rpc('admin_list_accounts', { p_plan: null, p_query: wanted, p_limit: 10, p_offset: 0 })
  const hit = ((data ?? []) as { id: string; email: string | null }[]).find(a => a.email?.toLowerCase() === wanted)
  return hit?.id ?? null
}

export type MemberView = { user_id: string; email: string | null; role: string; plan: string | null; pro_from_org: boolean }

/** Membres actifs, avec leur adresse (lue dans auth.users, côté serveur). */
export async function listMembers(db: SupabaseClient, orgId: string): Promise<MemberView[]> {
  const { data: rows } = await db.from('org_members')
    .select('user_id, role, pro_granted').eq('org_id', orgId).eq('status', 'active').order('added_at')
  const members = (rows ?? []) as { user_id: string; role: string; pro_granted: boolean }[]
  const { data: profiles } = await db.from('profiles').select('id, plan').in('id', members.map(m => m.user_id))
  const plans = new Map(((profiles ?? []) as { id: string; plan: string }[]).map(p => [p.id, p.plan]))
  return Promise.all(members.map(async m => {
    const { data } = await db.auth.admin.getUserById(m.user_id)
    return { user_id: m.user_id, email: data?.user?.email ?? null, role: m.role, plan: plans.get(m.user_id) ?? null, pro_from_org: m.pro_granted }
  }))
}

/**
 * Après un ajout ou un retrait : aligne la quantité de l'abonnement Stripe
 * sur le nombre de membres actifs. Renvoie false si Stripe n'a pas pu être
 * mis à jour (le back-office affiche alors l'écart, à resynchroniser).
 */
export async function pushSeats(db: SupabaseClient, orgId: string, seats: number): Promise<boolean> {
  const { data: org } = await db.from('organizations').select('stripe_subscription_id, seat_quantity').eq('id', orgId).single()
  if (!org?.stripe_subscription_id) return true
  const env = stripeEnv()
  if (!env) return false
  try {
    await updateSeats(stripeClient(env), org.stripe_subscription_id, org.seat_quantity ?? seats, seats)
    return true
  } catch (e) {
    console.error('[business] sièges', (e as Error).message)
    return false
  }
}
