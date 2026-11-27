// pages/api/messages/index.ts — la boîte de réception du compte connecté :
// ses conversations et le nombre de messages non lus (pastille de l'en-tête).
import type { NextApiRequest, NextApiResponse } from 'next'
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { adminSupabase } from '../../../lib/supabase'
import { listThreads } from '../../../lib/messagingServer'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
  }
  res.setHeader('Cache-Control', 'private, no-store')
  const { data: { user } } = await createPagesServerClient({ req, res }).auth.getUser()
  if (!user) return res.status(401).json({ error: 'AUTH_REQUIRED' })
  const { items, unread } = await listThreads(adminSupabase(), user.id)
  return res.status(200).json({ unread, threads: items })
}
