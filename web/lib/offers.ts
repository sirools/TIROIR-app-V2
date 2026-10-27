// La grille des formules — grille V4, figée par le fondateur le 19/10/2026
// pour toute la durée du projet (`strategie/offres.md`). Seule source des
// prix affichés par le site et cités par Torix : ne jamais les réécrire
// ailleurs. Les mêmes prix sont déclarés dans les stores et dans Stripe
// (`strategie/packs-stores.md`).
//
// Les packs doivent rester ceux que l'app vend et que le webhook crédite
// (`mobile/src/lib/creditPacks.ts`, `supabase/functions/_shared/
// storeProducts.ts`), et le coût d'un crédit celui de `ai_credit_cost`
// (`supabase/drafts/ai_credits_spend.sql`) : des tests le vérifient.

export const OFFERS_V4 = {
  free: { aiActionsPerMonth: 20 },
  packs: [
    { id: 'tiroir_credits_50', credits: 50, priceTtc: 2.99, popular: false },
    { id: 'tiroir_credits_150', credits: 150, priceTtc: 6.99, popular: true },
    { id: 'tiroir_credits_500', credits: 500, priceTtc: 19.99, popular: false },
  ],
  premium: { monthlyTtc: 4.99, yearlyTtc: 39 },
  /** Pro = Premium avec des quotas plus élevés (réglés dans le back-office). */
  pro: { monthlyTtc: 14.99 },
  business: { seatMonthly: 39 },
} as const

/** Ce que coûte chaque action, en crédits. */
export const CREDIT_COSTS = [
  { label: 'Fiche d’objet (photo analysée par l’IA)', credits: 1 },
  { label: 'Amélioration de photo', credits: 4 },
  { label: 'Estimation de valeur (recherche d’annonces)', credits: 8 },
] as const

/** 4.99 → « 4,99 € », 1700 → « 1 700 € ». Espaces insécables évités pour les tests. */
export function euros(n: number): string {
  const s = Number.isInteger(n)
    ? n.toLocaleString('fr-FR')
    : n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${s.replace(/\s/g, ' ')} €`
}

export function credits(n: number): string {
  return n.toLocaleString('fr-FR').replace(/\s/g, ' ')
}
