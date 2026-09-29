import { describe, expect, test } from 'vitest'
import { buildSaleSheet, parseOffer, type SaleInput } from '../lib/saleSheet'

const base: SaleInput = {
  title: 'Fauteuil', description: null, status: 'owned', attributes: null,
  created_at: '2025-03-10T10:00:00Z', purchase_date: null,
  sale_price: null, sale_price_lot: null, quantity: 1,
  user_value: null, market_value: null, value_currency: 'EUR', value_sources: null,
}

describe('fiche de vente', () => {
  test('le prix du vendeur passe avant l’estimation', () => {
    const s = buildSaleSheet({ ...base, sale_price: 120, market_value: 200 }, 'Clément')
    expect(s.askingPrice).toBe(120)
    expect(s.priceOrigin).toBe('vendeur')
    expect(s.suggestedOffer).toBe(110)
  })

  test('sans prix du vendeur : l’estimation ; sans rien : prix à discuter', () => {
    expect(buildSaleSheet({ ...base, market_value: 80 }, 'C').priceOrigin).toBe('estimation')
    const none = buildSaleSheet(base, 'C')
    expect(none.askingPrice).toBeNull()
    expect(none.suggestedOffer).toBeNull()
  })

  test('lot : prix du lot, sinon prix unitaire × quantité', () => {
    expect(buildSaleSheet({ ...base, sale_price: 10, quantity: 4 }, 'C').askingPrice).toBe(40)
    expect(buildSaleSheet({ ...base, sale_price: 10, sale_price_lot: 30, quantity: 4 }, 'C').askingPrice).toBe(30)
  })

  test('histoire et état, sans jamais le prix d’achat', () => {
    const s = buildSaleSheet({
      ...base, purchase_date: '2019-06-01',
      attributes: { 'état': 'Très bon', couleur: 'Vert', usage: 'Salon, peu utilisé' },
    }, 'Clément')
    expect(s.story[0]).toMatch(/^Dans le Tiroir de Clément depuis mars 2025/)
    expect(s.story[1]).toBe('Acheté en juin 2019.')
    expect(s.condition.map(c => c.label)).toEqual(['État', 'Usage'])
    expect(s.details).toEqual([{ label: 'Couleur', value: 'Vert' }])
    expect(JSON.stringify(s)).not.toContain('purchase_price')
  })

  test('fourchette d’estimation seulement si cohérente', () => {
    expect(buildSaleSheet({ ...base, value_sources: { value_min: 50, value_max: 90 } }, 'C').range).toEqual({ min: 50, max: 90 })
    expect(buildSaleSheet({ ...base, value_sources: { value_min: 90, value_max: 50 } }, 'C').range).toBeNull()
  })

  test('offre saisie', () => {
    expect(parseOffer('95')).toBe(95)
    expect(parseOffer('1 200,50')).toBe(1200.5)
    expect(parseOffer('-3')).toBeNull()
    expect(parseOffer('abc')).toBeNull()
  })
})
