// Export mensuel des factures Stripe et de la TVA collectée, pour la
// déclaration de TVA du fondateur (back-office › Facturation).
//
// Prestations de services : la TVA est exigible à l'encaissement. Une
// facture compte donc dans le mois de son paiement (status_transitions.
// paid_at), pas de son émission. Les ventes des stores n'y sont pas :
// Apple et Google facturent et reversent eux-mêmes la TVA.
//
// Module pur (sans réseau), testable ; la route API pagine chez Stripe.

type Obj = Record<string, unknown>
const obj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {})
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const str = (v: unknown): string => (typeof v === 'string' ? v : '')

/** « 2026-11 » → bornes en secondes Unix (UTC), ou null si le mois est invalide. */
export function monthRange(month: string): { start: number; end: number } | null {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month)
  if (!m) return null
  const start = Date.UTC(Number(m[1]), Number(m[2]) - 1, 1) / 1000
  const end = Date.UTC(Number(m[1]), Number(m[2]), 1) / 1000
  return { start, end }
}

export type VatRow = {
  paidAt: string
  number: string
  customer: string
  email: string
  country: string
  customerVat: string
  kind: 'abonnement' | 'crédits' | 'business' | 'autre'
  ht: number
  vat: number
  ttc: number
  currency: string
  url: string
}

function kindOf(i: Obj): VatRow['kind'] {
  const meta = obj(i.metadata)
  const subMeta = obj(obj(i.subscription_details).metadata)
  const parentMeta = obj(obj(obj(i.parent).subscription_details).metadata)
  if (meta.kind === 'credits') return 'crédits'
  if (subMeta.org_id || parentMeta.org_id) return 'business'
  if (subMeta.kind === 'individual' || parentMeta.kind === 'individual' || i.subscription) return 'abonnement'
  return 'autre'
}

/** Factures payées dans le mois → lignes de l'export (centimes → euros). */
export function vatRows(invoices: unknown[], range: { start: number; end: number }): VatRow[] {
  return invoices.map(obj)
    .filter(i => i.status === 'paid')
    .filter(i => {
      const paid = num(obj(i.status_transitions).paid_at)
      return paid >= range.start && paid < range.end
    })
    .map(i => {
      const total = num(i.total)
      const taxes = Array.isArray(i.total_tax_amounts) ? (i.total_tax_amounts as unknown[]).map(obj) : []
      const vat = taxes.reduce((s, t) => s + num(t.amount), 0)
      const ht = typeof i.total_excluding_tax === 'number' ? i.total_excluding_tax : total - vat
      const address = obj(i.customer_address)
      const taxIds = Array.isArray(i.customer_tax_ids) ? (i.customer_tax_ids as unknown[]).map(obj) : []
      return {
        paidAt: new Date(num(obj(i.status_transitions).paid_at) * 1000).toISOString().slice(0, 10),
        number: str(i.number),
        customer: str(i.customer_name),
        email: str(i.customer_email),
        country: str(address.country),
        customerVat: str(taxIds[0]?.value),
        kind: kindOf(i),
        ht: ht / 100,
        vat: vat / 100,
        ttc: total / 100,
        currency: str(i.currency).toUpperCase(),
        url: str(i.hosted_invoice_url),
      }
    })
    .sort((a, b) => a.paidAt.localeCompare(b.paidAt) || a.number.localeCompare(b.number))
}

const HEADER = ['Date de paiement', 'N° de facture', 'Client', 'E-mail', 'Pays', 'N° TVA client', 'Type', 'HT', 'TVA', 'TTC', 'Devise', 'Lien']

/** CSV pour un tableur français : séparateur « ; », virgule décimale, ligne de total. */
export function vatCsv(rows: VatRow[]): string {
  const cell = (v: string | number) => {
    const s = typeof v === 'number' ? v.toFixed(2).replace('.', ',') : v
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const sum = (k: 'ht' | 'vat' | 'ttc') => Math.round(rows.reduce((s, r) => s + r[k], 0) * 100) / 100
  const lines = [
    HEADER.join(';'),
    ...rows.map(r => [r.paidAt, r.number, r.customer, r.email, r.country, r.customerVat, r.kind, r.ht, r.vat, r.ttc, r.currency, r.url].map(cell).join(';')),
    ['Total', '', '', '', '', '', '', sum('ht'), sum('vat'), sum('ttc'), 'EUR', ''].map(cell).join(';'),
  ]
  // BOM : Excel lit l'UTF-8 (accents) sans réglage.
  return '﻿' + lines.join('\r\n') + '\r\n'
}

/** Les `count` derniers mois, du plus récent au plus ancien (« 2026-11 », « 2026-10 »…). */
export function lastMonths(now: Date, count: number): string[] {
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    out.push(d.toISOString().slice(0, 7))
  }
  return out
}

export type VatMonth = { month: string; invoices: number; ht: number; vat: number; ttc: number }

/** TVA collectée par mois de paiement (euros, arrondis au centime). */
export function vatByMonth(invoices: unknown[], months: string[]): VatMonth[] {
  const r2 = (n: number) => Math.round(n * 100) / 100
  return months.map(month => {
    const range = monthRange(month)
    const rows = range ? vatRows(invoices, range) : []
    return {
      month,
      invoices: rows.length,
      ht: r2(rows.reduce((s, r) => s + r.ht, 0)),
      vat: r2(rows.reduce((s, r) => s + r.vat, 0)),
      ttc: r2(rows.reduce((s, r) => s + r.ttc, 0)),
    }
  })
}
