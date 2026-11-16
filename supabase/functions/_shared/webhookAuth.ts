// Authentification du webhook RevenueCat par secret partagé.
//
// RevenueCat renvoie, dans l'en-tête Authorization, exactement la valeur
// saisie dans son tableau de bord (Integrations → Webhooks). La fonction est
// déployée sans vérification JWT (supabase/config.toml) : le secret est la
// seule barrière, il doit donc être long, aléatoire et privé — jamais la clé
// anon de Supabase, qui est publique (embarquée dans l'app) : avec elle,
// n'importe qui pourrait s'offrir Premium, Pro ou des crédits.
//
// Module sans dépendance : importé par le webhook (Deno) et testé côté site.

/** Longueur minimale d'un secret acceptable (32 caractères aléatoires). */
export const MIN_SECRET_LENGTH = 32

/** Le secret ressemble-t-il à un JWT (clé anon ou de service de Supabase) ? */
export const looksLikeJwt = (secret: string): boolean =>
  /^(Bearer\s+)?eyJ[\w-]*\.[\w-]+\.[\w-]+$/.test(secret.trim())

/**
 * Faiblesse du secret configuré, ou null s'il convient. Signalée dans les
 * journaux à chaque appel, sans bloquer : la rotation se fait dans
 * RevenueCat et dans les secrets Supabase, pas par un redéploiement.
 */
export function secretWeakness(secret: string | undefined | null): 'missing' | 'jwt' | 'short' | null {
  if (!secret) return 'missing'
  if (looksLikeJwt(secret)) return 'jwt'
  if (secret.length < MIN_SECRET_LENGTH) return 'short'
  return null
}

/** Comparaison en temps constant de l'en-tête reçu et du secret. */
export function isAuthorized(header: string | null | undefined, secret: string | undefined | null): boolean {
  if (!secret || typeof header !== 'string') return false
  const enc = new TextEncoder()
  const a = enc.encode(header)
  const b = enc.encode(secret)
  let diff = a.length ^ b.length
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0)
  return diff === 0
}

/**
 * Vrai si l'en-tête correspond à l'un des secrets (rotation : courant et
 * suivant). Chaque secret est comparé, sans s'arrêter au premier trouvé :
 * la durée ne dit pas lequel a répondu.
 */
export function isAuthorizedAny(header: string | null | undefined, secrets: readonly (string | undefined | null)[]): boolean {
  let ok = false
  for (const secret of secrets) ok = isAuthorized(header, secret) || ok
  return ok
}
