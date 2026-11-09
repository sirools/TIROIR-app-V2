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

/**
 * Zoom et photos haute définition : réservés aux abonnés, pour contenir le
 * volume stocké (décision du 3/11, strategie/offres.md). Business est nommé
 * ici car la grille le prévoit, même si le palier n'existe pas encore en base.
 */
export const hasPhotoZoom = (plan?: string | null): boolean =>
  isPaidPlan(plan) || plan === 'business'

export const isProPlan = (plan?: string | null): boolean => plan === 'pro'

/** Clé i18n du libellé de palier, pour le badge du profil. */
export const planLabelKey = (plan?: string | null): string =>
  plan === 'pro' ? 'profile.pro' : plan === 'premium' ? 'profile.premium' : 'profile.free'

/**
 * Ce que l'écran d'abonnement peut vendre à ce compte, pour ne jamais faire
 * payer deux fois (audit du 09/11/2026) :
 *   - 'all'      : gratuit (ou Pro sur facture échu) → Premium et Pro ;
 *   - 'pro_only' : Premium acheté dans l'app → seulement la montée en Pro,
 *                  que le store gère dans le même groupe d'abonnements ;
 *   - 'none'     : déjà payé ailleurs (site, facture, compte offert) ou déjà
 *                  Pro → aucun abonnement ; les packs de crédits restent.
 * Le webhook RevenueCat ignore un achat des stores sur un compte payé
 * ailleurs (storeProducts.ts, nextPlan) : sans cette garde, le client paie
 * sans rien recevoir de plus.
 */
export type StoreSubscribeGate = 'all' | 'pro_only' | 'none'

export type PlanProfile = {
  plan?: string | null
  plan_source?: string | null
  pro_expires_at?: string | null
}

export function storeSubscribeGate(
  profile: PlanProfile | null | undefined,
  today: string = new Date().toISOString().slice(0, 10),
): StoreSubscribeGate {
  const plan = profile?.plan ?? 'free'
  // Même règle que effective_plan() en base : un Pro daté et échu est gratuit.
  const expired = plan === 'pro' && !!profile?.pro_expires_at && profile.pro_expires_at < today
  if (!isPaidPlan(plan) || expired) return 'all'
  if (plan === 'premium' && profile?.plan_source === 'app') return 'pro_only'
  return 'none'
}

/**
 * Produit d'abonnement Pro des stores (tiroir_pro_monthly…) — même règle que
 * le webhook RevenueCat (supabase/functions/_shared/storeProducts.ts).
 * Google Play peut suffixer l'identifiant (« …:base »).
 */
export const isProProduct = (productId?: string | null): boolean =>
  !!productId && productId.split(':')[0].startsWith('tiroir_pro')
