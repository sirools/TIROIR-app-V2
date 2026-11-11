import { describe, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { AI_COST_ALERT_SHARE, FEATURE_CREDITS, aiEconomics, creditPriceHtEur } from '../lib/aiEconomics'

const plans = new Map<string, string | null>([['f1', 'free'], ['f2', 'free'], ['p1', 'premium'], ['x1', 'pro']])

describe('économie de l’IA', () => {
  test('prix HT d’un crédit : le plus gros pack (19,99 € TTC / 500)', () => {
    expect(creditPriceHtEur()).toBeCloseTo(19.99 / 1.2 / 500, 6)
  })

  test('gratuits contre payants : appels, coût, coût par compte', () => {
    const e = aiEconomics({
      usdToEur: 1, revenueHtEur: 0, plans,
      usage: [
        { user_id: 'f1', feature: 'describe_object', cost_usd: 0.002 },
        { user_id: 'f2', feature: 'describe_object', cost_usd: '0.004' },
        { user_id: 'p1', feature: 'estimate_value', cost_usd: 0.09 },
        { user_id: 'gone', feature: 'chat_turn', cost_usd: 0.001 },
      ],
    })
    expect(e.segments.map(s => s.segment)).toEqual(['free', 'premium', 'unknown'])
    expect(e.segments[0]).toMatchObject({ users: 2, calls: 2, costEur: 0.006, costPerUserEur: 0.003 })
    expect(e.segments[1]).toMatchObject({ users: 1, calls: 1, costEur: 0.09 })
    expect(e.totalCostEur).toBeCloseTo(0.097, 6)
  })

  test('coût et marge par action, au prix du crédit', () => {
    const e = aiEconomics({
      usdToEur: 1, revenueHtEur: 0, plans,
      usage: [
        { user_id: 'p1', feature: 'estimate_value', cost_usd: 0.1 },
        { user_id: 'p1', feature: 'estimate_value', cost_usd: 0.08 },
        { user_id: 'f1', feature: 'nouvelle_fonction', cost_usd: 0.01 },
      ],
    })
    const est = e.actions.find(a => a.feature === 'estimate_value')!
    expect(est).toMatchObject({ calls: 2, avgCostEur: 0.09, credits: 8 })
    expect(est.priceEur).toBeCloseTo(8 * creditPriceHtEur(), 4)
    expect(est.marginEur).toBeCloseTo(8 * creditPriceHtEur() - 0.09, 4)
    expect(e.actions.find(a => a.feature === 'nouvelle_fonction')).toMatchObject({ credits: null, priceEur: null, marginEur: null })
  })

  test('alerte : part du chiffre d’affaires au-delà du seuil, ou coût sans aucun revenu', () => {
    const usage = [{ user_id: 'f1', feature: 'describe_object', cost_usd: 10 }]
    expect(aiEconomics({ usage, plans, usdToEur: 1, revenueHtEur: 100 })).toMatchObject({ share: 0.1, alert: false })
    expect(aiEconomics({ usage, plans, usdToEur: 1, revenueHtEur: 20 }).alert).toBe(10 / 20 > AI_COST_ALERT_SHARE)
    expect(aiEconomics({ usage, plans, usdToEur: 1, revenueHtEur: 0 })).toMatchObject({ share: null, alert: true })
    expect(aiEconomics({ usage: [], plans, usdToEur: 1, revenueHtEur: 0 })).toMatchObject({ share: null, alert: false })
  })

  test('prix des actions : ceux que le serveur débite (ai_feature_kind, ai_credit_cost)', () => {
    const sql = readFileSync(path.join(__dirname, '../../supabase/migrations/20261108143238_ai_credits_spend.sql'), 'utf8')
    const cost: Record<string, number> = {
      analysis: 1,
      photo: Number(sql.match(/WHEN 'photo' THEN (\d+)/)?.[1]),
      estimate: Number(sql.match(/WHEN 'estimate' THEN (\d+)/)?.[1]),
    }
    const kinds = [...sql.matchAll(/WHEN '([a-z_]+)'\s+THEN '(analysis|photo|estimate)'/g)].map(m => [m[1], m[2]] as const)
    expect(kinds.length).toBe(Object.keys(FEATURE_CREDITS).length)
    for (const [feature, kind] of kinds) expect(FEATURE_CREDITS[feature]?.credits).toBe(cost[kind])
  })
})
