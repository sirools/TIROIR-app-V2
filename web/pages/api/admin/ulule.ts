// Actions du tableau de bord de la campagne Ulule. Réservé au propriétaire.
import type { NextApiRequest, NextApiResponse } from 'next'
import { requireTorixOwnerApi } from '../../../lib/adminAuth'
import { adminSupabase } from '../../../lib/supabase'
import { isEmail, parseAmbassadorLines, parisInputToIso, uniqueSlug } from '../../../lib/ulule'
import {
  forgetEmail, importExport, resetFailed, sendBatch, sendTest, type EmailKind,
} from '../../../lib/ululeServer'

export const config = { api: { bodyParser: { sizeLimit: '4mb' } } }

const isKind = (v: unknown): v is EmailKind => v === 'prelaunch' || v === 'thanks'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const user = await requireTorixOwnerApi(req, res)
  if (!user) return
  if (req.method !== 'POST') return res.status(405).end()

  const db = adminSupabase()
  const body = req.body ?? {}

  try {
    switch (body.action) {
      case 'settings': {
        const launchAt = parisInputToIso(String(body.launchAt ?? ''))
        const pageUrl = String(body.pageUrl ?? '').trim()
        const presaleNumber = String(body.presaleNumber ?? '').trim()
        if (!launchAt || !/^https:\/\/[a-z.]*ulule\.com\//.test(pageUrl) || !/^\d+$/.test(presaleNumber)) {
          return res.status(400).json({ error: 'Date, adresse Ulule ou numéro de collecte invalide.' })
        }
        const { error } = await db.from('ulule_campaign')
          .update({ launch_at: launchAt, page_url: pageUrl, presale_number: presaleNumber }).eq('id', 1)
        if (error) throw new Error(error.message)
        return res.status(200).json({ ok: true })
      }

      case 'add-ambassadors': {
        const { valid, invalid } = parseAmbassadorLines(String(body.lines ?? ''))
        const { data: existing, error } = await db.from('ambassadors').select('slug, email')
        if (error) throw new Error(error.message)
        const taken = new Set((existing ?? []).map(a => a.slug as string))
        const emails = new Set((existing ?? []).map(a => a.email as string))
        const rows: { first_name: string; last_name: string; email: string; slug: string }[] = []
        let duplicates = 0
        for (const a of valid) {
          if (emails.has(a.email)) { duplicates++; continue }
          emails.add(a.email)
          rows.push({
            first_name: a.firstName, last_name: a.lastName, email: a.email,
            slug: uniqueSlug(a.firstName, a.lastName, taken),
          })
        }
        if (rows.length) {
          const { error: insertError } = await db.from('ambassadors').insert(rows)
          if (insertError) throw new Error(insertError.message)
        }
        return res.status(200).json({ added: rows.length, duplicates, invalid })
      }

      case 'delete-ambassador': {
        const { error } = await db.from('ambassadors').delete().eq('id', String(body.id))
        if (error) throw new Error(error.message)
        return res.status(200).json({ ok: true })
      }

      case 'send-test': {
        if (!isKind(body.kind) || !user.email) return res.status(400).json({ error: 'Envoi invalide.' })
        const result = await sendTest(db, body.kind, user.email, 'Clément')
        return result.ok
          ? res.status(200).json({ to: user.email })
          : res.status(502).json({ error: result.error })
      }

      case 'send-batch': {
        if (!isKind(body.kind)) return res.status(400).json({ error: 'Envoi invalide.' })
        return res.status(200).json(await sendBatch(db, body.kind))
      }

      case 'retry-failed': {
        if (!isKind(body.kind)) return res.status(400).json({ error: 'Envoi invalide.' })
        await resetFailed(db, body.kind)
        return res.status(200).json({ ok: true })
      }

      case 'import': {
        const extra = Array.isArray(body.extraPaidStatuses) ? body.extraPaidStatuses.map(String) : []
        const summary = await importExport(db, String(body.csv ?? ''), {
          dryRun: body.dryRun !== false, extraPaidStatuses: extra,
        })
        return res.status(summary.ok ? 200 : 400).json(summary)
      }

      case 'forget': {
        const email = String(body.email ?? '').trim().toLowerCase()
        if (!isEmail(email)) return res.status(400).json({ error: 'Adresse invalide.' })
        await forgetEmail(db, email)
        return res.status(200).json({ ok: true })
      }

      default:
        return res.status(400).json({ error: 'Action inconnue.' })
    }
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message })
  }
}
