import { describe, expect, test } from 'vitest'
import { monthlyHtCents, revenueReport, type SubscriptionRow } from '../lib/subscriptionRevenue'

const now = new Date('2026-11-20T12:00:00Z')
const sub = (o: Partial<SubscriptionRow> & Pick<SubscriptionRow, 'user_id' | 'source' | 'tier'>): SubscriptionRow => ({
  period: 'monthly', status: 'active', cancel_at_period_end: false, current_period_end: null,
  updated_at: '2026-11-10T00:00:00Z', ...o,
})

describe('revenus réels par canal', () => {
  test('prix de la grille HT : annuel ramené au mois', () => {
    expect(monthlyHtCents('premium', 'monthly')).toBe(1500)
    expect(monthlyHtCents('premium', 'yearly')).toBe(1250)
    expect(monthlyHtCents('pro', 'monthly')).toBe(5000)
    expect(monthlyHtCents('pro', 'yearly')).toBe(4167)
  })

  test('site, iOS et Play Store séparés ; stores estimés', () => {
    const r = revenueReport({
      now,
      profiles: [],
      subscriptions: [
        sub({ user_id: 'a', source: 'stripe', tier: 'premium' }),
        sub({ user_id: 'b', source: 'stripe', tier: 'pro', period: 'yearly' }),
        sub({ user_id: 'c', source: 'apple', tier: 'premium' }),
        sub({ user_id: 'd', source: 'google', tier: 'pro' }),
      ],
      siteCredits: [], appCredits: [],
    })
    const by = Object.fromEntries(r.channels.map(c => [c.channel, c]))
    expect(by.site).toMatchObject({ premium: 1, pro: 1, mrrHt: 1500 + 4167, estimated: false })
    expect(by.ios).toMatchObject({ premium: 1, pro: 0, mrrHt: 1500, estimated: true })
    expect(by.android).toMatchObject({ premium: 0, pro: 1, mrrHt: 5000, estimated: true })
    expect(r.subscribers).toEqual({ premium: 2, pro: 2, total: 4 })
    expect(r.mrrHt).toBe(1500 + 4167 + 1500 + 5000)
    expect(r.mrrHtEstimated).toBe(6500)
  })

  test('abonnement terminé : ni abonné ni MRR, mais compté dans les résiliations', () => {
    const r = revenueReport({
      now,
      profiles: [],
      subscriptions: [
        sub({ user_id: 'a', source: 'stripe', tier: 'premium', status: 'canceled', updated_at: '2026-11-15T00:00:00Z' }),
        sub({ user_id: 'b', source: 'stripe', tier: 'premium', status: 'canceled', updated_at: '2026-09-01T00:00:00Z' }),
        sub({ user_id: 'c', source: 'apple', tier: 'premium', cancel_at_period_end: true }),
      ],
      siteCredits: [], appCredits: [],
    })
    expect(r.subscribers.total).toBe(1)
    expect(r.churn).toEqual({ scheduled: 1, ended30d: 1 })
  })

  test('paliers sans abonnement au journal : Pro sur facture compté sans montant, stores anciens estimés', () => {
    const r = revenueReport({
      now,
      profiles: [
        { id: 'p1', plan: 'pro', plan_source: null },
        { id: 'p2', plan: 'premium', plan_source: 'app' },
        { id: 'p3', plan: 'premium', plan_source: null },
        { id: 'p4', plan: 'free', plan_source: null },
        { id: 'a', plan: 'premium', plan_source: 'web' },
      ],
      subscriptions: [sub({ user_id: 'a', source: 'stripe', tier: 'premium' })],
      siteCredits: [], appCredits: [],
    })
    const by = Object.fromEntries(r.channels.map(c => [c.channel, c]))
    expect(by.invoice).toMatchObject({ pro: 1, mrrHt: null })
    expect(by.store).toMatchObject({ premium: 1, mrrHt: 1500, estimated: true })
    expect(by.other).toMatchObject({ premium: 1, mrrHt: 0 })
    expect(by.site).toMatchObject({ premium: 1 }) // pas compté deux fois
    expect(r.subscribers.total).toBe(4)
    expect(r.mrrHt).toBe(3000)
  })

  test('un seul abonnement vivant par compte (le plus récent)', () => {
    const r = revenueReport({
      now,
      profiles: [],
      subscriptions: [
        sub({ user_id: 'a', source: 'apple', tier: 'premium', updated_at: '2026-10-01T00:00:00Z' }),
        sub({ user_id: 'a', source: 'stripe', tier: 'pro', updated_at: '2026-11-01T00:00:00Z' }),
      ],
      siteCredits: [], appCredits: [],
    })
    expect(r.channels).toHaveLength(1)
    expect(r.channels[0]).toMatchObject({ channel: 'site', pro: 1 })
  })

  test('ventes de crédits du mois : site (remboursements déduits) et app (estimée au prix des packs)', () => {
    const r = revenueReport({
      now,
      profiles: [], subscriptions: [],
      siteCredits: [
        { paid_at: '2026-11-08T14:45:46Z', amount_total: 699, amount_refunded: 0, credits: 150 },
        { paid_at: '2026-11-09T10:00:00Z', amount_total: 299, amount_refunded: 299, credits: 50 },
        { paid_at: '2026-10-30T10:00:00Z', amount_total: 1999, amount_refunded: 0, credits: 500 },
      ],
      appCredits: [
        { created_at: '2026-11-02T00:00:00Z', delta: 500 },
        { created_at: '2026-10-02T00:00:00Z', delta: 50 },
      ],
    })
    expect(r.credits.month).toBe('2026-11')
    expect(r.credits.site).toEqual({ count: 2, credits: 200, ttc: 699, estimated: false })
    expect(r.credits.app).toEqual({ count: 1, credits: 500, ttc: 1999, estimated: true })
  })
})
