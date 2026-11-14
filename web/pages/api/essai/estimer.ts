// pages/api/essai/estimer — la photo de l'essai sans compte, et son
// estimation par Torix. Aucune session : le visiteur n'a pas de compte.
//
// Garde-fous, dans l'ordre :
//   1. la photo est un JPEG réduit par le navigateur (taille et signature
//      vérifiées ici) ;
//   2. un essai par navigateur (cookie) : une fois l'objet estimé, pas de
//      second ;
//   3. les plafonds par adresse IP et par jour se vérifient EN BASE à
//      l'ouverture de l'essai (trial_start) ;
//   4. une tentative d'estimation se réserve en base avant l'appel au
//      modèle (fonction Edge trial-estimate) : deux au plus, et la seconde
//      seulement si la première n'a rien donné.
import type { NextApiRequest, NextApiResponse } from 'next'
import { adminSupabase } from '../../../lib/supabase'
import { asLocale } from '../../../lib/localeRouting'
import { decodeJpegDataUrl, MAX_ATTEMPTS, TRIAL_COLUMNS, trialView, type TrialRow } from '../../../lib/trial'
import {
  ipHash, newTrialSecrets, setTrialCookie, sha256, signedTrialPhoto, TRIAL_BUCKET, trialFromCookie,
} from '../../../lib/trialServer'

// La photo arrive en base64 dans le corps : 1,5 Mo de photo ≈ 2 Mo de texte.
export const config = { api: { bodyParser: { sizeLimit: '3mb' } }, maxDuration: 60 }

type ErrorCode =
  | 'INVALID_PHOTO' | 'ALREADY_ESTIMATED' | 'NO_ATTEMPT_LEFT'
  | 'IP_LIMIT' | 'DAILY_CAP' | 'DISABLED' | 'NOT_AN_OBJECT' | 'ESTIMATE_FAILED'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
  }
  res.setHeader('Cache-Control', 'no-store')
  const fail = (status: number, error: ErrorCode, extra: Record<string, unknown> = {}) =>
    res.status(status).json({ error, ...extra })

  const body = (req.body ?? {}) as Record<string, unknown>
  const photo = decodeJpegDataUrl(body.photo)
  if (!photo) return fail(400, 'INVALID_PHOTO')

  const admin = adminSupabase()
  let row = await trialFromCookie(admin, req)

  if (row && row.status !== 'pending') return fail(409, 'ALREADY_ESTIMATED')
  if (row && row.attempts >= MAX_ATTEMPTS) return fail(429, 'NO_ATTEMPT_LEFT')

  if (!row) {
    const secrets = newTrialSecrets()
    const { data, error } = await admin.rpc('trial_start', {
      p_token_hash: sha256(secrets.token),
      p_claim_hash: sha256(secrets.claim),
      p_ip_hash: ipHash(req),
      p_locale: asLocale(typeof body.locale === 'string' ? body.locale : null),
    })
    const started = (data ?? {}) as { ok?: boolean; id?: string; reason?: string }
    if (error || (!started.ok && !started.reason)) {
      console.error('essai/estimer ouverture', error?.message)
      return fail(500, 'ESTIMATE_FAILED')
    }
    if (!started.ok) {
      const reason = started.reason === 'IP_LIMIT' || started.reason === 'DAILY_CAP' ? started.reason : 'DISABLED'
      return fail(reason === 'DISABLED' ? 503 : 429, reason)
    }
    setTrialCookie(req, res, secrets)
    const { data: created } = await admin.from('trial_objects').select(TRIAL_COLUMNS).eq('id', started.id!).single()
    row = created as TrialRow
  }

  // Une photo par essai, toujours au même chemin : une seconde tentative remplace la première.
  const path = `${row.id}.jpg`
  const { error: uploadError } = await admin.storage.from(TRIAL_BUCKET).upload(path, photo, { contentType: 'image/jpeg', upsert: true })
  if (uploadError) {
    console.error('essai/estimer photo', uploadError.message)
    return fail(500, 'ESTIMATE_FAILED', { canRetry: true })
  }
  await admin.from('trial_objects').update({ photo_path: path }).eq('id', row.id)

  let code: string | null = null
  try {
    const call = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/trial-estimate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
      body: JSON.stringify({ trial_id: row.id }),
      signal: AbortSignal.timeout(45_000),
    })
    if (!call.ok) code = ((await call.json().catch(() => null)) as { error?: { code?: string } } | null)?.error?.code ?? 'UNKNOWN'
  } catch (e) {
    console.error('essai/estimer appel', e instanceof Error ? e.message : e)
    code = 'UNREACHABLE'
  }

  const { data: fresh } = await admin.from('trial_objects').select(TRIAL_COLUMNS).eq('id', row.id).single()
  const after = fresh as TrialRow
  const view = trialView(after, await signedTrialPhoto(admin, after))

  if (after.status === 'estimated') return res.status(200).json({ trial: view })
  if (code === 'NOT_AN_OBJECT') return fail(422, 'NOT_AN_OBJECT', { canRetry: view.canRetry })
  if (code === 'ATTEMPTS_EXHAUSTED') return fail(429, 'NO_ATTEMPT_LEFT')
  console.error('essai/estimer estimation', code)
  return fail(502, 'ESTIMATE_FAILED', { canRetry: view.canRetry })
}
