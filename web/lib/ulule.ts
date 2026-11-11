// Campagne Ulule : la logique sans dépendance (slugs, liens, lecture de
// l'export), testable hors de Next. Voir web/__tests__/ulule.test.ts.

export const PARIS = 'Europe/Paris'
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const SLUG_FORMAT = /^[a-z0-9][a-z0-9-]*$/

export function isEmail(value: string): boolean {
  return EMAIL.test(value)
}

export function slugify(text: string): string {
  return text
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

/** Slug libre le plus court : « marie-dupont », puis « marie-dupont-2 »… */
export function uniqueSlug(firstName: string, lastName: string, taken: Set<string>): string {
  const base = slugify(`${firstName} ${lastName}`) || 'ambassadeur'
  let slug = base
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`
  taken.add(slug)
  return slug
}

export type AmbassadorLine = { firstName: string; lastName: string; email: string | null }

/**
 * Une personne par ligne : « Prénom, Nom, e-mail » (virgule, point-virgule ou
 * tabulation). Sans adresse (« Prénom, Nom »), la personne a un lien perso
 * mais ne reçoit aucun e-mail : proche prévenu par SMS, Instagram…
 * Une adresse mal écrite rend la ligne illisible plutôt que d'en faire un nom.
 */
export function parseAmbassadorLines(text: string): { valid: AmbassadorLine[]; invalid: string[] } {
  const valid: AmbassadorLine[] = []
  const invalid: string[] = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line) continue
    const parts = line.split(/[,;\t]/).map(p => p.trim()).filter(Boolean)
    const last = (parts.at(-1) ?? '').toLowerCase()
    const hasEmail = last.includes('@')
    if (!parts[0] || (hasEmail && (parts.length < 2 || !isEmail(last))) || parts.slice(0, hasEmail ? -1 : undefined).some(p => p.includes('@'))) {
      invalid.push(line)
      continue
    }
    valid.push(hasEmail
      ? { firstName: parts[0], lastName: parts.slice(1, -1).join(' '), email: last }
      : { firstName: parts[0], lastName: parts.slice(1).join(' '), email: null })
  }
  return { valid, invalid }
}

/**
 * Ulule ne documente que utm_medium, utm_source et utm_campaign=presale_<n>,
 * et seuls Medium et Source remontent dans l'export : le slug va donc dans
 * utm_source (https://outils.ulule.com/articles/mesurer-resultats-communications-grace-liens-trackes).
 */
export function campaignUrl(pageUrl: string, presaleNumber: string, slug: string): string {
  const url = new URL(pageUrl)
  url.searchParams.set('utm_medium', 'ambassadeur')
  url.searchParams.set('utm_source', slug)
  url.searchParams.set('utm_campaign', `presale_${presaleNumber}`)
  return url.toString()
}

/** Du referrer, seulement le site d'origine : le chemin peut identifier quelqu'un. */
export function referrerOrigin(referrer: string | undefined): string | null {
  if (!referrer) return null
  try {
    return new URL(referrer).origin
  } catch {
    return null
  }
}

export function formatLaunchDate(iso: string, locale = 'fr-FR'): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', timeZone: PARIS }).format(new Date(iso))
}

/** « 2027-01-12T08:00 », pour un champ datetime-local affiché à l'heure de Paris. */
export function toParisInput(iso: string): string {
  return new Date(iso).toLocaleString('sv-SE', { timeZone: PARIS }).replace(' ', 'T').slice(0, 16)
}

/** Heure murale de Paris vers un instant, heure d'été comprise. */
export function fromParisParts(y: number, mo: number, d: number, h = 0, mi = 0, s = 0): string {
  const asUtc = Date.UTC(y, mo - 1, d, h, mi, s)
  const seen = new Date(asUtc).toLocaleString('sv-SE', { timeZone: PARIS }).replace(' ', 'T')
  const offset = Date.parse(`${seen}Z`) - asUtc
  return new Date(asUtc - offset).toISOString()
}

export function parisInputToIso(value: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value)
  return m ? fromParisParts(+m[1], +m[2], +m[3], +m[4], +m[5]) : null
}

// ── Lecture de l'export ───────────────────────────────────────────

export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, '')
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? ''
  const separator = [';', ',', '\t']
    .map(s => ({ s, n: firstLine.split(s).length }))
    .sort((a, b) => b.n - a.n)[0].s

  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') { cell += '"'; i++ }
      else if (c === '"') quoted = false
      else cell += c
    } else if (c === '"') quoted = true
    else if (c === separator) { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && clean[i + 1] === '\n') i++
      row.push(cell); cell = ''
      if (row.some(v => v.trim())) rows.push(row)
      row = []
    } else cell += c
  }
  row.push(cell)
  if (row.some(v => v.trim())) rows.push(row)
  return rows
}

/** Montant en euros (« 25 », « 25,50 € », « 1 200.00 ») vers des centimes. */
export function parseAmountCents(raw: string): number | null {
  const compact = raw.replace(/[€\s  ]/g, '').replace(/EUR$/i, '').replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(compact)) return null
  return Math.round(Number(compact) * 100)
}

/** Date ISO, ou « JJ/MM/AAAA[ HH:mm[:ss]] » lue à l'heure de Paris. */
export function parseOrderDate(raw: string): string | null {
  const value = raw.trim()
  if (!value) return null
  const fr = /^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(value)
  if (fr) return fromParisParts(+fr[3], +fr[2], +fr[1], +(fr[4] ?? 0), +(fr[5] ?? 0), +(fr[6] ?? 0))
  const time = Date.parse(value)
  return Number.isNaN(time) ? null : new Date(time).toISOString()
}

const normalizeHeader = (h: string) =>
  h.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

// L'intitulé exact des colonnes du fichier n'est pas documenté : noms de
// l'API d'abord, puis libellés probables. Un manque est signalé, jamais deviné.
const COLUMNS = {
  orderId: ['order id', 'donation id', 'id commande', 'numero de commande', 'n commande', 'commande', 'id du don', 'numero du don', 'id'],
  email: ['user email', 'email', 'e mail', 'adresse email', 'adresse e mail', 'mail'],
  fullName: ['user full name', 'full name', 'nom complet', 'nom et prenom', 'contributeur'],
  firstName: ['user first name', 'first name', 'prenom'],
  lastName: ['user last name', 'last name', 'nom'],
  amount: ['order total', 'donation amount', 'total', 'montant total', 'montant du don', 'montant', 'amount'],
  status: ['order status', 'status', 'statut de la commande', 'statut', 'etat'],
  date: ['order created at', 'created at', 'date de la commande', 'date de commande', 'date de contribution', 'date du don', 'date'],
  utmSource: ['order tracking source', 'utm source'],
  utmMedium: ['order tracking medium', 'utm medium'],
} as const

const REQUIRED = ['orderId', 'email', 'amount', 'status'] as const

export type ExportOrder = {
  orderId: string
  name: string
  email: string | null
  amountCents: number
  status: string
  contributedAt: string | null
  utmSource: string | null
  utmMedium: string | null
}

export type ExportParse =
  | { ok: false; error: string; columns: string[] }
  | { ok: true; orders: ExportOrder[]; rejected: { line: number; reason: string }[]; columns: string[] }

export function parseExport(text: string): ExportParse {
  const [header, ...rows] = parseCsv(text)
  if (!header) return { ok: false, error: 'Fichier vide.', columns: [] }
  const names = header.map(normalizeHeader)
  const index = Object.fromEntries(
    Object.entries(COLUMNS).map(([key, options]) => {
      for (const option of options) {
        const i = names.indexOf(option)
        if (i >= 0) return [key, i]
      }
      return [key, -1]
    }),
  ) as Record<keyof typeof COLUMNS, number>

  const missing = REQUIRED.filter(k => index[k] < 0)
  if (missing.length) {
    return { ok: false, error: `Colonnes introuvables : ${missing.join(', ')}.`, columns: header }
  }

  const cell = (row: string[], key: keyof typeof COLUMNS) =>
    index[key] >= 0 ? (row[index[key]] ?? '').trim() : ''

  const orders: ExportOrder[] = []
  const rejected: { line: number; reason: string }[] = []
  rows.forEach((row, i) => {
    const line = i + 2
    const orderId = cell(row, 'orderId')
    const amountCents = parseAmountCents(cell(row, 'amount'))
    const status = cell(row, 'status')
    if (!orderId) return void rejected.push({ line, reason: 'commande sans identifiant' })
    if (amountCents === null) return void rejected.push({ line, reason: `montant illisible (${cell(row, 'amount')})` })
    if (!status) return void rejected.push({ line, reason: 'statut vide' })
    const email = cell(row, 'email').toLowerCase()
    orders.push({
      orderId,
      name: cell(row, 'fullName') || `${cell(row, 'firstName')} ${cell(row, 'lastName')}`.trim(),
      email: isEmail(email) ? email : null,
      amountCents,
      status,
      contributedAt: parseOrderDate(cell(row, 'date')),
      utmSource: cell(row, 'utmSource').toLowerCase() || null,
      utmMedium: cell(row, 'utmMedium').toLowerCase() || null,
    })
  })
  return { ok: true, orders, rejected, columns: header }
}

export function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? ''
}

// ── Jauge et paliers ──────────────────────────────────────────────

export const DEFAULT_MILESTONES_CENTS = [100_000, 200_000, 500_000]

export type Progress = {
  amountCents: number
  /** Premier palier pas encore atteint ; null quand tous le sont. */
  nextCents: number | null
  /** Part du palier visé (ou du dernier), entre 0 et 1. */
  ratio: number
  reached: number
}

export function progressOf(amountCents: number, milestonesCents: number[]): Progress {
  const steps = [...milestonesCents].filter(n => n > 0).sort((a, b) => a - b)
  const nextCents = steps.find(m => m > amountCents) ?? null
  const target = nextCents ?? steps.at(-1) ?? 0
  return {
    amountCents,
    nextCents,
    ratio: target ? Math.min(1, amountCents / target) : 0,
    reached: steps.filter(m => m <= amountCents).length,
  }
}

/** « 1 000 € », sans centimes quand ils sont nuls. */
export function formatEuros(cents: number, locale = 'fr-FR'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency', currency: 'EUR', maximumFractionDigits: cents % 100 ? 2 : 0,
  }).format(cents / 100).replace(/\u202f/g, '\u00a0')
}

/** « 1000, 2 000 ; 5000 » (euros) vers des centimes, en ordre ; null si illisible. */
export function parseMilestones(raw: string): number[] | null {
  const parts = raw.split(/[,;]/).map(p => p.trim()).filter(Boolean)
  const cents = parts.map(parseAmountCents)
  if (!parts.length || cents.some(c => !c)) return null
  return Array.from(new Set(cents as number[])).sort((a, b) => a - b)
}
