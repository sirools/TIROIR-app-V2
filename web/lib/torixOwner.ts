// Torix appartient à son fondateur, et à lui seul (cf.
// strategie/torix-et-tiroir.md, § Gouvernance). Être admin de Tiroir ne
// suffit donc pas pour accéder à Torix : les associés qui gèrent Tiroir
// sont admins, le propriétaire de Torix est une seule personne.
//
// Il est désigné par TORIX_OWNER_EMAIL, variable serveur (jamais
// NEXT_PUBLIC_) : l'adresse ne figure ni dans le code ni dans le
// navigateur. Sans elle, personne n'est propriétaire — Torix est fermé
// plutôt qu'ouvert à tous les admins.
//
// Module sans dépendance, pour rester testable hors de Next.

type OwnerCandidate = {
  email?: string | null
  email_confirmed_at?: string | null
}

export function torixOwnerEmail(): string | null {
  const email = process.env.TORIX_OWNER_EMAIL?.trim().toLowerCase()
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
