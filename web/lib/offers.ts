// La grille des formules — grille V4 du 19/10/2026, prix des abonnements
// remplacés par la grille de lancement du 08/11/2026 (`strategie/offres.md`). Seule source des
// prix affichés par le site et cités par Torix : ne jamais les réécrire
// ailleurs. Les mêmes prix sont déclarés dans les stores et dans Stripe
// (`strategie/packs-stores.md`).
//
// Les packs doivent rester ceux que l'app vend et que le webhook crédite
// (`mobile/src/lib/creditPacks.ts`, `supabase/functions/_shared/
// storeProducts.ts`), et le coût d'un crédit celui de `ai_credit_cost`
// (`supabase/drafts/ai_credits_spend.sql`) : des tests le vérifient.

// Le site vend ces packs et le siège Business par Stripe à partir de cette
// grille (lib/stripeConfig.ts) ; paiement fermé tant que STRIPE_MODE et la
// clé ne sont pas posés.
export const OFFERS_V4 = {
  free: { aiActionsPerMonth: 20 },
  packs: [
    { id: 'tiroir_credits_50', credits: 50, priceTtc: 2.99, popular: false },
    { id: 'tiroir_credits_150', credits: 150, priceTtc: 6.99, popular: true },
    { id: 'tiroir_credits_500', credits: 500, priceTtc: 19.99, popular: false },
  ],
  // Grille de lancement du 08/11/2026 (fixée jusqu'au passage à l'échelle) :
  // annuel = 10 mois, « deux mois offerts ». Prix HORS TAXES : la TVA
  // (20 %, l'EI est assujettie depuis le 08/11/2026 — BILLING_VAT_MODE)
  // s'ajoute : Premium 18 € / 180 € TTC, Pro 60 € / 600 € TTC.
  premium: { monthlyHt: 15, yearlyHt: 150 },
  /** Pro = Premium avec des quotas plus élevés (réglés dans le back-office). */
  pro: { monthlyHt: 50, yearlyHt: 500 },
  /** Business : sur devis, facture mensuelle (pas de paiement en ligne). Base de facturation par siège. */
  business: { seatMonthly: 39 },
} as const

/** TVA française appliquée quand l'EI est assujettie (BILLING_VAT_MODE). */
export const VAT_RATE = 0.2

/** Taux affiché par les pages (inliné au build par next.config.js). */
export function displayVatRate(): number {
  const r = Number(process.env.DISPLAY_VAT_RATE)
  return r === VAT_RATE ? VAT_RATE : 0
}

/** HT → TTC, arrondi au centime. */
export function withVat(ht: number, rate: number): number {
  return Math.round(ht * (1 + rate) * 100) / 100
}

/** TTC → HT, arrondi au centime (packs de crédits, vendus TTC). */
export function withoutVat(ttc: number, rate: number): number {
  return Math.round((ttc / (1 + rate)) * 100) / 100
}

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
