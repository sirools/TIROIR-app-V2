// Lecture serveur (clé service) des données de revenus du back-office :
// paliers payants, journal des abonnements, crédits du mois. Le calcul est
// dans lib/subscriptionRevenue.ts.
import type { SupabaseClient } from '@supabase/supabase-js'
import { revenueReport, type RevenueReport } from './subscriptionRevenue'

export async function loadRevenueReport(db: SupabaseClient, now = new Date()): Promise<RevenueReport> {
  const monthStart = `${now.toISOString().slice(0, 7)}-01T00:00:00Z`
  const [profiles, subscriptions, siteCredits, appCredits] = await Promise.all([
    db.from('profiles').select('id, plan, plan_source').in('plan', ['premium', 'pro']),
    db.from('subscriptions')
      .select('user_id, source, tier, period, status, cancel_at_period_end, current_period_end, updated_at')
      .limit(10000),
    db.from('stripe_credit_purchases')
      .select('paid_at, amount_total, amount_refunded, credits')
      .gte('paid_at', monthStart),
    db.from('ai_credit_ledger')
      .select('created_at, delta')
      .eq('reason', 'purchase').like('ref', 'rc:%')
      .gte('created_at', monthStart),
  ])
  // Une table absente (base pas encore migrée) se lit comme vide.
  return revenueReport({
    now,
    profiles: profiles.data ?? [],
    subscriptions: subscriptions.data ?? [],
    siteCredits: siteCredits.data ?? [],
    appCredits: appCredits.data ?? [],
  })
}
