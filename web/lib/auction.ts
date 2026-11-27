// La salle des ventes : une enchère privée sur un objet ou un lot, ouverte
// par un lien à des invités. Ici les règles, pures et testées
// (web/__tests__/auction.test.ts) ; la base les applique aussi au moment
// d'enchérir (place_auction_bid, verrou sur la vente), parce que deux
// offres peuvent arriver en même temps.
//
// Première version SANS paiement : Tiroir affiche le meilleur enchérisseur,
// vendeur et acheteur s'arrangent (main propre, Colissimo…), le vendeur
// marque « Remis ». Le paiement dans Tiroir (Stripe Connect) viendra
// derrière un drapeau, après avis juridique — voir v4/docs/vente.md.

/** `AUCTIONS=off` côté serveur coupe la salle des ventes pour tous. */
export function auctionsEnabled(flag: string | undefined = process.env.AUCTIONS): boolean {
  return flag !== 'off'
}

/** Durées proposées, en jours. */
export const DURATIONS = [1, 3, 7, 14] as const
/** Objets dans un même lot, au plus. */
export const MAX_LOT = 20
/** Pas minimal entre deux offres, dans l'unité de la devise. */
export const BID_STEP = 1
export const TITLE_MAX = 80

export type AuctionRow = {
  start_price: number
  reserve_price: number | null
  ends_at: string
  cancelled_at: string | null
  handed_over_at: string | null
}
export type BidRow = { id: string; bidder_id: string; amount: number; created_at: string }

/** « 120 », « 120,50 » → montant positif à deux décimales, ou null. */
export function parseAmount(raw: unknown): number | null {
  const text = typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw.replace(/[\s  €]/g, '').replace(',', '.') : ''
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null
  const n = Number(text)
  return n > 0 && n < 1e8 ? n : null
}

/** La meilleure offre : la plus haute, et à montant égal la première arrivée. */
export function topBid(bids: BidRow[]): BidRow | null {
  return [...bids].sort((a, b) => b.amount - a.amount || a.created_at.localeCompare(b.created_at))[0] ?? null
}

/** Montant minimal de la prochaine offre : le prix de départ, puis un pas au-dessus de la meilleure. */
export function minNextBid(auction: Pick<AuctionRow, 'start_price'>, bids: BidRow[]): number {
  const top = topBid(bids)
  return top ? Math.round((top.amount + BID_STEP) * 100) / 100 : auction.start_price
}

export type AuctionState =
  | 'open'       // on peut enchérir
  | 'cancelled'  // retirée par le vendeur
  | 'unsold'     // terminée sans offre, ou sous le prix de réserve
  | 'won'        // terminée, un gagnant, objet pas encore remis
  | 'handed'     // remis à l'acheteur : la vente est faite

export type Outcome = { state: AuctionState; winner: BidRow | null; reserveMet: boolean }

/** Où en est une vente à l'instant `now`. Le prix de réserve n'est jamais révélé, seulement s'il est atteint. */
export function outcome(auction: AuctionRow, bids: BidRow[], now: number = Date.now()): Outcome {
  const top = topBid(bids)
  const reserveMet = !!top && (auction.reserve_price === null || top.amount >= auction.reserve_price)
  if (auction.cancelled_at) return { state: 'cancelled', winner: null, reserveMet }
  if (new Date(auction.ends_at).getTime() > now) return { state: 'open', winner: null, reserveMet }
  if (!top || !reserveMet) return { state: 'unsold', winner: null, reserveMet }
  return { state: auction.handed_over_at ? 'handed' : 'won', winner: top, reserveMet }
}

/** Temps restant, en jours, heures et minutes entiers ; null si c'est fini. */
export function timeLeft(endsAt: string, now: number = Date.now()): { days: number; hours: number; minutes: number } | null {
  const ms = new Date(endsAt).getTime() - now
  if (ms <= 0) return null
  const minutes = Math.ceil(ms / 60_000)
  return { days: Math.floor(minutes / 1440), hours: Math.floor((minutes % 1440) / 60), minutes: minutes % 60 }
}

export type NewAuction = {
  ids: string[]
  title: string
  startPrice: number
  reservePrice: number | null
  days: (typeof DURATIONS)[number]
  password: string | null
}
export type NewAuctionError = 'ids' | 'title' | 'startPrice' | 'reservePrice' | 'days' | 'password'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Contrôle du formulaire « Mettre aux enchères », côté navigateur comme côté serveur. */
export function parseNewAuction(body: Record<string, unknown>): { ok: true; value: NewAuction } | { ok: false; error: NewAuctionError } {
  const ids = Array.isArray(body.ids) ? Array.from(new Set(body.ids.map(String))) : []
  if (ids.length === 0 || ids.length > MAX_LOT || !ids.every(id => UUID.test(id))) return { ok: false, error: 'ids' }
  const title = typeof body.title === 'string' ? body.title.replace(/\s+/g, ' ').trim() : ''
  if (!title || title.length > TITLE_MAX) return { ok: false, error: 'title' }
  const startPrice = parseAmount(body.startPrice)
  if (startPrice === null) return { ok: false, error: 'startPrice' }
  const hasReserve = body.reservePrice !== undefined && body.reservePrice !== null && body.reservePrice !== ''
  const reservePrice = hasReserve ? parseAmount(body.reservePrice) : null
  if (hasReserve && (reservePrice === null || reservePrice < startPrice)) return { ok: false, error: 'reservePrice' }
  const days = Number(body.days)
  if (!(DURATIONS as readonly number[]).includes(days)) return { ok: false, error: 'days' }
  const password = typeof body.password === 'string' && body.password.trim() ? body.password.trim() : null
  if (password !== null && (password.length < 4 || password.length > 100)) return { ok: false, error: 'password' }
  return { ok: true, value: { ids, title, startPrice, reservePrice, days: days as NewAuction['days'], password } }
}
