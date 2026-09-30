// Packs de crédits IA vendus dans l'app (strategie/offres.md). Les mêmes
// identifiants sont créés dans App Store Connect et Google Play Console
// (produits CONSOMMABLES), puis rangés dans RevenueCat dans l'offre
// « credits ». Le webhook RevenueCat crédite le compte
// (supabase/functions/revenuecat-webhook, même table).
export const CREDITS_OFFERING = 'credits'

export const CREDIT_PACKS: Record<string, number> = {
  tiroir_credits_30: 30,
  tiroir_credits_80: 80,
}

export function creditsForProduct(productId: string | null | undefined): number | null {
  if (!productId) return null
  // Google Play peut suffixer l'identifiant (« tiroir_credits_30:… »).
  const base = productId.split(':')[0]
  return CREDIT_PACKS[base] ?? null
}
