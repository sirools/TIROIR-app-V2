// Identité + réseaux du fondateur — centralisés pour rester synchronisés
// entre le footer, la page /about et d'éventuels e-mails.
//
// ⚠️ À COMPLÉTER :
//   - `agenda`   : colle ici ton lien Cal.com / Calendly. Laissé vide, tous les
//                  CTA « prendre un créneau » basculent automatiquement sur un
//                  mailto (voir `agendaHref`).
export const FOUNDER = {
  name: 'Clément Ougier',
  role: 'Senior Product Designer & Builder, concepteur de Tiroir',
  // Adresse de contact perso — reste sur hello@ tant qu'une boîte clement@ n'existe pas.
  email: 'hello@tiroir.app',
  linkedin: 'https://www.linkedin.com/in/clement-ougier/',
  website: 'https://www.clementougier.com/',
  websiteLabel: 'clementougier.com',
  blog: 'https://www.cofondateurauchomage.fr/',
  blogLabel: 'Cofondateur au chômage',
  agenda: '',
} as const

/** Lien du CTA « réserver un créneau » : agenda si dispo, sinon e-mail. */
export const agendaHref = (subject = 'Parler de Tiroir') =>
  FOUNDER.agenda || `mailto:${FOUNDER.email}?subject=${encodeURIComponent(subject)}`

/** True quand un vrai lien d'agenda est configuré (pour adapter les libellés). */
export const hasAgenda = () => Boolean(FOUNDER.agenda)

export const CONTACT_EMAIL = 'hello@tiroir.app'
