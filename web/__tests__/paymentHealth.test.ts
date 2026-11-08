import { describe, expect, test } from 'vitest'
import { disputeStatusLabel, paymentHealth } from '../lib/stripe/health'

const now = new Date('2026-11-20T12:00:00Z')
const t = (iso: string) => Math.floor(new Date(iso).getTime() / 1000)

describe('santé des paiements', () => {
  test('rien à signaler', () => {
    const h = paymentHealth({ now, events: [], charges: [{ id: 'ch_1', status: 'succeeded', created: t('2026-11-19T00:00:00Z'), amount: 699 }], disputes: [] })
    expect(h.ok).toBe(true)
    expect(h.failedPayments).toHaveLength(0)
  })

  test('webhook en erreur, ou reçu et jamais traité depuis plus de 10 min', () => {
    const h = paymentHealth({
      now, charges: [], disputes: [],
      events: [
        { id: 'evt_err', type: 'invoice.paid', received_at: '2026-11-20T09:00:00Z', processed_at: null, error: 'organizations absente' },
        { id: 'evt_stuck', type: 'checkout.session.completed', received_at: '2026-11-20T11:40:00Z', processed_at: null, error: null },
        { id: 'evt_recent', type: 'checkout.session.completed', received_at: '2026-11-20T11:58:00Z', processed_at: null, error: null },
      ],
    })
    expect(h.webhooks.map(w => w.id)).toEqual(['evt_stuck', 'evt_err'])
    expect(h.webhooks[0].problem).toBe('reçu, jamais traité')
    expect(h.ok).toBe(false)
  })

  test('paiements refusés : raison et e-mail', () => {
    const h = paymentHealth({
      now, events: [], disputes: [],
      charges: [
        { id: 'ch_ok', status: 'succeeded', created: t('2026-11-19T00:00:00Z'), amount: 1800 },
        { id: 'ch_ko', status: 'failed', created: t('2026-11-18T10:00:00Z'), amount: 1800, currency: 'eur',
          failure_message: 'Your card was declined.', billing_details: { email: 'a@b.fr' } },
      ],
    })
    expect(h.failedPayments).toEqual([{ id: 'ch_ko', at: '2026-11-18T10:00:00.000Z', amount: 1800, currency: 'eur', email: 'a@b.fr', reason: 'Your card was declined.' }])
    expect(h.ok).toBe(false)
  })

  test('litiges : ouverts d’abord, date limite de réponse, raison traduite', () => {
    const h = paymentHealth({
      now, events: [], charges: [],
      disputes: [
        { id: 'dp_won', status: 'won', created: t('2026-10-01T00:00:00Z'), amount: 699, reason: 'fraudulent' },
        { id: 'dp_open', status: 'needs_response', created: t('2026-11-15T00:00:00Z'), amount: 18000, reason: 'subscription_canceled',
          evidence_details: { due_by: t('2026-11-25T00:00:00Z') } },
      ],
    })
    expect(h.disputes.map(d => d.id)).toEqual(['dp_open', 'dp_won'])
    expect(h.disputes[0]).toMatchObject({ open: true, reason: 'abonnement résilié', dueBy: '2026-11-25T00:00:00.000Z' })
    expect(h.openDisputes).toBe(1)
    expect(h.ok).toBe(false)
    expect(disputeStatusLabel('needs_response')).toBe('réponse attendue')
  })

  test('litige clos seul : pas d’alerte', () => {
    const h = paymentHealth({ now, events: [], charges: [], disputes: [{ id: 'dp', status: 'lost', created: t('2026-10-01T00:00:00Z'), amount: 1 }] })
    expect(h.ok).toBe(true)
  })

  test('Stripe injoignable : signalé', () => {
    const h = paymentHealth({ now, events: [], charges: [], disputes: [], stripeUnavailable: true })
    expect(h.ok).toBe(false)
    expect(h.stripeUnavailable).toBe(true)
  })
})

describe('paiement sur facture et doubles abonnements', () => {
  test('facture envoyée, échéance passée : en retard, la plus ancienne d’abord', () => {
    const h = paymentHealth({
      now, events: [], charges: [], disputes: [],
      overdueInvoices: [
        { id: 'in_1', status: 'open', number: 'A-1', customer_email: 'a@b.fr', amount_remaining: 6000, due_date: t('2026-11-15T00:00:00Z'), hosted_invoice_url: 'https://x' },
        { id: 'in_2', status: 'open', number: 'A-2', amount_remaining: 60000, due_date: t('2026-11-01T00:00:00Z') },
        { id: 'in_3', status: 'open', amount_remaining: 6000, due_date: t('2026-11-30T00:00:00Z') },
        { id: 'in_4', status: 'paid', amount_remaining: 0, due_date: t('2026-11-01T00:00:00Z') },
      ],
    })
    expect(h.overdueInvoices.map(i => [i.id, i.daysLate])).toEqual([['in_2', 19], ['in_1', 5]])
    expect(h.ok).toBe(false)
  })

  test('abonné sur le site et dans un store : signalé', () => {
    const h = paymentHealth({
      now, events: [], charges: [], disputes: [],
      liveSubscriptions: [
        { user_id: 'u1', source: 'stripe' }, { user_id: 'u1', source: 'apple' },
        { user_id: 'u2', source: 'stripe' }, { user_id: 'u2', source: 'stripe' },
      ],
    })
    expect(h.doubles).toEqual([{ userId: 'u1', sources: ['apple', 'stripe'] }])
    expect(h.ok).toBe(false)
  })
})
