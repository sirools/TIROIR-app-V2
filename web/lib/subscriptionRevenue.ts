// Revenus réels des abonnements et des crédits, par canal de vente, pour le
// back-office (page Facturation, carte Trésorerie de l'accueil).
//
// Sources (lues par le serveur, clé service) :
//   - public.subscriptions : journal des abonnements, toutes sources
//     (stripe = le site, apple = iOS, google = Play Store). Écrit par le
//     webhook Stripe et par revenuecat-webhook ;
//   - public.profiles : palier effectif (plan) et son origine (plan_source :
//     web, app, ou vide pour un Pro sur facture posé à la main) ;
//   - public.stripe_credit_purchases : crédits achetés sur le site ;
//   - public.ai_credit_ledger : crédits achetés dans l'app (ref « rc:… »).
//
// MRR : hors taxes, en centimes, à la grille du site (OFFERS_V4) : un
// abonnement annuel compte pour 1/12. Pour les stores, c'est une
// ESTIMATION : le prix réel dépend du pays et de la console du store, et
// Apple / Google retiennent leur commission. Un Pro sur facture n'a pas de
// montant ici (facture hors Stripe) : il est compté, pas valorisé.
//
// Module pur, testable.
import { OFFERS_V4 } from './offers'

export type Channel = 'site' | 'ios' | 'android' | 'store' | 'invoice' | 'other'

export const CHANNEL_LABELS: Record<Channel, string> = {
  site: 'Site (Stripe)',
  ios: 'iOS (App Store)',
  android: 'Android (Play Store)',
  store: 'App, store non enregistré',
  invoice: 'Pro sur facture',
  other: 'Attribué à la main',
}

/** Statuts d'un abonnement qui donnent accès (et donc comptent dans le MRR). */
const LIVE = new Set(['active', 'trialing', 'past_due'])
/** Statuts d'un abonnement terminé. */
const ENDED = new Set(['canceled', 'expired', 'unpaid', 'incomplete_expired'])

export type ProfileRevenueRow = { id: string; plan: string | null; plan_source: string | null }
export type SubscriptionRow = {
  user_id: string
  source: string
  tier: string
  period: string | null
  status: string
  cancel_at_period_end: boolean | null
  current_period_end: string | null
  updated_at: string
}
export type SiteCreditRow = { paid_at: string; amount_total: number; amount_refunded: number | null; credits: number }
export type AppCreditRow = { created_at: string; delta: number }

export type ChannelLine = {
  channel: Channel
  label: string
  premium: number
  pro: number
  /** Centimes HT par mois (null : pas de montant connu, Pro sur facture). */
  mrrHt: number | null
  /** Montant estimé (stores) plutôt que lu tel quel. */
  estimated: boolean
}

export type CreditSales = { count: number; credits: number; ttc: number; estimated: boolean }

export type RevenueReport = {
  channels: ChannelLine[]
  subscribers: { premium: number; pro: number; total: number }
  /** MRR HT connu (site + stores), en centimes. */
  mrrHt: number
  /** Part estimée du MRR (stores). */
  mrrHtEstimated: number
  churn: {
    /** Résiliation demandée, accès gardé jusqu'à la fin de la période. */
    scheduled: number
    /** Abonnements terminés sur les 30 derniers jours. */
    ended30d: number
  }
  credits: { month: string; site: CreditSales; app: CreditSales }
}

const SOURCE_CHANNEL: Record<string, Channel> = { stripe: 'site', apple: 'ios', google: 'android' }

/** Prix HT mensuel de la grille (annuel ramené au mois), en centimes. */
export function monthlyHtCents(tier: string, period: string | null): number {
  const grid = tier === 'pro' ? OFFERS_V4.pro : OFFERS_V4.premium
  return period === 'yearly' ? Math.round((grid.yearlyHt * 100) / 12) : Math.round(grid.monthlyHt * 100)
}

/** Prix TTC (centimes) d'un pack d'après son nombre de crédits ; 0 si inconnu. */
function packTtcCents(credits: number): number {
  const p = OFFERS_V4.packs.find(x => x.credits === credits)
  return p ? Math.round(p.priceTtc * 100) : 0
}

export function revenueReport(args: {
  profiles: ProfileRevenueRow[]
  subscriptions: SubscriptionRow[]
  siteCredits: SiteCreditRow[]
  appCredits: AppCreditRow[]
  now?: Date
}): RevenueReport {
  const now = args.now ?? new Date()
  const lines = new Map<Channel, ChannelLine>()
  const line = (c: Channel) => {
    let l = lines.get(c)
    if (!l) {
      l = { channel: c, label: CHANNEL_LABELS[c], premium: 0, pro: 0, mrrHt: c === 'invoice' ? null : 0, estimated: c !== 'site' && c !== 'invoice' && c !== 'other' }
      lines.set(c, l)
    }
    return l
  }
  const add = (c: Channel, tier: string, mrr: number | null) => {
    const l = line(c)
    if (tier === 'pro') l.pro += 1
    else l.premium += 1
    if (l.mrrHt !== null && mrr !== null) l.mrrHt += mrr
  }

  // Un abonnement vivant par compte : le plus récent (un compte qui passe
  // de Premium à Pro sur le site garde une seule ligne vivante, mais on se
  // protège d'un doublon entre sources).
  const liveByUser = new Map<string, SubscriptionRow>()
  for (const s of args.subscriptions) {
    if (!LIVE.has(s.status)) continue
    const prev = liveByUser.get(s.user_id)
    if (!prev || s.updated_at > prev.updated_at) liveByUser.set(s.user_id, s)
  }

  const counted = new Set<string>()
  for (const [userId, s] of liveByUser) {
    const channel = SOURCE_CHANNEL[s.source]
    if (!channel) continue
    add(channel, s.tier, monthlyHtCents(s.tier, s.period))
    counted.add(userId)
  }

  // Paliers payants sans abonnement vivant au journal : abonnés des stores
  // d'avant le journal, Pro sur facture, attributions à la main.
  for (const p of args.profiles) {
    if (counted.has(p.id) || (p.plan !== 'premium' && p.plan !== 'pro')) continue
    if (p.plan_source === 'app') add('store', p.plan, monthlyHtCents(p.plan, 'monthly'))
    else if (p.plan_source === 'web') add('site', p.plan, monthlyHtCents(p.plan, 'monthly'))
    else if (p.plan === 'pro') add('invoice', 'pro', null)
    else add('other', 'premium', 0)
  }

  const order: Channel[] = ['site', 'ios', 'android', 'store', 'invoice', 'other']
  const channels = order.map(c => lines.get(c)).filter((l): l is ChannelLine => !!l)
  const premium = channels.reduce((n, l) => n + l.premium, 0)
  const pro = channels.reduce((n, l) => n + l.pro, 0)
  const mrrHt = channels.reduce((n, l) => n + (l.mrrHt ?? 0), 0)
  const mrrHtEstimated = channels.filter(l => l.estimated).reduce((n, l) => n + (l.mrrHt ?? 0), 0)

  const since30d = new Date(now.getTime() - 30 * 86400_000).toISOString()
  const scheduled = [...liveByUser.values()].filter(s => s.cancel_at_period_end).length
  const ended30d = args.subscriptions.filter(s => ENDED.has(s.status) && s.updated_at >= since30d).length

  const month = now.toISOString().slice(0, 7)
  const site: CreditSales = { count: 0, credits: 0, ttc: 0, estimated: false }
  for (const c of args.siteCredits) {
    if (!c.paid_at.startsWith(month)) continue
    site.count += 1
    site.credits += c.credits
    site.ttc += c.amount_total - (c.amount_refunded ?? 0)
  }
  const app: CreditSales = { count: 0, credits: 0, ttc: 0, estimated: true }
  for (const c of args.appCredits) {
    if (!c.created_at.startsWith(month) || c.delta <= 0) continue
    app.count += 1
    app.credits += c.delta
    app.ttc += packTtcCents(c.delta)
  }

  return {
    channels,
    subscribers: { premium, pro, total: premium + pro },
    mrrHt,
    mrrHtEstimated,
    churn: { scheduled, ended30d },
    credits: { month, site, app },
  }
}
