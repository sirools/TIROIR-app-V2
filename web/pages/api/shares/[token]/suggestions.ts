// pages/api/shares/[token]/suggestions.ts — un visiteur suggère un objet
// à la collection partagée par ce lien.
//
// Un objet saisi (nom, lien, prix) ou un objet du Tiroir de l'auteur
// (sourceObjectId). Trois preuves avant d'écrire :
//   1. une session Tiroir (l'auteur est affiché au propriétaire) ;
//   2. pour un lien protégé, le cookie SIGNÉ posé par /verify ;
//   3. côté base (create_collection_suggestion) : lien valide, ajouts
//      autorisés sur ce partage, collection déterminée, objet source à
//      l'auteur, quota d'attente.
import type { NextApiRequest, NextApiResponse } from 'next'
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { adminSupabase } from '../../../../lib/supabase'
import { hasSignedCookie } from '../../../../lib/shareCookieSignature'
import { parseSuggestionInput } from '../../../../lib/suggestions'
import { loadAuthors, loadSourceCovers, toWish } from '../../../../lib/shareSuggestions'

const DB_ERRORS: Record<string, [number, string]> = {
  AUTH_REQUIRED: [401, 'AUTH_REQUIRED'],
  LINK_UNAVAILABLE: [410, 'LINK_UNAVAILABLE'],
  OWNER_CANNOT_SUGGEST: [403, 'OWNER_CANNOT_SUGGEST'],
  SUGGESTIONS_DISABLED: [403, 'SUGGESTIONS_DISABLED'],
  TOO_MANY_PENDING: [429, 'TOO_MANY_PENDING'],
  SOURCE_NOT_FOUND: [404, 'SOURCE_NOT_FOUND'],
  ALREADY_SUGGESTED: [409, 'ALREADY_SUGGESTED'],
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

  if (link.options?.password_protected && !hasSignedCookie(token, req)) {
    return res.status(403).json({ error: 'PASSWORD_REQUIRED' })
  }

  const { title, url, price, sourceObjectId } = parsed.value
  const { data: row, error } = await admin.rpc('create_collection_suggestion', {
    p_share_token: token,
    p_author_id: user.id,
    p_title: title || null,
    p_url: url,
    p_price: price,
    // Seulement s'il y en a un : la signature sans objet source reste
    // valable sur une base qui n'a pas encore la migration 0004.
    ...(sourceObjectId ? { p_source_object_id: sourceObjectId } : {}),
  })

  if (error || !row) {
    const known = error?.message ? DB_ERRORS[error.message] : undefined
    if (known) return res.status(known[0]).json({ error: known[1] })
    console.error('create_collection_suggestion', error?.message)
    return res.status(500).json({ error: 'INTERNAL_ERROR' })
  }

  const [authors, covers] = await Promise.all([
    loadAuthors(admin, [user.id]),
    loadSourceCovers(admin, row.source_object_id ? [row.source_object_id] : []),
  ])
  return res.status(201).json({ wish: toWish(row, authors, covers) })
}
