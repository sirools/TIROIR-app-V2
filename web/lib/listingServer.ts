// Côté serveur de « Préparer l'annonce » : charger les objets d'une
// annonce et écrire une mise en vente. Appelé par les pages et les API du
// lien de partage et de l'inventaire, qui font d'abord leurs contrôles
// (session vérifiée, propriétaire, palier). Tout est borné à `userId`.
import type { SupabaseClient } from '@supabase/supabase-js'
import { saleUpdate, type ListingInput, type Platform, type SaleAction } from './listing'

export type ListingPhoto = { thumb: string; full: string }
/** Suivi de la vente d'une fiche (migration 20261113063854_object_for_sale). */
export type ListingSale = {
  status: string | null
  sale_price: number | null
  sale_price_lot: number | null
  listing_platform: string | null
  listed_at: string | null
  sold_price: number | null
  sold_at: string | null
}
export type ListingItem = ListingInput & { id: string; status: string | null; photos: ListingPhoto[]; sale: ListingSale | null }

const SALE_COLUMNS = 'id, status, quantity, sale_price, sale_price_lot, listing_platform, listed_at, sold_price, sold_at'

/** Les objets de `ids` qui sont au compte, dans l'ordre demandé, avec leurs photos signées. */
export async function loadListingItems(
  admin: SupabaseClient, userId: string, ids: string[],
): Promise<{ items: ListingItem[]; saleReady: boolean }> {
  if (ids.length === 0) return { items: [], saleReady: false }

  // location_note et les notes ne sont pas chargés : ils n'ont rien à faire dans une annonce.
  const [{ data: rows }, { data: imgRows }, { data: saleRows, error: saleError }] = await Promise.all([
    admin.from('objects')
      .select('id, title, description, status, attributes, quantity, sale_price, sale_price_lot, user_value, market_value, value_currency, value_sources')
      .in('id', ids)
      .eq('user_id', userId),
    admin.from('object_images').select('object_id, storage_path, zoom_path').in('object_id', ids).order('position'),
    // À part : ces colonnes n'existent qu'après la migration, la page doit s'ouvrir avant.
    admin.from('objects').select(SALE_COLUMNS).in('id', ids).eq('user_id', userId),
  ])
  const saleById = new Map(((saleRows ?? []) as unknown as (ListingSale & { id: string; quantity?: number })[])
    .map(({ id, quantity: _q, ...sale }) => [id, sale as ListingSale]))

  // La copie haute définition, quand elle existe, est celle qu'on télécharge.
  const images = (imgRows ?? []) as { object_id: string; storage_path: string; zoom_path: string | null }[]
  const paths = Array.from(new Set(images.flatMap(r => (r.zoom_path ? [r.storage_path, r.zoom_path] : [r.storage_path]))))
  const urlByPath = new Map<string, string>()
  if (paths.length) {
    const { data: signed } = await admin.storage.from('object-images').createSignedUrls(paths, 3600)
    for (const s of signed ?? []) if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl)
  }

  const byId = new Map(((rows ?? []) as unknown as (Omit<ListingItem, 'photos' | 'sale'>)[]).map(r => [r.id, r]))
  const items: ListingItem[] = ids.flatMap(id => {
    const row = byId.get(id)
    if (!row) return []
    const photos = images.filter(r => r.object_id === id).flatMap(r => {
      const thumb = urlByPath.get(r.storage_path)
      if (!thumb) return []
      return [{ thumb, full: (r.zoom_path && urlByPath.get(r.zoom_path)) || thumb }]
    })
    // De value_sources, seule la fourchette part dans le navigateur.
    const range = row.value_sources
      ? { value_min: row.value_sources.value_min ?? null, value_max: row.value_sources.value_max ?? null }
      : null
    return [{ ...row, value_sources: range, photos, sale: saleById.get(id) ?? null }]
  })
  return { items, saleReady: !saleError }
}

/**
 * Déclare des objets du compte en vente, vendus, ou retirés de la vente.
 * `ok: false` si un objet n'est pas au compte ou si la base refuse ;
 * `objects` porte ce qui a été écrit avant l'échec.
 */
export async function declareSale(
  admin: SupabaseClient, userId: string, ids: string[],
  opts: { action: SaleAction; price: number | null; platform: Platform },
): Promise<{ ok: boolean; reason?: 'NOT_OWNED' | 'DB'; objects: unknown[] }> {
  const { data: rows } = await admin.from('objects').select('id, quantity').in('id', ids).eq('user_id', userId)
  if (!rows || rows.length !== ids.length) return { ok: false, reason: 'NOT_OWNED', objects: [] }

  const now = new Date().toISOString()
  const objects: unknown[] = []
  for (const row of rows) {
    const patch = saleUpdate(opts.action, row, { price: opts.price, platform: opts.platform, shared: ids.length > 1, now })
    const { data, error } = await admin
      .from('objects').update(patch).eq('id', row.id).eq('user_id', userId)
      .select(SALE_COLUMNS).single()
    if (error || !data) {
      console.error('declareSale', opts.action, error?.message)
      return { ok: false, reason: 'DB', objects }
    }
    objects.push(data)
  }
  return { ok: true, objects }
}
