// pages/api/objects/listing.ts — depuis l'inventaire, le propriétaire
// déclare ses objets « en vente », « vendus », ou les retire de la vente.
// Pendant, sans lien de partage, de api/shares/[token]/listing.ts : session
// vérifiée, palier (lib/listing.ts), objets du compte seulement.
import type { NextApiRequest, NextApiResponse } from 'next'
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { adminSupabase } from '../../../lib/supabase'
import { canPrepareListing, parseIds, parsePrice, PLATFORMS, type Platform, type SaleAction } from '../../../lib/listing'
import { declareSale } from '../../../lib/listingServer'

const ACTIONS: SaleAction[] = ['list', 'sold', 'unlist']

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
  }

  const body = (req.body ?? {}) as Record<string, unknown>
  const action = body.action as SaleAction
  const platform = (body.platform ?? 'leboncoin') as Platform
  const ids = parseIds(Array.isArray(body.ids) ? body.ids.map(String) : undefined)
  if (!ACTIONS.includes(action) || !PLATFORMS.includes(platform) || ids.length === 0) {
    return res.status(400).json({ error: 'INVALID_INPUT' })
  }
  const hasPrice = body.price !== undefined && body.price !== null && body.price !== ''
  const price = hasPrice ? parsePrice(body.price) : null
  if (hasPrice && price === null) return res.status(400).json({ error: 'INVALID_PRICE' })

  // getUser() et non getSession() : le jeton est vérifié auprès de Supabase.
  const { data: { user } } = await createPagesServerClient({ req, res }).auth.getUser()
  if (!user) return res.status(401).json({ error: 'AUTH_REQUIRED' })

  const admin = adminSupabase()
  const { data: profile } = await admin.from('profiles').select('plan, pro_expires_at').eq('id', user.id).single()
  if (!canPrepareListing(profile?.plan, profile?.pro_expires_at)) return res.status(404).json({ error: 'NOT_FOUND' })

  const result = await declareSale(admin, user.id, ids, { action, price, platform })
  if (!result.ok) {
    return result.reason === 'NOT_OWNED'
      ? res.status(400).json({ error: 'INVALID_INPUT' })
      : res.status(500).json({ error: 'INTERNAL_ERROR', objects: result.objects })
  }
  return res.status(200).json({ objects: result.objects })
}
