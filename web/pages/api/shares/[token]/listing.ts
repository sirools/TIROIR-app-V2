// pages/api/shares/[token]/listing.ts — le propriétaire déclare un objet
// « en vente » (après avoir déposé son annonce), « vendu », ou le retire de
// la vente. Tiroir ne publie rien : c'est une déclaration.
//
// Mêmes preuves que la page /s/<jeton>/annonces : session vérifiée,
// propriétaire du lien, lien valide, palier (lib/listing.ts), objets du
// partage ET du compte. Écrit par la clé service, bornée à ces objets.
import type { NextApiRequest, NextApiResponse } from 'next'
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { adminSupabase } from '../../../../lib/supabase'
import {
  canPrepareListing, parseIds, parsePrice, PLATFORMS,
  type Platform, type SaleAction,
} from '../../../../lib/listing'
import { declareSale } from '../../../../lib/listingServer'

const ACTIONS: SaleAction[] = ['list', 'sold', 'unlist']

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
  }

  const token = String(req.query.token ?? '').trim()
  const body = (req.body ?? {}) as Record<string, unknown>
  const action = body.action as SaleAction
  const platform = (body.platform ?? 'leboncoin') as Platform
  const ids = parseIds(Array.isArray(body.ids) ? body.ids.map(String) : undefined)
  if (!token || !ACTIONS.includes(action) || !PLATFORMS.includes(platform) || ids.length === 0) {
    return res.status(400).json({ error: 'INVALID_INPUT' })
  }
  const hasPrice = body.price !== undefined && body.price !== null && body.price !== ''
  const price = hasPrice ? parsePrice(body.price) : null
  if (hasPrice && price === null) return res.status(400).json({ error: 'INVALID_PRICE' })

  // getUser() et non getSession() : le jeton est vérifié auprès de Supabase.
  const userClient = createPagesServerClient({ req, res })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return res.status(401).json({ error: 'AUTH_REQUIRED' })

  const admin = adminSupabase()
  const { data: link } = await admin
    .from('share_links')
    .select('user_id, object_ids, expires_at, is_archived')
    .eq('token', token)
    .maybeSingle()
  // Même réponse pour un lien inconnu et pour le lien d'un autre : rien à apprendre ici.
  if (!link || link.user_id !== user.id) return res.status(404).json({ error: 'NOT_FOUND' })
  if (link.is_archived || (link.expires_at && new Date(link.expires_at) < new Date())) {
    return res.status(410).json({ error: 'LINK_UNAVAILABLE' })
  }

  const { data: profile } = await admin.from('profiles').select('plan, pro_expires_at').eq('id', user.id).single()
  if (!canPrepareListing(profile?.plan, profile?.pro_expires_at)) return res.status(404).json({ error: 'NOT_FOUND' })

  const shared = new Set<string>(Array.isArray(link.object_ids) ? link.object_ids : [])
  if (!ids.every(id => shared.has(id))) return res.status(400).json({ error: 'INVALID_INPUT' })

  const result = await declareSale(admin, user.id, ids, { action, price, platform })
  if (!result.ok) {
    return result.reason === 'NOT_OWNED'
      ? res.status(400).json({ error: 'INVALID_INPUT' })
      : res.status(500).json({ error: 'INTERNAL_ERROR', objects: result.objects })
  }
  return res.status(200).json({ objects: result.objects })
}
