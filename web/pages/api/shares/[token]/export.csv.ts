import type { NextApiRequest, NextApiResponse } from 'next'
import { lotTotal } from '../../../../lib/quantity'
import {
  resolveShareExport, STATUS_LABEL, formatDate, formatInsurances, safeFilename,
  type ExportObjectRow, type InsuranceRow, type ShareFields,
} from '../../../../lib/shareExportData'

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
  const result = await resolveShareExport(req, token, req.query.ids)
  if (!result.ok) {
    res.status(result.status).json({ error: result.error })
    return
  }

  const { objects, collectionNames, insurancesByObject, shareFields, title } = result.data
  const csv = buildCsv(objects, collectionNames, insurancesByObject, shareFields)
  sendCsv(res, safeFilename(title), csv)
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
      // Déduit comme sur la page : le booléen n'est plus écrit par l'app
      // depuis le passage aux contrats multiples.
      insured: (object.insured || (insurancesByObject.get(object.id) ?? []).length > 0) ? 'Oui' : 'Non',
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
  res.status(200).send('﻿' + csv)
}

function toCsvCell(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) return ''
  const stringValue = escapeSpreadsheetFormula(String(value))
  return `"${stringValue.replace(/"/g, '""')}"`
}

function escapeSpreadsheetFormula(value: string) {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}
