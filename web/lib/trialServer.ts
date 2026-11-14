// Accès serveur à l'essai sans compte (lib/trial.ts) : cookie, empreintes,
// lecture de la ligne et rattachement au compte. Tout passe par la clé
// service — la table trial_objects n'a aucune règle d'accès, ni pour un
// visiteur ni pour un compte connecté.
import crypto from 'crypto'
import type { IncomingMessage, ServerResponse } from 'http'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  isClaimCode, isExpired, parseTrialCookie, TRIAL_COLUMNS, TRIAL_COOKIE, TRIAL_COOKIE_MAX_AGE, type TrialRow,
} from './trial'

export const TRIAL_BUCKET = 'trial-images'
const OBJECT_BUCKET = 'object-images'

export const sha256 = (text: string) => crypto.createHash('sha256').update(text).digest('hex')

/** Deux secrets de 32 octets, prêts pour le cookie. */
export function newTrialSecrets(): { token: string; claim: string } {
  return { token: crypto.randomBytes(32).toString('base64url'), claim: crypto.randomBytes(32).toString('base64url') }
}

type Req = IncomingMessage & { cookies?: Partial<Record<string, string>> }

export function clientIp(req: Req): string {
  const forwarded = req.headers['x-forwarded-for']
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim()
  return first || req.socket?.remoteAddress || 'inconnue'
}

/** Empreinte salée de l'adresse IP : l'adresse elle-même n'est jamais gardée. */
export function ipHash(req: Req): string {
  const salt = process.env.TRIAL_SALT || process.env.ANALYTICS_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || 'tiroir'
  return sha256(`${salt}:essai:${clientIp(req)}`)
}

export function readTrialCookie(req: Req): { token: string; claim: string } | null {
  return parseTrialCookie(req.cookies?.[TRIAL_COOKIE])
}

function appendCookie(res: ServerResponse, cookie: string) {
  const current = res.getHeader('Set-Cookie')
  const list = Array.isArray(current) ? current : current ? [String(current)] : []
  res.setHeader('Set-Cookie', [...list, cookie])
}

/** `Secure` seulement en HTTPS : la preprod du NAS répond en HTTP sur le réseau local. */
const secureFlag = (req: Req) => (req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '')

export function setTrialCookie(req: Req, res: ServerResponse, secrets: { token: string; claim: string }) {
  appendCookie(res,
    `${TRIAL_COOKIE}=${secrets.token}.${secrets.claim}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TRIAL_COOKIE_MAX_AGE}${secureFlag(req)}`)
}

export function clearTrialCookie(req: Req, res: ServerResponse) {
  appendCookie(res, `${TRIAL_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag(req)}`)
}

/** L'essai de ce navigateur, s'il existe encore (un essai échu non rattaché n'existe plus). */
export async function trialFromCookie(admin: SupabaseClient, req: Req): Promise<TrialRow | null> {
  const cookie = readTrialCookie(req)
  if (!cookie) return null
  const { data } = await admin.from('trial_objects').select(TRIAL_COLUMNS).eq('token_hash', sha256(cookie.token)).maybeSingle()
  const row = data as TrialRow | null
  return row && (row.status === 'claimed' || !isExpired(row)) ? row : null
}

/** L'essai désigné par le code de rattachement des métadonnées d'inscription. */
export async function trialFromClaimCode(admin: SupabaseClient, code: unknown): Promise<TrialRow | null> {
  if (!isClaimCode(code)) return null
  const { data } = await admin.from('trial_objects').select(TRIAL_COLUMNS).eq('claim_hash', sha256(code)).maybeSingle()
  const row = data as TrialRow | null
  return row && (row.status === 'claimed' || !isExpired(row)) ? row : null
}

export async function signedTrialPhoto(admin: SupabaseClient, row: TrialRow): Promise<string | null> {
  if (!row.photo_path || row.status === 'claimed') return null
  const { data } = await admin.storage.from(TRIAL_BUCKET).createSignedUrl(row.photo_path, 3600)
  return data?.signedUrl ?? null
}

export type ClaimResult =
  | { ok: true; objectId: string }
  | { ok: false; reason: 'NOT_ESTIMATED' | 'OBJECT_QUOTA_EXCEEDED' | 'CLAIMED_BY_OTHER' | 'PHOTO_MISSING' | 'FAILED' }

/**
 * Rattache l'essai au compte : la photo est copiée dans le stockage du
 * compte, puis la base crée l'objet et marque l'essai (claim_trial_object,
 * atomique et rejouable). Rien n'est supprimé avant que l'objet existe : un
 * échec à n'importe quelle étape laisse l'essai intact, à rejouer.
 */
export async function claimTrial(admin: SupabaseClient, userId: string, row: TrialRow): Promise<ClaimResult> {
  if (row.status === 'claimed') {
    return row.claimed_by === userId && row.object_id
      ? { ok: true, objectId: row.object_id }
      : { ok: false, reason: 'CLAIMED_BY_OTHER' }
  }
  if (row.status !== 'estimated') return { ok: false, reason: 'NOT_ESTIMATED' }
  if (!row.photo_path) return { ok: false, reason: 'PHOTO_MISSING' }

  const { data: file } = await admin.storage.from(TRIAL_BUCKET).download(row.photo_path)
  if (!file) return { ok: false, reason: 'PHOTO_MISSING' }
  const bytes = Buffer.from(await file.arrayBuffer())

  const objectId = crypto.randomUUID()
  const imageId = crypto.randomUUID()
  const path = `${userId}/${objectId}/${imageId}.jpg`
  const { error: uploadError } = await admin.storage.from(OBJECT_BUCKET).upload(path, bytes, { contentType: 'image/jpeg' })
  if (uploadError) {
    console.error('essai/rattachement photo', uploadError.message)
    return { ok: false, reason: 'FAILED' }
  }

  const { data, error } = await admin.rpc('claim_trial_object', {
    p_trial_id: row.id, p_user_id: userId, p_object_id: objectId, p_image_id: imageId,
    p_storage_path: path, p_size_bytes: bytes.length,
  })
  const result = (data ?? {}) as { ok?: boolean; object_id?: string; already?: boolean; reason?: string }

  // Refus, ou essai déjà rattaché entre-temps (double envoi) : la copie ne sert à rien.
  if (error || !result.ok || result.already) {
    await admin.storage.from(OBJECT_BUCKET).remove([path])
  }
  if (error) {
    console.error('essai/rattachement', error.message)
    return { ok: false, reason: 'FAILED' }
  }
  if (!result.ok || !result.object_id) {
    const reason = result.reason
    return {
      ok: false,
      reason: reason === 'OBJECT_QUOTA_EXCEEDED' || reason === 'CLAIMED_BY_OTHER' || reason === 'NOT_ESTIMATED' ? reason : 'FAILED',
    }
  }

  // L'objet vit dans le compte : la photo d'essai n'a plus de raison d'être.
  // Un échec ici est rattrapé par le nettoyage horaire.
  if (!result.already) await admin.storage.from(TRIAL_BUCKET).remove([row.photo_path])
  return { ok: true, objectId: result.object_id }
}
