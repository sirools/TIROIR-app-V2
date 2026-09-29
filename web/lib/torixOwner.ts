// Torix appartient à son fondateur, et à lui seul (cf.
// strategie/torix-et-tiroir.md, § Gouvernance). Être admin de Tiroir ne
// suffit donc pas pour accéder à Torix : les associés qui gèrent Tiroir
// sont admins, le propriétaire de Torix est une seule personne.
//
// Il est désigné par TORIX_OWNER_EMAIL, variable serveur (jamais
// NEXT_PUBLIC_). À défaut, par DEFAULT_OWNER_EMAIL ci-dessous — choix du
// fondateur (2026-09-29) pour retrouver l'accès sans passer par Vercel.
// Ce module n'est lu que côté serveur : l'adresse n'est jamais envoyée au
// navigateur (vérifié dans le build, test torixPrive).
//
// Module sans dépendance, pour rester testable hors de Next.

type OwnerCandidate = {
  email?: string | null
  email_confirmed_at?: string | null
}

/** Propriétaire par défaut, si TORIX_OWNER_EMAIL n'est pas défini. */
export const DEFAULT_OWNER_EMAIL = 'clement.ougier@gmail.com'

export function torixOwnerEmail(): string | null {
  const email = (process.env.TORIX_OWNER_EMAIL?.trim() || DEFAULT_OWNER_EMAIL).toLowerCase()
  return email ? email : null
}

/**
 * Vrai si ce compte est le propriétaire de Torix. L'adresse doit être
 * confirmée : un compte créé avec la bonne adresse mais jamais vérifié ne
 * prouve pas qu'on la possède.
 */
export function isTorixOwner(user: OwnerCandidate | null | undefined): boolean {
  const owner = torixOwnerEmail()
  if (!owner || !user?.email || !user.email_confirmed_at) return false
  return user.email.trim().toLowerCase() === owner
}
