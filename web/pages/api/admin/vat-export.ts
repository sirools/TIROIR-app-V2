// Export CSV des factures payées dans un mois et de la TVA collectée.
// GET /api/admin/vat-export?month=2026-11 → fichier CSV (tableur français).
// Réservé aux admins (is_admin relu avec la clé service).
import type { NextApiRequest, NextApiResponse } from 'next'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { adminSupabase } from '../../../lib/supabase'
import { stripeEnv } from '../../../lib/stripeConfig'
import { stripeClient } from '../../../lib/stripe/api'
import { monthRange, vatCsv, vatRows } from '../../../lib/stripe/vatExport'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store')
  if (req.method !== 'GET') return res.status(405).end()
  const { data: { user } } = await createServerSupabaseClient({ req, res }).auth.getUser()
  if (!user) return res.status(401).json({ error: 'Non authentifié' })
  const { data: me } = await adminSupabase().from('profiles').select('is_admin').eq('id', user.id).single()
  if (!me?.is_admin) return res.status(403).json({ error: 'Accès refusé' })

  const month = typeof req.query.month === 'string' ? req.query.month : ''
  const range = monthRange(month)
  if (!range) return res.status(400).json({ error: 'Mois attendu au format AAAA-MM' })
  const env = stripeEnv()
  if (!env) return res.status(503).json({ error: 'Stripe non configuré' })

  // Une facture payée dans le mois a pu être émise avant (échéance, relance) :
  // on lit les factures créées jusqu'à 62 jours plus tôt, filtrées ensuite
  // sur la date de paiement.
  const stripe = stripeClient(env)
  const invoices: unknown[] = []
  let startingAfter: string | undefined
  try {
    for (let page = 0; page < 50; page++) {
      const list = await stripe<{ data: { id: string }[]; has_more: boolean }>('GET', '/v1/invoices', {
        status: 'paid', limit: 100,
        created: { gte: range.start - 62 * 86400, lt: range.end },
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      })
      invoices.push(...list.data)
      if (!list.has_more || !list.data.length) break
      startingAfter = list.data[list.data.length - 1].id
    }
  } catch (e) {
    console.error('[vat-export]', (e as Error).message)
    return res.status(502).json({ error: 'Stripe' })
  }

  const csv = vatCsv(vatRows(invoices, range))
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="tiroir-tva-${month}${env.mode === 'test' ? '-test' : ''}.csv"`)
  return res.status(200).send(csv)
}
