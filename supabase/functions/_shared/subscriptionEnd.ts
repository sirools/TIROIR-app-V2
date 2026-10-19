// Quand un événement RevenueCat met-il fin à l'accès payant ?
//
// - EXPIRATION : la période payée est finie (y compris après un problème
//   de paiement non résolu) → oui.
// - CANCELLATION : le client a coupé le renouvellement automatique ; il a
//   payé jusqu'à la fin de sa période, l'accès continue et EXPIRATION
//   suivra → non. Sauf remboursement : RevenueCat place alors
//   expiration_at_ms au moment du remboursement, déjà passé → oui.
// - BILLING_ISSUE : période de grâce des stores, l'accès continue ;
//   EXPIRATION suivra si le paiement n'aboutit pas → non.
//
// Module sans dépendance : importé par le webhook (Deno) et testé côté site.

export type SubscriptionEvent = { type: string; expiration_at_ms?: unknown }

export function endsAccess(event: SubscriptionEvent, now: number = Date.now()): boolean {
  if (event.type === 'EXPIRATION') return true
  if (event.type === 'CANCELLATION') {
    return typeof event.expiration_at_ms === 'number' && event.expiration_at_ms <= now
  }
  return false
}
