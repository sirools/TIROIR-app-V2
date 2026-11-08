// Trésorerie de Tiroir, en ordre de grandeur : ce que Tiroir coûte ce mois-ci,
// ce que les abonnements rapportent vraiment, et combien de clients Pro il
// faut pour combler l'écart. Affiché dans le back-office. Toutes les
// hypothèses sont ici, nommées, et affichées à côté des chiffres.
//
// Revenus : le MRR hors taxes réellement en cours, par canal
// (lib/subscriptionRevenue.ts). La TVA collectée n'est pas un revenu :
// l'EI est assujettie depuis le 08/11/2026, la TVA du site est reversée,
// celle des stores retenue par Apple / Google. Le site est compté avant
// frais Stripe ; les stores, commission déduite. Un Pro sur facture n'a pas
// de montant connu ici : il n'est pas compté.
//
// Module sans dépendance, testable.
import { OFFERS_V4 } from './offers'

export const HYPOTHESES = {
  usdToEur: 0.92,
  storeCommission: 0.15, // programme petites entreprises d'Apple / Google
  vercelUsd: 20, // à ajuster selon la formule Vercel
  appleDeveloperUsdPerYear: 99,
} as const

export type TreasuryInput = {
  supabaseUsd: number
  aiMonthUsd: number
  /** MRR HT du site (Stripe), en euros. */
  siteMrrHtEur: number
  /** MRR HT estimé des stores (avant commission), en euros. */
  storeMrrHtEur: number
}

export type Treasury = {
  costs: { label: string; eur: number }[]
  costEur: number
  revenueEur: number
  gapEur: number
  /** Ce que rapporte un Pro mensuel du site, HT. */
  proNetEur: number
  /** Clients Pro mensuels de plus pour couvrir l'écart (0 si couvert). */
  proNeeded: number
  /** Ce qu'un client Pro annuel apporte d'un coup, HT. */
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

  const revenueEur = round2(safe(input.siteMrrHtEur) + safe(input.storeMrrHtEur) * (1 - h.storeCommission))
  const proNetEur = OFFERS_V4.pro.monthlyHt

  const gapEur = round2(Math.max(0, costEur - revenueEur))
  const proNeeded = gapEur > 0 ? Math.ceil(gapEur / proNetEur) : 0
  const proAnnualCashEur = OFFERS_V4.pro.yearlyHt

  return { costs, costEur, revenueEur, gapEur, proNetEur, proNeeded, proAnnualCashEur }
}
