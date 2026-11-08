// Formule Business : droits des membres selon l'état de l'abonnement
// Stripe, et lecture des objets Stripe (abonnement, facture) dont le
// webhook a besoin. Module pur, testable.
import { BUSINESS } from '../stripeConfig'

const DAY_MS = 24 * 60 * 60 * 1000

/** Date (UTC) au format AAAA-MM-JJ, comme une colonne DATE. */
export const isoDay = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS)
export const fromEpoch = (s: unknown): Date | null => (typeof s === 'number' && s > 0 ? new Date(s * 1000) : null)

/**
 * Dernier jour des droits Pro des membres (profiles.pro_expires_at), ou
 * null pour les retirer tout de suite.
 *
 *   - active, trialing : fin de la période en cours + délai de grâce. Sur
 *     facture, l'abonnement reste actif jusqu'à l'échéance (30 jours) ;
 *   - past_due (échéance dépassée, prélèvement rejeté) : la grâce court à
 *     partir du premier impayé, sans jamais repousser une date déjà
 *     posée — les rappels successifs de Stripe ne prolongent rien ;
 *   - unpaid, canceled, incomplete, incomplete_expired, paused : plus de
 *     droits.
 */
export function accessUntil(args: {
  status: string | null | undefined
  periodEnd: Date | null
  previous: string | null | undefined
  now: Date
  graceDays?: number
}): string | null {
  const grace = args.graceDays ?? BUSINESS.graceDays
  if (args.status === 'active' || args.status === 'trialing') {
    return args.periodEnd ? isoDay(addDays(args.periodEnd, grace)) : null
  }
  if (args.status === 'past_due') {
    const fromNow = isoDay(addDays(args.now, grace))
    const prev = args.previous ?? (args.periodEnd ? isoDay(addDays(args.periodEnd, grace)) : null)
    return prev && prev < fromNow ? prev : fromNow
  }
  return null
}

type Obj = Record<string, unknown>
const obj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {})
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null)
/** Identifiant d'un champ qui peut être un id ou un objet développé. */
export const idOf = (v: unknown): string | null => str(v) ?? str(obj(v).id)

export type SubscriptionSnapshot = {
  id: string
  customerId: string | null
  orgId: string | null
  status: string | null
  quantity: number | null
  unitAmount: number | null
  periodEnd: Date | null
  livemode: boolean
}

/** Lit un abonnement (anciennes et nouvelles versions de l'API). */
export function subscriptionSnapshot(sub: unknown): SubscriptionSnapshot {
  const s = obj(sub)
  const item = obj((obj(s.items).data as unknown[] | undefined)?.[0])
  return {
    id: str(s.id) ?? '',
    customerId: idOf(s.customer),
    orgId: str(obj(s.metadata).org_id),
    status: str(s.status),
    quantity: num(item.quantity) ?? num(s.quantity),
    unitAmount: num(obj(item.price).unit_amount),
    // Depuis 2025, la période vit sur l'élément d'abonnement.
    periodEnd: fromEpoch(s.current_period_end) ?? fromEpoch(item.current_period_end),
    livemode: s.livemode === true,
  }
}

export type InvoiceRow = {
  stripe_invoice_id: string
  number: string | null
  status: string
  currency: string
  amount_due: number
  amount_paid: number
  amount_remaining: number
  seats: number | null
  period_start: string | null
  period_end: string | null
  due_date: string | null
  paid_at: string | null
  hosted_invoice_url: string | null
  invoice_pdf: string | null
  livemode: boolean
  created_at: string
}

const iso = (d: Date | null) => (d ? d.toISOString() : null)

/** Facture Stripe → ligne de billing_invoices (sans org ni moyen de paiement). */
export function invoiceRow(invoice: unknown): InvoiceRow {
  const i = obj(invoice)
  const lines = (obj(i.lines).data as unknown[] | undefined) ?? []
  // Sièges : la ligne de l'abonnement (hors lignes de prorata).
  const seatLine = lines.map(obj).find(l => l.proration !== true && num(l.quantity) !== null)
  const period = obj(seatLine?.period)
  const transitions = obj(i.status_transitions)
  return {
    stripe_invoice_id: str(i.id) ?? '',
    number: str(i.number),
    status: str(i.status) ?? 'draft',
    currency: str(i.currency) ?? 'eur',
    amount_due: num(i.amount_due) ?? 0,
    amount_paid: num(i.amount_paid) ?? 0,
    amount_remaining: num(i.amount_remaining) ?? 0,
    seats: num(seatLine?.quantity),
    period_start: iso(fromEpoch(period.start) ?? fromEpoch(i.period_start)),
    period_end: iso(fromEpoch(period.end) ?? fromEpoch(i.period_end)),
    due_date: iso(fromEpoch(i.due_date)),
    paid_at: iso(fromEpoch(transitions.paid_at)),
    hosted_invoice_url: str(i.hosted_invoice_url),
    invoice_pdf: str(i.invoice_pdf),
    livemode: i.livemode === true,
    created_at: iso(fromEpoch(i.created)) ?? new Date().toISOString(),
  }
}

/** Abonnement d'une facture (anciennes et nouvelles versions de l'API). */
export function invoiceSubscriptionId(invoice: unknown): string | null {
  const i = obj(invoice)
  return idOf(i.subscription) ?? str(obj(obj(i.parent).subscription_details).subscription)
}

/** Organisation d'une facture, si l'abonnement la porte en métadonnée. */
export function invoiceOrgId(invoice: unknown): string | null {
  const i = obj(invoice)
  return str(obj(obj(i.subscription_details).metadata).org_id)
    ?? str(obj(obj(obj(i.parent).subscription_details).metadata).org_id)
}

/** Libellé lisible d'un moyen de paiement Stripe. */
export function paymentMethodLabel(type: string | null | undefined): string {
  switch (type) {
    case 'card': return 'Carte'
    case 'link': return 'Link'
    case 'sepa_debit': return 'Prélèvement SEPA'
    case 'customer_balance': return 'Virement'
    case 'out_of_band': return 'Hors Stripe'
    case null: case undefined: case '': return '—'
    default: return type
  }
}
