// Chargement de l'inventaire pour les pages /mes-collections. Les pages
// vérifient d'abord la session (getUser) ; tout ce qui est lu ici avec la
// clé service est borné à `userId`. Mêmes tables que l'app : collections,
// objects, object_groups, object_images (bucket privé object-images,
// adresses signées une heure).
import type { GetServerSidePropsContext } from 'next'
import type { SupabaseClient } from '@supabase/supabase-js'
import { adminSupabase, serverSupabase } from './supabase'
import { asLocale, localePrefix } from './localeRouting'
import { canPrepareListing } from './listing'
import { NO_COLLECTION, type CollectionRow, type ObjectRow } from './inventory'

export type Owner = { userId: string; admin: SupabaseClient; canList: boolean }

/** Le propriétaire connecté, ou la redirection vers la connexion. */
export async function requireOwner(ctx: GetServerSidePropsContext): Promise<
  { owner: Owner } | { redirect: { destination: string; permanent: false } }
> {
  ctx.res.setHeader('X-Robots-Tag', 'noindex, nofollow')
  // getUser() et non getSession() : le jeton est vérifié auprès de Supabase.
  const { data: { user } } = await serverSupabase(ctx).auth.getUser()
  if (!user) return { redirect: { destination: `${localePrefix(asLocale(ctx.locale))}/login`, permanent: false } }
  const admin = adminSupabase()
  const { data: profile } = await admin.from('profiles').select('plan, pro_expires_at').eq('id', user.id).single()
  return { owner: { userId: user.id, admin, canList: canPrepareListing(profile?.plan, profile?.pro_expires_at) } }
}

async function signAll(admin: SupabaseClient, paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const unique = Array.from(new Set(paths.filter(Boolean)))
  if (!unique.length) return out
  const { data } = await admin.storage.from('object-images').createSignedUrls(unique, 3600)
  for (const s of data ?? []) if (s.path && s.signedUrl) out.set(s.path, s.signedUrl)
  return out
}

/** Toutes les lignes d'une requête, par pages de 1000 (plafond de l'API). */
async function allRows<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null }>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; from < 20000; from += 1000) {
    const { data } = await page(from, from + 999)
    out.push(...((data ?? []) as T[]))
    if (!data || data.length < 1000) break
  }
  return out
}

export type CollectionCard = CollectionRow & { cover: string | null }

/** Les collections du compte, avec leur couverture et leur nombre d'objets, et le nombre d'objets sans collection. */
export async function loadCollections({ admin, userId }: Owner): Promise<{ collections: CollectionCard[]; unfiled: number }> {
  const [{ data: rows }, objects, { count }] = await Promise.all([
    admin.from('collections')
      .select('id, name, emoji, icon_color, cover_image_path, pinned_at, created_at, updated_at')
      .eq('user_id', userId)
      .order('created_at'),
    allRows<{ collection_id: string; updated_at: string }>((from, to) =>
      admin.from('objects').select('collection_id, updated_at').eq('user_id', userId).not('collection_id', 'is', null).range(from, to)),
    admin.from('objects').select('id', { count: 'exact', head: true }).eq('user_id', userId).is('collection_id', null),
  ])
  const stats = new Map<string, { n: number; last: string }>()
  for (const o of objects) {
    const s = stats.get(o.collection_id) ?? { n: 0, last: '' }
    stats.set(o.collection_id, { n: s.n + 1, last: o.updated_at > s.last ? o.updated_at : s.last })
  }
  const list = (rows ?? []) as (Omit<CollectionRow, 'object_count' | 'last_activity_at'> & { cover_image_path: string | null; updated_at: string })[]
  const covers = await signAll(admin, list.map(c => c.cover_image_path ?? ''))
  return {
    collections: list.map(({ cover_image_path, updated_at, ...c }) => {
      const s = stats.get(c.id)
      return {
        ...c,
        object_count: s?.n ?? 0,
        last_activity_at: s && s.last > updated_at ? s.last : updated_at,
        cover: (cover_image_path && covers.get(cover_image_path)) || null,
      }
    }),
    unfiled: count ?? 0,
  }
}

export type ObjectCard = ObjectRow & { thumb: string | null }
export type GroupRow = { id: string; name: string }
export type CollectionView = {
  /** null : la pseudo-collection des objets sans collection. */
  collection: { id: string; name: string; emoji: string | null; icon_color: string | null; cover: string | null } | null
  objects: ObjectCard[]
  groups: GroupRow[]
}

const OBJECT_COLUMNS = 'id, title, status, group_id, quantity, attributes, user_value, market_value, value_currency, created_at'

/** Une collection du compte et ses objets, ou null si elle n'est pas au compte. */
export async function loadCollection({ admin, userId }: Owner, id: string): Promise<CollectionView | null> {
  const unfiled = id === NO_COLLECTION
  let collection: CollectionView['collection'] = null
  let groups: GroupRow[] = []
  if (!unfiled) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null
    const [{ data: row }, { data: groupRows }] = await Promise.all([
      admin.from('collections').select('id, name, emoji, icon_color, cover_image_path').eq('id', id).eq('user_id', userId).maybeSingle(),
      admin.from('object_groups').select('id, name').eq('collection_id', id).eq('user_id', userId).order('position').order('created_at'),
    ])
    if (!row) return null
    const cover = row.cover_image_path ? (await signAll(admin, [row.cover_image_path])).get(row.cover_image_path) ?? null : null
    collection = { id: row.id, name: row.name, emoji: row.emoji, icon_color: row.icon_color, cover }
    groups = (groupRows ?? []) as GroupRow[]
  }

  const rows = await allRows<ObjectRow>((from, to) => {
    const q = admin.from('objects').select(OBJECT_COLUMNS).eq('user_id', userId)
    return (unfiled ? q.is('collection_id', null) : q.eq('collection_id', id))
      .order('created_at', { ascending: false }).range(from, to)
  })

  // Vignette : la photo de couverture de chaque objet, comme dans l'app.
  const coverByObject = new Map<string, string>()
  for (let i = 0; i < rows.length; i += 200) {
    const { data } = await admin.from('object_images')
      .select('object_id, storage_path')
      .in('object_id', rows.slice(i, i + 200).map(o => o.id))
      .eq('user_id', userId)
      .eq('is_cover', true)
    for (const img of data ?? []) coverByObject.set(img.object_id, img.storage_path)
  }
  const signed = await signAll(admin, Array.from(coverByObject.values()))
  const objects = rows.map(o => ({ ...o, thumb: signed.get(coverByObject.get(o.id) ?? '') ?? null }))
  return { collection, objects, groups }
}

export type ObjectDetail = ObjectRow & {
  description: string | null
  location_note: string | null
  collection_id: string | null
  collection_name: string | null
  sale_price: number | null
  sale_price_lot: number | null
  range: { min: number; max: number } | null
  listed_at: string | null
  sold_at: string | null
  sold_price: number | null
  photos: { src: string; full: string }[]
}

/** La fiche d'un objet du compte, ou null. */
export async function loadObject({ admin, userId }: Owner, id: string): Promise<ObjectDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const [{ data: row }, { data: sale }, { data: images }] = await Promise.all([
    admin.from('objects')
      .select(`${OBJECT_COLUMNS}, description, location_note, collection_id, sale_price, sale_price_lot, value_sources`)
      .eq('id', id).eq('user_id', userId).maybeSingle(),
    // À part : colonnes de la migration 20261113063854.
    admin.from('objects').select('listed_at, sold_at, sold_price').eq('id', id).eq('user_id', userId).maybeSingle(),
    admin.from('object_images').select('storage_path, zoom_path').eq('object_id', id).eq('user_id', userId).order('position'),
  ])
  if (!row) return null
  const { value_sources, ...object } = row as unknown as ObjectDetail & { value_sources: Record<string, unknown> | null }
  const imgs = (images ?? []) as { storage_path: string; zoom_path: string | null }[]
  const [signed, { data: collection }] = await Promise.all([
    signAll(admin, imgs.flatMap(i => [i.storage_path, i.zoom_path ?? ''])),
    object.collection_id
      ? admin.from('collections').select('name').eq('id', object.collection_id).eq('user_id', userId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  const min = Number(value_sources?.value_min), max = Number(value_sources?.value_max)
  return {
    ...object,
    collection_name: collection?.name ?? null,
    range: min > 0 && max >= min ? { min, max } : null,
    listed_at: sale?.listed_at ?? null,
    sold_at: sale?.sold_at ?? null,
    sold_price: sale?.sold_price ?? null,
    photos: imgs.flatMap(i => {
      const src = signed.get(i.storage_path)
      return src ? [{ src, full: (i.zoom_path && signed.get(i.zoom_path)) || src }] : []
    }),
  }
}
