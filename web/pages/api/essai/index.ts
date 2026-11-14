// pages/api/essai — l'état de l'essai sans compte de ce navigateur, pour
// reprendre la page /essai là où elle en était. Sans cookie d'essai : rien.
import type { NextApiRequest, NextApiResponse } from 'next'
import { adminSupabase } from '../../../lib/supabase'
import { trialView } from '../../../lib/trial'
import { signedTrialPhoto, trialFromCookie } from '../../../lib/trialServer'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
  }
  res.setHeader('Cache-Control', 'no-store')
  const admin = adminSupabase()
  const row = await trialFromCookie(admin, req)
  if (!row) return res.status(200).json({ trial: null })
  return res.status(200).json({ trial: trialView(row, await signedTrialPhoto(admin, row)) })
}
