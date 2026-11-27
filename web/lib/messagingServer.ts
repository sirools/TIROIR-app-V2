// Côté serveur de la messagerie. Les tables threads, thread_participants
// et thread_messages n'ont aucune politique RLS : tout passe par ici, avec
// la clé service, après que la route ou la page a établi QUI regarde
// (session vérifiée, ou lien signé d'un invité). Chaque lecture et chaque
// écriture commence par viewerParticipant() : sans place dans le fil, rien.
//
// Ce qui part vers le navigateur ou dans un e-mail : des prénoms, le titre
// et la photo de la vente, les textes des messages. Jamais une adresse.
import type { IncomingMessage } from 'node:http'
import type { SupabaseClient } from '@supabase/supabase-js'
import { COPIES } from '../locales'
import { accountLocale } from './accountLocale'
import { localePrefix, type Locale } from './localeRouting'
import {
  excerpt, listingKey, rateAllowed, unreadCount, viewerParticipant,
  type MessageRow, type ParticipantRow, type Viewer,
} from './messaging'
import { decryptBody, encryptBody, guestCookieName, guestToken, ipHash, readGuestToken } from './messagingCrypto'
import { renderNewMessage, renderVerify } from './messagingEmails'
import { loadAuthors } from './shareSuggestions'
import { sendEmail } from './ululeServer'

const FROM = 'Tiroir <hello@tiroir.app>'
const REPORT_TO = 'hello@tiroir.app'
const PARTICIPANT_COLUMNS = 'id, thread_id, role, user_id, guest_name, guest_email, guest_verified_at, locale, last_read_at'
const MESSAGE_COLUMNS = 'id, thread_id, author_id, body, delivered_at, created_at'

export type ThreadRow = { id: string; kind: 'annonce' | 'direct'; auction_id: string | null; last_message_at: string; reported_at: string | null }
type StoredMessage = MessageRow & { body: string }

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
export function guestFromCookie(req: IncomingMessage, threadId: string): string | null {
  return readGuestToken(threadId, cookieFrom(req.headers.cookie, guestCookieName(threadId)))
}

/**
 * La base a-t-elle les tables de la messagerie ? Tant que la migration
 * n'est pas appliquée, la vente ne propose pas « Contacter le vendeur » :
 * un bouton qui échoue serait pire qu'un bouton absent.
 */
export async function messagingReady(admin: SupabaseClient): Promise<boolean> {
  const { error } = await admin.from('threads').select('id', { count: 'exact', head: true }).limit(1)
  return !error
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

// ── Qui est qui ────────────────────────────────────────────────────

export type Person = { name: string; avatarUrl: string | null }

async function loadPeople(admin: SupabaseClient, participants: ParticipantRow[]): Promise<Map<string, Person>> {
  const authors = await loadAuthors(admin, participants.flatMap(p => (p.user_id ? [p.user_id] : [])))
  return new Map(participants.map(p => {
    const a = p.user_id ? authors.get(p.user_id) : null
    return [p.id, { name: p.user_id ? a?.firstName ?? '' : p.guest_name ?? '', avatarUrl: a?.avatarUrl ?? null }]
  }))
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
  admin: SupabaseClient, kind: 'guest' | 'member', who: { userId: string } | { email: string } | { participantId: string }, ip: string | null,
): Promise<boolean> {
  const since = new Date(Date.now() - 3600_000).toISOString()
  let authorIds: string[]
  if ('participantId' in who) authorIds = [who.participantId]
  else {
    const query = admin.from('thread_participants').select('id').limit(500)
    const { data } = 'userId' in who ? await query.eq('user_id', who.userId) : await query.eq('guest_email', who.email)
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

/** Adresse et langue d'un participant. L'adresse ne sort jamais de ce fichier. */
async function contactOf(admin: SupabaseClient, p: ParticipantRow): Promise<{ email: string; locale: Locale } | null> {
  if (!p.user_id) return p.guest_email ? { email: p.guest_email, locale: accountLocale(p.locale) ?? 'fr' } : null
  const { data } = await admin.auth.admin.getUserById(p.user_id)
  const email = data?.user?.email
  return email ? { email, locale: accountLocale(data.user?.user_metadata?.locale) ?? accountLocale(p.locale) ?? 'fr' } : null
}

async function threadTitle(admin: SupabaseClient, thread: ThreadRow): Promise<string> {
  if (!thread.auction_id) return 'Tiroir'
  const { data } = await admin.from('auctions').select('title').eq('id', thread.auction_id).maybeSingle()
  return (data?.title as string | undefined) ?? 'Tiroir'
}

/** Prévient les autres participants : prénom de l'auteur, vente, texte, lien vers le fil. */
async function notifyOthers(
  admin: SupabaseClient, origin: string, thread: ThreadRow, participants: ParticipantRow[], author: ParticipantRow, text: string,
): Promise<void> {
  const [people, title] = await Promise.all([loadPeople(admin, participants), threadTitle(admin, thread)])
  const from = people.get(author.id)?.name || '—'
  await Promise.all(participants.filter(p => p.id !== author.id).map(async p => {
    const contact = await contactOf(admin, p)
    if (!contact) return
    const path = threadPath(contact.locale, thread.id)
    // Un invité n'a pas de session : son lien porte sa place dans le fil, signée.
    const link = p.user_id ? `${origin}${path}` : `${origin}${path}?k=${encodeURIComponent(guestToken(thread.id, p.id))}`
    const result = await sendEmail({
      to: contact.email, from: FROM,
      email: renderNewMessage(COPIES[contact.locale].messages.email, contact.locale, { from, title, text, link }),
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
    console.error('[messagerie] message', error.message)
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

export type ContactError = 'OWN_LISTING' | 'RATE_LIMITED' | 'DB'
export type ContactResult =
  | { ok: true; threadId: string; /** Sans compte : le message attend la confirmation de l'adresse. */ pending: boolean }
  | { ok: false; error: ContactError }

/**
 * « Contacter le vendeur » : crée le fil de cette vente pour cet acheteur,
 * ou rouvre celui qui existe (unicité : threads.dedupe_key), et y pose le
 * message. Avec un compte, il est remis aussitôt. Sans compte, il attend
 * que l'invité ouvre le lien reçu par e-mail — à chaque fois : n'importe
 * qui peut saisir l'adresse d'un autre dans le formulaire.
 */
export async function contactSeller(admin: SupabaseClient, input: {
  auction: { id: string; user_id: string; title: string }
  buyer: { userId: string } | { name: string; email: string }
  text: string
  locale: Locale
  ip: string | null
  origin: string
}): Promise<ContactResult> {
  const { auction, buyer, text, locale, ip, origin } = input
  const isMember = 'userId' in buyer
  if (isMember && buyer.userId === auction.user_id) return { ok: false, error: 'OWN_LISTING' }
  if (!(await sendAllowed(admin, isMember ? 'member' : 'guest', isMember ? { userId: buyer.userId } : { email: buyer.email }, ip))) {
    return { ok: false, error: 'RATE_LIMITED' }
  }

  const key = listingKey(auction.id, buyer)
  // La contrainte d'unicité tranche si deux envois arrivent ensemble : le second retrouve le fil du premier.
  await admin.from('threads').upsert({ kind: 'annonce', auction_id: auction.id, dedupe_key: key }, { onConflict: 'dedupe_key', ignoreDuplicates: true })
  const { data: row } = await admin.from('threads').select('id').eq('dedupe_key', key).maybeSingle()
  if (!row) return { ok: false, error: 'DB' }
  const loaded = await loadThread(admin, row.id as string)
  if (!loaded) return { ok: false, error: 'DB' }
  const { thread } = loaded
  let participants = loaded.participants

  if (!participants.some(p => p.role === 'seller')) {
    await admin.from('thread_participants').upsert(
      { thread_id: thread.id, role: 'seller', user_id: auction.user_id },
      { onConflict: 'thread_id,user_id', ignoreDuplicates: true },
    )
  }
  let me = participants.find(p => p.role === 'buyer') ?? null
  if (!me) {
    const { data, error } = await admin.from('thread_participants').insert(
      isMember
        ? { thread_id: thread.id, role: 'buyer', user_id: buyer.userId, locale }
        : { thread_id: thread.id, role: 'buyer', guest_name: buyer.name, guest_email: buyer.email, locale },
    ).select(PARTICIPANT_COLUMNS).single()
    if (error || !data) {
      console.error('[messagerie] participant', error?.message)
      return { ok: false, error: 'DB' }
    }
    me = data as ParticipantRow
  }
  participants = (await loadThread(admin, thread.id))?.participants ?? participants

  if (!(await insertMessage(admin, thread, me, text, ip, isMember))) return { ok: false, error: 'DB' }

  if (isMember) {
    await notifyOthers(admin, origin, thread, participants, me, text)
    return { ok: true, threadId: thread.id, pending: false }
  }

  // Invité : rien n'est remis au vendeur avant qu'il ouvre ce lien.
  const people = await loadPeople(admin, participants)
  const seller = participants.find(p => p.role === 'seller')
  const link = `${origin}${threadPath(locale, thread.id)}?k=${encodeURIComponent(guestToken(thread.id, me.id))}`
  const sent = await sendEmail({
    to: buyer.email, from: FROM,
    email: renderVerify(COPIES[locale].messages.email, locale, {
      name: me.guest_name ?? buyer.name, seller: (seller && people.get(seller.id)?.name) || '—', title: auction.title, text, link,
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
  const delivered = ((data ?? []) as StoredMessage[]).sort((a, b) => a.created_at.localeCompare(b.created_at))
  if (!delivered.length) return 0
  await Promise.all([
    admin.from('threads').update({ last_message_at: now }).eq('id', thread.id),
    admin.from('thread_participants').update({ guest_verified_at: guest.guest_verified_at ?? now, last_read_at: now }).eq('id', guest.id),
  ])
  const text = delivered.flatMap(m => decryptBody(thread.id, m.body) ?? []).join('\n\n')
  if (text) await notifyOthers(admin, origin, thread, participants, guest, text)
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
  await notifyOthers(admin, input.origin, loaded.thread, loaded.participants, me, input.text)
  return { ok: true }
}

/** « Signaler » : prévient l'équipe, sans le contenu des messages. */
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
    email: { subject, text: lines.join('\n'), html: `<p>${lines.join('<br>')}</p>` },
  })
  if (!result.ok) console.error('[messagerie] signalement', result.error)
  return result.ok
}

// ── Lire ───────────────────────────────────────────────────────────

export type ThreadView = {
  id: string
  me: { name: string; isGuest: boolean }
  other: Person
  listing: ListingSummary | null
  reported: boolean
  /** `body` nul : message indéchiffrable (clé changée). */
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
    messages: ((rows ?? []) as StoredMessage[]).map(m => ({
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
    const inThread = messages.filter(m => m.thread_id === t.id)
    const last = inThread[0]
    // Un fil dont rien n'a encore été remis (invité non confirmé) n'apparaît pas.
    if (!self || !last) return []
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
