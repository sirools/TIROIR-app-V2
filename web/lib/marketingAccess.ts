// Page Marketing du back-office : des chiffres solides (visites, sources,
// inscriptions, activation), jamais de secret (ni Torix, ni coûts, ni
// trésorerie, ni données d'un utilisateur). Ouverte aux admins et aux
// adresses listées dans MARKETING_EMAILS (variable serveur, séparées par
// des virgules), sans les rendre admins du reste.
//
// Module sans dépendance, pour rester testable hors de Next.

type Candidate = { email?: string | null; email_confirmed_at?: string | null }

export function marketingEmails(raw = process.env.MARKETING_EMAILS): string[] {
  return (raw ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(e => e.includes('@'))
}

/** Adresse confirmée et listée dans MARKETING_EMAILS. */
export function isMarketingMember(user: Candidate | null | undefined, raw?: string): boolean {
  if (!user?.email || !user.email_confirmed_at) return false
  return marketingEmails(raw).includes(user.email.trim().toLowerCase())
}
