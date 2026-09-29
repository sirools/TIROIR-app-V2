// Santé du système, pour ne jamais douter qu'il tourne — jour et nuit,
// que Torix dorme ou non (son repos ne coupe que Torix).
//
// Publique et minimale : « en ligne », la base répond ou non, l'heure. Rien
// d'autre. Faite pour être interrogée par un service de surveillance
// (toutes les 5 minutes) qui alerte le fondateur si elle tombe.
import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const TIMEOUT_MS = 4000

async function databaseAnswers(): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return false
  const query = createClient(url, key, { auth: { persistSession: false } })
    .from('app_settings').select('id').eq('id', 1).maybeSingle()
  const timeout = new Promise<{ error: Error }>(resolve =>
    setTimeout(() => resolve({ error: new Error('timeout') }), TIMEOUT_MS))
  try {
    const { error } = await Promise.race([query, timeout])
    return !error
  } catch {
    return false
  }
}

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Robots-Tag', 'noindex, nofollow')
  const db = await databaseAnswers()
  // 503 si la base ne répond pas : un service de surveillance le voit comme une panne.
  res.status(db ? 200 : 503).json({ status: db ? 'ok' : 'degraded', site: 'ok', db: db ? 'ok' : 'ko', at: new Date().toISOString() })
}
