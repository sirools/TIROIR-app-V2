// lib/shareSuggestions.ts — lecture serveur des idées et suggestions d'un
// partage. Serveur uniquement : reçoit le client Supabase à clé service.
//
// Tolérant par construction : tant que le brouillon
// v4/supabase/drafts/0003_collection_suggestions.sql n'est pas appliqué à la
// base visée, les requêtes échouent et la page se comporte exactement comme
// avant (ni bouton « + », ni réglage, ni module de tri).

import type { SupabaseClient } from '@supabase/supabase-js'
import { firstNameOf, type Wish, type WishAuthor, type WishStatus } from './suggestions'

export interface ShareCollection {
  id: string
  name: string
  suggestionsEnabled: boolean
}

export interface ShareSuggestions {
  /** Collection du lien ; null si indéterminable ou fonctionnalité absente. */
  collection: ShareCollection | null
  wishes: Wish[]
}

const NONE: ShareSuggestions = { collection: null, wishes: [] }

interface WishRow {
  id: string
  status: WishStatus
  title: string
  url: string | null
  price: number | string | null
  currency: string | null
  created_at: string
  suggested_by: string | null
}

export const WISH_COLUMNS = 'id, status, title, url, price, currency, created_at, suggested_by'

/** Prénom, nom affiché et photo (URL signée) des auteurs. */
export async function loadAuthors(admin: SupabaseClient, ids: string[]): Promise<Map<string, WishAuthor>> {
  const out = new Map<string, WishAuthor>()
  const unique = Array.from(new Set(ids.filter(Boolean)))
  if (unique.length === 0) return out

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, display_name, avatar_path')
    .in('id', unique)

  const paths = (profiles ?? []).map(p => p.avatar_path).filter(Boolean) as string[]
  const signedByPath = new Map<string, string>()
  if (paths.length) {
    const { data: signed } = await admin.storage.from('object-images').createSignedUrls(paths, 3600)
    for (const s of signed ?? []) if (s.path && s.signedUrl) signedByPath.set(s.path, s.signedUrl)
  }

  for (const id of unique) {
    const p = (profiles ?? []).find(x => x.id === id)
    out.set(id, {
      id,
      firstName: firstNameOf(p?.display_name),
      displayName: p?.display_name ?? null,
      avatarUrl: p?.avatar_path ? signedByPath.get(p.avatar_path) ?? null : null,
    })
  }
  return out
}

export function toWish(row: WishRow, authors: Map<string, WishAuthor>): Wish {
  return {
    id: row.id,
    status: row.status,
    title: row.title,
    url: row.url,
    price: row.price === null || row.price === undefined ? null : Number(row.price),
    currency: row.currency ?? 'EUR',
    createdAt: row.created_at,
    author: row.suggested_by ? authors.get(row.suggested_by) ?? null : null,
  }
}

/**
 * Ce que voit un visiteur : les idées validées et ses propres suggestions en
 * attente, et rien du tout si la collection n'accepte pas les suggestions.
 * Le propriétaire voit ses idées et toutes les suggestions en attente.
 * Les suggestions écartées ne sont jamais renvoyées.
 */
export async function loadShareSuggestions(
  admin: SupabaseClient,
  link: { id: string; user_id: string },
  viewerId: string | null,
): Promise<ShareSuggestions> {
  try {
    const { data: collectionId, error: rpcErr } = await admin
      .rpc('share_link_collection_id', { p_link_id: link.id })
    if (rpcErr || !collectionId) return NONE

    const { data: coll, error: collErr } = await admin
      .from('collections')
      .select('id, name, suggestions_enabled')
      .eq('id', collectionId)
      .single()
    if (collErr || !coll) return NONE

    const collection: ShareCollection = {
      id: coll.id,
      name: coll.name,
      suggestionsEnabled: Boolean(coll.suggestions_enabled),
    }
    const isOwner = viewerId !== null && viewerId === link.user_id
    if (!isOwner && !collection.suggestionsEnabled) return { collection, wishes: [] }

    let query = admin
      .from('collection_wishes')
      .select(WISH_COLUMNS)
      .eq('collection_id', collection.id)
      .order('created_at', { ascending: true })

    if (isOwner) {
      query = query.in('status', ['idea', 'suggested'])
    } else if (viewerId) {
      // viewerId vient de auth.getUser() : un UUID, sûr à interpoler.
      query = query.or(`status.eq.idea,and(status.eq.suggested,suggested_by.eq.${viewerId})`)
    } else {
      query = query.eq('status', 'idea')
    }

    const { data: rows, error } = await query
    if (error) return { collection, wishes: [] }

    const authors = await loadAuthors(admin, (rows ?? []).map(r => r.suggested_by).filter(Boolean) as string[])
    return { collection, wishes: (rows ?? []).map(r => toWish(r as WishRow, authors)) }
  } catch {
    return NONE
  }
}
