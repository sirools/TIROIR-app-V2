// pages/api/profile/pseudo.ts — choisir ou changer son pseudo, le nom sous
// lequel on apparaît dans la messagerie privée.
//
// Par le serveur et non depuis le navigateur : le rôle authenticated n'a
// pas le droit d'écrire profiles.pseudo (migration 20261127140000). Le
// format est contrôlé ici (lib/messaging.ts, parsePseudo), l'unicité par la
// base, sans tenir compte de la casse.
import type { NextApiRequest, NextApiResponse } from 'next'
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { adminSupabase } from '../../../lib/supabase'
import { parsePseudo } from '../../../lib/messaging'
import { setPseudo } from '../../../lib/messagingServer'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
  }
  // getUser() et non getSession() : le jeton est vérifié auprès de Supabase.
  const { data: { user } } = await createPagesServerClient({ req, res }).auth.getUser()
  if (!user) return res.status(401).json({ error: 'AUTH_REQUIRED' })
  const pseudo = parsePseudo((req.body ?? {}).pseudo)
  if (!pseudo) return res.status(400).json({ error: 'INVALID_PSEUDO' })
  const result = await setPseudo(adminSupabase(), user.id, pseudo)
  if (!result.ok) return res.status(result.error === 'PSEUDO_TAKEN' ? 409 : 500).json({ error: result.error })
  return res.status(200).json({ ok: true, pseudo })
}
