import { describe, expect, test } from 'vitest'
import { monthRange, vatCsv, vatRows } from '../lib/stripe/vatExport'

const nov = monthRange('2026-11')!
const at = (iso: string) => Date.parse(iso) / 1000
const inv = (over: Record<string, unknown>) => ({
  id: 'in_1', number: 'TIROIR-0001', status: 'paid', currency: 'eur', total: 1800, total_excluding_tax: 1500,
  total_tax_amounts: [{ amount: 300 }], customer_name: 'Ada', customer_email: 'ada@test.fr',
  customer_address: { country: 'FR' }, customer_tax_ids: [], hosted_invoice_url: 'https://x',
  status_transitions: { paid_at: at('2026-11-08T10:00:00Z') }, subscription: 'sub_1',
  subscription_details: { metadata: { kind: 'individual' } }, ...over,
})

describe('export TVA', () => {
  test('mois : bornes UTC, format refusé sinon', () => {
    expect(nov).toEqual({ start: at('2026-11-01T00:00:00Z'), end: at('2026-12-01T00:00:00Z') })
    expect(monthRange('2026-13')).toBeNull()
    expect(monthRange('nov')).toBeNull()
  })

  test('compte au mois du paiement, HT / TVA / TTC, type', () => {
    const rows = vatRows([
      inv({}),
      inv({ id: 'in_2', number: 'TIROIR-0002', status_transitions: { paid_at: at('2026-10-31T23:00:00Z') } }),
      inv({ id: 'in_3', number: 'TIROIR-0003', status: 'open' }),
      inv({ id: 'in_4', number: 'TIROIR-0004', total: 699, total_excluding_tax: 583, total_tax_amounts: [{ amount: 116 }], subscription: null, subscription_details: null, metadata: { kind: 'credits' } }),
    ], nov)
    expect(rows.map(r => [r.number, r.kind, r.ht, r.vat, r.ttc])).toEqual([
      ['TIROIR-0001', 'abonnement', 15, 3, 18],
      ['TIROIR-0004', 'crédits', 5.83, 1.16, 6.99],
    ])
  })

  test('CSV pour tableur français, avec total', () => {
    const csv = vatCsv(vatRows([inv({ customer_name: 'Dupont; fils' })], nov))
    expect(csv.startsWith('﻿Date de paiement;')).toBe(true)
    expect(csv).toContain('"Dupont; fils"')
    expect(csv).toContain(';15,00;3,00;18,00;EUR;')
    expect(csv).toContain('Total;;;;;;;15,00;3,00;18,00;EUR;')
  })
})
