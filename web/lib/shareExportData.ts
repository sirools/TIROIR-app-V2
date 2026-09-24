// Logique commune aux exports d'un lien de partage (CSV, PDF).
// Charge le lien, applique les mêmes gardes que la page publique
// (expiration, téléchargement autorisé, mot de passe), résout la
// sélection d'objets et rapatrie objets + collections + assurances.
import type { NextApiRequest } from 'next'
import { adminSupabase } from './supabase'
import { makeCookieName } from './shareAuth'

export type ShareFields = {
  values: boolean
  location: boolean
  attributes: boolean
  description: boolean
  insurance: boolean
}

export type ExportObjectRow = {
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

export type InsuranceRow = {
  object_id: string
  label: string | null
  price: number | null
  billing_period: 'monthly' | 'yearly' | null
  coverage: number | null
  date: string | null
  position: number | null
}

type ShareLinkRow = {
  title: string | null
  object_ids: string[]
  options: {
    allow_download?: boolean
    password_protected?: boolean
    fields?: Partial<ShareFields>
  } | null
  expires_at: string | null
  is_archived: boolean
}

export type ResolvedShareExport = {
  title: string
  shareFields: ShareFields
  objects: ExportObjectRow[]
  collectionNames: Map<string, string>
  insurancesByObject: Map<string, InsuranceRow[]>
}

export type ShareExportResult =
  | { ok: true; data: ResolvedShareExport }
  | { ok: false; status: number; error: string }

export const STATUS_LABEL: Record<string, string> = {
  owned: 'Possédé',
  stored: 'En stockage',
  loaned: 'Prêté',
  sold: 'Vendu',
  given: 'Donné',
  lost: 'Perdu',
}

const BILLING_LABEL: Record<string, string> = { monthly: '/mois', yearly: '/an' }

export function currencySymbol(raw: string | null | undefined): string {
  const c = raw ?? 'EUR'
  if (c === 'EUR' || c === '€') return '€'
  if (c === 'USD' || c === '$') return '$'
  if (c === 'GBP' || c === '£') return '£'
  return c
}

export function formatDate(value: string | null): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toISOString().slice(0, 10)
}

export function formatInsurances(rows: InsuranceRow[], currency: string | null): string | null {
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

export function safeFilename(value: string): string {
  const normalized = value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  return normalized || 'tiroir-export'
}

function hasSignedShareCookie(req: NextApiRequest, token: string): boolean {
  const cookieName = makeCookieName(token)
  const cookieHeader = req.headers.cookie || ''
  return cookieHeader.split(';').map(c => c.trim()).some(c => c.startsWith(`${cookieName}=`))
}

/**
 * Résout un export de partage : garde d'accès + données prêtes à formater.
 * Retourne un résultat discriminé (jamais d'exception) que la route traduit
 * en code HTTP. `objects` respecte l'ordre du lien et n'inclut que les
 * colonnes autorisées par la visibilité du partage.
 */
export async function resolveShareExport(
  req: NextApiRequest,
  token: string,
  idsParam: string | string[] | undefined,
): Promise<ShareExportResult> {
  if (!token) return { ok: false, status: 400, error: 'MISSING_TOKEN' }

  const supabase = adminSupabase()
  const { data: link, error: linkError } = await supabase
    .from('share_links')
    .select('title, object_ids, options, expires_at, is_archived')
    .eq('token', token)
    .single()

  if (linkError || !link) return { ok: false, status: 404, error: 'SHARE_NOT_FOUND' }

  const shareLink = link as ShareLinkRow
  if (shareLink.is_archived || (shareLink.expires_at && new Date(shareLink.expires_at) < new Date())) {
    return { ok: false, status: 410, error: 'SHARE_EXPIRED' }
  }

  const shareFields: ShareFields = {
    values: true, location: true, attributes: true, description: true, insurance: true,
    ...(shareLink.options?.fields ?? {}),
  }

  if (!shareLink.options?.allow_download) return { ok: false, status: 403, error: 'DOWNLOAD_DISABLED' }
  if (shareLink.options?.password_protected && !hasSignedShareCookie(req, token)) {
    return { ok: false, status: 403, error: 'PASSWORD_REQUIRED' }
  }

  const title = shareLink.title ?? 'tiroir-export'
  const shareObjectIds = Array.isArray(shareLink.object_ids) ? shareLink.object_ids : []

  // Sélection optionnelle depuis l'UI : ne garder que les ids du partage.
  const objectIds = typeof idsParam === 'string' && idsParam.length > 0
    ? shareObjectIds.filter(id => idsParam.split(',').includes(id))
    : shareObjectIds

  if (objectIds.length === 0) {
    return { ok: true, data: { title, shareFields, objects: [], collectionNames: new Map(), insurancesByObject: new Map() } }
  }

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
    .from('objects').select(exportColumns).in('id', objectIds)

  if (objectsError || !objectsData) return { ok: false, status: 500, error: 'OBJECTS_FETCH_FAILED' }

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
  const objects = objectIds
    .map(id => objectsById.get(id))
    .filter((o): o is ExportObjectRow => Boolean(o))

  const collectionIds = Array.from(new Set(objects.map(o => o.collection_id).filter(Boolean))) as string[]
  const collectionNames = new Map<string, string>()
  if (collectionIds.length > 0) {
    const { data: collectionsData } = await supabase.from('collections').select('id, name').in('id', collectionIds)
    for (const collection of collectionsData ?? []) collectionNames.set(collection.id, collection.name)
  }

  const insurancesByObject = new Map<string, InsuranceRow[]>()
  const { data: insuranceData } = shareFields.insurance
    ? await supabase
        .from('object_insurances')
        .select('object_id, label, price, billing_period, coverage, date, position')
        .in('object_id', objectIds).order('position')
    : { data: null }
  for (const row of (insuranceData ?? []) as InsuranceRow[]) {
    const list = insurancesByObject.get(row.object_id) ?? []
    list.push(row)
    insurancesByObject.set(row.object_id, list)
  }

  return { ok: true, data: { title, shareFields, objects, collectionNames, insurancesByObject } }
}
