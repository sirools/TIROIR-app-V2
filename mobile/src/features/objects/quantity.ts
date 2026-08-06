/**
 * Quantité d'une fiche : nombre d'exemplaires identiques.
 *
 * RÈGLE D'OR — en base, tous les montants d'un objet sont UNITAIRES
 * (market_value, user_value, purchase_price, sale_price, deposit_amount).
 * Le total d'un lot n'est jamais stocké, il se dérive ici. Stocker le total
 * désynchroniserait chaque somme de collection à la première modification
 * de quantité, et obligerait à diviser à l'envers pour retrouver l'unité.
 */

/** Une fiche décrit au moins un exemplaire (contrainte CHECK en base). */
export const QUANTITY_MIN = 1

/**
 * Au-delà, on ne décrit plus un lot mais un stock — ce que Tiroir n'est pas.
 * Borne de saisie, pas de vérité métier : elle protège surtout de la faute
 * de frappe (un « 1000 » au lieu de « 10 » fausserait tout le patrimoine).
 */
export const QUANTITY_MAX = 999

export function clampQuantity(value: number): number {
  if (!Number.isFinite(value)) return QUANTITY_MIN
  return Math.min(QUANTITY_MAX, Math.max(QUANTITY_MIN, Math.round(value)))
}

/**
 * Un objet unique n'a pas de quantité à afficher : c'est ce qui garantit
 * que rien ne change pour qui ne fait que de l'ajout unitaire.
 */
export function isLot(quantity: number | null | undefined): boolean {
  return (quantity ?? 1) > 1
}

/** Total du lot pour un montant unitaire. `null` reste `null`. */
export function lotTotal(
  unitAmount: number | null | undefined,
  quantity: number | null | undefined,
): number | null {
  if (unitAmount == null) return null
  return unitAmount * (quantity ?? 1)
}

/**
 * Somme d'un inventaire en tenant compte des lots. À utiliser partout où on
 * additionnait naïvement des montants unitaires : patrimoine, valeur d'une
 * collection, totaux d'un partage.
 */
export function sumLots<T>(
  items: T[],
  unitAmount: (item: T) => number | null | undefined,
  quantity: (item: T) => number | null | undefined,
): number {
  return items.reduce((sum, item) => sum + (lotTotal(unitAmount(item), quantity(item)) ?? 0), 0)
}
