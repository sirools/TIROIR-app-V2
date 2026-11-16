// Économie de l'IA, pour le back-office : qui coûte quoi (gratuits contre
// payants), ce que coûte et rapporte chaque action, et le poids de l'IA
// dans le chiffre d'affaires du mois.
//
// Sources : public.ai_usage (coût réel en dollars de chaque appel, mesuré
// à l'écriture) et le palier de chaque compte (profiles.plan) ; le revenu
// vient de lib/subscriptionRevenue.ts.
//
// Prix d'une action : son coût en crédits (ai_credit_cost, migration
// 20261108143238_ai_credits_spend.sql : analyse 1, image 4, estimation 8)
// au prix HT d'un crédit du plus gros pack — le moins cher pour le client,
// donc la marge la plus prudente.
//
// Module pur, testable.
import { OFFERS_V4, VAT_RATE } from './offers'

/** Part de l'IA dans le chiffre d'affaires HT du mois au-delà de laquelle on alerte. */
export const AI_COST_ALERT_SHARE = 0.3

/** Famille et prix en crédits d'une fonction IA (même table que ai_feature_kind / ai_credit_cost). */
export const FEATURE_CREDITS: Record<string, { label: string; credits: number }> = {
  describe_object: { label: 'Fiche d’objet', credits: 1 },
  detect_scene: { label: 'Détection de scène', credits: 1 },
  chat_turn: { label: 'Assistant (message)', credits: 1 },
  enhance_photo: { label: 'Amélioration de photo', credits: 4 },
  scene_thumbnail: { label: 'Vignette de scène', credits: 4 },
  estimate_value: { label: 'Estimation de valeur', credits: 8 },
}

/** Prix HT d'un crédit au plus gros pack, en euros. */
export function creditPriceHtEur(): number {
  const best = [...OFFERS_V4.packs].sort((a, b) => a.priceTtc / a.credits - b.priceTtc / b.credits)[0]
  return best.priceTtc / (1 + VAT_RATE) / best.credits
}

export type UsageRow = { user_id: string | null; feature: string; cost_usd: number | string | null }
export type Segment = 'free' | 'premium' | 'pro' | 'unknown'
const SEGMENT_LABELS: Record<Segment, string> = { free: 'Gratuits', premium: 'Premium', pro: 'Pro', unknown: 'Compte supprimé' }

export type SegmentLine = { segment: Segment; label: string; users: number; calls: number; costEur: number; costPerUserEur: number }
export type ActionLine = {
  feature: string; label: string; calls: number; avgCostEur: number
  /** Prix de l'action en crédits (null : fonction non vendue en crédits). */
  credits: number | null
  /** Ce que l'action rapporte au prix d'un crédit (HT), et la marge. */
  priceEur: number | null
  marginEur: number | null
}

export type AiEconomics = {
  segments: SegmentLine[]
  actions: ActionLine[]
  totalCostEur: number
  /** Chiffre d'affaires HT du mois retenu (MRR + crédits du mois). */
  revenueHtEur: number
  /** Coût IA / chiffre d'affaires (null si pas de chiffre d'affaires). */
  share: number | null
  alert: boolean
}

const r4 = (n: number) => Math.round(n * 10000) / 10000

export function aiEconomics(args: {
  usage: UsageRow[]
  plans: Map<string, string | null>
  usdToEur: number
  revenueHtEur: number
}): AiEconomics {
  const toEur = (v: UsageRow['cost_usd']) => (Number(v) || 0) * args.usdToEur

  const seg = new Map<Segment, { users: Set<string>; calls: number; cost: number }>()
  const act = new Map<string, { calls: number; cost: number }>()
  let total = 0
  for (const u of args.usage) {
    const cost = toEur(u.cost_usd)
    total += cost
    const plan = u.user_id ? args.plans.get(u.user_id) : undefined
    const s: Segment = plan === 'pro' ? 'pro' : plan === 'premium' ? 'premium' : plan === undefined ? 'unknown' : 'free'
    const sl = seg.get(s) ?? { users: new Set<string>(), calls: 0, cost: 0 }
    if (u.user_id) sl.users.add(u.user_id)
    sl.calls += 1
    sl.cost += cost
    seg.set(s, sl)
    const al = act.get(u.feature) ?? { calls: 0, cost: 0 }
    al.calls += 1
    al.cost += cost
    act.set(u.feature, al)
  }

  const order: Segment[] = ['free', 'premium', 'pro', 'unknown']
  const segments = order.filter(s => seg.has(s)).map(s => {
    const v = seg.get(s)!
    return {
      segment: s, label: SEGMENT_LABELS[s], users: v.users.size, calls: v.calls,
      costEur: r4(v.cost), costPerUserEur: r4(v.users.size ? v.cost / v.users.size : 0),
    }
  })

  const credit = creditPriceHtEur()
  const actions = [...act.entries()].map(([feature, v]) => {
    const known = FEATURE_CREDITS[feature]
    const avg = v.calls ? v.cost / v.calls : 0
    const price = known ? known.credits * credit : null
    return {
      feature, label: known?.label ?? feature, calls: v.calls, avgCostEur: r4(avg),
      credits: known?.credits ?? null,
      priceEur: price === null ? null : r4(price),
      marginEur: price === null ? null : r4(price - avg),
    }
  }).sort((a, b) => b.avgCostEur * b.calls - a.avgCostEur * a.calls)

  const revenue = Math.max(0, args.revenueHtEur)
  const share = revenue > 0 ? total / revenue : null
  return {
    segments,
    actions,
    totalCostEur: r4(total),
    revenueHtEur: Math.round(revenue * 100) / 100,
    share,
    alert: share === null ? total > 0 : share > AI_COST_ALERT_SHARE,
  }
}
