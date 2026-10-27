// Paliers d'abonnement.
//
// « pro » (Professionnel) est vendu en direct sur facture, hors stores : il
// ouvre exactement les mêmes fonctionnalités que le premium, avec des quotas
// IA plus élevés servis par les RPC côté serveur. Côté app, il ne faut donc
// jamais comparer à 'premium' en dur — un compte Pro serait traité comme
// gratuit — mais passer par isPaidPlan().
export type Plan = 'free' | 'premium' | 'pro'

/** Vrai pour tout palier payant : débloque les fonctionnalités premium. */
export const isPaidPlan = (plan?: string | null): boolean =>
  plan === 'premium' || plan === 'pro'

export const isProPlan = (plan?: string | null): boolean => plan === 'pro'

/** Clé i18n du libellé de palier, pour le badge du profil. */
export const planLabelKey = (plan?: string | null): string =>
  plan === 'pro' ? 'profile.pro' : plan === 'premium' ? 'profile.premium' : 'profile.free'

/**
 * Produit d'abonnement Pro des stores (tiroir_pro_monthly…) — même règle que
 * le webhook RevenueCat (supabase/functions/_shared/storeProducts.ts).
 * Google Play peut suffixer l'identifiant (« …:base »).
 */
export const isProProduct = (productId?: string | null): boolean =>
  !!productId && productId.split(':')[0].startsWith('tiroir_pro')
