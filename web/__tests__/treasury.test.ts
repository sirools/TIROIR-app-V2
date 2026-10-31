import { describe, expect, test } from 'vitest'
import { computeTreasury } from '../lib/treasury'

describe('computeTreasury', () => {
  test('coûts en euros, hypothèses comprises', () => {
    const t = computeTreasury({ supabaseUsd: 25, aiMonthUsd: 10, premiumCount: 0, proCount: 0 })
    // 25 + 10 + 20 + 99/12 = 63,25 $ → × 0,92
    expect(t.costEur).toBeCloseTo(58.19, 1)
    expect(t.costs.map(c => c.label)).toContain('IA (dépense réelle du mois)')
  })

  test('revenu net : TVA des stores puis commission pour Premium, rien pour le Pro (franchise en base)', () => {
    const t = computeTreasury({ supabaseUsd: 0, aiMonthUsd: 0, premiumCount: 10, proCount: 1 })
    expect(t.premiumNetEur).toBeCloseTo(4.95, 2)
    expect(t.proNetEur).toBe(29)
    expect(t.revenueEur).toBeCloseTo(49.5 + 29, 1)
  })

  test('clients Pro nécessaires pour combler l’écart', () => {
    const t = computeTreasury({ supabaseUsd: 25, aiMonthUsd: 10, premiumCount: 0, proCount: 0 })
    expect(t.gapEur).toBeGreaterThan(0)
    expect(t.proNeeded).toBe(3) // 58,19 € / 29 € → 3
    expect(t.proAnnualCashEur).toBe(290)
  })

  test('écart couvert : aucun client de plus', () => {
    const t = computeTreasury({ supabaseUsd: 25, aiMonthUsd: 10, premiumCount: 20, proCount: 0 })
    expect(t.gapEur).toBe(0)
    expect(t.proNeeded).toBe(0)
  })

  test('valeurs manquantes ou négatives : comptées zéro', () => {
    const t = computeTreasury({ supabaseUsd: NaN, aiMonthUsd: -3, premiumCount: NaN, proCount: -1 })
    expect(t.revenueEur).toBe(0)
    expect(t.costs[0].eur).toBe(0)
  })
})
