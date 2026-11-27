// Messagerie : chiffrement des messages et liens signés des invités.
// Serveur uniquement (node:crypto) : n'importer que depuis une route API ou
// un getServerSideProps.
//
// CHIFFREMENT. Le corps d'un message est chiffré par le site avant d'être
// écrit en base (AES-256-GCM), et lié à son fil : un texte recopié dans un
// autre fil ne se déchiffre pas. La base, ses sauvegardes et le tableau de
// bord Supabase ne contiennent donc jamais un message en clair. Ce n'est
// pas un chiffrement de bout en bout : le site déchiffre pour afficher le
// fil et pour l'e-mail de notification.
//
// Clé : MESSAGES_KEY (à poser sur Vercel) ; à défaut, dérivée de la clé
// service Supabase, déjà secrète et déjà présente. Attention : sans
// MESSAGES_KEY, faire tourner la clé service rend les anciens messages
// illisibles.
//
// LIEN D'INVITÉ. `<participant>.<expiration>.<signature>` : signé (HMAC),
// à durée limitée, lié à un seul fil et à une seule place dans ce fil.

import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

function secret(purpose: 'body' | 'link' | 'ip'): Buffer {
  const base = process.env.MESSAGES_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base) throw new Error('MESSAGES_KEY manquant')
  return createHmac('sha256', base).update(`tiroir-messagerie:${purpose}`).digest()
}

const b64 = (b: Buffer) => b.toString('base64url')

export function encryptBody(threadId: string, text: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', secret('body'), iv)
  cipher.setAAD(Buffer.from(threadId))
  const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  return `v1.${b64(iv)}.${b64(cipher.getAuthTag())}.${b64(data)}`
}

/** Le texte en clair, ou null si le message a été altéré, déplacé, ou si la clé a changé. */
export function decryptBody(threadId: string, stored: string): string | null {
  const [version, iv, tag, data] = stored.split('.')
  if (version !== 'v1' || !iv || !tag || data === undefined) return null
  try {
    const decipher = createDecipheriv('aes-256-gcm', secret('body'), Buffer.from(iv, 'base64url'))
    decipher.setAAD(Buffer.from(threadId))
    decipher.setAuthTag(Buffer.from(tag, 'base64url'))
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}

/** Durée de vie d'un lien d'invité. Chaque e-mail en porte un neuf. */
export const GUEST_LINK_TTL_MS = 30 * 24 * 3600 * 1000

const signLink = (threadId: string, participantId: string, expires: number) =>
  b64(createHmac('sha256', secret('link')).update(`${threadId}.${participantId}.${expires}`).digest())

export function guestToken(threadId: string, participantId: string, now = Date.now()): string {
  const expires = now + GUEST_LINK_TTL_MS
  return `${participantId}.${expires}.${signLink(threadId, participantId, expires)}`
}

/** L'identifiant du participant si le lien est valable POUR CE FIL, sinon null. */
export function readGuestToken(threadId: string, token: string | null | undefined, now = Date.now()): string | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [participantId, rawExpires, signature] = parts
  const expires = Number(rawExpires)
  if (!participantId || !Number.isFinite(expires) || expires < now) return null
  const expected = Buffer.from(signLink(threadId, participantId, expires))
  const given = Buffer.from(signature)
  return expected.length === given.length && timingSafeEqual(expected, given) ? participantId : null
}

/** Nom du cookie qui garde le lien d'un invité, fil par fil. */
export const guestCookieName = (threadId: string) => `tiroir_fil_${threadId}`

/** Empreinte d'une adresse IP : sert à compter, jamais à retrouver l'adresse. */
export function ipHash(ip: string | null | undefined): string | null {
  if (!ip) return null
  return createHash('sha256').update(secret('ip')).update(ip).digest('hex').slice(0, 32)
}
