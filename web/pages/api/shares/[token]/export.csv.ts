import type { NextApiRequest, NextApiResponse } from 'next'
import { adminSupabase } from '../../../../lib/supabase'
import { makeCookieName } from '../../../../lib/shareAuth'

type ShareLinkRow = {
  title: string | null
  object_ids: string[]
  options: {
    allow_download?: boolean
    password_protected?: boolean
  } | null
  expires_at: string | null
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
  created_at: string
  updated_at: string
}

const STATUS_LABEL: Record<string, string> = {
  owned: 'Possédé',
  stored: 'En stockage',
  loaned: 'Prêté',
  sold: 'Vendu',
  given: 'Donné',
  lost: 'Perdu',
}

const FIXED_COLUMNS = [
  { key: 'title', label: 'Titre' },
  { key: 'status', label: 'Statut' },
  { key: 'collection', label: 'Collection' },
  { key: 'location_note', label: 'Emplacement' },
  { key: 'description', label: 'Description' },
  { key: 'value', label: 'Valeur' },
  { key: 'value_currency', label: 'Devise valeur' },
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
    .select('title, object_ids, options, expires_at')
    .eq('token', token)
    .single()

  if (linkError || !link) {
    res.status(404).json({ error: 'SHARE_NOT_FOUND' })
    return
  }

  const shareLink = link as ShareLinkRow
  if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
    res.status(410).json({ error: 'SHARE_EXPIRED' })
    return
  }

  if (!shareLink.options?.allow_download) {
    res.status(403).json({ error: 'DOWNLOAD_DISABLED' })
    return
  }

  if (shareLink.options?.password_protected && !hasSignedShareCookie(req, token)) {
    res.status(403).json({ error: 'PASSWORD_REQUIRED' })
    return
  }

  const objectIds = Array.isArray(shareLink.object_ids) ? shareLink.object_ids : []
  if (objectIds.length === 0) {
    sendCsv(res, safeFilename(shareLink.title ?? 'tiroir-export'), buildCsv([], new Map()))
    return
  }

  const { data: objectsData, error: objectsError } = await supabase
    .from('objects')
    .select(`
      id,
      collection_id,
      title,
      description,
      status,
      location_note,
      attributes,
      market_value,
      user_value,
      value_currency,
      created_at,
      updated_at
    `)
    .in('id', objectIds)

  if (objectsError || !objectsData) {
    res.status(500).json({ error: 'OBJECTS_FETCH_FAILED' })
    return
  }

  const objectsById = new Map((objectsData as ExportObjectRow[]).map(object => [object.id, object]))
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

  const csv = buildCsv(orderedObjects, collectionNames)
  sendCsv(res, safeFilename(shareLink.title ?? 'tiroir-export'), csv)
}

function buildCsv(objects: ExportObjectRow[], collectionNames: Map<string, string>) {
  const attributeKeys = Array.from(
    objects.reduce((keys, object) => {
      for (const [key, value] of Object.entries(object.attributes ?? {})) {
        if (value !== null && value !== '') keys.add(key)
      }
      return keys
    }, new Set<string>())
  ).sort((a, b) => a.localeCompare(b, 'fr'))

  const headers = [
    ...FIXED_COLUMNS.map(column => column.label),
    ...attributeKeys.map(key => `Attribut: ${key}`),
  ]

  const rows = objects.map(object => {
    const value = object.user_value ?? object.market_value
    const fixedValues: Record<(typeof FIXED_COLUMNS)[number]['key'], string | number | boolean | null> = {
      title: object.title,
      status: object.status ? STATUS_LABEL[object.status] ?? object.status : null,
      collection: object.collection_id ? collectionNames.get(object.collection_id) ?? null : null,
      location_note: object.location_note,
      description: object.description,
      value,
      value_currency: value === null ? null : object.value_currency ?? 'EUR',
      created_at: formatDate(object.created_at),
      updated_at: formatDate(object.updated_at),
    }

    return [
      ...FIXED_COLUMNS.map(column => fixedValues[column.key]),
      ...attributeKeys.map(key => object.attributes?.[key] ?? null),
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
