import type { NextApiRequest, NextApiResponse } from 'next'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { adminSupabase } from '../../../lib/supabase'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const supabase = createServerSupabaseClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return res.status(401).json({ error: 'Non authentifié' })

  const admin = adminSupabase()
  const { data: profile } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('id', session.user.id)
    .single()

  if (!profile?.is_admin) return res.status(403).json({ error: 'Accès refusé' })

  const {
    free_ai_quota_monthly, free_objects_max, free_photos_per_object,
    premium_ai_quota_monthly, premium_photo_enhance_quota_monthly,
    pro_ai_quota_monthly, pro_photo_enhance_quota_monthly,
    supabase_db_limit_mb, supabase_storage_limit_mb,
    supabase_plan_monthly_usd, supabase_egress_limit_gb,
    supabase_egress_used_gb, supabase_egress_reading_date,
    estimated_cost_per_ai_analysis_usd, estimated_cost_per_photo_enhance_usd,
    monthly_ai_spend_alert_usd,
  } = req.body

  const { error } = await admin
    .from('app_settings')
    .update({
      free_ai_quota_monthly, free_objects_max, free_photos_per_object,
      premium_ai_quota_monthly, premium_photo_enhance_quota_monthly,
      pro_ai_quota_monthly, pro_photo_enhance_quota_monthly,
      supabase_db_limit_mb, supabase_storage_limit_mb,
      supabase_plan_monthly_usd, supabase_egress_limit_gb,
      supabase_egress_used_gb,
      // Champ date nullable : une chaîne vide ferait échouer le cast Postgres.
      supabase_egress_reading_date: supabase_egress_reading_date || null,
      estimated_cost_per_ai_analysis_usd, estimated_cost_per_photo_enhance_usd,
      monthly_ai_spend_alert_usd,
    })
    .eq('id', 1)

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ ok: true })
}
