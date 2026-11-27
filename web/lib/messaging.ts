// La messagerie privée de Tiroir : ici les règles, pures et testées
// (web/__tests__/messaging.test.ts). Aucune dépendance : ce module est
// aussi lu par le navigateur (formulaire « Contacter le vendeur »).
//
// Phase 1 : écrire au vendeur depuis une vente (/ventes/<jeton>), avec ou
// sans compte. Phase 2 : fils directs entre membres, sur le même modèle
// (migration 20261127090000_messagerie.sql). Le chiffrement et les liens
// signés sont dans messagingCrypto.ts, la base dans messagingServer.ts.

export const BODY_MAX = 2000
export const NAME_MAX = 60
export const EXCERPT_MAX = 120

/** Corps d'un message : texte brut, 2000 caractères au plus. */
export function parseBody(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const text = raw.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim()
  return text && text.length <= BODY_MAX ? text : null
}

/** Prénom d'un invité : une ligne, sans rien qui ressemble à une adresse ou un lien. */
export function parseGuestName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const name = raw.replace(/\s+/g, ' ').trim()
  if (!name || name.length > NAME_MAX || /[@<>]|https?:|www\./i.test(name)) return null
  return name
}

/** Adresse d'un invité, en minuscules, ou null. */
export function parseEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const email = raw.trim().toLowerCase()
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : null
}

export type Buyer = { userId: string } | { email: string }

/**
 * Clé d'unicité d'un fil lié à une vente : une seule conversation par
 * couple vente + acheteur. Un deuxième message rouvre le même fil.
 */
export function listingKey(auctionId: string, buyer: Buyer): string {
  return 'userId' in buyer
    ? `annonce:${auctionId}:u:${buyer.userId}`
    : `annonce:${auctionId}:e:${buyer.email.trim().toLowerCase()}`
}

/** Clé d'unicité d'un fil direct (phase 2) : la même dans les deux sens. */
export function directKey(a: string, b: string): string {
  return `direct:${[a, b].sort().join(':')}`
}

export type ParticipantRow = {
  id: string
  thread_id: string
  role: 'seller' | 'buyer' | 'member'
  user_id: string | null
  guest_name: string | null
  guest_email: string | null
  guest_verified_at: string | null
  locale: string | null
  last_read_at: string | null
}

/** Qui regarde : un compte connecté, et/ou un invité entré par son lien signé. */
export type Viewer = { userId: string | null; guestParticipantId: string | null }

/**
 * Le participant que ce visiteur est dans ce fil, ou null : il n'y a alors
 * rien à lire ni à écrire. Seule porte d'entrée de toutes les routes.
 */
export function viewerParticipant(participants: ParticipantRow[], viewer: Viewer): ParticipantRow | null {
  if (viewer.userId) {
    const own = participants.find(p => p.user_id !== null && p.user_id === viewer.userId)
    if (own) return own
  }
  if (viewer.guestParticipantId) {
    // Un lien d'invité n'ouvre que la place d'un invité, jamais celle d'un compte.
    return participants.find(p => p.id === viewer.guestParticipantId && p.user_id === null) ?? null
  }
  return null
}

export type MessageRow = { id: string; thread_id: string; author_id: string; delivered_at: string | null; created_at: string }

/** Messages que l'autre partie a remis depuis la dernière lecture. */
export function unreadCount(messages: MessageRow[], me: Pick<ParticipantRow, 'id' | 'last_read_at'>): number {
  const since = me.last_read_at ? Date.parse(me.last_read_at) : 0
  return messages.filter(m => m.author_id !== me.id && m.delivered_at !== null && Date.parse(m.delivered_at) > since).length
}

/** Première ligne d'un message, raccourcie pour la boîte de réception. */
export function excerpt(body: string, max = EXCERPT_MAX): string {
  const line = body.replace(/\s+/g, ' ').trim()
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line
}

/** Plafonds d'envoi sur une heure glissante. */
export const RATE = {
  /** Sans compte : par adresse IP, et par adresse e-mail. */
  guestPerIp: 5,
  guestPerEmail: 3,
  /** Avec un compte, ou un invité entré par son lien. */
  memberPerHour: 30,
} as const

export type RateCounts = { byIp: number; byAuthor: number }

/** L'envoi est-il encore permis ? `guest` : formulaire sans compte. */
export function rateAllowed(kind: 'guest' | 'member', counts: RateCounts): boolean {
  if (kind === 'guest') return counts.byIp < RATE.guestPerIp && counts.byAuthor < RATE.guestPerEmail
  return counts.byAuthor < RATE.memberPerHour && counts.byIp < RATE.memberPerHour
}
