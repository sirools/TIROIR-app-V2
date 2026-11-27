// Messagerie : chiffrement, empreintes et liens signés des invités.
// Serveur uniquement (node:crypto) : n'importer que depuis une route API ou
// un getServerSideProps.
//
// CHIFFREMENT. Le corps d'un message, et l'adresse d'un invité, sont
// chiffrés par le site avant d'être écrits en base (AES-256-GCM), liés à
// leur usage : un message ne se déchiffre que dans son fil. La base, ses
// sauvegardes et le tableau de bord Supabase ne contiennent donc jamais un
// message ni une adresse d'invité en clair. Ce n'est pas un chiffrement de
// bout en bout : le site déchiffre pour afficher le fil. Les e-mails, eux,
// ne recopient jamais le texte (lib/messagingEmails.ts).
//
// CLÉS. MESSAGES_KEY chiffre. Pour en changer sans perdre l'historique :
// poser la nouvelle dans MESSAGES_KEY et ajouter l'ancienne en tête de
// MESSAGES_KEY_PREVIOUS (liste séparée par des virgules, de la plus
// récente à la plus ancienne). Tout se lit avec n'importe laquelle ; tout
// s'écrit avec la première. Sans MESSAGES_KEY, la clé est dérivée de la clé
// service Supabase, qui reste aussi essayée en lecture : les messages
// écrits avant la pose de MESSAGES_KEY restent lisibles.
//
// EMPREINTES (adresse d'invité, adresse IP) : calculées avec la clé la
// PLUS ANCIENNE, pour qu'elles ne changent pas quand on fait tourner les clés.
//
// LIEN D'INVITÉ. `<participant>.<époque>.<expiration>.<signature>` : signé
// (HMAC), valable 7 jours, lié à un seul fil, à une seule place, et à
// l'époque des liens de cet invité — l'augmenter bloque les anciens liens.

import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

type Purpose = 'body' | 'email' | 'link' | 'ip' | 'email-hash'

/** Les clés de base, de la plus récente à la plus ancienne (la clé service en dernier recours). */
function baseKeys(): string[] {
  const explicit = [process.env.MESSAGES_KEY, ...(process.env.MESSAGES_KEY_PREVIOUS ?? '').split(',')]
    .map(k => (k ?? '').trim()).filter(Boolean)
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  const all = service && !explicit.includes(service) ? [...explicit, service] : explicit
  if (!all.length) throw new Error('MESSAGES_KEY manquant')
  return all
}

const derive = (base: string, purpose: Purpose) => createHmac('sha256', base).update(`tiroir-messagerie:${purpose}`).digest()

/** Clé d'écriture : la plus récente. */
const writeKey = (purpose: Purpose) => derive(baseKeys()[0], purpose)
/** Clés de lecture : toutes, la plus récente d'abord. */
const readKeys = (purpose: Purpose) => baseKeys().map(k => derive(k, purpose))
/** Clé des empreintes : la plus ancienne explicite, pour qu'elles restent stables. */
function hashKey(purpose: Purpose): Buffer {
  const explicit = [process.env.MESSAGES_KEY, ...(process.env.MESSAGES_KEY_PREVIOUS ?? '').split(',')]
    .map(k => (k ?? '').trim()).filter(Boolean)
  return derive(explicit.length ? explicit[explicit.length - 1] : baseKeys()[0], purpose)
}

const b64 = (b: Buffer) => b.toString('base64url')

function seal(purpose: Purpose, context: string, text: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', writeKey(purpose), iv)
  cipher.setAAD(Buffer.from(context))
  const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  return `v1.${b64(iv)}.${b64(cipher.getAuthTag())}.${b64(data)}`
}

function open(purpose: Purpose, context: string, stored: string): string | null {
  const [version, iv, tag, data] = stored.split('.')
  if (version !== 'v1' || !iv || !tag || data === undefined) return null
  for (const key of readKeys(purpose)) {
    try {
      const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'))
      decipher.setAAD(Buffer.from(context))
      decipher.setAuthTag(Buffer.from(tag, 'base64url'))
      return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8')
    } catch {
      /* clé suivante */
    }
  }
  return null
}

export const encryptBody = (threadId: string, text: string) => seal('body', threadId, text)

/** Le texte en clair, ou null si le message a été altéré, déplacé, ou si aucune clé ne l'ouvre. */
export const decryptBody = (threadId: string, stored: string) => open('body', threadId, stored)

export const encryptEmail = (email: string) => seal('email', 'guest_email', email)

/**
 * L'adresse en clair. Une adresse enregistrée avant le chiffrement (sans
 * le préfixe « v1. ») est rendue telle quelle.
 */
export function decryptEmail(stored: string | null | undefined): string | null {
  if (!stored) return null
  return stored.startsWith('v1.') ? open('email', 'guest_email', stored) : stored
}

/** Empreinte d'une adresse : retrouver un invité sans lire son adresse. */
export function emailHash(email: string): string {
  return createHmac('sha256', hashKey('email-hash')).update(email.trim().toLowerCase()).digest('hex')
}

/** Empreinte d'une adresse IP : sert à compter, jamais à retrouver l'adresse. */
export function ipHash(ip: string | null | undefined): string | null {
  if (!ip) return null
  return createHmac('sha256', hashKey('ip')).update(ip).digest('hex').slice(0, 32)
}

// ── Liens d'invité ────────────────────────────────────────────────

/** Durée de vie d'un lien d'invité. Chaque e-mail en porte un neuf. */
export const GUEST_LINK_TTL_MS = 7 * 24 * 3600 * 1000

const linkMessage = (threadId: string, participantId: string, epoch: number, expires: number) =>
  `${threadId}.${participantId}.${epoch}.${expires}`

export function guestToken(threadId: string, participantId: string, epoch = 0, now = Date.now()): string {
  const expires = now + GUEST_LINK_TTL_MS
  const signature = b64(createHmac('sha256', writeKey('link')).update(linkMessage(threadId, participantId, epoch, expires)).digest())
  return `${participantId}.${epoch}.${expires}.${signature}`
}

export type GuestPass = { participantId: string; epoch: number }

/**
 * La place et l'époque que ce lien désigne s'il est signé, POUR CE FIL, et
 * pas expiré ; sinon null. L'époque se compare ensuite à celle du
 * participant en base (lib/messaging.ts, viewerParticipant).
 */
export function readGuestToken(threadId: string, token: string | null | undefined, now = Date.now()): GuestPass | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 4) return null
  const [participantId, rawEpoch, rawExpires, signature] = parts
  const epoch = Number(rawEpoch)
  const expires = Number(rawExpires)
  if (!participantId || !/^\d{1,9}$/.test(rawEpoch) || !Number.isFinite(expires) || expires < now) return null
  const given = Buffer.from(signature)
  const message = linkMessage(threadId, participantId, epoch, expires)
  const valid = readKeys('link').some(key => {
    const expected = Buffer.from(b64(createHmac('sha256', key).update(message).digest()))
    return expected.length === given.length && timingSafeEqual(expected, given)
  })
  return valid ? { participantId, epoch } : null
}

/** Nom du cookie qui garde le lien d'un invité, fil par fil. */
export const guestCookieName = (threadId: string) => `tiroir_fil_${threadId}`
