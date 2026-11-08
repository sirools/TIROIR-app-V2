import { describe, expect, test } from 'vitest'
import { computeTreasury } from '../lib/treasury'

const zero = { supabaseUsd: 0, aiMonthUsd: 0, siteMrrHtEur: 0, storeMrrHtEur: 0 }

describe('computeTreasury', () => {
  test('coûts en euros, hypothèses comprises', () => {
    const t = computeTreasury({ ...zero, supabaseUsd: 25, aiMonthUsd: 10 })
    // 25 + 10 + 20 + 99/12 = 63,25 $ → × 0,92
    expect(t.costEur).toBeCloseTo(58.19, 1)
    expect(t.costs.map(c => c.label)).toContain('IA (dépense réelle du mois)')
  })

  test('revenu : MRR HT réel, site tel quel, stores commission déduite', () => {
    const t = computeTreasury({ ...zero, siteMrrHtEur: 65, storeMrrHtEur: 100 })
    expect(t.revenueEur).toBeCloseTo(65 + 85, 2)
  })

  test('clients Pro (50 € HT par mois) nécessaires pour combler l’écart', () => {
    const t = computeTreasury({ ...zero, supabaseUsd: 25, aiMonthUsd: 10 })
    expect(t.gapEur).toBeGreaterThan(0)
    expect(t.proNetEur).toBe(50)
    expect(t.proNeeded).toBe(2) // 58,19 € / 50 € → 2
    expect(t.proAnnualCashEur).toBe(500)
  })

  test('écart couvert : aucun client de plus', () => {
    const t = computeTreasury({ ...zero, supabaseUsd: 25, aiMonthUsd: 10, siteMrrHtEur: 100 })
    expect(t.gapEur).toBe(0)
    expect(t.proNeeded).toBe(0)
  })

  test('valeurs manquantes ou négatives : comptées zéro', () => {
    const t = computeTreasury({ supabaseUsd: NaN, aiMonthUsd: -3, siteMrrHtEur: NaN, storeMrrHtEur: -1 })
    expect(t.revenueEur).toBe(0)
    expect(t.costs[0].eur).toBe(0)
  })
})
