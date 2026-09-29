// Moyens de connexion d'un compte : un seul compte Tiroir, quel que soit le
// moyen (e-mail et mot de passe, Google, Apple) — sur le site, l'app et le
// back-office. Module sans dépendance, testable.
//
// Lier un moyen : supabase.auth.linkIdentity (exige « Allow manual linking »
// dans Supabase, Authentication). Délier : unlinkIdentity, jamais le dernier.

export type Provider = 'email' | 'google' | 'apple'

/** Connexion Apple sur le site : attend l'identifiant de service Apple dans
 *  Supabase. Tant qu'il manque, Apple se lie et se connecte depuis l'app. */
export const APPLE_WEB_ENABLED = false

export type IdentityLike = { provider: string; identity_id?: string; identity_data?: { email?: string } | null }

export type ProviderRow = {
  provider: Provider
  label: string
  linked: boolean
  /** Adresse vue par ce moyen (Apple peut donner une adresse masquée). */
  email: string | null
  action: 'link' | 'unlink' | 'set-password' | 'app-only' | null
}

const LABELS: Record<Provider, string> = {
  email: 'E-mail et mot de passe',
  google: 'Google',
  apple: 'Apple',
}

export function providerRows(identities: IdentityLike[], appleWeb = APPLE_WEB_ENABLED): ProviderRow[] {
  const linkedCount = identities.filter(i => i.provider in LABELS).length
  return (Object.keys(LABELS) as Provider[]).map(provider => {
    const identity = identities.find(i => i.provider === provider)
    const linked = Boolean(identity)
    let action: ProviderRow['action'] = null
    if (linked) {
      // Le dernier moyen de connexion ne se délie jamais : on perdrait le compte.
      action = linkedCount > 1 ? 'unlink' : null
    } else if (provider === 'email') {
      action = 'set-password'
    } else if (provider === 'apple' && !appleWeb) {
      action = 'app-only'
    } else {
      action = 'link'
    }
    return {
      provider,
      label: LABELS[provider],
      linked,
      email: identity?.identity_data?.email ?? null,
      action,
    }
  })
}

/** Message clair pour les erreurs de liaison les plus probables. */
export function linkErrorMessage(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('manual linking')) {
    return 'La liaison de comptes doit d’abord être activée dans Supabase (Authentication → « Allow manual linking »).'
  }
  if (m.includes('already') && (m.includes('linked') || m.includes('exists'))) {
    return 'Ce compte est déjà rattaché à un autre compte Tiroir. Connecte-toi avec lui, supprime ce second compte ou écris à support@tiroir.app.'
  }
  if (m.includes('single identity') || m.includes('at least')) {
    return 'Impossible de délier ton dernier moyen de connexion : ajoute-en un autre d’abord.'
  }
  return message
}
