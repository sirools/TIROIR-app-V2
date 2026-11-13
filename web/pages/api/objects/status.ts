// pages/api/objects/status.ts — « Changer le statut » depuis l'inventaire,
// pour un ou plusieurs objets. Même effet que « Statuer » dans l'app (une
// mise à jour de objects.status), avec la date de mise en vente ou de vente
// quand le statut le demande (lib/inventory.ts, statusPatch).
//
// Session vérifiée ; seuls les objets du compte sont touchés.
import type { NextApiRequest, NextApiResponse } from 'next'
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { adminSupabase } from '../../../lib/supabase'
import { isStatus, statusPatch } from '../../../lib/inventory'

const MAX_IDS = 500

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
  }
  const body = (req.body ?? {}) as Record<string, unknown>
  const ids = Array.isArray(body.ids) ? Array.from(new Set(body.ids.map(String))) : []
  if (!isStatus(body.status) || ids.length === 0 || ids.length > MAX_IDS || !ids.every(id => /^[0-9a-f-]{36}$/i.test(id))) {
    return res.status(400).json({ error: 'INVALID_INPUT' })
  }

  // getUser() et non getSession() : le jeton est vérifié auprès de Supabase.
  const { data: { user } } = await createPagesServerClient({ req, res }).auth.getUser()
  if (!user) return res.status(401).json({ error: 'AUTH_REQUIRED' })

  const { data, error } = await adminSupabase()
    .from('objects')
    .update(statusPatch(body.status, new Date().toISOString()))
    .in('id', ids)
    .eq('user_id', user.id)
    .select('id, status')
  if (error) {
    console.error('objects/status', error.message)
    return res.status(500).json({ error: 'INTERNAL_ERROR' })
  }
  return res.status(200).json({ objects: data ?? [] })
}
