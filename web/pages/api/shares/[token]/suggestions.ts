// pages/api/shares/[token]/suggestions.ts — un visiteur suggère un objet
// à la collection partagée par ce lien.
//
// Trois preuves avant d'écrire :
//   1. une session Tiroir (l'auteur est affiché au propriétaire) ;
//   2. pour un lien protégé, le cookie SIGNÉ posé par /verify ;
//   3. côté base (create_collection_suggestion) : lien valide, collection
//      déterminée, suggestions activées, quota d'attente.
import type { NextApiRequest, NextApiResponse } from 'next'
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { adminSupabase } from '../../../../lib/supabase'
import { hasSignedCookie } from '../../../../lib/shareCookieSignature'
import { parseSuggestionInput } from '../../../../lib/suggestions'
import { loadAuthors, toWish } from '../../../../lib/shareSuggestions'

const DB_ERRORS: Record<string, [number, string]> = {
  AUTH_REQUIRED: [401, 'AUTH_REQUIRED'],
  LINK_UNAVAILABLE: [410, 'LINK_UNAVAILABLE'],
  OWNER_CANNOT_SUGGEST: [403, 'OWNER_CANNOT_SUGGEST'],
  SUGGESTIONS_DISABLED: [403, 'SUGGESTIONS_DISABLED'],
  TOO_MANY_PENDING: [429, 'TOO_MANY_PENDING'],
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
  }

  const token = String(req.query.token ?? '').trim()
  if (!token) return res.status(400).json({ error: 'MISSING_TOKEN' })

  // getUser() et non getSession() : le jeton est vérifié auprès de Supabase.
  const userClient = createPagesServerClient({ req, res })
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) return res.status(401).json({ error: 'AUTH_REQUIRED' })

  const parsed = parseSuggestionInput(req.body ?? {})
  if (!parsed.ok) return res.status(400).json({ error: 'INVALID_INPUT', field: parsed.error })

  const admin = adminSupabase()
  const { data: link } = await admin
    .from('share_links')
    .select('options')
    .eq('token', token)
    .maybeSingle()
  if (!link) return res.status(404).json({ error: 'NOT_FOUND' })

  if (link.options?.password_protected && !hasSignedCookie(token, req, link.options?.password_hash)) {
    return res.status(403).json({ error: 'PASSWORD_REQUIRED' })
  }

  const { data: row, error } = await admin.rpc('create_collection_suggestion', {
    p_share_token: token,
    p_author_id: user.id,
    p_title: parsed.value.title,
    p_url: parsed.value.url,
    p_price: parsed.value.price,
  })

  if (error || !row) {
    const known = error?.message ? DB_ERRORS[error.message] : undefined
    if (known) return res.status(known[0]).json({ error: known[1] })
    console.error('create_collection_suggestion', error?.message)
    return res.status(500).json({ error: 'INTERNAL_ERROR' })
  }

  const authors = await loadAuthors(admin, [user.id])
  return res.status(201).json({ wish: toWish(row, authors) })
}
