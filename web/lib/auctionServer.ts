// Côté serveur de la salle des ventes. Les tables auctions, auction_bids
// et auction_messages n'ont aucune politique RLS : tout passe par ici, avec
// la clé service, après que la route ou la page a vérifié la session, le
// lien et son mot de passe. Un invité ne reçoit que ce que cette vue
// compose : jamais l'emplacement, les notes, le prix d'achat ni le prix de
// réserve.
import { createHash, randomBytes } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { publicAttributes } from './listing'
import { outcome, minNextBid, type AuctionRow, type AuctionState, type BidRow, type NewAuction } from './auction'
import { loadAuthors } from './shareSuggestions'

export type AuctionRecord = AuctionRow & {
  id: string
  user_id: string
  token: string
  title: string
  object_ids: string[]
  currency: string
  password_hash: string | null
  created_at: string
}

const COLUMNS = 'id, user_id, token, title, object_ids, start_price, reserve_price, currency, password_hash, ends_at, cancelled_at, handed_over_at, created_at'

export const hashPassword = (password: string) => createHash('sha256').update(password).digest('hex')

/** Nom du cookie signé posé après le mot de passe d'une vente (lib/shareCookieSignature.ts). */
export const auctionCookieKey = (token: string) => `enchere_${token}`

const num = (v: unknown) => Number(v)

function normalize(row: Record<string, unknown>): AuctionRecord {
  const r = row as unknown as AuctionRecord
  return { ...r, start_price: num(r.start_price), reserve_price: r.reserve_price === null ? null : num(r.reserve_price) }
}

export async function loadAuctionByToken(admin: SupabaseClient, token: string): Promise<AuctionRecord | null> {
  if (!/^[a-z0-9]{6,32}$/.test(token)) return null
  const { data } = await admin.from('auctions').select(COLUMNS).eq('token', token).maybeSingle()
  return data ? normalize(data) : null
}

async function loadBids(admin: SupabaseClient, auctionIds: string[]): Promise<Map<string, BidRow[]>> {
  const out = new Map<string, BidRow[]>()
  if (!auctionIds.length) return out
  const { data } = await admin.from('auction_bids')
    .select('id, auction_id, bidder_id, amount, created_at')
    .in('auction_id', auctionIds)
    .order('created_at', { ascending: false })
    .limit(2000)
  for (const b of data ?? []) {
    const list = out.get(b.auction_id) ?? []
    list.push({ id: b.id, bidder_id: b.bidder_id, amount: num(b.amount), created_at: b.created_at })
    out.set(b.auction_id, list)
  }
  return out
}

export type Person = { firstName: string; avatarUrl: string | null }
export type AuctionLot = {
  id: string
  title: string
  description: string | null
  quantity: number
  attributes: Record<string, string>
  photos: string[]
}
export type AuctionView = {
  token: string
  title: string
  currency: string
  startPrice: number
  endsAt: string
  createdAt: string
  state: AuctionState
  hasReserve: boolean
  reserveMet: boolean
  passwordProtected: boolean
  /** Montant minimal de la prochaine offre. */
  nextBid: number
  seller: Person
  lots: AuctionLot[]
  bids: { id: string; amount: number; at: string; who: Person; mine: boolean }[]
  messages: { id: string; body: string; at: string; who: Person; mine: boolean; fromSeller: boolean }[]
  /** L'offre gagnante, une fois la vente terminée. */
  winner: { who: Person; amount: number; mine: boolean } | null
  viewer: 'seller' | 'guest' | 'anonymous'
  /** Pour le vendeur seulement. */
  reservePrice: number | null
}

/** Tout ce qu'une page de vente affiche, composé pour ce visiteur. */
export async function loadAuctionView(admin: SupabaseClient, auction: AuctionRecord, viewerId: string | null): Promise<AuctionView> {
  const isSeller = viewerId === auction.user_id
  const [bidsByAuction, { data: messageRows }, { data: objectRows }, { data: imageRows }] = await Promise.all([
    loadBids(admin, [auction.id]),
    admin.from('auction_messages').select('id, author_id, body, created_at').eq('auction_id', auction.id).order('created_at').limit(500),
    admin.from('objects').select('id, title, description, quantity, attributes').in('id', auction.object_ids).eq('user_id', auction.user_id),
    admin.from('object_images').select('object_id, storage_path').in('object_id', auction.object_ids).eq('user_id', auction.user_id).order('position'),
  ])
  const bids = bidsByAuction.get(auction.id) ?? []
  const messages = messageRows ?? []

  const paths = (imageRows ?? []).map(i => i.storage_path as string)
  const signed = new Map<string, string>()
  if (paths.length) {
    const { data } = await admin.storage.from('object-images').createSignedUrls(paths, 3600)
    for (const s of data ?? []) if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl)
  }

  const authors = await loadAuthors(admin, [auction.user_id, ...bids.map(b => b.bidder_id), ...messages.map(m => m.author_id)])
  const person = (id: string): Person => {
    const a = authors.get(id)
    return { firstName: a?.firstName ?? '', avatarUrl: a?.avatarUrl ?? null }
  }

  const result = outcome(auction, bids)
  const byId = new Map((objectRows ?? []).map(o => [o.id as string, o]))
  return {
    token: auction.token,
    title: auction.title,
    currency: auction.currency,
    startPrice: auction.start_price,
    endsAt: auction.ends_at,
    createdAt: auction.created_at,
    state: result.state,
    hasReserve: auction.reserve_price !== null,
    reserveMet: result.reserveMet,
    passwordProtected: !!auction.password_hash,
    nextBid: minNextBid(auction, bids),
    seller: person(auction.user_id),
    // Dans l'ordre choisi par le vendeur ; un objet supprimé depuis disparaît du lot.
    lots: auction.object_ids.flatMap(id => {
      const o = byId.get(id)
      if (!o) return []
      return [{
        id,
        title: o.title as string,
        description: (o.description as string | null) ?? null,
        quantity: (o.quantity as number | null) ?? 1,
        attributes: publicAttributes(o.attributes as Record<string, unknown> | null),
        photos: (imageRows ?? []).filter(i => i.object_id === id).flatMap(i => signed.get(i.storage_path as string) ?? []),
      }]
    }),
    bids: bids.map(b => ({ id: b.id, amount: b.amount, at: b.created_at, who: person(b.bidder_id), mine: b.bidder_id === viewerId })),
    messages: messages.map(m => ({
      id: m.id, body: m.body, at: m.created_at, who: person(m.author_id),
      mine: m.author_id === viewerId, fromSeller: m.author_id === auction.user_id,
    })),
    winner: result.winner
      ? { who: person(result.winner.bidder_id), amount: result.winner.amount, mine: result.winner.bidder_id === viewerId }
      : null,
    viewer: isSeller ? 'seller' : viewerId ? 'guest' : 'anonymous',
    reservePrice: isSeller ? auction.reserve_price : null,
  }
}

export type CreateError = 'NOT_OWNED' | 'NOT_AVAILABLE' | 'ALREADY_IN_AUCTION' | 'DB'

/** Ouvre une vente sur des objets du compte, et les passe « en vente ». */
export async function createAuction(
  admin: SupabaseClient, userId: string, input: NewAuction,
): Promise<{ ok: true; token: string } | { ok: false; error: CreateError }> {
  const { data: rows } = await admin.from('objects').select('id, status, value_currency').in('id', input.ids).eq('user_id', userId)
  if (!rows || rows.length !== input.ids.length) return { ok: false, error: 'NOT_OWNED' }
  if (rows.some(o => ['sold', 'given', 'lost'].includes(o.status ?? ''))) return { ok: false, error: 'NOT_AVAILABLE' }

  // Un objet ne se vend pas dans deux ventes ouvertes à la fois.
  const { data: running } = await admin.from('auctions').select('id')
    .eq('user_id', userId).is('cancelled_at', null).is('handed_over_at', null)
    .gt('ends_at', new Date().toISOString()).overlaps('object_ids', input.ids).limit(1)
  if (running?.length) return { ok: false, error: 'ALREADY_IN_AUCTION' }

  const token = randomBytes(8).toString('hex').slice(0, 12)
  const currency = rows[0]?.value_currency === '$' ? 'USD' : rows[0]?.value_currency === '£' ? 'GBP' : 'EUR'
  const now = new Date()
  const { error } = await admin.from('auctions').insert({
    user_id: userId, token, title: input.title, object_ids: input.ids,
    start_price: input.startPrice, reserve_price: input.reservePrice, currency,
    password_hash: input.password ? hashPassword(input.password) : null,
    ends_at: new Date(now.getTime() + input.days * 86_400_000).toISOString(),
  })
  if (error) {
    console.error('createAuction', error.message)
    return { ok: false, error: 'DB' }
  }
  await admin.from('objects')
    .update({ status: 'for_sale', listing_platform: 'tiroir_encheres', listed_at: now.toISOString(), sold_at: null, sold_price: null })
    .in('id', input.ids).eq('user_id', userId)
  return { ok: true, token }
}

export type ManageAction = 'cancel' | 'handed_over'

/**
 * Le vendeur retire sa vente (tant qu'il n'y a pas d'offre, ou une fois
 * terminée sans acheteur) ou déclare l'objet remis au gagnant. Les objets
 * suivent : retour à « possédé », ou « vendu » avec le prix obtenu (pour
 * un lot, le prix n'est pas réparti entre les fiches).
 */
export async function manageAuction(
  admin: SupabaseClient, auction: AuctionRecord, action: ManageAction,
): Promise<{ ok: boolean; error?: 'NOT_ALLOWED' | 'DB' }> {
  const bids = (await loadBids(admin, [auction.id])).get(auction.id) ?? []
  const result = outcome(auction, bids)
  const now = new Date().toISOString()

  if (action === 'cancel') {
    if (!((result.state === 'open' && bids.length === 0) || result.state === 'unsold')) return { ok: false, error: 'NOT_ALLOWED' }
    if (result.state === 'open') {
      const { error } = await admin.from('auctions').update({ cancelled_at: now }).eq('id', auction.id)
      if (error) return { ok: false, error: 'DB' }
    }
    // Seulement les fiches encore « en vente » par cette salle : un statut changé depuis est respecté.
    await admin.from('objects').update({ status: 'owned', listing_platform: null, listed_at: null })
      .in('id', auction.object_ids).eq('user_id', auction.user_id).eq('status', 'for_sale').eq('listing_platform', 'tiroir_encheres')
    return { ok: true }
  }

  if (result.state !== 'won' || !result.winner) return { ok: false, error: 'NOT_ALLOWED' }
  const { error } = await admin.from('auctions').update({ handed_over_at: now }).eq('id', auction.id)
  if (error) return { ok: false, error: 'DB' }
  await admin.from('objects')
    .update({ status: 'sold', sold_at: now, sold_price: auction.object_ids.length === 1 ? result.winner.amount : null })
    .in('id', auction.object_ids).eq('user_id', auction.user_id)
  return { ok: true }
}

export type AuctionSummary = {
  token: string
  title: string
  currency: string
  endsAt: string
  state: AuctionState
  bidCount: number
  /** Meilleure offre, ou le prix de départ s'il n'y en a pas. */
  price: number
  hasBids: boolean
  role: 'seller' | 'bidder'
  /** Pour un invité : est-il en tête ? */
  leading: boolean
}

/** Les ventes du compte : celles qu'il a ouvertes, et celles où il a enchéri. Vide si la base n'a pas encore les tables. */
export async function listAuctions(admin: SupabaseClient, userId: string): Promise<{ auctions: AuctionSummary[]; ready: boolean }> {
  const { data: own, error } = await admin.from('auctions').select(COLUMNS).eq('user_id', userId).order('created_at', { ascending: false }).limit(100)
  if (error) return { auctions: [], ready: false }
  const { data: myBids } = await admin.from('auction_bids').select('auction_id').eq('bidder_id', userId).limit(1000)
  const joinedIds = Array.from(new Set((myBids ?? []).map(b => b.auction_id as string)))
  const { data: joined } = joinedIds.length
    ? await admin.from('auctions').select(COLUMNS).in('id', joinedIds).order('ends_at', { ascending: false })
    : { data: [] }

  const all = [...(own ?? []).map(normalize), ...(joined ?? []).map(normalize)]
  const bids = await loadBids(admin, all.map(a => a.id))
  const summary = (a: AuctionRecord, role: 'seller' | 'bidder'): AuctionSummary => {
    const list = bids.get(a.id) ?? []
    const result = outcome(a, list)
    const top = [...list].sort((x, y) => y.amount - x.amount || x.created_at.localeCompare(y.created_at))[0]
    return {
      token: a.token, title: a.title, currency: a.currency, endsAt: a.ends_at, state: result.state,
      bidCount: list.length, price: top?.amount ?? a.start_price, hasBids: list.length > 0, role,
      leading: role === 'bidder' && top?.bidder_id === userId,
    }
  }
  return {
    auctions: [...(own ?? []).map(a => summary(normalize(a), 'seller')), ...(joined ?? []).map(a => summary(normalize(a), 'bidder'))],
    ready: true,
  }
}
