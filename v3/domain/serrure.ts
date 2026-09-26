// Serrure et trousseau de clés : qui peut faire quoi sur un Tiroir.
// Doit rester aligné avec v3/supabase/drafts/0001_drawer_members.sql.

/** Niveau d'ouverture d'un Tiroir. */
export type Serrure = 'ferme' | 'entrouvert' | 'ouvert'

/** Rôle porté par une clé. */
export type Role = 'owner' | 'editor' | 'viewer'

export type Action = 'voir' | 'modifier' | 'preter' | 'gerer_membres'

/** Une clé du trousseau : un rôle, éventuellement confié jusqu'à une date. */
export interface Cle {
  role: Role
  expiresAt?: Date | null
}

const RANG: Record<Role, number> = { viewer: 1, editor: 2, owner: 3 }

const ROLE_MINIMUM: Record<Action, Role> = {
  voir: 'viewer',
  modifier: 'editor',
  preter: 'owner',
  gerer_membres: 'owner',
}

export function cleValide(cle: Cle, maintenant: Date): boolean {
  if (cle.role === 'owner') return true
  return cle.expiresAt == null || cle.expiresAt.getTime() > maintenant.getTime()
}

/**
 * La serrure prime sur les clés : fermé, seul le propriétaire entre ;
 * ouvert, tout le monde peut voir, mais seules les clés permettent d'agir.
 */
export function peutFaire(
  serrure: Serrure,
  cle: Cle | null,
  action: Action,
  maintenant: Date = new Date(),
): boolean {
  const role = cle !== null && cleValide(cle, maintenant) ? cle.role : null

  if (role === 'owner') return true
  if (serrure === 'ouvert' && action === 'voir') return true
  if (serrure === 'ferme' || role === null) return false

  return RANG[role] >= RANG[ROLE_MINIMUM[action]]
}
