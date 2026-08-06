/**
 * Quantité d'une fiche : nombre d'exemplaires identiques.
 *
 * Pendant web de `mobile/src/features/objects/quantity.ts`. Les deux
 * codebases sont séparées, mais la règle est la même et elle est
 * structurante : en base, TOUS les montants d'un objet sont unitaires
 * (market_value, user_value, purchase_price, sale_price, deposit_amount).
 * Le total d'un lot n'est jamais stocké, il se dérive.
 *
 * Seule exception, explicite : `sale_price_lot`, le prix négocié pour le
 * lot entier, qui remplace le produit au lieu de s'y ajouter.
 */

/** Un objet unique n'a pas de quantité à afficher. */
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
