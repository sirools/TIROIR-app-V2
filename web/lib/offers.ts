// La grille des formules, telle que décidée par le fondateur le 30/09/2026
// (`strategie/offres.md`). Seule source des prix affichés par la page
// Tarifs et cités par Torix : ne jamais les réécrire ailleurs.
//
// Les packs doivent rester ceux que l'app vend et que le webhook crédite
// (`mobile/src/lib/creditPacks.ts`), et le coût d'un crédit celui de
// `ai_credit_cost` (`supabase/drafts/ai_credits_spend.sql`) : des tests le
// vérifient.

export const OFFERS = {
  free: { aiObjects: 20 },
  packs: [
    { id: 'tiroir_credits_30', credits: 30, priceTtc: 4.99 },
    { id: 'tiroir_credits_80', credits: 80, priceTtc: 9.99 },
  ],
  premium: { monthlyTtc: 49.99 },
  /** Licence Pro : socle mensuel HT avec des crédits inclus, puis au crédit. */
  pro: { baseHt: 1700, includedCredits: 20000, extraCreditHt: 0.05 },
  /** Ce que coûte chaque action, en crédits. */
  creditCosts: [
    { label: 'Fiche d’objet (photo analysée par l’IA)', credits: 1 },
    { label: 'Amélioration de photo', credits: 4 },
    { label: 'Estimation de valeur (recherche d’annonces)', credits: 8 },
  ],
  /** Prix que gardent les abonnés actuels tant qu'ils restent abonnés. */
  legacyPremiumTtc: 6.99,
} as const

// Grille V4, affichée par la page Tarifs du site (textes de la page Notion
// « Page Tarifs — textes V4 », octobre 2026). Le paiement n'est pas encore
// ouvert : Stripe reste en mode test, et l'app vend toujours la grille
// OFFERS ci-dessus. Les identifiants des packs ne sont pas encore ceux de
// l'app : ne pas les relier au webhook avant la bascule.
export const OFFERS_V4 = {
  free: { aiActionsPerMonth: 20 },
  packs: [
    { credits: 50, priceTtc: 2.99, popular: false },
    { credits: 150, priceTtc: 6.99, popular: true },
    { credits: 500, priceTtc: 19.99, popular: false },
  ],
  premium: { monthlyTtc: 4.99, yearlyTtc: 39 },
  pro: { monthlyTtc: 14.99 },
  business: { seatMonthly: 39 },
} as const

/** Montant mensuel HT d'une licence Pro pour une consommation donnée. */
export function proMonthlyHt(credits: number): number {
  const { baseHt, includedCredits, extraCreditHt } = OFFERS.pro
  const extra = Math.max(0, Math.round(Number.isFinite(credits) ? credits : 0) - includedCredits)
  return Math.round((baseHt + extra * extraCreditHt) * 100) / 100
}

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
