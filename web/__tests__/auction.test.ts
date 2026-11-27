import { describe, expect, test } from 'vitest'
import {
  auctionsEnabled, minNextBid, outcome, parseAmount, parseNewAuction, timeLeft, topBid,
  type AuctionRow, type BidRow,
} from '../lib/auction'

const NOW = Date.parse('2026-11-13T12:00:00Z')
const auction = (over: Partial<AuctionRow> = {}): AuctionRow => ({
  start_price: 50, reserve_price: null, ends_at: '2026-11-14T12:00:00Z', cancelled_at: null, handed_over_at: null, ...over,
})
const bid = (id: string, amount: number, at: string, bidder = id): BidRow => ({ id, bidder_id: bidder, amount, created_at: at })
const ID = '00000000-0000-4000-8000-000000000001'

describe('enchères : offres', () => {
  test('meilleure offre : la plus haute, la première à montant égal', () => {
    expect(topBid([])).toBeNull()
    expect(topBid([bid('a', 60, '10:00'), bid('b', 80, '10:05'), bid('c', 80, '10:01')])?.id).toBe('c')
  })
  test('prochaine offre : le prix de départ, puis un pas au-dessus', () => {
    expect(minNextBid(auction(), [])).toBe(50)
    expect(minNextBid(auction(), [bid('a', 60, '10:00')])).toBe(61)
    expect(minNextBid(auction(), [bid('a', 60.5, '10:00')])).toBe(61.5)
  })
  test('montant saisi', () => {
    expect(parseAmount('120')).toBe(120)
    expect(parseAmount('1 200,50 €')).toBe(1200.5)
    expect(parseAmount(75)).toBe(75)
    expect(parseAmount('0')).toBeNull()
    expect(parseAmount('-5')).toBeNull()
    expect(parseAmount('12.345')).toBeNull()
    expect(parseAmount('cent')).toBeNull()
  })
})

describe('enchères : où en est la vente', () => {
  const closed = { ends_at: '2026-11-13T11:00:00Z' }
  test('ouverte tant que l’heure de fin n’est pas passée', () => {
    expect(outcome(auction(), [bid('a', 60, '10:00')], NOW)).toMatchObject({ state: 'open', winner: null })
  })
  test('terminée sans offre : invendue', () => {
    expect(outcome(auction(closed), [], NOW).state).toBe('unsold')
  })
  test('terminée avec offre : gagnée, puis remise', () => {
    const bids = [bid('a', 60, '10:00'), bid('b', 90, '10:30')]
    expect(outcome(auction(closed), bids, NOW)).toMatchObject({ state: 'won', winner: { id: 'b' } })
    expect(outcome(auction({ ...closed, handed_over_at: '2026-11-13T11:30:00Z' }), bids, NOW).state).toBe('handed')
  })
  test('prix de réserve : en dessous, la vente n’aboutit pas', () => {
    const bids = [bid('a', 90, '10:00')]
    expect(outcome(auction({ ...closed, reserve_price: 100 }), bids, NOW)).toMatchObject({ state: 'unsold', winner: null, reserveMet: false })
    expect(outcome(auction({ ...closed, reserve_price: 90 }), bids, NOW)).toMatchObject({ state: 'won', reserveMet: true })
    expect(outcome(auction({ reserve_price: 100 }), bids, NOW)).toMatchObject({ state: 'open', reserveMet: false })
  })
  test('retirée par le vendeur', () => {
    expect(outcome(auction({ cancelled_at: '2026-11-13T09:00:00Z' }), [], NOW).state).toBe('cancelled')
  })
  test('temps restant', () => {
    expect(timeLeft('2026-11-14T13:30:00Z', NOW)).toEqual({ days: 1, hours: 1, minutes: 30 })
    expect(timeLeft('2026-11-13T12:00:30Z', NOW)).toEqual({ days: 0, hours: 0, minutes: 1 })
    expect(timeLeft('2026-11-13T12:00:00Z', NOW)).toBeNull()
  })
})

describe('enchères : formulaires', () => {
  const ok = { ids: [ID], title: '  Lot   d’amplis ', startPrice: '50', reservePrice: '', days: 7, password: '' }
  test('mise aux enchères valide', () => {
    expect(parseNewAuction(ok)).toEqual({
      ok: true, value: { ids: [ID], title: 'Lot d’amplis', startPrice: 50, reservePrice: null, days: 7, password: null },
    })
    expect(parseNewAuction({ ...ok, reservePrice: '80', password: 'secret' })).toMatchObject({ ok: true, value: { reservePrice: 80, password: 'secret' } })
  })
  test('refus : chaque champ', () => {
    expect(parseNewAuction({ ...ok, ids: [] })).toEqual({ ok: false, error: 'ids' })
    expect(parseNewAuction({ ...ok, ids: ['pas-un-id'] })).toEqual({ ok: false, error: 'ids' })
    expect(parseNewAuction({ ...ok, title: ' ' })).toEqual({ ok: false, error: 'title' })
    expect(parseNewAuction({ ...ok, startPrice: '0' })).toEqual({ ok: false, error: 'startPrice' })
    expect(parseNewAuction({ ...ok, reservePrice: '40' })).toEqual({ ok: false, error: 'reservePrice' })
    expect(parseNewAuction({ ...ok, days: 2 })).toEqual({ ok: false, error: 'days' })
    expect(parseNewAuction({ ...ok, password: 'abc' })).toEqual({ ok: false, error: 'password' })
  })
  test('interrupteur', () => {
    expect(auctionsEnabled(undefined)).toBe(true)
    expect(auctionsEnabled('off')).toBe(false)
  })
})
