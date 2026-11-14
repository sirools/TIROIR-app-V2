// L'essai sans compte (/essai) : un visiteur prend un objet en photo, Torix
// l'estime, il note un emplacement, puis crée son compte et l'objet le suit.
//
// Ce module ne contient que des règles pures (testées dans
// __tests__/trial.test.ts). L'accès à la base est dans lib/trialServer.ts ;
// les plafonds (par adresse IP, par jour) et l'unicité de l'estimation sont
// garantis EN BASE (supabase/drafts/essai_sans_compte.sql), pas ici.

/** Cookie de l'essai : « jeton.code », illisible par le JavaScript de la page. */
export const TRIAL_COOKIE = 'tiroir_essai'

/** Durée du cookie : celle de l'essai le plus long (inscription en attente de confirmation). */
export const TRIAL_COOKIE_MAX_AGE = 7 * 24 * 3600

/** Jours gardés quand une inscription attend la confirmation de l'e-mail. */
export const SIGNUP_GRACE_DAYS = 7

/** Photo réduite par le navigateur avant l'envoi : au-delà, c'est refusé. */
export const MAX_PHOTO_BYTES = 1_500_000

/** Côté le plus long de la photo envoyée, en pixels (le coût d'une image suit ses pixels). */
export const PHOTO_MAX_SIDE = 1280

export const LOCATION_MAX = 200

/** Page qui rattache l'essai au compte, où l'on revient après l'inscription. */
export const SAVE_PATH = '/essai/sauvegarde'

const PART = /^[A-Za-z0-9_-]{43}$/

/** Le cookie porte deux secrets de 32 octets : le jeton (ce navigateur) et le code de rattachement. */
export function parseTrialCookie(raw: unknown): { token: string; claim: string } | null {
  if (typeof raw !== 'string') return null
  const [token, claim, ...rest] = raw.split('.')
  return !rest.length && PART.test(token ?? '') && PART.test(claim ?? '') ? { token, claim } : null
}

/** Code de rattachement reçu des métadonnées d'inscription (écrites par le navigateur : à vérifier). */
export const isClaimCode = (v: unknown): v is string => typeof v === 'string' && PART.test(v)

/**
 * La photo envoyée par la page : une adresse `data:` JPEG, réencodée par le
 * navigateur. Rend ses octets, ou null si ce n'est pas un JPEG de taille
 * raisonnable (la signature du fichier est vérifiée, pas seulement son nom).
 */
export function decodeJpegDataUrl(raw: unknown): Buffer | null {
  if (typeof raw !== 'string') return null
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(raw)
  if (!match) return null
  // Quatre caractères pour trois octets : inutile de décoder un envoi trop gros.
  if (match[1].length > Math.ceil(MAX_PHOTO_BYTES / 3) * 4 + 4) return null
  const bytes = Buffer.from(match[1], 'base64')
  if (bytes.length < 100 || bytes.length > MAX_PHOTO_BYTES) return null
  return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff ? bytes : null
}

/** Emplacement saisi : une ligne, bornée ; vide → null. */
export function cleanLocation(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const text = raw.replace(/\s+/g, ' ').trim().slice(0, LOCATION_MAX)
  return text || null
}

export type TrialRow = {
  id: string
  status: 'pending' | 'estimated' | 'claimed'
  attempts: number
  photo_path: string | null
  title: string | null
  category: string | null
  estimate: Record<string, unknown> | null
  location_note: string | null
  expires_at: string
  claimed_by: string | null
  object_id: string | null
}

export const TRIAL_COLUMNS =
  'id, status, attempts, photo_path, title, category, estimate, location_note, expires_at, claimed_by, object_id'

export type TrialEstimate = {
  value: number
  min: number
  max: number
  confidence: 'low' | 'medium' | 'high'
  summary: string
}

/** Ce que la page reçoit d'un essai : rien d'interne (ni identifiant, ni empreinte). */
export type TrialView = {
  status: 'pending' | 'estimated' | 'claimed'
  title: string | null
  category: string | null
  estimate: TrialEstimate | null
  location: string | null
  photoUrl: string | null
  expiresAt: string
  /** Une seconde photo est-elle encore possible (la première n'a rien donné) ? */
  canRetry: boolean
}

export const MAX_ATTEMPTS = 2

export function isExpired(row: Pick<TrialRow, 'expires_at'>, now = Date.now()): boolean {
  return new Date(row.expires_at).getTime() <= now
}

export function estimateOf(raw: Record<string, unknown> | null): TrialEstimate | null {
  const value = Number(raw?.value)
  if (!raw || !Number.isFinite(value) || value <= 0) return null
  const min = Number(raw.value_min), max = Number(raw.value_max)
  const confidence = raw.confidence
  return {
    value,
    min: Number.isFinite(min) && min > 0 && min <= value ? min : value,
    max: Number.isFinite(max) && max >= value ? max : value,
    confidence: confidence === 'high' || confidence === 'medium' ? confidence : 'low',
    summary: typeof raw.summary === 'string' ? raw.summary : '',
  }
}

export function trialView(row: TrialRow, photoUrl: string | null): TrialView {
  return {
    status: row.status,
    title: row.title,
    category: row.category,
    estimate: estimateOf(row.estimate),
    location: row.location_note,
    photoUrl,
    expiresAt: row.expires_at,
    canRetry: row.status === 'pending' && row.attempts < MAX_ATTEMPTS,
  }
}
