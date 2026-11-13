// Le tableau de bord de /accueil : des chiffres personnels, jamais ceux du
// service. Les cartes ne sont pas codées dans la page : chacune est décrite
// ici (STAT_CARDS), et `cardsFor` choisit lesquelles montrer selon l'offre
// et, plus tard, le profil choisi à l'inscription. Logique pure, testée
// dans web/__tests__/dashboard.test.ts.
import { lotTotal } from './quantity'
import { normCurrency } from './inventory'
import { familyOf, type PersonaFamily } from './personas'

export type StatRow = {
  status: string | null
  quantity: number | null
  user_value: number | null
  market_value: number | null
  value_currency: string | null
  sold_price: number | null
}

export type Stats = {
  /** Fiches au compte, toutes confondues. */
  objects: number
  /** Valeur de ce qu'on possède encore : la sienne, sinon l'estimation, fois la quantité. */
  value: number
  currency: string
  shares: number
  loaned: number
  forSale: number
  sold: number
  /** Somme des prix obtenus connus. */
  salesTotal: number
}

/** Statuts d'un objet sorti du Tiroir : il ne compte plus dans la valeur. */
const GONE = ['sold', 'given', 'lost']

export function computeStats(rows: StatRow[], shares: number): Stats {
  // Plusieurs devises ne s'additionnent pas : on garde celle qui porte le plus de fiches.
  const byCurrency = new Map<string, { n: number; total: number }>()
  let loaned = 0, forSale = 0, sold = 0, salesTotal = 0
  for (const o of rows) {
    if (o.status === 'loaned') loaned++
    if (o.status === 'for_sale') forSale++
    if (o.status === 'sold') {
      sold++
      salesTotal += Number(o.sold_price ?? 0)
    }
    if (GONE.includes(o.status ?? '')) continue
    const value = lotTotal(o.user_value ?? o.market_value, o.quantity)
    if (value === null) continue
    const c = normCurrency(o.value_currency)
    const cur = byCurrency.get(c) ?? { n: 0, total: 0 }
    byCurrency.set(c, { n: cur.n + 1, total: cur.total + Number(value) })
  }
  const main = Array.from(byCurrency.entries()).sort((a, b) => b[1].n - a[1].n)[0]
  return {
    objects: rows.length,
    value: Math.round(main?.[1].total ?? 0),
    currency: main?.[0] ?? 'EUR',
    shares, loaned, forSale, sold,
    salesTotal: Math.round(salesTotal),
  }
}

/** Les cartes possibles. `money` : la valeur s'affiche comme un montant. */
export const STAT_CARDS = {
  objects: { money: false },
  value: { money: true },
  shares: { money: false },
  loaned: { money: false },
  forSale: { money: false },
  sold: { money: false },
  salesTotal: { money: true },
} as const
export type StatCard = keyof typeof STAT_CARDS

export type Plan = 'free' | 'premium' | 'pro'

/** Palier effectif : un Pro échu redevient gratuit (comme effective_plan() en base). */
export function effectivePlan(plan?: string | null, proExpiresAt?: string | null, today = new Date().toISOString().slice(0, 10)): Plan {
  if (plan === 'pro') return proExpiresAt && proExpiresAt < today ? 'free' : 'pro'
  return plan === 'premium' ? 'premium' : 'free'
}

/** Cartes du profil de base, pour toutes les offres. */
const BASE: StatCard[] = ['objects', 'value', 'shares']

/** Cartes par famille de profils (lib/personas.ts) ; une famille absente garde la base. */
const FAMILY_CARDS: Partial<Record<PersonaFamily, StatCard[]>> = {
  // Création : ce que vaut le matériel, ce qui est sorti (prêté), ce qui est partagé avec d'autres pros.
  creation: ['value', 'loaned', 'shares', 'objects'],
  // Métiers du matériel : le parc d'abord, puis ce qui est sorti.
  trades: ['objects', 'value', 'loaned', 'shares'],
  // Commerce : ce qui est en vente, ce qui est vendu, ce que ça a rapporté.
  commerce: ['forSale', 'sold', 'salesTotal', 'value'],
}

/** Cartes propres à un profil précis, quand elles diffèrent de celles de sa famille. */
export const PROFILE_CARDS: Record<string, StatCard[]> = {}

/** Trois à quatre cartes : celles du profil ou de sa famille, sinon la base, enrichie avec l'offre. */
export function cardsFor(opts: { plan: Plan; profile?: string | null }): StatCard[] {
  const family = familyOf(opts.profile)
  const own = (opts.profile ? PROFILE_CARDS[opts.profile] : undefined) ?? (family ? FAMILY_CARDS[family] : undefined)
  if (own?.length) return own.slice(0, 4)
  if (opts.plan === 'pro') return [...BASE, 'forSale']
  if (opts.plan === 'premium') return [...BASE, 'loaned']
  return BASE
}
