// lib/shareSuggestions.ts — lecture serveur des idées et suggestions d'un
// partage. Serveur uniquement : reçoit le client Supabase à clé service.
//
// Tolérant par construction : tant que les migrations des suggestions ne
// sont pas appliquées à la base visée, les requêtes échouent et la page se
// comporte exactement comme avant (ni tuile « + », ni module de tri).

import type { SupabaseClient } from '@supabase/supabase-js'
import { firstNameOf, type Wish, type WishAuthor, type WishStatus } from './suggestions'

export interface ShareCollection {
  id: string
  name: string
}

export interface ShareSuggestions {
  /** Collection du lien ; null si indéterminable ou fonctionnalité absente. */
  collection: ShareCollection | null
  /** Le partage accepte les ajouts (réglé dans l'app, sur le partage). */
  allowSuggestions: boolean
  wishes: Wish[]
}

const NONE: ShareSuggestions = { collection: null, allowSuggestions: false, wishes: [] }

interface WishRow {
  id: string
  status: WishStatus
  title: string
  url: string | null
  price: number | string | null
  currency: string | null
  created_at: string
  suggested_by: string | null
  source_object_id?: string | null
}

const BASE_COLUMNS = 'id, status, title, url, price, currency, created_at, suggested_by'
/** Colonne ajoutée par la migration 0004 ; lue si elle existe. */
export const WISH_COLUMNS = `${BASE_COLUMNS}, source_object_id`

/** Réglage « ajouts autorisés » d'un partage, depuis ses options JSONB. */
export function linkAllowsSuggestions(options: unknown): boolean {
  return Boolean((options as { allow_suggestions?: unknown } | null)?.allow_suggestions === true)
}

async function signPaths(admin: SupabaseClient, paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (!paths.length) return out
  const { data } = await admin.storage.from('object-images').createSignedUrls(paths, 3600)
  for (const s of data ?? []) if (s.path && s.signedUrl) out.set(s.path, s.signedUrl)
  return out
}

/** Prénom, nom affiché et photo (URL signée) des auteurs. */
export async function loadAuthors(admin: SupabaseClient, ids: string[]): Promise<Map<string, WishAuthor>> {
  const out = new Map<string, WishAuthor>()
  const unique = Array.from(new Set(ids.filter(Boolean)))
  if (unique.length === 0) return out

  const { data: profiles } = await admin
    .from('profiles')
    .select('id, display_name, avatar_path')
    .in('id', unique)

  const signed = await signPaths(admin, (profiles ?? []).map(p => p.avatar_path).filter(Boolean) as string[])

  for (const id of unique) {
    const p = (profiles ?? []).find(x => x.id === id)
    out.set(id, {
      id,
      firstName: firstNameOf(p?.display_name),
      displayName: p?.display_name ?? null,
      avatarUrl: p?.avatar_path ? signed.get(p.avatar_path) ?? null : null,
    })
  }
  return out
}

/**
 * Photo de couverture des objets proposés depuis le Tiroir de leur auteur.
 * L'auteur a choisi de les montrer au propriétaire du partage : le serveur
 * signe la photo pour lui, le temps d'un affichage.
 */
export async function loadSourceCovers(admin: SupabaseClient, objectIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const unique = Array.from(new Set(objectIds.filter(Boolean)))
  if (!unique.length) return out
  const { data: covers } = await admin
    .from('object_images')
    .select('object_id, storage_path')
    .in('object_id', unique)
    .eq('is_cover', true)
  const signed = await signPaths(admin, (covers ?? []).map(c => c.storage_path))
  for (const c of covers ?? []) {
    const url = signed.get(c.storage_path)
    if (url) out.set(c.object_id, url)
  }
  return out
}

export function toWish(row: WishRow, authors: Map<string, WishAuthor>, covers = new Map<string, string>()): Wish {
  const source = row.source_object_id ?? null
  return {
    id: row.id,
    status: row.status,
    title: row.title,
    url: row.url,
    price: row.price === null || row.price === undefined ? null : Number(row.price),
    currency: row.currency ?? 'EUR',
    createdAt: row.created_at,
    author: row.suggested_by ? authors.get(row.suggested_by) ?? null : null,
    imageUrl: source ? covers.get(source) ?? null : null,
    fromTiroir: source !== null,
  }
}

/**
 * Ce que voit un visiteur : les idées validées et ses propres suggestions en
 * attente, et rien du tout si le partage n'accepte pas les ajouts.
 * Le propriétaire voit ses idées et toutes les suggestions en attente.
 * Les suggestions écartées ne sont jamais renvoyées.
 */
export async function loadShareSuggestions(
  admin: SupabaseClient,
  link: { id: string; user_id: string; options?: unknown },
  viewerId: string | null,
): Promise<ShareSuggestions> {
  try {
    const { data: collectionId, error: rpcErr } = await admin
      .rpc('share_link_collection_id', { p_link_id: link.id })
    if (rpcErr || !collectionId) return NONE

    const { data: coll, error: collErr } = await admin
      .from('collections')
      .select('id, name')
      .eq('id', collectionId)
      .single()
    if (collErr || !coll) return NONE

    const collection: ShareCollection = { id: coll.id, name: coll.name }
    const allowSuggestions = linkAllowsSuggestions(link.options)
    const isOwner = viewerId !== null && viewerId === link.user_id
    if (!isOwner && !allowSuggestions) return { collection, allowSuggestions, wishes: [] }

    const run = (columns: string) => {
      let query = admin
        .from('collection_wishes')
        .select(columns)
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
      return query
    }

    // Base sans la migration 0004 : on relit sans la colonne de l'objet source.
    let { data: rows, error } = await run(WISH_COLUMNS)
    if (error) ({ data: rows, error } = await run(BASE_COLUMNS))
    if (error) return { collection, allowSuggestions, wishes: [] }

    const list = (rows ?? []) as unknown as WishRow[]
    const [authors, covers] = await Promise.all([
      loadAuthors(admin, list.map(r => r.suggested_by).filter(Boolean) as string[]),
      loadSourceCovers(admin, list.map(r => r.source_object_id).filter(Boolean) as string[]),
    ])
    return { collection, allowSuggestions, wishes: list.map(r => toWish(r, authors, covers)) }
  } catch {
    return NONE
  }
}
