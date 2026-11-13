// pages/api/auctions/index.ts — « Mettre aux enchères » : le propriétaire
// ouvre une vente privée sur un ou plusieurs de ses objets. Session
// vérifiée ; les objets doivent être au compte, pas déjà vendus ni dans
// une autre vente ouverte (lib/auctionServer.ts).
import type { NextApiRequest, NextApiResponse } from 'next'
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { adminSupabase } from '../../../lib/supabase'
import { auctionsEnabled, parseNewAuction } from '../../../lib/auction'
import { createAuction } from '../../../lib/auctionServer'

const STATUS: Record<string, number> = { NOT_OWNED: 400, NOT_AVAILABLE: 409, ALREADY_IN_AUCTION: 409, DB: 500 }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
  }
  if (!auctionsEnabled()) return res.status(404).json({ error: 'NOT_FOUND' })

  const parsed = parseNewAuction((req.body ?? {}) as Record<string, unknown>)
  if (!parsed.ok) return res.status(400).json({ error: 'INVALID_INPUT', field: parsed.error })

  // getUser() et non getSession() : le jeton est vérifié auprès de Supabase.
  const { data: { user } } = await createPagesServerClient({ req, res }).auth.getUser()
  if (!user) return res.status(401).json({ error: 'AUTH_REQUIRED' })

  const result = await createAuction(adminSupabase(), user.id, parsed.value)
  if (!result.ok) return res.status(STATUS[result.error] ?? 500).json({ error: result.error })
  return res.status(201).json({ token: result.token })
}
