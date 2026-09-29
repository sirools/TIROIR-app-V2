// Fiche de vente (prototype V4, cf. v4/docs/vente.md) : à partir d'un objet
// partagé, ce qu'un acheteur doit voir — le produit, à qui il appartient, son
// histoire, son état, et un prix indicatif « à débattre ».
//
// Jamais le prix d'achat : il révèle la marge du vendeur. Module sans
// dépendance, testable.

export type SaleInput = {
  title: string
  description: string | null
  status: string | null
  attributes: Record<string, string> | null
  created_at: string
  purchase_date: string | null
  sale_price: number | null
  sale_price_lot: number | null
  quantity: number | null
  user_value: number | null
  market_value: number | null
  value_currency: string | null
  value_sources: { value_min?: number; value_max?: number } | null
}

export type SaleSheet = {
  /** Prix indicatif, ou null s'il n'y en a aucun : « prix à discuter ». */
  askingPrice: number | null
  priceOrigin: 'vendeur' | 'estimation' | null
  currency: string
  /** Fourchette d'estimation, si l'IA en a donné une. */
  range: { min: number; max: number } | null
  /** Offre suggérée par défaut : 10 % sous le prix, arrondie. */
  suggestedOffer: number | null
  story: string[]
  condition: { label: string; value: string }[]
  details: { label: string; value: string }[]
  sold: boolean
}

const CONDITION_KEY = /^(etat|état|condition|usure|usage|utilisation)/i

function monthYear(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

function currencyOf(raw: string | null | undefined): string {
  const c = raw ?? 'EUR'
  if (c === '€') return 'EUR'
  if (c === '$') return 'USD'
  if (c === '£') return 'GBP'
  return c.length === 3 ? c : 'EUR'
}

const positive = (n: unknown): number | null => {
  const v = typeof n === 'string' ? Number(n) : (n as number | null)
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null
}

export function buildSaleSheet(o: SaleInput, ownerFirstName: string): SaleSheet {
  const qty = o.quantity && o.quantity > 1 ? o.quantity : 1
  const lot = positive(o.sale_price_lot)
  const unit = positive(o.sale_price)
  const seller = lot ?? (unit ? unit * qty : null)
  const estimate = positive(o.user_value) ?? positive(o.market_value)
  const askingPrice = seller ?? estimate
  const priceOrigin = seller ? 'vendeur' : estimate ? 'estimation' : null

  const min = positive(o.value_sources?.value_min)
  const max = positive(o.value_sources?.value_max)
  const range = min && max && max >= min ? { min, max } : null

  const story: string[] = []
  const since = monthYear(o.created_at)
  if (since) story.push(`Dans le Tiroir de ${ownerFirstName} depuis ${since}.`)
  const bought = monthYear(o.purchase_date)
  if (bought) story.push(`Acheté en ${bought}.`)
  if (qty > 1) story.push(`Vendu en lot de ${qty}.`)

  const condition: SaleSheet['condition'] = []
  const details: SaleSheet['details'] = []
  for (const [k, v] of Object.entries(o.attributes ?? {})) {
    if (typeof v !== 'string' || !v.trim()) continue
    const label = k.charAt(0).toUpperCase() + k.slice(1)
    ;(CONDITION_KEY.test(k) ? condition : details).push({ label, value: v.trim() })
  }

  return {
    askingPrice,
    priceOrigin,
    currency: currencyOf(o.value_currency),
    range,
    suggestedOffer: askingPrice ? Math.max(1, Math.round((askingPrice * 0.9) / 5) * 5) : null,
    story,
    condition,
    details,
    sold: o.status === 'sold',
  }
}

/** Offre saisie par l'acheteur : un montant positif, raisonnable. */
export function parseOffer(raw: string): number | null {
  const v = Number(raw.replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(v) && v > 0 && v < 10_000_000 ? Math.round(v * 100) / 100 : null
}
