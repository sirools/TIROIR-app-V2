// La messagerie privée de Tiroir : ici les règles, pures et testées
// (web/__tests__/messaging.test.ts). Aucune dépendance : ce module est
// aussi lu par le navigateur (formulaire « Contacter le vendeur »).
//
// Phase 1 : écrire au vendeur depuis une vente (/ventes/<jeton>), avec ou
// sans compte. Phase 2 : fils directs entre membres, sur le même modèle
// (migrations 20261127090000_messagerie.sql, 20261127140000_messagerie_niveau1.sql).
// Le chiffrement et les liens signés sont dans messagingCrypto.ts, la base
// dans messagingServer.ts.
//
// Chacun apparaît sous son PSEUDO : choisi dans le profil pour un compte
// (profiles.pseudo, unique), saisi dans le formulaire pour un invité.

export const BODY_MAX = 2000
export const NAME_MAX = 24
export const EXCERPT_MAX = 120

/** Corps d'un message : texte brut, 2000 caractères au plus. */
export function parseBody(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const text = raw.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim()
  return text && text.length <= BODY_MAX ? text : null
}

/** Pseudo : 3 à 24 caractères, lettres (accents compris), chiffres, point, tiret, tiret bas ; commence par une lettre ou un chiffre. */
export const PSEUDO_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N}._-]{2,23}$/u
export const PSEUDO_MAX = 24

/** Le pseudo saisi, ou null s'il ne respecte pas le format (ni espace, ni @, ni lien possible). */
export function parsePseudo(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const pseudo = raw.normalize('NFC').trim()
  return PSEUDO_PATTERN.test(pseudo) ? pseudo : null
}

/** Forme comparable d'un pseudo : deux pseudos de même forme ne peuvent coexister (profiles.pseudo_key). */
export const pseudoKey = (pseudo: string) => pseudo.normalize('NFC').toLocaleLowerCase('und')

/** Ancien nom : le pseudo d'un invité suit la même règle que celui d'un compte. */
export const parseGuestName = parsePseudo

/** Adresse d'un invité, en minuscules, ou null. */
export function parseEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const email = raw.trim().toLowerCase()
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : null
}

/** L'acheteur : un compte, ou un invité désigné par l'EMPREINTE de son adresse (jamais l'adresse). */
export type Buyer = { userId: string } | { emailHash: string }

/**
 * Clé d'unicité d'un fil lié à une vente : une seule conversation par
 * couple vente + acheteur. Un deuxième message rouvre le même fil.
 */
export function listingKey(auctionId: string, buyer: Buyer): string {
  return 'userId' in buyer
    ? `annonce:${auctionId}:u:${buyer.userId}`
    : `annonce:${auctionId}:h:${buyer.emailHash}`
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
  /** Époque des liens de l'invité : un lien d'une autre époque ne vaut plus rien. */
  guest_link_epoch: number
  locale: string | null
  last_read_at: string | null
  /** Ce participant a supprimé la conversation : rien d'antérieur ne lui est montré. */
  cleared_at: string | null
}

/** Qui regarde : un compte connecté, et/ou un invité entré par son lien signé (place et époque du lien). */
export type Viewer = { userId: string | null; guest: { participantId: string; epoch: number } | null }

/**
 * Le participant que ce visiteur est dans ce fil, ou null : il n'y a alors
 * rien à lire ni à écrire. Seule porte d'entrée de toutes les routes.
 */
export function viewerParticipant(participants: ParticipantRow[], viewer: Viewer): ParticipantRow | null {
  if (viewer.userId) {
    const own = participants.find(p => p.user_id !== null && p.user_id === viewer.userId)
    if (own) return own
  }
  if (viewer.guest) {
    const { participantId, epoch } = viewer.guest
    // Un lien d'invité n'ouvre que la place d'un invité, jamais celle d'un
    // compte, et seulement s'il est de l'époque en cours (pas révoqué).
    return participants.find(p => p.id === participantId && p.user_id === null && (p.guest_link_epoch ?? 0) === epoch) ?? null
  }
  return null
}

export type MessageRow = { id: string; thread_id: string; author_id: string; delivered_at: string | null; created_at: string }

/** Ce participant voit-il ce message ? Remis, et postérieur à sa suppression de la conversation. */
export function visibleTo(m: Pick<MessageRow, 'delivered_at'>, me: Pick<ParticipantRow, 'cleared_at'>): boolean {
  if (m.delivered_at === null) return false
  return !me.cleared_at || Date.parse(m.delivered_at) > Date.parse(me.cleared_at)
}

/** Messages que l'autre partie a remis depuis la dernière lecture. */
export function unreadCount(messages: MessageRow[], me: Pick<ParticipantRow, 'id' | 'last_read_at' | 'cleared_at'>): number {
  const since = me.last_read_at ? Date.parse(me.last_read_at) : 0
  return messages.filter(m => m.author_id !== me.id && visibleTo(m, me) && Date.parse(m.delivered_at!) > since).length
}

/**
 * Après qu'un participant a supprimé la conversation : le fil entier peut
 * disparaître de la base si TOUS l'ont supprimée depuis le dernier message.
 */
export function everyoneCleared(participants: Pick<ParticipantRow, 'cleared_at'>[], lastMessageAt: string): boolean {
  const last = Date.parse(lastMessageAt)
  return participants.length > 0 && participants.every(p => p.cleared_at !== null && Date.parse(p.cleared_at) >= last)
}

/** Durée de conservation : un fil est supprimé 12 mois après son dernier message (purge_expired_threads). */
export const RETENTION_MONTHS = 12

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
