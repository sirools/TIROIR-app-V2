// Lecture serveur (clé service) des appels IA du mois et du palier de leurs
// comptes. Le calcul est dans lib/aiEconomics.ts.
import type { SupabaseClient } from '@supabase/supabase-js'
import { aiEconomics, type AiEconomics, type UsageRow } from './aiEconomics'

export async function loadAiEconomics(db: SupabaseClient, args: { usdToEur: number; revenueHtEur: number; now?: Date }): Promise<AiEconomics> {
  const now = args.now ?? new Date()
  const monthStart = `${now.toISOString().slice(0, 7)}-01T00:00:00Z`
  const { data: usage } = await db.from('ai_usage')
    .select('user_id, feature, cost_usd')
    .gte('created_at', monthStart)
    .limit(100000)
  const rows = (usage ?? []) as UsageRow[]
  const ids = [...new Set(rows.map(r => r.user_id).filter((v): v is string => !!v))]
  const plans = new Map<string, string | null>()
  for (let i = 0; i < ids.length; i += 500) {
    const { data } = await db.from('profiles').select('id, plan').in('id', ids.slice(i, i + 500))
    for (const p of (data ?? []) as { id: string; plan: string | null }[]) plans.set(p.id, p.plan)
  }
  return aiEconomics({ usage: rows, plans, usdToEur: args.usdToEur, revenueHtEur: args.revenueHtEur })
}
