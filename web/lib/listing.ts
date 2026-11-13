// « Préparer une annonce » : à partir d'un objet, le texte d'une annonce de
// vente à copier dans Leboncoin — titre (50 caractères, marque et modèle
// d'abord), description structurée, prix et fourchette, catégorie suggérée.
// Une série se prépare en une annonce par objet ou en une seule pour le lot.
// Tiroir ne publie rien et n'appelle aucune API de Leboncoin : le
// propriétaire copie, publie lui-même, puis déclare l'objet « en vente »
// (saleUpdate, supabase/migrations/20261113063854_object_for_sale.sql).
//
// Réservé aux paliers Pro et Business. Module sans dépendance ni modèle
// d'IA, testable (web/__tests__/listing.test.ts).
import { isLot } from './quantity'

/**
 * Le drapeau de la fonction : Pro (non échu, comme effective_plan() côté
 * base) ou Business. `LISTING_EXPORT=off` côté serveur la coupe pour tous.
 */
export function canPrepareListing(
  plan?: string | null,
  proExpiresAt?: string | null,
  flag: string | undefined = process.env.LISTING_EXPORT,
): boolean {
  if (flag === 'off') return false
  if (plan === 'business') return true
  if (plan !== 'pro') return false
  return !(proExpiresAt && proExpiresAt < new Date().toISOString().slice(0, 10))
}

/** Nombre d'annonces préparées d'un coup, au plus. */
export const MAX_LISTINGS = 50

/** `?ids=a,b,c` → identifiants uniques, bornés. */
export function parseIds(raw: string | string[] | undefined): string[] {
  const text = Array.isArray(raw) ? raw.join(',') : raw ?? ''
  return Array.from(new Set(text.split(',').map(s => s.trim()).filter(Boolean))).slice(0, MAX_LISTINGS)
}

export type ListingInput = {
  title: string
  description: string | null
  attributes: Record<string, unknown> | null
  quantity: number | null
  sale_price: number | null
  sale_price_lot: number | null
  user_value: number | null
  market_value: number | null
  value_currency: string | null
  /** Sortie d'estimate-value : on n'en lit que value_min et value_max. */
  value_sources?: Record<string, unknown> | null
}

/** Champs d'une annonce complète, dans l'ordre où la description les donne. */
export const CORE_FIELDS = ['condition', 'brand', 'model', 'dimensions', 'accessories'] as const
export type CoreField = (typeof CORE_FIELDS)[number]

const EXTRA_FIELDS = ['size', 'color', 'material', 'weight', 'year', 'voltage']

/**
 * Jamais dans une annonce publique : un numéro de série sert aux fraudes ;
 * notes, emplacement, prêt et prix d'achat sont privés.
 */
const PRIVATE_KEY = /serie|serial|imei|note|emplacement|location|adresse|address|loan|pret|achat|purchase|price|prix|valeur|value/

const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** Les fiches anciennes portent des clés en français : on les ramène aux clés connues. */
const ALIASES: Record<string, string> = {
  etat: 'condition', marque: 'brand', modele: 'model', dimension: 'dimensions', taille: 'size',
  accessoires: 'accessories', accessoire: 'accessories', accessory: 'accessories',
  couleur: 'color', matiere: 'material', materiau: 'material', poids: 'weight', annee: 'year',
  categorie: 'category',
}

function attributesOf(raw: Record<string, unknown> | null): Map<string, string> {
  const out = new Map<string, string>()
  for (const [k, v] of Object.entries(raw ?? {})) {
    if (typeof v !== 'string' && typeof v !== 'number') continue
    const value = String(v).trim()
    if (!value) continue
    const key = plain(k).replace(/\s+/g, '_')
    if (PRIVATE_KEY.test(key)) continue
    const canonical = ALIASES[key] ?? key
    if (!out.has(canonical)) out.set(canonical, value)
  }
  return out
}

const positive = (n: unknown): number | null => {
  const v = typeof n === 'string' ? Number(n) : (n as number | null)
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null
}

function currencyOf(raw: string | null | undefined): string {
  const c = raw ?? 'EUR'
  if (c === '€') return 'EUR'
  if (c === '$') return 'USD'
  if (c === '£') return 'GBP'
  return c.length === 3 ? c : 'EUR'
}

/**
 * Rubriques de Leboncoin (leurs noms, en français sur le site), de la plus
 * précise à la plus large : la première qui reconnaît un mot l'emporte.
 */
const CATEGORIES: [string, RegExp][] = ([
  ['Téléphones & Objets connectés', 'iphone|smartphone|telephone|montre connectee|apple watch|airpod'],
  ['Ordinateurs', 'ordinateur|macbook|imac|laptop|pc portable|ecran pc|clavier|imprimante'],
  ['Tablettes & Liseuses', 'ipad|tablette|liseuse|kindle'],
  ['Consoles', 'console|playstation|ps[345]|xbox|nintendo|switch|game ?boy'],
  ['Photo, audio & vidéo', 'appareil photo|objectif|camera|enceinte|casque audio|ampli|platine|televiseur|television|tv|videoprojecteur|hi-?fi'],
  ['Instruments de musique', 'guitare|piano|synthe|synthetiseur|violon|basse electrique|ukulele|saxophone|trompette|accordeon'],
  ['Vélos', 'velo|vtt|bicyclette|trottinette'],
  ['Montres & Bijoux', 'montre|bague|collier|bracelet|bijou|boucles d\'oreilles'],
  ['Livres', 'livre|roman|bd|bande dessinee|manga|encyclopedie'],
  ['CD - Musique', 'vinyle|33 tours|45 tours|cd'],
  ['Jeux & Jouets', 'jouet|lego|playmobil|peluche|puzzle|jeu de societe|poupee|figurine'],
  ['Équipement bébé', 'poussette|siege auto|lit bebe|chaise haute|transat'],
  ['Électroménager', 'lave-?linge|lave-?vaisselle|refrigerateur|frigo|four|micro-?ondes|aspirateur|cafetiere|bouilloire|grille-?pain|congelateur|seche-?linge'],
  ['Ameublement', 'fauteuil|chaise|table|canape|armoire|commode|buffet|bureau|lit|etagere|meuble|tabouret|banc|bibliotheque|chevet'],
  ['Arts de la table', 'assiette|verre|carafe|couvert|vaisselle|theiere|tasse|service a'],
  ['Décoration', 'lampe|miroir|vase|tableau|cadre|tapis|affiche|bougeoir|horloge|pendule|lustre|sculpture|statue'],
  ['Chaussures', 'chaussure|basket|botte|bottine|sandale|escarpin'],
  ['Accessoires & Bagagerie', 'sac|valise|ceinture|echarpe|foulard|chapeau|lunettes|portefeuille'],
  ['Vêtements', 'veste|manteau|robe|pantalon|jean|chemise|pull|t-?shirt|jupe|blouson|costume|vetement'],
  ['Bricolage', 'perceuse|visseuse|scie|ponceuse|outil|etabli|echelle|marteau'],
  ['Jardin & Plantes', 'tondeuse|salon de jardin|barbecue|parasol|jardiniere|taille-?haie'],
  ['Sport & Plein air', 'ski|raquette|tente|haltere|tapis de course|surf|kayak|ballon|golf'],
  ['Collection', 'timbre|piece de monnaie|carte postale|miniature|collection'],
] as [string, string][]).map(([name, words]) => [name, new RegExp(`\\b(?:${words})[sx]?\\b`)])

/** Rubrique Leboncoin la plus probable, ou null : jamais de rubrique inventée. */
export function suggestCategory(...texts: (string | null | undefined)[]): string | null {
  const hay = plain(texts.filter(Boolean).join(' '))
  if (!hay) return null
  return CATEGORIES.find(([, re]) => re.test(hay))?.[0] ?? null
}

export type ListingLabels = {
  /** Libellé d'un attribut connu (`condition` → « État ») ; à défaut la clé brute. */
  attrs: Record<string, string>
  quantity: string
  /** « lot de {n} » */
  lot: string
}

export type Listing = {
  title: string
  description: string
  /** Prix demandé pour l'annonce entière (le lot s'il y en a un), ou null. */
  price: number | null
  priceOrigin: 'seller' | 'estimate' | null
  /** Fourchette de l'estimation, pour l'annonce entière, ou null. */
  range: { min: number; max: number } | null
  currency: string
  category: string | null
  /** Ce qu'il manque pour une annonce complète. */
  missing: (CoreField | 'description' | 'price')[]
}

const labelOf = (labels: ListingLabels, key: string) =>
  labels.attrs[key] ?? key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')

/** Longueur d'un titre d'annonce sur Leboncoin. */
export const TITLE_MAX = 50

/** Coupe au dernier mot entier qui tient, sans ponctuation pendante. */
export function clip(text: string, max = TITLE_MAX): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max + 1)
  const space = cut.lastIndexOf(' ')
  return (space > max * 0.5 ? cut.slice(0, space) : t.slice(0, max)).replace(/[\s,;:·–—-]+$/, '')
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/**
 * Marque et modèle d'abord, puis le reste du nom, en 50 caractères. Une
 * marque que le nom porte déjà n'est pas répétée.
 */
export function listingTitle(title: string, brand?: string | null, model?: string | null): string {
  let rest = title.replace(/\s+/g, ' ').trim()
  const lead: string[] = []
  for (const v of [brand, model]) {
    const value = v?.trim()
    if (!value) continue
    if (plain([...lead, rest].join(' ')).includes(plain(value))) {
      // Déjà dans le nom : on la remonte en tête si on sait l'en retirer proprement.
      const re = new RegExp(`(^|\\s)${escapeRe(value)}(?=\\s|$)`, 'i')
      if (!re.test(rest)) continue
      rest = rest.replace(re, ' ').replace(/\s+/g, ' ').trim()
    }
    lead.push(value)
  }
  return clip([...lead, rest].filter(Boolean).join(' '))
}

/** Une estimation n'est pas au centime : au 5 près, au 10 près au-delà de 200. */
export function roundEstimate(n: number): number {
  if (n < 20) return Math.max(1, Math.round(n))
  const step = n < 200 ? 5 : 10
  return Math.round(n / step) * step
}

export function buildListing(o: ListingInput, labels: ListingLabels): Listing {
  const attrs = attributesOf(o.attributes)
  const qty = isLot(o.quantity) ? (o.quantity as number) : 1

  const lines: string[] = []
  const used = new Set<string>(['category'])
  for (const key of [...CORE_FIELDS, ...EXTRA_FIELDS]) {
    used.add(key)
    const v = attrs.get(key)
    if (v) lines.push(`${labelOf(labels, key)} : ${v}`)
  }
  for (const [key, v] of attrs) if (!used.has(key)) lines.push(`${labelOf(labels, key)} : ${v}`)
  if (qty > 1) lines.push(`${labels.quantity} : ${labels.lot.replace('{n}', String(qty))}`)

  const body = (o.description ?? '').trim()
  const description = [body, lines.join('\n')].filter(Boolean).join('\n\n')

  // Montants unitaires en base (lib/quantity.ts) ; seul sale_price_lot vaut pour le lot.
  const unitSeller = positive(o.sale_price)
  const seller = positive(o.sale_price_lot) ?? (unitSeller ? unitSeller * qty : null)
  const unitEstimate = positive(o.user_value) ?? positive(o.market_value)
  const estimate = unitEstimate ? unitEstimate * qty : null

  const min = positive(o.value_sources?.value_min)
  const max = positive(o.value_sources?.value_max)
  const range = min && max && max >= min
    ? { min: roundEstimate(min * qty), max: roundEstimate(max * qty) }
    : null

  const missing: Listing['missing'] = []
  if (!body) missing.push('description')
  for (const key of CORE_FIELDS) if (!attrs.has(key)) missing.push(key)
  if (seller === null && estimate === null) missing.push('price')

  return {
    title: listingTitle(o.title, attrs.get('brand'), attrs.get('model')),
    description,
    price: seller !== null ? Math.round(seller) : estimate !== null ? roundEstimate(estimate) : null,
    priceOrigin: seller ? 'seller' : estimate ? 'estimate' : null,
    range,
    currency: currencyOf(o.value_currency),
    category: suggestCategory(attrs.get('category'), o.title, o.description),
    missing,
  }
}

/**
 * Une seule annonce pour plusieurs objets. Le prix est la somme des prix,
 * s'ils sont tous connus : un lot à moitié chiffré n'a pas de prix.
 */
export function buildLotListing(parts: Listing[], lotTitle: string): Listing {
  const titles = parts.map(p => p.title)
  const sum = (values: (number | null)[]) =>
    values.every((v): v is number => v !== null) && values.length > 0 ? values.reduce((a, b) => a + b, 0) : null
  const price = sum(parts.map(p => p.price))
  const min = sum(parts.map(p => p.range?.min ?? null))
  const max = sum(parts.map(p => p.range?.max ?? null))
  const categories = parts.map(p => p.category).filter((c): c is string => c !== null)
  const category = categories
    .sort((a, b) => categories.filter(c => c === b).length - categories.filter(c => c === a).length)[0] ?? null
  return {
    title: clip(lotTitle.replace('{n}', String(parts.length)).replace('{titles}', titles.join(', '))),
    description: parts.map(p => [`— ${p.title}`, p.description].filter(Boolean).join('\n')).join('\n\n'),
    price,
    priceOrigin: price === null ? null : parts.some(p => p.priceOrigin === 'estimate') ? 'estimate' : 'seller',
    range: min !== null && max !== null ? { min, max } : null,
    currency: parts[0]?.currency ?? 'EUR',
    category,
    missing: price === null ? ['price'] : [],
  }
}

/**
 * Lignes pratiques en fin de description (remise en main propre, envoi,
 * lien vers la fiche). On retire celles qui y sont déjà avant d'ajouter les
 * nouvelles : les retouches du vendeur au-dessus sont gardées.
 * `known` : toutes les lignes possibles ; `prefixes` : celles qui portent
 * une adresse à leur suite.
 */
export function withPractical(description: string, lines: string[], known: string[], prefixes: string[] = []): string {
  const isPractical = (l: string) => known.includes(l.trim()) || prefixes.some(p => p && l.trim().startsWith(p))
  const kept = description.split('\n')
  while (kept.length && (kept[kept.length - 1].trim() === '' || isPractical(kept[kept.length - 1]))) kept.pop()
  return [kept.join('\n'), lines.join('\n')].filter(Boolean).join('\n\n')
}

export type ListingDraft = { title: string; price: string; category: string; description: string }

/**
 * « Copier l'annonce » : titre, prix, description, en texte brut. La
 * catégorie n'y est pas : sur Leboncoin elle se choisit dans une liste.
 */
export function listingText(
  d: ListingDraft,
  f: { title: string; price: string; description: string },
  currency: string,
): string {
  const price = d.price.trim() ? `${d.price.trim()} ${currency === 'EUR' ? '€' : currency}` : ''
  return [
    d.title.trim() && `${f.title} : ${d.title.trim()}`,
    price && `${f.price} : ${price}`,
    d.description.trim() && `${f.description} :\n${d.description.trim()}`,
  ].filter(Boolean).join('\n')
}

// ── Mise en vente déclarée ─────────────────────────────────────────

/** Plateformes connues. Leboncoin seul aujourd'hui ; Vinted, eBay plus tard. */
export const PLATFORMS = ['leboncoin'] as const
export type Platform = (typeof PLATFORMS)[number]

export type SaleAction = 'list' | 'sold' | 'unlist'

/** « 120 », « 120,50 », « 1 200 » → nombre, ou null. */
export function parsePrice(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) && raw >= 0 && raw < 1e9 ? Math.round(raw * 100) / 100 : null
  if (typeof raw !== 'string') return null
  const text = raw.replace(/[\s  €]/g, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null
  const n = Number(text)
  return n < 1e9 ? n : null
}

/**
 * Ce qu'une action écrit sur UNE fiche.
 * - `list` : en vente ; le prix demandé va dans sale_price_lot pour un lot
 *   (quantité > 1), sinon dans sale_price. Sans prix, ou pour une annonce
 *   qui réunit plusieurs fiches (`shared`), les prix ne sont pas touchés :
 *   le prix d'un lot ne se répartit pas entre ses objets.
 * - `sold` : vendu ; le prix obtenu vaut pour la fiche entière.
 * - `unlist` : retour à « possédé », le prix demandé reste.
 */
export function saleUpdate(
  action: SaleAction,
  o: { quantity: number | null },
  opts: { price: number | null; platform: Platform; shared: boolean; now: string },
): Record<string, string | number | null> {
  const price = opts.shared ? null : opts.price
  if (action === 'list') {
    return {
      status: 'for_sale', listing_platform: opts.platform, listed_at: opts.now, sold_price: null, sold_at: null,
      ...(price === null ? {} : isLot(o.quantity) ? { sale_price_lot: price } : { sale_price: price }),
    }
  }
  if (action === 'sold') return { status: 'sold', sold_at: opts.now, sold_price: price }
  return { status: 'owned', listing_platform: null, listed_at: null }
}

/** Nom de dossier ou de fichier sûr, tiré d'un titre. */
export function slug(title: string, fallback = 'objet'): string {
  return plain(title).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || fallback
}
