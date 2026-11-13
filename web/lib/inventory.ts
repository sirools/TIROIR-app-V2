// L'inventaire sur le site (/mes-collections) : les collections et les
// objets du propriétaire connecté, comme dans l'app — même modèle, mêmes
// statuts. Ici la logique pure (tris, filtres, sélection, changement de
// statut), testée dans web/__tests__/inventory.test.ts ; le chargement est
// dans lib/inventoryServer.ts.
import { lotTotal } from './quantity'

/** Statuts d'un objet, dans l'ordre de l'app (collections/[id].tsx), « en vente » avant « vendu ». */
export const STATUSES = ['owned', 'stored', 'loaned', 'for_sale', 'sold', 'given', 'lost'] as const
export type Status = (typeof STATUSES)[number]
export const isStatus = (v: unknown): v is Status => (STATUSES as readonly string[]).includes(v as string)

/** Pastilles de statut : celles de la vue collection de l'app. */
export const STATUS_COLOR: Record<string, string> = {
  owned: '#22C55E', stored: '#38BDF8', loaned: '#E879F9',
  for_sale: '#F97316', sold: '#FBBF24', given: '#FB7185', lost: '#9CA3AF',
}

/** Adresse de la pseudo-collection des objets sans collection. */
export const NO_COLLECTION = 'sans-collection'

/** Retour après une annonce : seulement vers une page de l'inventaire. */
export function safeBack(raw: string | string[] | undefined): string {
  const from = Array.isArray(raw) ? raw[0] : raw
  return from && /^\/mes-collections(\/[A-Za-z0-9/-]*)?$/.test(from) ? from : '/mes-collections'
}

const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

// ── Collections ────────────────────────────────────────────────────

export type CollectionRow = {
  id: string
  name: string
  emoji: string | null
  icon_color: string | null
  pinned_at: string | null
  created_at: string
  last_activity_at: string | null
  object_count: number
}

/** Les tris de l'app (mobile/src/features/collections/sort.ts), dans le même ordre. */
export const COLLECTION_SORTS = ['created_asc', 'created_desc', 'updated_desc', 'name_asc', 'count_desc', 'count_asc'] as const
export type CollectionSort = (typeof COLLECTION_SORTS)[number]

/** Épinglées d'abord (la dernière épinglée en tête) ; le tri ne vaut que pour le reste. */
export function sortCollections<T extends CollectionRow>(list: T[], sort: CollectionSort): T[] {
  const byCreated = (a: T, b: T) => a.created_at.localeCompare(b.created_at)
  const compare: Record<CollectionSort, (a: T, b: T) => number> = {
    created_asc: byCreated,
    created_desc: (a, b) => -byCreated(a, b),
    updated_desc: (a, b) => (b.last_activity_at ?? b.created_at).localeCompare(a.last_activity_at ?? a.created_at),
    name_asc: (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    count_desc: (a, b) => b.object_count - a.object_count || byCreated(a, b),
    count_asc: (a, b) => a.object_count - b.object_count || byCreated(a, b),
  }
  const pinned = list.filter(c => c.pinned_at).sort((a, b) => (b.pinned_at as string).localeCompare(a.pinned_at as string))
  return [...pinned, ...list.filter(c => !c.pinned_at).sort(compare[sort])]
}

// ── Objets ─────────────────────────────────────────────────────────

export type ObjectRow = {
  id: string
  title: string
  status: string | null
  group_id: string | null
  quantity: number | null
  attributes: Record<string, unknown> | null
  user_value: number | null
  market_value: number | null
  value_currency: string | null
  created_at: string
}

/** Valeur affichée sur une vignette, comme dans l'app : la sienne, sinon l'estimation, fois la quantité. */
export const objectValue = (o: Pick<ObjectRow, 'user_value' | 'market_value' | 'quantity'>): number | null =>
  lotTotal(o.user_value ?? o.market_value, o.quantity)

export const attr = (o: Pick<ObjectRow, 'attributes'>, key: string): string => {
  const v = o.attributes?.[key]
  return typeof v === 'string' || typeof v === 'number' ? String(v).trim() : ''
}

export const OBJECT_SORTS = ['recent', 'name', 'value_desc', 'value_asc'] as const
export type ObjectSort = (typeof OBJECT_SORTS)[number]

/** Recherche sur le nom, la marque et le modèle, sans accents ni casse ; filtre par statut. */
export function filterObjects<T extends ObjectRow>(list: T[], f: { query: string; status: string }): T[] {
  const q = plain(f.query)
  return list.filter(o =>
    (!f.status || o.status === f.status)
    && (!q || plain(`${o.title} ${attr(o, 'brand')} ${attr(o, 'model')}`).includes(q)))
}

export function sortObjects<T extends ObjectRow>(list: T[], sort: ObjectSort): T[] {
  const out = [...list]
  if (sort === 'name') return out.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
  if (sort === 'recent') return out.sort((a, b) => b.created_at.localeCompare(a.created_at))
  // Sans valeur : toujours en fin de liste, dans un sens comme dans l'autre.
  const dir = sort === 'value_desc' ? -1 : 1
  return out.sort((a, b) => {
    const va = objectValue(a), vb = objectValue(b)
    if (va === null || vb === null) return va === vb ? 0 : va === null ? 1 : -1
    return (va - vb) * dir
  })
}

/**
 * Clic sur une case en mode sélection. Maj + clic étend la sélection de
 * `anchor` à `id`, dans l'ordre affiché ; sinon la case bascule.
 */
export function toggleSelection(
  selected: ReadonlySet<string>, order: string[], id: string, opts: { shift: boolean; anchor: string | null },
): Set<string> {
  const next = new Set(selected)
  const from = opts.shift && opts.anchor ? order.indexOf(opts.anchor) : -1
  const to = order.indexOf(id)
  if (from >= 0 && to >= 0) {
    for (let i = Math.min(from, to); i <= Math.max(from, to); i++) next.add(order[i])
    return next
  }
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

/**
 * Ce que « Changer le statut » écrit. Passer « en vente » ou « vendu » à
 * la main date l'événement, sans plateforme ni prix : seule l'annonce
 * préparée les connaît (lib/listing.ts, saleUpdate).
 */
export function statusPatch(status: Status, now: string): Record<string, string | null> {
  if (status === 'for_sale') return { status, listed_at: now, sold_at: null, sold_price: null }
  if (status === 'sold') return { status, sold_at: now }
  return { status, listing_platform: null, listed_at: null, sold_at: null, sold_price: null }
}

export function normCurrency(raw: string | null | undefined): string {
  const c = raw ?? 'EUR'
  if (c === '€') return 'EUR'
  if (c === '$') return 'USD'
  if (c === '£') return 'GBP'
  return c.length === 3 ? c : 'EUR'
}
