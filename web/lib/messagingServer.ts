// Côté serveur de la messagerie. Les tables threads, thread_participants
// et thread_messages n'ont aucune politique RLS : tout passe par ici, avec
// la clé service, après que la route ou la page a établi QUI regarde
// (session vérifiée, ou lien signé d'un invité). Chaque lecture et chaque
// écriture commence par viewerParticipant() : sans place dans le fil, rien.
//
// Ce qui part vers le navigateur : des pseudos, le titre et la photo de la
// vente, les textes des messages. Dans un e-mail : un pseudo, le titre de
// la vente, un lien — jamais le texte d'un message. Jamais une adresse,
// nulle part. En base : messages et adresses d'invités chiffrés
// (lib/messagingCrypto.ts).
import type { IncomingMessage } from 'node:http'
import type { SupabaseClient } from '@supabase/supabase-js'
import { COPIES } from '../locales'
import { accountLocale } from './accountLocale'
import { localePrefix, type Locale } from './localeRouting'
import {
  everyoneCleared, excerpt, listingKey, pseudoKey, rateAllowed, unreadCount, viewerParticipant, visibleTo,
  type MessageRow, type ParticipantRow, type Viewer,
} from './messaging'
import {
  decryptBody, decryptEmail, emailHash, encryptBody, encryptEmail, guestCookieName, guestToken, ipHash, readGuestToken,
  type GuestPass,
} from './messagingCrypto'
import { renderNewLink, renderNewMessage, renderVerify } from './messagingEmails'
import { firstNameOf } from './suggestions'
import { loadAuthors } from './shareSuggestions'
import { sendEmail } from './ululeServer'

const FROM = 'Tiroir <hello@tiroir.app>'
const REPORT_TO = 'hello@tiroir.app'
const PARTICIPANT_COLUMNS =
  'id, thread_id, role, user_id, guest_name, guest_email, guest_verified_at, guest_link_epoch, locale, last_read_at, cleared_at'
const MESSAGE_COLUMNS = 'id, thread_id, author_id, body, delivered_at, created_at'

export type ThreadRow = { id: string; kind: 'annonce' | 'direct'; auction_id: string | null; last_message_at: string; reported_at: string | null }
type StoredMessage = MessageRow & { body: string }

// ── Requête ────────────────────────────────────────────────────────

/** Adresse du site telle que le visiteur l'a ouverte : les liens des e-mails y ramènent. */
export function originOf(req: IncomingMessage): string {
  const host = String(req.headers.host ?? 'tiroir.app')
  return `${isLocalHost(host) ? 'http' : 'https'}://${host}`
}

/** Poste local ou réseau privé (la préprod du NAS, http://192.168.…) : servi en http. */
export function isLocalHost(host: string): boolean {
  return /^(localhost|127\.|\[::1\]|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
}

export function clientIp(req: IncomingMessage): string | null {
  return String(req.headers['x-forwarded-for'] ?? '').split(',')[0]?.trim() || req.socket?.remoteAddress || null
}

function cookieFrom(header: string | undefined, name: string): string | null {
  for (const part of (header ?? '').split(';')) {
    const [k, ...rest] = part.split('=')
    if (k?.trim() === name) return decodeURIComponent(rest.join('=').trim())
  }
  return null
}

/** L'invité que le cookie de ce fil désigne (lien signé posé à l'ouverture), ou null. */
export function guestFromCookie(req: IncomingMessage, threadId: string): GuestPass | null {
  return readGuestToken(threadId, cookieFrom(req.headers.cookie, guestCookieName(threadId)))
}

// ── État de la base ────────────────────────────────────────────────

/**
 * Ce que le code lit et écrit : sans l'une de ces tables ou colonnes, la
 * vente ne propose pas « Contacter le vendeur » (un bouton qui échoue
 * serait pire qu'un bouton absent).
 */
export const MESSAGING_SCHEMA: Record<string, string> = {
  threads: 'id',
  thread_participants: 'id, guest_email_hash, guest_link_epoch, cleared_at',
  thread_messages: 'id',
  profiles: 'pseudo, pseudo_key',
}
/** Ancien nom, gardé pour les tests. */
export const MESSAGING_TABLES = Object.keys(MESSAGING_SCHEMA)

export async function messagingReady(admin: SupabaseClient): Promise<boolean> {
  // Une vraie lecture, pas une requête HEAD : pour une table absente, le
  // client Supabase transforme la réponse 404 d'un HEAD en succès sans
  // erreur, et le contrôle répondait « prête » sur une base vide.
  const checks = await Promise.all(Object.entries(MESSAGING_SCHEMA).map(([table, columns]) => admin.from(table).select(columns).limit(1)))
  return checks.every(c => !c.error)
}

/** Trace d'un échec de la base, avec l'étape : c'est ce qu'on lit dans les journaux de Vercel. */
function dbFailure(step: string, error?: { message?: string } | null): { ok: false; error: 'DB' } {
  console.error(`[messagerie] ${step}`, error?.message ?? '(aucune ligne)')
  return { ok: false, error: 'DB' }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function loadThread(admin: SupabaseClient, threadId: string): Promise<{ thread: ThreadRow; participants: ParticipantRow[] } | null> {
  if (!UUID.test(threadId)) return null
  const [{ data: thread }, { data: participants }] = await Promise.all([
    admin.from('threads').select('id, kind, auction_id, last_message_at, reported_at').eq('id', threadId).maybeSingle(),
    admin.from('thread_participants').select(PARTICIPANT_COLUMNS).eq('thread_id', threadId),
  ])
  if (!thread) return null
  return { thread: thread as ThreadRow, participants: (participants ?? []) as ParticipantRow[] }
}

// ── Pseudos ────────────────────────────────────────────────────────

export type Person = { name: string; avatarUrl: string | null }

/**
 * Le nom sous lequel chaque compte apparaît dans la messagerie : son
 * pseudo, ou à défaut le prénom de son profil (comptes qui n'ont pas
 * encore choisi de pseudo).
 */
export async function messagingNames(admin: SupabaseClient, userIds: string[]): Promise<Map<string, string>> {
  const ids = Array.from(new Set(userIds.filter(Boolean)))
  const out = new Map<string, string>()
  if (!ids.length) return out
  const { data } = await admin.from('profiles').select('id, pseudo, display_name').in('id', ids)
  for (const p of (data ?? []) as { id: string; pseudo: string | null; display_name: string | null }[]) {
    out.set(p.id, p.pseudo || firstNameOf(p.display_name))
  }
  return out
}

/** Le pseudo choisi par ce compte, ou null s'il n'en a pas encore. */
export async function pseudoOf(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await admin.from('profiles').select('pseudo').eq('id', userId).maybeSingle()
  return (data?.pseudo as string | null | undefined) ?? null
}

export type PseudoResult = { ok: true } | { ok: false; error: 'PSEUDO_TAKEN' | 'DB' }

/** Enregistre le pseudo d'un compte. L'unicité (sans tenir compte de la casse) est garantie par la base, sur pseudo_key. */
export async function setPseudo(admin: SupabaseClient, userId: string, pseudo: string): Promise<PseudoResult> {
  const { error } = await admin.from('profiles').update({ pseudo, pseudo_key: pseudoKey(pseudo) }).eq('id', userId)
  if (!error) return { ok: true }
  if (error.code === '23505' || /duplicate|unique/i.test(error.message)) return { ok: false, error: 'PSEUDO_TAKEN' }
  return dbFailure('pseudo', error)
}

async function loadPeople(admin: SupabaseClient, participants: ParticipantRow[]): Promise<Map<string, Person>> {
  const userIds = participants.flatMap(p => (p.user_id ? [p.user_id] : []))
  const [names, authors] = await Promise.all([messagingNames(admin, userIds), loadAuthors(admin, userIds)])
  return new Map(participants.map(p => [p.id, {
    name: p.user_id ? names.get(p.user_id) ?? '' : p.guest_name ?? '',
    avatarUrl: p.user_id ? authors.get(p.user_id)?.avatarUrl ?? null : null,
  }]))
}

// ── La vente rappelée en tête d'un fil ─────────────────────────────

export type ListingSummary = { token: string; title: string; photo: string | null; price: number; currency: string }

async function loadListings(admin: SupabaseClient, auctionIds: string[]): Promise<Map<string, ListingSummary>> {
  const out = new Map<string, ListingSummary>()
  const ids = Array.from(new Set(auctionIds))
  if (!ids.length) return out
  const [{ data: auctions }, { data: bids }] = await Promise.all([
    admin.from('auctions').select('id, user_id, token, title, object_ids, start_price, currency').in('id', ids),
    admin.from('auction_bids').select('auction_id, amount').in('auction_id', ids).limit(2000),
  ])
  const firstObject = new Map((auctions ?? []).map(a => [a.id as string, (a.object_ids as string[])[0]]))
  const objectIds = Array.from(new Set(Array.from(firstObject.values()).filter(Boolean)))
  const { data: images } = objectIds.length
    ? await admin.from('object_images').select('object_id, storage_path').in('object_id', objectIds).order('position')
    : { data: [] as { object_id: string; storage_path: string }[] }
  const pathByObject = new Map<string, string>()
  for (const i of images ?? []) if (!pathByObject.has(i.object_id)) pathByObject.set(i.object_id, i.storage_path)
  const signed = new Map<string, string>()
  if (pathByObject.size) {
    const { data } = await admin.storage.from('object-images').createSignedUrls(Array.from(pathByObject.values()), 3600)
    for (const s of data ?? []) if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl)
  }
  for (const a of auctions ?? []) {
    const top = Math.max(0, ...(bids ?? []).filter(b => b.auction_id === a.id).map(b => Number(b.amount)))
    const path = pathByObject.get(firstObject.get(a.id as string) ?? '')
    out.set(a.id as string, {
      token: a.token as string, title: a.title as string, currency: a.currency as string,
      price: top || Number(a.start_price), photo: path ? signed.get(path) ?? null : null,
    })
  }
  return out
}

// ── Limitation de débit ────────────────────────────────────────────

async function sendAllowed(
  admin: SupabaseClient, kind: 'guest' | 'member', who: { userId: string } | { emailHash: string } | { participantId: string }, ip: string | null,
): Promise<boolean> {
  const since = new Date(Date.now() - 3600_000).toISOString()
  let authorIds: string[]
  if ('participantId' in who) authorIds = [who.participantId]
  else {
    const query = admin.from('thread_participants').select('id').limit(500)
    const { data } = 'userId' in who ? await query.eq('user_id', who.userId) : await query.eq('guest_email_hash', who.emailHash)
    authorIds = (data ?? []).map(p => p.id as string)
  }
  const hash = ipHash(ip)
  const [byAuthor, byIp] = await Promise.all([
    authorIds.length
      ? admin.from('thread_messages').select('id', { count: 'exact', head: true }).in('author_id', authorIds).gt('created_at', since)
      : Promise.resolve({ count: 0 }),
    hash
      ? admin.from('thread_messages').select('id', { count: 'exact', head: true }).eq('ip_hash', hash).gt('created_at', since)
      : Promise.resolve({ count: 0 }),
  ])
  return rateAllowed(kind, { byAuthor: byAuthor.count ?? 0, byIp: byIp.count ?? 0 })
}

// ── E-mails ────────────────────────────────────────────────────────

const threadPath = (locale: Locale, threadId: string) => `${localePrefix(locale)}/messages/${threadId}`

/** Lien vers le fil ; pour un invité, il porte sa place, signée, de l'époque en cours. */
function threadLink(origin: string, locale: Locale, threadId: string, p: Pick<ParticipantRow, 'id' | 'user_id' | 'guest_link_epoch'>): string {
  const path = `${origin}${threadPath(locale, threadId)}`
  return p.user_id ? path : `${path}?k=${encodeURIComponent(guestToken(threadId, p.id, p.guest_link_epoch ?? 0))}`
}

/** Adresse et langue d'un participant. L'adresse ne sort jamais de ce fichier. */
async function contactOf(admin: SupabaseClient, p: ParticipantRow): Promise<{ email: string; locale: Locale } | null> {
  if (!p.user_id) {
    const email = decryptEmail(p.guest_email)
    return email ? { email, locale: accountLocale(p.locale) ?? 'fr' } : null
  }
  const { data } = await admin.auth.admin.getUserById(p.user_id)
  const email = data?.user?.email
  return email ? { email, locale: accountLocale(data.user?.user_metadata?.locale) ?? accountLocale(p.locale) ?? 'fr' } : null
}

async function threadTitle(admin: SupabaseClient, thread: ThreadRow): Promise<string> {
  if (!thread.auction_id) return 'Tiroir'
  const { data } = await admin.from('auctions').select('title').eq('id', thread.auction_id).maybeSingle()
  return (data?.title as string | undefined) ?? 'Tiroir'
}

/** Prévient les autres participants : pseudo de l'auteur, vente, lien vers le fil. Jamais le texte. */
async function notifyOthers(
  admin: SupabaseClient, origin: string, thread: ThreadRow, participants: ParticipantRow[], author: ParticipantRow,
): Promise<void> {
  const [people, title] = await Promise.all([loadPeople(admin, participants), threadTitle(admin, thread)])
  const from = people.get(author.id)?.name || '—'
  await Promise.all(participants.filter(p => p.id !== author.id).map(async p => {
    const contact = await contactOf(admin, p)
    if (!contact) return
    const result = await sendEmail({
      to: contact.email, from: FROM,
      email: renderNewMessage(COPIES[contact.locale].messages.email, contact.locale, {
        from, title, link: threadLink(origin, contact.locale, thread.id, p), personal: p.user_id === null,
      }),
    })
    if (!result.ok) console.error('[messagerie] notification', result.error)
  }))
}

// ── Écrire ─────────────────────────────────────────────────────────

async function insertMessage(
  admin: SupabaseClient, thread: ThreadRow, author: ParticipantRow, text: string, ip: string | null, delivered: boolean,
): Promise<boolean> {
  const now = new Date().toISOString()
  const { error } = await admin.from('thread_messages').insert({
    thread_id: thread.id, author_id: author.id, body: encryptBody(thread.id, text),
    delivered_at: delivered ? now : null, ip_hash: ipHash(ip),
  })
  if (error) {
    dbFailure('message', error)
    return false
  }
  if (delivered) {
    await Promise.all([
      admin.from('threads').update({ last_message_at: now }).eq('id', thread.id),
      // Écrire, c'est avoir lu ce qui précède.
      admin.from('thread_participants').update({ last_read_at: now }).eq('id', author.id),
    ])
  }
  return true
}

export type ContactError = 'OWN_LISTING' | 'RATE_LIMITED' | 'PSEUDO_REQUIRED' | 'PSEUDO_TAKEN' | 'DB'
export type ContactResult =
  | { ok: true; threadId: string; /** Sans compte : le message attend la confirmation de l'adresse. */ pending: boolean }
  | { ok: false; error: ContactError }

/**
 * « Contacter le vendeur » : crée le fil de cette vente pour cet acheteur,
 * ou rouvre celui qui existe (unicité : threads.dedupe_key), et y pose le
 * message. Avec un compte, il est remis aussitôt — un compte sans pseudo
 * doit en choisir un (`pseudo`), enregistré dans son profil. Sans compte,
 * le message attend que l'invité ouvre le lien reçu par e-mail — à chaque
 * fois : n'importe qui peut saisir l'adresse d'un autre dans le formulaire.
 */
export async function contactSeller(admin: SupabaseClient, input: {
  auction: { id: string; user_id: string; title: string }
  buyer: { userId: string; pseudo?: string | null } | { name: string; email: string }
  text: string
  locale: Locale
  ip: string | null
  origin: string
}): Promise<ContactResult> {
  const { auction, buyer, text, locale, ip, origin } = input
  const isMember = 'userId' in buyer
  if (isMember && buyer.userId === auction.user_id) return { ok: false, error: 'OWN_LISTING' }
  const hash = isMember ? null : emailHash(buyer.email)
  if (!(await sendAllowed(admin, isMember ? 'member' : 'guest', isMember ? { userId: buyer.userId } : { emailHash: hash! }, ip))) {
    return { ok: false, error: 'RATE_LIMITED' }
  }
  if (isMember && !(await pseudoOf(admin, buyer.userId))) {
    if (!buyer.pseudo) return { ok: false, error: 'PSEUDO_REQUIRED' }
    const saved = await setPseudo(admin, buyer.userId, buyer.pseudo)
    if (!saved.ok) return saved
  }

  const key = listingKey(auction.id, isMember ? { userId: buyer.userId } : { emailHash: hash! })
  // La contrainte d'unicité tranche si deux envois arrivent ensemble : le second retrouve le fil du premier.
  const created = await admin.from('threads').upsert({ kind: 'annonce', auction_id: auction.id, dedupe_key: key }, { onConflict: 'dedupe_key', ignoreDuplicates: true })
  if (created.error) return dbFailure('création du fil', created.error)
  const { data: row, error: rowError } = await admin.from('threads').select('id').eq('dedupe_key', key).maybeSingle()
  if (!row) return dbFailure('lecture du fil', rowError)
  const loaded = await loadThread(admin, row.id as string)
  if (!loaded) return dbFailure('chargement du fil')
  const { thread } = loaded
  let participants = loaded.participants

  if (!participants.some(p => p.role === 'seller')) {
    const added = await admin.from('thread_participants').upsert(
      { thread_id: thread.id, role: 'seller', user_id: auction.user_id },
      { onConflict: 'thread_id,user_id', ignoreDuplicates: true },
    )
    if (added.error) return dbFailure('participant vendeur', added.error)
  }
  let me = participants.find(p => p.role === 'buyer') ?? null
  if (!me) {
    const { data, error } = await admin.from('thread_participants').insert(
      isMember
        ? { thread_id: thread.id, role: 'buyer', user_id: buyer.userId, locale }
        : {
          thread_id: thread.id, role: 'buyer', locale,
          guest_name: buyer.name, guest_email: encryptEmail(buyer.email), guest_email_hash: hash,
        },
    ).select(PARTICIPANT_COLUMNS).single()
    if (error || !data) return dbFailure('participant acheteur', error)
    me = data as ParticipantRow
  }
  participants = (await loadThread(admin, thread.id))?.participants ?? participants

  if (!(await insertMessage(admin, thread, me, text, ip, isMember))) return { ok: false, error: 'DB' }

  if (isMember) {
    await notifyOthers(admin, origin, thread, participants, me)
    return { ok: true, threadId: thread.id, pending: false }
  }

  // Invité : rien n'est remis au vendeur avant qu'il ouvre ce lien.
  const people = await loadPeople(admin, participants)
  const seller = participants.find(p => p.role === 'seller')
  const sent = await sendEmail({
    to: buyer.email, from: FROM,
    email: renderVerify(COPIES[locale].messages.email, locale, {
      name: me.guest_name ?? buyer.name, seller: (seller && people.get(seller.id)?.name) || '—', title: auction.title,
      link: threadLink(origin, locale, thread.id, me),
    }),
  })
  if (!sent.ok) {
    console.error('[messagerie] vérification', sent.error)
    return { ok: false, error: 'DB' }
  }
  return { ok: true, threadId: thread.id, pending: true }
}

/**
 * L'invité a ouvert son lien : son adresse est confirmée, ses messages en
 * attente sont remis et le vendeur prévenu. Sans effet la deuxième fois
 * (la mise à jour ne prend que les messages encore en attente).
 */
export async function deliverPending(
  admin: SupabaseClient, origin: string, thread: ThreadRow, participants: ParticipantRow[], guest: ParticipantRow,
): Promise<number> {
  const now = new Date().toISOString()
  const { data } = await admin.from('thread_messages')
    .update({ delivered_at: now }).eq('thread_id', thread.id).eq('author_id', guest.id).is('delivered_at', null)
    .select(MESSAGE_COLUMNS)
  const delivered = (data ?? []) as StoredMessage[]
  if (!delivered.length) return 0
  await Promise.all([
    admin.from('threads').update({ last_message_at: now }).eq('id', thread.id),
    admin.from('thread_participants').update({ guest_verified_at: guest.guest_verified_at ?? now, last_read_at: now }).eq('id', guest.id),
  ])
  await notifyOthers(admin, origin, thread, participants, guest)
  return delivered.length
}

export type ReplyError = 'NOT_FOUND' | 'RATE_LIMITED' | 'DB'

/** Répondre dans un fil dont on est participant. */
export async function reply(
  admin: SupabaseClient, input: { threadId: string; viewer: Viewer; text: string; ip: string | null; origin: string },
): Promise<{ ok: true } | { ok: false; error: ReplyError }> {
  const loaded = await loadThread(admin, input.threadId)
  const me = loaded && viewerParticipant(loaded.participants, input.viewer)
  // Même réponse qu'un fil inconnu : rien à apprendre ici pour un tiers.
  if (!loaded || !me) return { ok: false, error: 'NOT_FOUND' }
  if (!(await sendAllowed(admin, 'member', { participantId: me.id }, input.ip))) return { ok: false, error: 'RATE_LIMITED' }
  if (!(await insertMessage(admin, loaded.thread, me, input.text, input.ip, true))) return { ok: false, error: 'DB' }
  await notifyOthers(admin, input.origin, loaded.thread, loaded.participants, me)
  return { ok: true }
}

/** « Signaler » : prévient l'équipe, sans le contenu des messages ni les adresses. */
export async function report(admin: SupabaseClient, input: { threadId: string; viewer: Viewer }): Promise<boolean> {
  const loaded = await loadThread(admin, input.threadId)
  const me = loaded && viewerParticipant(loaded.participants, input.viewer)
  if (!loaded || !me) return false
  await admin.from('threads').update({ reported_at: new Date().toISOString() }).eq('id', loaded.thread.id)
  const people = await loadPeople(admin, loaded.participants)
  const lines = [
    `Fil : ${loaded.thread.id}`,
    `Signalé par : ${people.get(me.id)?.name ?? '—'} (${me.role}, participant ${me.id})`,
    `Vente : ${loaded.thread.auction_id ?? '—'}`,
  ]
  const subject = `${COPIES.fr.messages.email.reportSubject} — ${loaded.thread.id}`
  const result = await sendEmail({
    to: REPORT_TO, from: FROM,
    email: { subject, text: lines.join('\n'), html: `<p>${lines.map(l => l.replace(/[<>&]/g, '')).join('<br>')}</p>` },
  })
  if (!result.ok) console.error('[messagerie] signalement', result.error)
  return result.ok
}

/**
 * « Supprimer la conversation » : ce participant ne voit plus rien de ce
 * qui précède. Quand tous l'ont supprimée depuis le dernier message, le fil
 * disparaît de la base. Un nouveau message la fait réapparaître, sans
 * l'historique supprimé.
 */
export async function clearThread(admin: SupabaseClient, input: { threadId: string; viewer: Viewer }): Promise<boolean> {
  const loaded = await loadThread(admin, input.threadId)
  const me = loaded && viewerParticipant(loaded.participants, input.viewer)
  if (!loaded || !me) return false
  const now = new Date().toISOString()
  const { error } = await admin.from('thread_participants').update({ cleared_at: now, last_read_at: now }).eq('id', me.id)
  if (error) {
    dbFailure('suppression', error)
    return false
  }
  const participants = loaded.participants.map(p => (p.id === me.id ? { ...p, cleared_at: now } : p))
  if (everyoneCleared(participants, loaded.thread.last_message_at)) {
    await admin.from('threads').delete().eq('id', loaded.thread.id)
  }
  return true
}

/**
 * Un invité bloque tous les liens déjà envoyés pour ce fil (e-mail
 * transféré, boîte partagée…) et en reçoit un neuf. Réservé à l'invité lui-même.
 */
export async function revokeGuestLinks(
  admin: SupabaseClient, input: { threadId: string; viewer: Viewer; origin: string },
): Promise<boolean> {
  const loaded = await loadThread(admin, input.threadId)
  const me = loaded && viewerParticipant(loaded.participants, { userId: null, guest: input.viewer.guest })
  if (!loaded || !me || me.user_id !== null) return false
  const epoch = (me.guest_link_epoch ?? 0) + 1
  const { error } = await admin.from('thread_participants').update({ guest_link_epoch: epoch }).eq('id', me.id).eq('guest_link_epoch', me.guest_link_epoch ?? 0)
  if (error) {
    dbFailure('révocation', error)
    return false
  }
  const contact = await contactOf(admin, me)
  if (!contact) return true
  const [people, title] = await Promise.all([loadPeople(admin, loaded.participants), threadTitle(admin, loaded.thread)])
  const other = loaded.participants.find(p => p.id !== me.id)
  const result = await sendEmail({
    to: contact.email, from: FROM,
    email: renderNewLink(COPIES[contact.locale].messages.email, contact.locale, {
      name: me.guest_name ?? '', other: (other && people.get(other.id)?.name) || '—', title,
      link: threadLink(input.origin, contact.locale, loaded.thread.id, { ...me, guest_link_epoch: epoch }),
    }),
  })
  if (!result.ok) console.error('[messagerie] nouveau lien', result.error)
  return true
}

// ── Lire ───────────────────────────────────────────────────────────

export type ThreadView = {
  id: string
  me: { name: string; isGuest: boolean }
  other: Person
  listing: ListingSummary | null
  reported: boolean
  /** `body` nul : message indéchiffrable (clé perdue). */
  messages: { id: string; body: string | null; at: string; mine: boolean }[]
}

/**
 * Le fil tel que ce visiteur a le droit de le voir, ou null s'il n'en est
 * pas participant. L'ouvrir le marque lu.
 */
export async function loadThreadView(admin: SupabaseClient, threadId: string, viewer: Viewer): Promise<ThreadView | null> {
  const loaded = await loadThread(admin, threadId)
  const me = loaded && viewerParticipant(loaded.participants, viewer)
  if (!loaded || !me) return null
  const { thread, participants } = loaded
  const [{ data: rows }, people, listings] = await Promise.all([
    admin.from('thread_messages').select(MESSAGE_COLUMNS).eq('thread_id', thread.id).not('delivered_at', 'is', null).order('created_at').limit(1000),
    loadPeople(admin, participants),
    loadListings(admin, thread.auction_id ? [thread.auction_id] : []),
  ])
  await admin.from('thread_participants').update({ last_read_at: new Date().toISOString() }).eq('id', me.id)
  const other = participants.find(p => p.id !== me.id)
  return {
    id: thread.id,
    me: { name: people.get(me.id)?.name ?? '', isGuest: me.user_id === null },
    other: (other && people.get(other.id)) || { name: '', avatarUrl: null },
    listing: thread.auction_id ? listings.get(thread.auction_id) ?? null : null,
    reported: thread.reported_at !== null,
    messages: ((rows ?? []) as StoredMessage[]).filter(m => visibleTo(m, me)).map(m => ({
      id: m.id, body: decryptBody(thread.id, m.body), at: m.delivered_at ?? m.created_at, mine: m.author_id === me.id,
    })),
  }
}

export type InboxItem = {
  id: string
  kind: 'annonce' | 'direct'
  other: Person
  listing: { title: string; photo: string | null } | null
  excerpt: string
  lastMine: boolean
  at: string
  unread: number
}

/** La boîte de réception d'un compte : ses fils, le plus récent d'abord. `ready` faux si la base n'a pas encore les tables. */
export async function listThreads(admin: SupabaseClient, userId: string): Promise<{ items: InboxItem[]; unread: number; ready: boolean }> {
  const { data: mine, error } = await admin.from('thread_participants').select(PARTICIPANT_COLUMNS).eq('user_id', userId).limit(200)
  if (error) return { items: [], unread: 0, ready: false }
  const me = new Map(((mine ?? []) as ParticipantRow[]).map(p => [p.thread_id, p]))
  const threadIds = Array.from(me.keys())
  if (!threadIds.length) return { items: [], unread: 0, ready: true }

  const [{ data: threads }, { data: allParticipants }, { data: rows }] = await Promise.all([
    admin.from('threads').select('id, kind, auction_id, last_message_at, reported_at').in('id', threadIds).order('last_message_at', { ascending: false }),
    admin.from('thread_participants').select(PARTICIPANT_COLUMNS).in('thread_id', threadIds),
    admin.from('thread_messages').select(MESSAGE_COLUMNS).in('thread_id', threadIds).not('delivered_at', 'is', null)
      .order('created_at', { ascending: false }).limit(2000),
  ])
  const participants = (allParticipants ?? []) as ParticipantRow[]
  const messages = (rows ?? []) as StoredMessage[]
  const [people, listings] = await Promise.all([
    loadPeople(admin, participants),
    loadListings(admin, ((threads ?? []) as ThreadRow[]).flatMap(t => (t.auction_id ? [t.auction_id] : []))),
  ])

  const items = ((threads ?? []) as ThreadRow[]).flatMap((t): InboxItem[] => {
    const self = me.get(t.id)
    if (!self) return []
    const inThread = messages.filter(m => m.thread_id === t.id && visibleTo(m, self))
    const last = inThread[0]
    // Rien de visible (invité non confirmé, ou conversation supprimée) : le fil n'apparaît pas.
    if (!last) return []
    const other = participants.find(p => p.thread_id === t.id && p.id !== self.id)
    const listing = t.auction_id ? listings.get(t.auction_id) : null
    return [{
      id: t.id, kind: t.kind,
      other: (other && people.get(other.id)) || { name: '', avatarUrl: null },
      listing: listing ? { title: listing.title, photo: listing.photo } : null,
      excerpt: excerpt(decryptBody(t.id, last.body) ?? ''),
      lastMine: last.author_id === self.id,
      at: last.delivered_at ?? last.created_at,
      unread: unreadCount(inThread, self),
    }]
  })
  return { items, unread: items.reduce((n, i) => n + i.unread, 0), ready: true }
}
