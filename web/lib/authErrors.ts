// Erreurs Supabase Auth → clé de texte traduite (t.account.errors).
//
// Supabase renvoie ses messages en anglais (« Invalid login credentials »…) :
// on ne les affiche jamais tels quels. On lit d'abord `error.code`, stable,
// puis le message et le statut HTTP pour les anciennes versions ou les
// erreurs renvoyées dans l'URL (?error_code=…&error_description=…). Faute de
// mieux, un message générique traduit. Module sans dépendance, testable.
import type { AccountCopy } from '../locales/account/fr'

/** Toute clé de t.account.errors. */
export type AccountErrorKey = keyof AccountCopy['errors']

export type AuthErrorKey =
  | 'invalidCredentials'
  | 'emailNotConfirmed'
  | 'userAlreadyExists'
  | 'weakPassword'
  | 'samePassword'
  | 'invalidEmail'
  | 'rateLimit'
  | 'linkExpired'
  | 'accessDenied'
  | 'network'
  | 'generic'

export type LinkErrorKey = 'linkingDisabled' | 'identityTaken' | 'lastIdentity'

/** Casse à la compilation si une clé manque dans les textes. */
export type AuthErrorKeysExist = AccountCopy['errors'][AuthErrorKey | LinkErrorKey]

/** Forme minimale d'une AuthError Supabase (ou d'une erreur lue dans l'URL). */
export type AuthErrorLike = {
  code?: string | null
  message?: string | null
  status?: number | null
  name?: string | null
}

const BY_CODE: Record<string, AuthErrorKey> = {
  invalid_credentials: 'invalidCredentials',
  email_not_confirmed: 'emailNotConfirmed',
  user_already_exists: 'userAlreadyExists',
  email_exists: 'userAlreadyExists',
  weak_password: 'weakPassword',
  same_password: 'samePassword',
  email_address_invalid: 'invalidEmail',
  over_email_send_rate_limit: 'rateLimit',
  over_request_rate_limit: 'rateLimit',
  over_sms_send_rate_limit: 'rateLimit',
  otp_expired: 'linkExpired',
  flow_state_expired: 'linkExpired',
  flow_state_not_found: 'linkExpired',
  bad_code_verifier: 'linkExpired',
  access_denied: 'accessDenied',
}

const LINK_BY_CODE: Record<string, LinkErrorKey> = {
  manual_linking_disabled: 'linkingDisabled',
  identity_already_exists: 'identityTaken',
  single_identity_not_deletable: 'lastIdentity',
}

function normalize(err: AuthErrorLike | string | null | undefined): AuthErrorLike {
  if (!err) return {}
  return typeof err === 'string' ? { message: err } : err
}

/** Clé de texte pour une erreur d'authentification. */
export function authErrorKey(err: AuthErrorLike | string | null | undefined): AuthErrorKey {
  const { code, message, status, name } = normalize(err)
  const byCode = code ? BY_CODE[code] : undefined
  if (byCode) return byCode

  const m = (message ?? '').toLowerCase()
  if (m.includes('invalid login credentials') || m.includes('invalid credentials')) return 'invalidCredentials'
  if (m.includes('email not confirmed')) return 'emailNotConfirmed'
  if (m.includes('already registered') || m.includes('already been registered') || m.includes('user already exists')) {
    return 'userAlreadyExists'
  }
  if (m.includes('should be different from the old password')) return 'samePassword'
  if (m.includes('password should be at least') || m.includes('weak password')) return 'weakPassword'
  if (m.includes('invalid email') || m.includes('unable to validate email') || (code === 'validation_failed' && m.includes('email'))) {
    return 'invalidEmail'
  }
  if (m.includes('rate limit') || m.includes('too many') || status === 429) return 'rateLimit'
  if (m.includes('expired') || m.includes('invalid flow state') || m.includes('code verifier')) return 'linkExpired'
  if (name === 'AuthRetryableFetchError' || m.includes('failed to fetch') || m.includes('network')) return 'network'
  return 'generic'
}

/** Erreur renvoyée par Supabase dans l'URL d'un lien ou d'un retour OAuth, ou null. */
export function authErrorFromUrl(get: (param: string) => string | null | undefined): AuthErrorKey | null {
  const code = get('error_code') || get('error') || null
  const message = get('error_description') || null
  if (!code && !message) return null
  return authErrorKey({ code, message })
}

/** Erreurs de liaison / déliaison d'un moyen de connexion (page Mon compte). */
export function linkErrorKey(err: AuthErrorLike | string | null | undefined): LinkErrorKey | AuthErrorKey {
  const e = normalize(err)
  const byCode = e.code ? LINK_BY_CODE[e.code] : undefined
  if (byCode) return byCode
  const m = (e.message ?? '').toLowerCase()
  if (m.includes('manual linking')) return 'linkingDisabled'
  if (m.includes('already') && (m.includes('linked') || m.includes('exists'))) return 'identityTaken'
  if (m.includes('single identity') || m.includes('at least')) return 'lastIdentity'
  return authErrorKey(e)
}

/** Mauvais identifiants : proposer de créer un compte. */
export const suggestsSignup = (key: AuthErrorKey) => key === 'invalidCredentials'

/** Compte déjà existant : proposer de se connecter. */
export const suggestsLogin = (key: AuthErrorKey) => key === 'userAlreadyExists'
