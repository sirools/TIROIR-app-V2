// Suivi des revenus encaissés par Stripe (crédits du site, factures
// Business), lu dans les tables que le webhook synchronise
// (stripe_credit_purchases, billing_invoices, organizations). Affiché par
// le back-office (/admin/facturation).
//
// Montants en centimes, TTC, bruts (avant frais Stripe). Les achats faits
// dans l'app (stores, RevenueCat) n'y sont pas : voir l'accueil du
// back-office pour ceux-là.
//
// Module sans dépendance, testable.

export type CreditPurchaseRow = {
  paid_at: string
  customer_email: string | null
  pack: string
  credits: number
  amount_total: number
  amount_refunded: number
  payment_method: string | null
  status: string
}

export type InvoiceRevenueRow = {
  org_name: string | null
  number: string | null
  status: string
  amount_due: number
  amount_paid: number
  amount_remaining: number
  seats: number | null
  created_at: string
  due_date: string | null
  paid_at: string | null
  payment_method: string | null
}

export type OrgRevenueRow = {
  name: string
  subscription_status: string | null
  seat_quantity: number | null
  seat_unit_amount: number | null
}

export type BillingLine = {
  date: string
  kind: 'credits' | 'business'
  client: string
  what: string
  amount: number
  method: string | null
  status: string
}

const DAY_MS = 24 * 60 * 60 * 1000
const BILLED = new Set(['active', 'trialing', 'past_due'])

/** Revenu mensuel récurrent Business : sièges facturés × prix du siège. */
export function businessMrr(orgs: OrgRevenueRow[]): number {
  return orgs
    .filter(o => BILLED.has(o.subscription_status ?? ''))
    .reduce((sum, o) => sum + (o.seat_quantity ?? 0) * (o.seat_unit_amount ?? 0), 0)
}

const netCredit = (p: CreditPurchaseRow) => Math.max(0, p.amount_total - p.amount_refunded)

/** Qui facture qui, quoi, quand, par quel moyen : le plus récent d'abord. */
export function billingLines(purchases: CreditPurchaseRow[], invoices: InvoiceRevenueRow[]): BillingLine[] {
  const lines: BillingLine[] = [
    ...purchases.map(p => ({
      date: p.paid_at,
      kind: 'credits' as const,
      client: p.customer_email ?? 'Compte supprimé',
      what: `${p.credits} crédits IA`,
      amount: netCredit(p),
      method: p.payment_method,
      status: p.status === 'paid' ? 'payé' : p.status === 'refunded' ? 'remboursé' : 'remboursé en partie',
    })),
    ...invoices.filter(i => i.status !== 'draft').map(i => ({
      date: i.paid_at ?? i.created_at,
      kind: 'business' as const,
      client: i.org_name ?? 'Organisation supprimée',
      what: `Business${i.seats ? ` · ${i.seats} siège${i.seats > 1 ? 's' : ''}` : ''}${i.number ? ` · ${i.number}` : ''}`,
      amount: i.status === 'paid' ? i.amount_paid : i.amount_due,
      method: i.payment_method,
      status: invoiceStatusLabel(i),
    })),
  ]
  return lines.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
}

export function invoiceStatusLabel(i: Pick<InvoiceRevenueRow, 'status' | 'due_date'>, now = new Date()): string {
  switch (i.status) {
    case 'paid': return 'payée'
    case 'void': return 'annulée'
    case 'uncollectible': return 'irrécouvrable'
    case 'open': return i.due_date && new Date(i.due_date) < now ? 'en retard' : 'à payer'
    default: return i.status
  }
}

/** Encaissé par mois (AAAA-MM), crédits et Business séparés. */
export function monthlyCollected(purchases: CreditPurchaseRow[], invoices: InvoiceRevenueRow[]) {
  const months = new Map<string, { credits: number; business: number }>()
  const add = (date: string, key: 'credits' | 'business', amount: number) => {
    const m = date.slice(0, 7)
    const cur = months.get(m) ?? { credits: 0, business: 0 }
    cur[key] += amount
    months.set(m, cur)
  }
  for (const p of purchases) add(p.paid_at, 'credits', netCredit(p))
  for (const i of invoices) if (i.status === 'paid' && i.paid_at) add(i.paid_at, 'business', i.amount_paid)
  return [...months.entries()].sort(([a], [b]) => (a < b ? 1 : -1)).map(([month, v]) => ({ month, ...v, total: v.credits + v.business }))
}

/** Prochain 25 décembre (aujourd'hui compris). */
export function nextChristmas(now: Date): Date {
  const y = now.getUTCFullYear()
  const xmas = new Date(Date.UTC(y, 11, 25))
  return now.getTime() <= xmas.getTime() ? xmas : new Date(Date.UTC(y + 1, 11, 25))
}

/** Rythme des crédits : jamais calculé sur moins de 30 jours. */
const MIN_DAYS = 30

export type Projection = {
  target: string
  days: number
  /** Business : MRR actuel prolongé, au prorata des jours. */
  business: number
  /** Abonnements (site et stores) : MRR HT actuel prolongé, au prorata des jours. */
  subscriptions: number
  /** Crédits : moyenne journalière des 90 derniers jours, prolongée. */
  credits: number
  /** Factures émises, pas encore payées. */
  outstanding: number
  total: number
}

/**
 * Projection simple, sans croissance supposée : ce qui rentrerait d'ici
 * `target` si tout continuait au rythme actuel. Un ordre de grandeur, pas
 * une prévision.
 */
export function projectRevenue(args: {
  now: Date
  target: Date
  mrr: number
  /** MRR HT des abonnements (lib/subscriptionRevenue.ts), en centimes. */
  subscriptionsMrr?: number
  purchases: CreditPurchaseRow[]
  invoices: InvoiceRevenueRow[]
  windowDays?: number
}): Projection {
  const window = args.windowDays ?? 90
  const days = Math.max(0, Math.ceil((args.target.getTime() - args.now.getTime()) / DAY_MS))
  const since = args.now.getTime() - window * DAY_MS
  const recent = args.purchases.filter(p => new Date(p.paid_at).getTime() >= since)
  // Si les ventes ont commencé il y a moins de `window` jours, on divise
  // par le nombre de jours réellement écoulés depuis la première, mais
  // jamais moins de MIN_DAYS : un seul jour de ventes, prolongé tel quel,
  // promettrait des centaines d'euros sur la foi de trois achats.
  const first = recent.reduce((min, p) => Math.min(min, new Date(p.paid_at).getTime()), args.now.getTime())
  const elapsed = Math.min(window, Math.max(MIN_DAYS, Math.ceil((args.now.getTime() - first) / DAY_MS)))
  const perDay = recent.reduce((s, p) => s + netCredit(p), 0) / elapsed

  const business = Math.round(args.mrr * days / (365.25 / 12))
  const subscriptions = Math.round((args.subscriptionsMrr ?? 0) * days / (365.25 / 12))
  const credits = Math.round(perDay * days)
  const outstanding = args.invoices.filter(i => i.status === 'open').reduce((s, i) => s + i.amount_remaining, 0)
  return { target: args.target.toISOString().slice(0, 10), days, business, credits, outstanding, subscriptions, total: business + subscriptions + credits + outstanding }
}

/** 123456 → « 1 234,56 € ». */
export function eurosFromCents(cents: number): string {
  return `${(cents / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\s/g, ' ')} €`
}
