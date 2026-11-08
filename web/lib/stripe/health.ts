// Santé des paiements, pour le back-office : ce qui demande un geste.
//   - webhooks Stripe en échec (stripe_events.error) ou restés sans
//     traitement plus de 10 minutes ;
//   - paiements refusés (charges « failed », 30 derniers jours) ;
//   - litiges (disputes) : ouverts, ou créés sur les 90 derniers jours.
//
// Les lignes viennent de la base (stripe_events) et de l'API Stripe, lues
// par le serveur ; le calcul est ici, pur et testable.

export type StripeEventRow = { id: string; type: string; received_at: string; processed_at: string | null; error: string | null }

type Obj = Record<string, unknown>
const obj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {})
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

export type WebhookIssue = { id: string; type: string; at: string; problem: string }
export type FailedPayment = { id: string; at: string; amount: number; currency: string; email: string | null; reason: string }
export type Dispute = { id: string; at: string; amount: number; currency: string; reason: string; status: string; open: boolean; dueBy: string | null }

export type PaymentHealth = {
  webhooks: WebhookIssue[]
  failedPayments: FailedPayment[]
  disputes: Dispute[]
  /** Litiges qui attendent une réponse (ou en cours d'examen). */
  openDisputes: number
  /** Stripe n'a pas pu être lu (clé absente ou erreur) : listes partielles. */
  stripeUnavailable: boolean
  /** Rien à signaler. */
  ok: boolean
}

/** Litiges encore ouverts chez Stripe. */
const OPEN_DISPUTE = new Set(['warning_needs_response', 'needs_response', 'under_review', 'warning_under_review'])

const DISPUTE_REASONS: Record<string, string> = {
  fraudulent: 'fraude déclarée',
  subscription_canceled: 'abonnement résilié',
  product_not_received: 'non reçu',
  product_unacceptable: 'non conforme',
  duplicate: 'doublon',
  credit_not_processed: 'remboursement non reçu',
  unrecognized: 'paiement non reconnu',
  general: 'autre',
}

const iso = (unixSeconds: unknown) => new Date(num(unixSeconds) * 1000).toISOString()

export function paymentHealth(args: {
  events: StripeEventRow[]
  charges: unknown[]
  disputes: unknown[]
  stripeUnavailable?: boolean
  now?: Date
}): PaymentHealth {
  const now = args.now ?? new Date()
  const stuckBefore = new Date(now.getTime() - 10 * 60_000).toISOString()

  const webhooks: WebhookIssue[] = []
  for (const e of args.events) {
    if (e.error) webhooks.push({ id: e.id, type: e.type, at: e.received_at, problem: e.error })
    else if (!e.processed_at && e.received_at < stuckBefore) webhooks.push({ id: e.id, type: e.type, at: e.received_at, problem: 'reçu, jamais traité' })
  }
  webhooks.sort((a, b) => b.at.localeCompare(a.at))

  const failedPayments: FailedPayment[] = args.charges.map(obj)
    .filter(c => c.status === 'failed')
    .map(c => {
      const outcome = obj(c.outcome)
      return {
        id: String(c.id),
        at: iso(c.created),
        amount: num(c.amount),
        currency: String(c.currency ?? 'eur'),
        email: str(obj(c.billing_details).email) ?? str(c.receipt_email),
        reason: str(c.failure_message) ?? str(outcome.seller_message) ?? str(c.failure_code) ?? 'refusé',
      }
    })
    .sort((a, b) => b.at.localeCompare(a.at))

  const disputes: Dispute[] = args.disputes.map(obj).map(d => {
    const status = String(d.status ?? '')
    return {
      id: String(d.id),
      at: iso(d.created),
      amount: num(d.amount),
      currency: String(d.currency ?? 'eur'),
      reason: DISPUTE_REASONS[String(d.reason)] ?? String(d.reason ?? ''),
      status,
      open: OPEN_DISPUTE.has(status),
      dueBy: obj(d.evidence_details).due_by ? iso(obj(d.evidence_details).due_by) : null,
    }
  }).sort((a, b) => Number(b.open) - Number(a.open) || b.at.localeCompare(a.at))

  const openDisputes = disputes.filter(d => d.open).length
  return {
    webhooks,
    failedPayments,
    disputes,
    openDisputes,
    stripeUnavailable: !!args.stripeUnavailable,
    ok: webhooks.length === 0 && failedPayments.length === 0 && openDisputes === 0 && !args.stripeUnavailable,
  }
}

/** Libellé court d'un statut de litige. */
export function disputeStatusLabel(status: string): string {
  switch (status) {
    case 'warning_needs_response':
    case 'needs_response': return 'réponse attendue'
    case 'under_review':
    case 'warning_under_review': return 'en examen'
    case 'won': return 'gagné'
    case 'lost': return 'perdu'
    case 'warning_closed': return 'clos (alerte)'
    case 'charge_refunded': return 'remboursé'
    default: return status
  }
}
