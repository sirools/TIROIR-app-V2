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

  const { free_ai_quota_monthly, free_objects_max, free_photos_per_object } = req.body

  const { error } = await admin
    .from('app_settings')
    .update({ free_ai_quota_monthly, free_objects_max, free_photos_per_object })
    .eq('id', 1)

  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ ok: true })
}
