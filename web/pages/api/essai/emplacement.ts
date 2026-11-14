// pages/api/essai/emplacement — « où ranges-tu cet objet ? » : l'emplacement
// de l'objet d'essai, modifiable tant qu'il n'est pas rattaché à un compte.
import type { NextApiRequest, NextApiResponse } from 'next'
import { adminSupabase } from '../../../lib/supabase'
import { cleanLocation } from '../../../lib/trial'
import { trialFromCookie } from '../../../lib/trialServer'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
  }
  const admin = adminSupabase()
  const row = await trialFromCookie(admin, req)
  if (!row || row.status !== 'estimated') return res.status(404).json({ error: 'NO_TRIAL' })

  const location = cleanLocation(((req.body ?? {}) as Record<string, unknown>).location)
  const { error } = await admin.from('trial_objects').update({ location_note: location }).eq('id', row.id).eq('status', 'estimated')
  if (error) {
    console.error('essai/emplacement', error.message)
    return res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
  return res.status(200).json({ location })
}
