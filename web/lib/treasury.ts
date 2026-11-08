// Trésorerie de Tiroir, en ordre de grandeur : ce que Tiroir coûte ce mois-ci,
// ce que les abonnements rapportent, et combien de clients Pro il faut pour
// combler l'écart. Affiché dans le back-office. Toutes les hypothèses sont
// ici, nommées, et affichées à côté des chiffres : c'est une ESTIMATION.
//
// TVA : Tiroir (EI) est en franchise en base (confirmé le 26/10/2026) : une
// vente directe (Pro sur facture, site) ne porte pas de TVA. Les stores, eux,
// vendent en leur nom et retiennent la TVA du pays de l'acheteur avant de
// reverser : elle reste déduite du Premium, quel que soit le régime de Tiroir.
//
// Module sans dépendance, testable.

export const HYPOTHESES = {
  usdToEur: 0.92,
  storeVat: 0.2, // TVA retenue par Apple / Google sur les ventes de l'app
  directVat: 0, // franchise en base : pas de TVA sur les ventes directes
  storeCommission: 0.15, // programme petites entreprises d'Apple / Google
  premiumPriceTtc: 6.99,
  proPriceTtc: 29,
  proAnnualPriceTtc: 290,
  vercelUsd: 20, // à ajuster selon la formule Vercel
  appleDeveloperUsdPerYear: 99,
} as const

export type TreasuryInput = {
  supabaseUsd: number
  aiMonthUsd: number
  premiumCount: number
  proCount: number
}

export type Treasury = {
  costs: { label: string; eur: number }[]
  costEur: number
  revenueEur: number
  gapEur: number
  premiumNetEur: number
  proNetEur: number
  /** Clients Pro mensuels de plus pour couvrir l'écart (0 si couvert). */
  proNeeded: number
  /** Ce qu'un client Pro annuel apporte d'un coup, sur facture. */
  proAnnualCashEur: number
}

const round2 = (n: number) => Math.round(n * 100) / 100
const safe = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0)

export function computeTreasury(input: TreasuryInput, h = HYPOTHESES): Treasury {
  const eur = (usd: number) => round2(safe(usd) * h.usdToEur)
  const costs = [
    { label: 'Supabase', eur: eur(input.supabaseUsd) },
    { label: 'IA (dépense réelle du mois)', eur: eur(input.aiMonthUsd) },
    { label: 'Vercel (hypothèse)', eur: eur(h.vercelUsd) },
    { label: 'Apple Developer (99 $/an)', eur: eur(h.appleDeveloperUsdPerYear / 12) },
  ]
  const costEur = round2(costs.reduce((s, c) => s + c.eur, 0))

  const premiumNetEur = round2((h.premiumPriceTtc / (1 + h.storeVat)) * (1 - h.storeCommission))
  const proNetEur = round2(h.proPriceTtc / (1 + h.directVat))
  const revenueEur = round2(safe(input.premiumCount) * premiumNetEur + safe(input.proCount) * proNetEur)

  const gapEur = round2(Math.max(0, costEur - revenueEur))
  const proNeeded = gapEur > 0 ? Math.ceil(gapEur / proNetEur) : 0
  const proAnnualCashEur = round2(h.proAnnualPriceTtc / (1 + h.directVat))

  return { costs, costEur, revenueEur, gapEur, premiumNetEur, proNetEur, proNeeded, proAnnualCashEur }
}
