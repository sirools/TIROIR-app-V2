// Produits vendus dans les stores (App Store, Google Play), via RevenueCat.
// Grille V4 figée le 19/10/2026 (strategie/offres.md) ; identifiants créés
// selon strategie/packs-stores.md, et les mêmes que
// mobile/src/lib/creditPacks.ts (un test le vérifie).
//
// Module sans dépendance : importé par le webhook RevenueCat (Deno) et par
// les tests du site (vitest).

/** Packs de crédits (consommables) : identifiant → crédits accordés. */
export const CREDIT_PACKS: Record<string, number> = {
  tiroir_credits_50: 50,
  tiroir_credits_150: 150,
  tiroir_credits_500: 500,
  // Ancienne grille, retirée de la vente : reconnue pour les achats passés.
  tiroir_credits_30: 30,
  tiroir_credits_80: 80,
}

/** Abonnements Pro : tout identifiant qui commence ainsi (tiroir_pro_monthly…). */
const PRO_PREFIX = 'tiroir_pro'

// Google Play peut suffixer l'identifiant (« tiroir_credits_50:… »).
const baseId = (productId: unknown): string | null =>
  typeof productId === 'string' && productId ? productId.split(':')[0] : null

export function creditsForProduct(productId: unknown): number | null {
  const id = baseId(productId)
  return id ? CREDIT_PACKS[id] ?? null : null
}

export type StoreTier = 'premium' | 'pro'

/** Palier qu'ouvre un abonnement des stores (null pour un pack ou un inconnu). */
export function tierForProduct(productId: unknown): StoreTier | null {
  const id = baseId(productId)
  if (!id || id in CREDIT_PACKS) return null
  return id.startsWith(PRO_PREFIX) ? 'pro' : 'premium'
}

// Événements RevenueCat : abonnement actif…
export const ACTIVE_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
  'TRANSFER',
])

// …ou terminé/annulé.
export const INACTIVE_EVENTS = new Set([
  'EXPIRATION',
  'CANCELLATION',
  'BILLING_ISSUE',
  'SUBSCRIBER_ALIAS',
])

export type StoreEvent = { type: string; product_id?: unknown; new_product_id?: unknown }
export type CurrentProfile = { plan: string; pro_since: string | null; pro_expires_at: string | null }

/** Pro sur facture encore en cours (posé et daté par le back-office). */
const isInvoicedPro = (p: CurrentProfile, today: string) =>
  p.plan === 'pro' && !!p.pro_since && (!p.pro_expires_at || p.pro_expires_at >= today)

/**
 * Palier à écrire après un événement d'abonnement, ou null s'il ne faut
 * rien toucher.
 *
 * - Un client Pro sur facture en cours (pro_since posé par le back-office,
 *   période non échue) n'est jamais modifié par les stores.
 * - Changement de produit : c'est le nouveau produit qui compte.
 * - Fin d'abonnement : on ne retombe en gratuit que si c'est l'abonnement
 *   en cours qui s'arrête (la fin d'un Premium remplacé par un Pro ne
 *   coupe pas le Pro).
 */
export function nextPlan(
  event: StoreEvent,
  profile: CurrentProfile,
  today: string = new Date().toISOString().slice(0, 10),
): 'free' | StoreTier | null {
  if (isInvoicedPro(profile, today)) return null

  if (ACTIVE_EVENTS.has(event.type)) {
    const product = event.type === 'PRODUCT_CHANGE' ? event.new_product_id ?? event.product_id : event.product_id
    const tier = tierForProduct(product)
    if (!tier) return null
    // Un ancien Pro sur facture, échu, qui s'abonne au Pro des stores : on
    // réécrit le palier pour effacer ses dates de facture.
    const staleInvoice = tier === 'pro' && !!profile.pro_since
    return tier !== profile.plan || staleInvoice ? tier : null
  }

  if (INACTIVE_EVENTS.has(event.type)) {
    const tier = tierForProduct(event.product_id)
    return tier && tier === profile.plan ? 'free' : null
  }

  return null
}
