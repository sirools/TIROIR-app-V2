// Parcours de connexion « sans savonnette » : un visiteur qui arrive d'un
// partage (/s/<jeton>) pour suggérer un objet doit pouvoir se connecter ou
// créer son compte, puis revenir exactement où il était, formulaire ouvert.
// Module sans dépendance, testable.

/** Retour après connexion : chemin interne seulement (pas `//hôte`, ni `/\hôte`). */
export function safeNext(raw: unknown): string {
  return typeof raw === 'string' && /^\/(?![/\\])/.test(raw) ? raw : '/'
}

/** Paramètre qui rouvre le formulaire de suggestion au retour sur le partage. */
export const SUGGEST_PARAM = 'suggerer'

/** Chemin de retour vers un partage, formulaire de suggestion rouvert. */
export function shareReturnPath(token: string): string {
  return `/s/${encodeURIComponent(token)}?${SUGGEST_PARAM}=1`
}

/** Lien vers une page d'authentification qui ramène à `next`. */
export function authHref(page: '/login' | '/inscription', next: string | null | undefined): string {
  const target = next ? safeNext(next) : '/'
  return target === '/' ? page : `${page}?next=${encodeURIComponent(target)}`
}

export type AuthHint = { message: string; suggestSignup?: boolean; suggestLogin?: boolean; suggestReset?: boolean }

/** Erreurs Supabase Auth → phrase claire en français, avec la bonne porte de sortie. */
export function authErrorHint(raw: string): AuthHint {
  const m = raw.toLowerCase()
  if (m.includes('invalid login credentials') || m.includes('invalid credentials')) {
    return {
      message: 'E-mail ou mot de passe incorrect. Pas encore de compte Tiroir ? Il se crée en une minute.',
      suggestSignup: true,
      suggestReset: true,
    }
  }
  if (m.includes('email not confirmed')) {
    return { message: 'Ton adresse n’est pas encore confirmée : ouvre l’e-mail de Tiroir et touche le lien, puis reviens ici.' }
  }
  if (m.includes('already registered') || m.includes('already been registered') || m.includes('user already exists')) {
    return { message: 'Tu as déjà un compte Tiroir avec cette adresse : connecte-toi.', suggestLogin: true, suggestReset: true }
  }
  if (m.includes('password should be at least') || m.includes('weak password')) {
    return { message: 'Mot de passe trop court : au moins 6 caractères.' }
  }
  if (m.includes('invalid email') || m.includes('unable to validate email')) {
    return { message: 'Cette adresse e-mail ne semble pas valide.' }
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return { message: 'Trop d’essais d’affilée. Attends une minute, puis réessaie.' }
  }
  return { message: raw }
}
