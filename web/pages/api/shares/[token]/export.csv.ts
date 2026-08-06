import type { NextApiRequest, NextApiResponse } from 'next'
import { adminSupabase } from '../../../../lib/supabase'
import { makeCookieName } from '../../../../lib/shareAuth'
import { lotTotal } from '../../../../lib/quantity'

type ShareLinkRow = {
  title: string | null
  object_ids: string[]
  options: {
    allow_download?: boolean
    password_protected?: boolean
    fields?: {
      values?: boolean
      location?: boolean
      attributes?: boolean
      description?: boolean
      insurance?: boolean
    }
  } | null
  expires_at: string | null
  is_archived: boolean
}

type ExportObjectRow = {
  id: string
  collection_id: string | null
  title: string
  description: string | null
  status: string | null
  location_note: string | null
  attributes: Record<string, string | number | boolean | null> | null
  market_value: number | null
  user_value: number | null
  value_currency: string | null
  value_estimated_at: string | null
  purchase_price: number | null
  purchase_currency: string | null
  purchase_date: string | null
  sale_price: number | null
  sale_price_lot: number | null
  deposit_amount: number | null
  quantity: number | null
  insured: boolean | null
  insurance_type: string | null
  insurance_coverage: number | null
  insurance_policy_ref: string | null
  insurance_provider: string | null
  insurance_expires_at: string | null
  created_at: string
  updated_at: string
}

type InsuranceRow = {
  object_id: string
  label: string | null
  price: number | null
  billing_period: 'monthly' | 'yearly' | null
  coverage: number | null
  date: string | null
  position: number | null
}

/**
 * Colonnes rattachées à un bloc masquable. Celles qui n'y figurent pas —
 * titre, statut, collection, dates — restent toujours exportées : sans
 * elles, une ligne ne désigne plus rien.
 */
const COLUMN_GROUP: Record<string, 'values' | 'location' | 'description' | 'insurance' | undefined> = {
  location_note: 'location',
  description: 'description',
  estimated_value: 'values',
  market_value: 'values',
  value_currency: 'values',
  value_estimated_at: 'values',
  purchase_price: 'values',
  purchase_currency: 'values',
  purchase_date: 'values',
  sale_price: 'values',
  sale_price_lot: 'values',
  deposit_amount: 'values',
  estimated_value_total: 'values',
  purchase_price_total: 'values',
  deposit_amount_total: 'values',
  insured: 'insurance',
  insurances: 'insurance',
  insurance_provider: 'insurance',
  insurance_type: 'insurance',
  insurance_coverage: 'insurance',
  insurance_policy_ref: 'insurance',
  insurance_expires_at: 'insurance',
}

const STATUS_LABEL: Record<string, string> = {
  owned: 'Possédé',
  stored: 'En stockage',
  loaned: 'Prêté',
  sold: 'Vendu',
  given: 'Donné',
  lost: 'Perdu',
}

const BILLING_LABEL: Record<string, string> = {
  monthly: '/mois',
  yearly: '/an',
}

function currencySymbol(raw: string | null | undefined): string {
  const c = raw ?? 'EUR'
  if (c === 'EUR' || c === '€') return '€'
  if (c === 'USD' || c === '$') return '$'
  if (c === 'GBP' || c === '£') return '£'
  return c
}

function formatInsurances(rows: InsuranceRow[], currency: string | null): string | null {
  if (!rows.length) return null
  const sym = currencySymbol(currency)
  return rows
    .map(row => {
      const head = row.label?.trim() || 'Contrat'
      const parts: string[] = []
      if (row.price != null) {
        const period = row.billing_period ? ` ${BILLING_LABEL[row.billing_period] ?? ''}`.trimEnd() : ''
        parts.push(`${row.price} ${sym}${period}`)
      }
      if (row.coverage != null) parts.push(`couverture ${row.coverage} ${sym}`)
      const due = formatDate(row.date)
      if (due) parts.push(`échéance ${due}`)
      return parts.length ? `${head} (${parts.join(', ')})` : head
    })
    .join(' | ')
}

const FIXED_COLUMNS = [
  { key: 'title', label: 'Titre' },
  { key: 'status', label: 'Statut' },
  { key: 'collection', label: 'Collection' },
  { key: 'location_note', label: 'Emplacement' },
  { key: 'description', label: 'Description' },
  { key: 'quantity', label: 'Quantité' },
  { key: 'estimated_value', label: 'Valeur estimée' },
  { key: 'market_value', label: 'Valeur marché' },
  { key: 'value_currency', label: 'Devise valeur' },
  { key: 'value_estimated_at', label: 'Date estimation' },
  { key: 'purchase_price', label: "Prix d'achat" },
  { key: 'purchase_currency', label: 'Devise achat' },
  { key: 'purchase_date', label: "Date d'achat" },
  { key: 'sale_price', label: 'Prix de vente' },
  { key: 'sale_price_lot', label: 'Prix du lot' },
  { key: 'deposit_amount', label: 'Caution' },
  // Colonnes dérivées : un tableur sert à sommer, et sommer des montants
  // unitaires sans tenir compte des lots donnerait un total faux.
  { key: 'estimated_value_total', label: 'Valeur estimée (lot)' },
  { key: 'purchase_price_total', label: "Prix d'achat (lot)" },
  { key: 'deposit_amount_total', label: 'Caution (lot)' },
  { key: 'insured', label: 'Assuré' },
  { key: 'insurances', label: 'Assurances' },
  { key: 'insurance_provider', label: 'Assureur' },
  { key: 'insurance_type', label: 'Type assurance' },
  { key: 'insurance_coverage', label: 'Couverture assurance' },
  { key: 'insurance_policy_ref', label: 'Réf. contrat' },
  { key: 'insurance_expires_at', label: 'Échéance assurance' },
  { key: 'created_at', label: 'Date ajout' },
  { key: 'updated_at', label: 'Date mise à jour' },
] as const

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
    return
  }

  const token = String(req.query.token ?? '').trim()
  if (!token) {
    res.status(400).json({ error: 'MISSING_TOKEN' })
    return
  }

  const supabase = adminSupabase()
  const { data: link, error: linkError } = await supabase
    .from('share_links')
    .select('title, object_ids, options, expires_at, is_archived')
    .eq('token', token)
    .single()

  if (linkError || !link) {
    res.status(404).json({ error: 'SHARE_NOT_FOUND' })
    return
  }

  const shareLink = link as ShareLinkRow
  if (shareLink.is_archived || (shareLink.expires_at && new Date(shareLink.expires_at) < new Date())) {
    res.status(410).json({ error: 'SHARE_EXPIRED' })
    return
  }

  // Un export ne doit pas contourner ce que la page masque.
  const shareFields = {
    values: true, location: true, attributes: true, description: true, insurance: true,
    ...(shareLink.options?.fields ?? {}),
  }

  if (!shareLink.options?.allow_download) {
    res.status(403).json({ error: 'DOWNLOAD_DISABLED' })
    return
  }

  if (shareLink.options?.password_protected && !hasSignedShareCookie(req, token)) {
    res.status(403).json({ error: 'PASSWORD_REQUIRED' })
    return
  }

  const shareObjectIds = Array.isArray(shareLink.object_ids) ? shareLink.object_ids : []

  // Optional row selection from the export UI. Never trust client-supplied ids
  // blindly — only keep the ones that actually belong to this share link.
  const requestedIds = req.query.ids
  const objectIds = typeof requestedIds === 'string' && requestedIds.length > 0
    ? shareObjectIds.filter(id => requestedIds.split(',').includes(id))
    : shareObjectIds

  if (objectIds.length === 0) {
    sendCsv(res, safeFilename(shareLink.title ?? 'tiroir-export'), buildCsv([], new Map(), new Map(), shareFields))
    return
  }

  // Même règle que la page : ce que le partage masque n'est pas chargé.
  const exportColumns = [
    'id', 'collection_id', 'title', 'status', 'quantity', 'created_at', 'updated_at',
    ...(shareFields.description ? ['description'] : []),
    ...(shareFields.location ? ['location_note'] : []),
    ...(shareFields.attributes ? ['attributes'] : []),
    ...(shareFields.values ? [
      'market_value', 'user_value', 'value_currency', 'value_estimated_at',
      'purchase_price', 'purchase_currency', 'purchase_date',
      'sale_price', 'sale_price_lot', 'deposit_amount',
    ] : []),
    ...(shareFields.insurance ? [
      'insured', 'insurance_type', 'insurance_coverage',
      'insurance_policy_ref', 'insurance_provider', 'insurance_expires_at',
    ] : []),
  ].join(', ')

  const { data: objectsData, error: objectsError } = await supabase
    .from('objects')
    .select(exportColumns)
    .in('id', objectIds)

  if (objectsError || !objectsData) {
    res.status(500).json({ error: 'OBJECTS_FETCH_FAILED' })
    return
  }

  // Colonnes non demandées : `null`, comme un champ vide.
  const objectRows = (objectsData as unknown as Record<string, unknown>[]).map(row => ({
    description: null, location_note: null, attributes: null,
    market_value: null, user_value: null, value_currency: null, value_estimated_at: null,
    purchase_price: null, purchase_currency: null, purchase_date: null,
    sale_price: null, sale_price_lot: null, deposit_amount: null,
    insured: null, insurance_type: null, insurance_coverage: null,
    insurance_policy_ref: null, insurance_provider: null, insurance_expires_at: null,
    ...row,
  })) as unknown as ExportObjectRow[]

  const objectsById = new Map(objectRows.map(object => [object.id, object]))
  const orderedObjects = objectIds
    .map(objectId => objectsById.get(objectId))
    .filter((object): object is ExportObjectRow => Boolean(object))

  const collectionIds = Array.from(new Set(orderedObjects.map(object => object.collection_id).filter(Boolean))) as string[]
  const collectionNames = new Map<string, string>()
  if (collectionIds.length > 0) {
    const { data: collectionsData } = await supabase
      .from('collections')
      .select('id, name')
      .in('id', collectionIds)

    for (const collection of collectionsData ?? []) {
      collectionNames.set(collection.id, collection.name)
    }
  }

  // Contrats d'assurance (table object_insurances, multi-contrats par objet)
  const insurancesByObject = new Map<string, InsuranceRow[]>()
  const { data: insuranceData } = shareFields.insurance
    ? await supabase
        .from('object_insurances')
        .select('object_id, label, price, billing_period, coverage, date, position')
        .in('object_id', objectIds)
        .order('position')
    : { data: null }

  for (const row of (insuranceData ?? []) as InsuranceRow[]) {
    const list = insurancesByObject.get(row.object_id) ?? []
    list.push(row)
    insurancesByObject.set(row.object_id, list)
  }

  const csv = buildCsv(orderedObjects, collectionNames, insurancesByObject, shareFields)
  sendCsv(res, safeFilename(shareLink.title ?? 'tiroir-export'), csv)
}

type ShareFields = {
  values: boolean; location: boolean; attributes: boolean
  description: boolean; insurance: boolean
}

function buildCsv(
  objects: ExportObjectRow[],
  collectionNames: Map<string, string>,
  insurancesByObject: Map<string, InsuranceRow[]>,
  shareFields: ShareFields,
) {
  const attributeKeys = Array.from(
    objects.reduce((keys, object) => {
      for (const [key, value] of Object.entries(object.attributes ?? {})) {
        if (value !== null && value !== '') keys.add(key)
      }
      return keys
    }, new Set<string>())
  ).sort((a, b) => a.localeCompare(b, 'fr'))

  const columns = FIXED_COLUMNS.filter(column => {
    const group = COLUMN_GROUP[column.key]
    return !group || shareFields[group]
  })
  const attrCols = shareFields.attributes ? attributeKeys : []

  const headers = [
    ...columns.map(column => column.label),
    ...attrCols.map(key => `Attribut: ${key}`),
  ]

  const rows = objects.map(object => {
    const estimatedValue = object.user_value ?? object.market_value
    const fixedValues: Record<(typeof FIXED_COLUMNS)[number]['key'], string | number | boolean | null> = {
      title: object.title,
      status: object.status ? STATUS_LABEL[object.status] ?? object.status : null,
      collection: object.collection_id ? collectionNames.get(object.collection_id) ?? null : null,
      location_note: object.location_note,
      description: object.description,
      quantity: object.quantity ?? 1,
      estimated_value: estimatedValue,
      market_value: object.market_value,
      value_currency: estimatedValue === null && object.market_value === null ? null : object.value_currency ?? 'EUR',
      value_estimated_at: formatDate(object.value_estimated_at),
      purchase_price: object.purchase_price,
      purchase_currency: object.purchase_price === null ? null : object.purchase_currency ?? 'EUR',
      purchase_date: formatDate(object.purchase_date),
      sale_price: object.sale_price,
      sale_price_lot: object.sale_price_lot ?? lotTotal(object.sale_price, object.quantity),
      deposit_amount: object.deposit_amount,
      estimated_value_total: lotTotal(estimatedValue, object.quantity),
      purchase_price_total: lotTotal(object.purchase_price, object.quantity),
      deposit_amount_total: lotTotal(object.deposit_amount, object.quantity),
      insured: object.insured ? 'Oui' : 'Non',
      insurances: formatInsurances(insurancesByObject.get(object.id) ?? [], object.value_currency),
      insurance_provider: object.insurance_provider,
      insurance_type: object.insurance_type,
      insurance_coverage: object.insurance_coverage,
      insurance_policy_ref: object.insurance_policy_ref,
      insurance_expires_at: formatDate(object.insurance_expires_at),
      created_at: formatDate(object.created_at),
      updated_at: formatDate(object.updated_at),
    }

    return [
      ...columns.map(column => fixedValues[column.key]),
      ...attrCols.map(key => object.attributes?.[key] ?? null),
    ]
  })

  return [headers, ...rows].map(row => row.map(toCsvCell).join(',')).join('\r\n') + '\r\n'
}

function sendCsv(res: NextApiResponse, filename: string, csv: string) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`)
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.status(200).send('\uFEFF' + csv)
}

function toCsvCell(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) return ''
  const stringValue = escapeSpreadsheetFormula(String(value))
  return `"${stringValue.replace(/"/g, '""')}"`
}

function escapeSpreadsheetFormula(value: string) {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}

function hasSignedShareCookie(req: NextApiRequest, token: string) {
  const cookieName = makeCookieName(token)
  const cookieHeader = req.headers.cookie || ''
  return cookieHeader
    .split(';')
    .map(c => c.trim())
    .some(c => c.startsWith(`${cookieName}=`))
}

function formatDate(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toISOString().slice(0, 10)
}

function safeFilename(value: string) {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()

  return normalized || 'tiroir-export'
}
