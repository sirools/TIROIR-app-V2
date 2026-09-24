import type { NextApiRequest, NextApiResponse } from 'next'
import PDFDocument from 'pdfkit'
import { lotTotal } from '../../../../lib/quantity'
import {
  resolveShareExport, STATUS_LABEL, currencySymbol, formatDate, safeFilename,
  type ExportObjectRow, type InsuranceRow, type ShareFields,
} from '../../../../lib/shareExportData'

// pdfkit lit ses polices AFM depuis le paquet : forcer le runtime Node
// et le tracing des fichiers (voir next.config.js outputFileTracingIncludes).
export const config = { runtime: 'nodejs' }

type Column = {
  key: string
  label: string
  width: number
  align?: 'left' | 'right'
  group?: keyof ShareFields
}

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
  const pdf = await buildPdf(title, objects, collectionNames, insurancesByObject, shareFields)

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="${safeFilename(title)}.pdf"`)
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.status(200).send(pdf)
}

function fmtMoney(amount: number | null, currency: string | null): string {
  if (amount == null) return ''
  return `${amount.toLocaleString('fr-FR')} ${currencySymbol(currency)}`
}

function buildPdf(
  title: string,
  objects: ExportObjectRow[],
  collectionNames: Map<string, string>,
  insurancesByObject: Map<string, InsuranceRow[]>,
  shareFields: ShareFields,
): Promise<Buffer> {
  // Jeu de colonnes lisibles pour un document imprimé (≠ les 28 du CSV).
  const allColumns: Column[] = [
    { key: 'title', label: 'Titre', width: 150 },
    { key: 'status', label: 'Statut', width: 70 },
    { key: 'collection', label: 'Collection', width: 90 },
    { key: 'location_note', label: 'Emplacement', width: 90, group: 'location' },
    { key: 'quantity', label: 'Qté', width: 34, align: 'right' },
    { key: 'unit_value', label: 'Valeur unit.', width: 74, align: 'right', group: 'values' },
    { key: 'total_value', label: 'Valeur (lot)', width: 78, align: 'right', group: 'values' },
    { key: 'insured', label: 'Assuré', width: 46, group: 'insurance' },
  ]
  const columns = allColumns.filter(c => !c.group || shareFields[c.group])

  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36 })
  const chunks: Buffer[] = []
  doc.on('data', (c: Buffer) => chunks.push(c))
  const done = new Promise<Buffer>(resolve => doc.on('end', () => resolve(Buffer.concat(chunks))))

  const left = doc.page.margins.left
  const right = doc.page.width - doc.page.margins.right
  const tableWidth = columns.reduce((sum, c) => sum + c.width, 0)

  // En-tête du document
  doc.font('Helvetica-Bold').fontSize(18).fillColor('#4a3527').text(title || 'Inventaire Tiroir', left, doc.y)
  doc.moveDown(0.2)
  doc.font('Helvetica').fontSize(9).fillColor('#8a7355')
    .text(`Export du ${new Date().toLocaleDateString('fr-FR')} · ${objects.length} objet(s) · Tiroir`, { align: 'left' })
  doc.moveDown(0.6)

  let totalValue = 0
  let hasValue = false

  const rowHeight = 20
  const headerHeight = 22

  const drawHeader = () => {
    const y = doc.y
    doc.rect(left, y, tableWidth, headerHeight).fill('#efe6da')
    let x = left
    doc.fillColor('#4a3527').font('Helvetica-Bold').fontSize(8.5)
    for (const col of columns) {
      doc.text(col.label, x + 4, y + 7, { width: col.width - 8, align: col.align ?? 'left', lineBreak: false })
      x += col.width
    }
    doc.y = y + headerHeight
  }

  const ensureSpace = (needed: number) => {
    if (doc.y + needed > doc.page.height - doc.page.margins.bottom) {
      doc.addPage()
      drawHeader()
    }
  }

  drawHeader()

  objects.forEach((object, i) => {
    ensureSpace(rowHeight)
    const y = doc.y
    if (i % 2 === 1) doc.rect(left, y, tableWidth, rowHeight).fill('#faf6f0')

    const unit = object.user_value ?? object.market_value
    const total = lotTotal(unit, object.quantity)
    if (total != null) { totalValue += total; hasValue = true }
    const isInsured = object.insured || (insurancesByObject.get(object.id) ?? []).length > 0

    const cell: Record<string, string> = {
      title: object.title ?? '',
      status: object.status ? STATUS_LABEL[object.status] ?? object.status : '',
      collection: object.collection_id ? collectionNames.get(object.collection_id) ?? '' : '',
      location_note: object.location_note ?? '',
      quantity: String(object.quantity ?? 1),
      unit_value: fmtMoney(unit, object.value_currency),
      total_value: fmtMoney(total, object.value_currency),
      insured: isInsured ? 'Oui' : 'Non',
    }

    let x = left
    doc.font('Helvetica').fontSize(8.5).fillColor('#33261a')
    for (const col of columns) {
      doc.text(cell[col.key] ?? '', x + 4, y + 6, { width: col.width - 8, align: col.align ?? 'left', lineBreak: false, ellipsis: true })
      x += col.width
    }
    doc.y = y + rowHeight
  })

  // Ligne de totaux (valeur du parc), si les valeurs sont partagées
  if (shareFields.values && hasValue) {
    ensureSpace(rowHeight + 4)
    const y = doc.y + 4
    doc.rect(left, y, tableWidth, rowHeight).fill('#e7d9c5')
    const totalCol = columns.find(c => c.key === 'total_value')
    doc.fillColor('#4a3527').font('Helvetica-Bold').fontSize(9)
    doc.text('Total estimé', left + 4, y + 6, { width: tableWidth - (totalCol?.width ?? 78) - 8, align: 'right', lineBreak: false })
    if (totalCol) {
      doc.text(
        totalValue.toLocaleString('fr-FR') + ' ' + currencySymbol(objects[0]?.value_currency ?? 'EUR'),
        right - totalCol.width + 4, y + 6, { width: totalCol.width - 8, align: 'right', lineBreak: false },
      )
    }
    doc.y = y + rowHeight
  }

  // Pied de page discret
  doc.font('Helvetica').fontSize(7).fillColor('#b0a08a')
  doc.text('Généré par Tiroir', left, doc.page.height - doc.page.margins.bottom + 8, { align: 'right', width: right - left })

  doc.end()
  return done
}
