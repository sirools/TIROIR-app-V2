// Packs de crédits IA vendus dans l'app (grille V4, strategie/offres.md).
// Les mêmes identifiants sont créés dans App Store Connect et Google Play
// Console (produits CONSOMMABLES), puis rangés dans RevenueCat dans l'offre
// « credits » (strategie/packs-stores.md). Le webhook RevenueCat crédite le
// compte (supabase/functions/_shared/storeProducts.ts, même table).
export const CREDITS_OFFERING = 'credits'

export const CREDIT_PACKS: Record<string, number> = {
  tiroir_credits_50: 50,
  tiroir_credits_150: 150,
  tiroir_credits_500: 500,
  // Ancienne grille, retirée de la vente : reconnue pour les achats passés.
  tiroir_credits_30: 30,
  tiroir_credits_80: 80,
}

export function creditsForProduct(productId: string | null | undefined): number | null {
  if (!productId) return null
  // Google Play peut suffixer l'identifiant (« tiroir_credits_30:… »).
  const base = productId.split(':')[0]
  return CREDIT_PACKS[base] ?? null
}
