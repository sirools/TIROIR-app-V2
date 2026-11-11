// « Préparer une annonce » : à partir d'un objet, le texte d'une annonce de
// vente à copier dans Leboncoin — titre, description structurée, prix,
// catégorie suggérée. Tiroir ne publie rien et n'appelle aucune API de
// Leboncoin : le propriétaire copie, puis publie lui-même.
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
}

/** Champs d'une annonce complète, dans l'ordre où la description les donne. */
export const CORE_FIELDS = ['condition', 'brand', 'model', 'dimensions', 'accessories'] as const
export type CoreField = (typeof CORE_FIELDS)[number]

const EXTRA_FIELDS = ['size', 'color', 'material', 'weight', 'year', 'voltage']

/** Jamais dans une annonce publique : un numéro de série sert aux fraudes. */
const PRIVATE_KEY = /serie|serial|imei/

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
  currency: string
  category: string | null
  /** Ce qu'il manque pour une annonce complète. */
  missing: (CoreField | 'description' | 'price')[]
}

const labelOf = (labels: ListingLabels, key: string) =>
  labels.attrs[key] ?? key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')

export function buildListing(o: ListingInput, labels: ListingLabels): Listing {
  const attrs = attributesOf(o.attributes)
  const qty = isLot(o.quantity) ? (o.quantity as number) : 1

  // Marque et modèle rejoignent le titre s'il ne les dit pas déjà.
  const titleParts = [o.title.trim()]
  for (const key of ['brand', 'model']) {
    const v = attrs.get(key)
    if (v && !plain(titleParts.join(' ')).includes(plain(v))) titleParts.push(v)
  }

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
  const price = seller ?? estimate

  const missing: Listing['missing'] = []
  if (!body) missing.push('description')
  for (const key of CORE_FIELDS) if (!attrs.has(key)) missing.push(key)
  if (price === null) missing.push('price')

  return {
    title: titleParts.join(' '),
    description,
    price: price === null ? null : Math.round(price),
    priceOrigin: seller ? 'seller' : estimate ? 'estimate' : null,
    currency: currencyOf(o.value_currency),
    category: suggestCategory(attrs.get('category'), o.title, o.description),
    missing,
  }
}

export type ListingDraft = { title: string; price: string; category: string; description: string }

/** « Tout copier » : l'annonce entière, champ par champ, sans ligne vide. */
export function listingText(
  d: ListingDraft,
  f: { title: string; price: string; category: string; description: string },
  currency: string,
): string {
  const price = d.price.trim() ? `${d.price.trim()} ${currency === 'EUR' ? '€' : currency}` : ''
  return [
    d.title.trim() && `${f.title} : ${d.title.trim()}`,
    price && `${f.price} : ${price}`,
    d.category.trim() && `${f.category} : ${d.category.trim()}`,
    d.description.trim() && `${f.description} :\n${d.description.trim()}`,
  ].filter(Boolean).join('\n')
}

/** Nom de dossier ou de fichier sûr, tiré d'un titre. */
export function slug(title: string, fallback = 'objet'): string {
  return plain(title).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || fallback
}
