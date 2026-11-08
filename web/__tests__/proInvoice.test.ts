import { describe, expect, test } from 'vitest'
import { PRO_INVOICE, billingAnchor, parseProInvoiceInput, proInvoiceFooter, proSubscriptionParams, type ProInvoiceInput } from '../lib/stripe/proInvoice'

const uid = '11111111-2222-3333-4444-555555555555'
const body = { user_id: uid, period: 'yearly', name: 'Ada Martin', line1: '1 rue A', postal_code: '75001', city: 'Paris' }
const env = { BILLING_LEGAL_NAME: 'Clément Ougier EI', BILLING_SIRET: '123', BILLING_VAT_MODE: 'assujetti', BILLING_VAT_NUMBER: 'FR00123' }

describe('Pro sur facture par Stripe', () => {
  test('formulaire : champs obligatoires, pays par défaut, TVA seulement pour un pro', () => {
    expect(parseProInvoiceInput({})).toBe('Compte manquant')
    expect(parseProInvoiceInput({ ...body, period: 'weekly' })).toBe('Formule : mensuelle ou annuelle')
    expect(parseProInvoiceInput({ ...body, city: '' })).toBe('Adresse de facturation incomplète')
    expect(parseProInvoiceInput({ ...body, billing_email: 'pas-un-mail' })).toBe('E-mail de facturation invalide')
    const ok = parseProInvoiceInput({ ...body, vat_number: 'fr 00 123' }) as ProInvoiceInput
    expect(ok).toMatchObject({ country: 'FR', business: false, vatNumber: null, period: 'yearly' })
    const pro = parseProInvoiceInput({ ...body, business: true, vat_number: 'fr 00 123' }) as ProInvoiceInput
    expect(pro.vatNumber).toBe('FR00123')
  })

  test('paramètres : sur facture à 15 jours, carte ou virement, TVA ajoutée, rattaché au compte', () => {
    const input = parseProInvoiceInput(body) as ProInvoiceInput
    const p = proSubscriptionParams(input, { customerId: 'cus_1', priceId: 'price_py', taxRate: 'txr_ex' })
    expect(p).toMatchObject({
      customer: 'cus_1', items: [{ price: 'price_py', quantity: 1 }],
      collection_method: 'send_invoice', days_until_due: PRO_INVOICE.daysUntilDue,
      payment_settings: { payment_method_types: ['card', 'customer_balance'] },
      default_tax_rates: ['txr_ex'],
      metadata: { user_id: uid, kind: 'individual', tier: 'pro' },
    })
    expect(p).not.toHaveProperty('billing_cycle_anchor')
  })

  test('période déjà réglée : première facture à la date choisie, sans prorata', () => {
    const now = new Date('2026-11-08T10:00:00Z')
    expect(billingAnchor('2026-12-01', now)).toBe(Date.parse('2026-12-01T12:00:00Z') / 1000)
    expect(billingAnchor('2026-11-08', now)).toBeNull()
    expect(billingAnchor('2026-10-01', now)).toBeNull()
    expect(billingAnchor(null, now)).toBeNull()
    const input = parseProInvoiceInput({ ...body, first_invoice_date: '2026-12-01' }) as ProInvoiceInput
    expect(proSubscriptionParams(input, { customerId: 'c', priceId: 'p', taxRate: null, now })).toMatchObject({
      billing_cycle_anchor: Date.parse('2026-12-01T12:00:00Z') / 1000, proration_behavior: 'none',
    })
  })

  test('mentions : retard et 40 € pour un pro ; particulier sans renoncement, échéance à 15 jours', () => {
    const pro = proInvoiceFooter(true, env)
    expect(pro).toContain('Paiement à 15 jours')
    expect(pro).toContain('indemnité forfaitaire de 40 €')
    expect(pro).toContain('FR00123')
    const perso = proInvoiceFooter(false, env)
    expect(perso).toContain('Paiement à 15 jours')
    expect(perso).not.toMatch(/rétractation/i)
    expect(perso).not.toContain('40 €')
  })
})
