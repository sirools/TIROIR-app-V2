// pages/api/essai/inscription — appelée par la page d'inscription juste
// avant la création du compte, quand le visiteur vient de l'essai.
//
// Elle rend le code de rattachement, que la page range dans les
// métadonnées du compte : si l'e-mail est confirmé sur un autre appareil
// (où le cookie de l'essai n'existe pas), l'objet est quand même retrouvé.
// Et elle prolonge l'essai, une seule fois, le temps que l'e-mail soit
// confirmé : sans cela, il serait supprimé avant que le compte n'existe.
import type { NextApiRequest, NextApiResponse } from 'next'
import { adminSupabase } from '../../../lib/supabase'
import { SIGNUP_GRACE_DAYS } from '../../../lib/trial'
import { readTrialCookie, trialFromCookie } from '../../../lib/trialServer'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
  }
  res.setHeader('Cache-Control', 'no-store')
  const admin = adminSupabase()
  const row = await trialFromCookie(admin, req)
  if (!row || row.status !== 'estimated') return res.status(200).json({ claim: null })

  const until = new Date(Date.now() + SIGNUP_GRACE_DAYS * 24 * 3600 * 1000).toISOString()
  // « signup_pending_at IS NULL » : la prolongation ne se rejoue pas.
  await admin.from('trial_objects')
    .update({ signup_pending_at: new Date().toISOString(), expires_at: until })
    .eq('id', row.id).is('signup_pending_at', null).lt('expires_at', until)

  return res.status(200).json({ claim: readTrialCookie(req)!.claim })
}
