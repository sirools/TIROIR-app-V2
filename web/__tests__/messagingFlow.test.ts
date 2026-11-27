// Les parcours de la messagerie de bout en bout, sur une base simulée en
// mémoire (mêmes contraintes d'unicité que la migration) et un Resend
// simulé : ce que reçoit chacun, ce qu'un tiers ne peut pas faire.
import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { RATE } from '../lib/messaging'
import { readGuestToken } from '../lib/messagingCrypto'
import { contactSeller, deliverPending, listThreads, loadThread, loadThreadView, messagingReady, reply, report } from '../lib/messagingServer'

type Row = Record<string, unknown>
const UNIQUE: Record<string, string[][]> = { threads: [['dedupe_key']], thread_participants: [['thread_id', 'user_id']] }
const DEFAULTS: Record<string, Row> = {
  threads: { reported_at: null },
  thread_participants: { user_id: null, guest_name: null, guest_email: null, guest_verified_at: null, locale: null, last_read_at: null },
  thread_messages: { delivered_at: null, ip_hash: null },
}

/** Ce qu'il faut du client Supabase pour lib/messagingServer.ts, en mémoire. */
function fakeDb(seed: Record<string, Row[]>, emails: Record<string, string>) {
  const tables: Record<string, Row[]> = { threads: [], thread_participants: [], thread_messages: [], auction_bids: [], object_images: [], ...seed }
  class Query {
    private filters: ((r: Row) => boolean)[] = []
    private op: 'select' | 'insert' | 'upsert' | 'update' = 'select'
    private payload: Row[] = []
    private patch: Row = {}
    private ignore = false
    private conflict: string[] = []
    private sort: { col: string; asc: boolean } | null = null
    private max = Infinity
    private head = false
    private one: 'single' | 'maybe' | null = null
    constructor(private table: string) {}
    select(_cols?: string, opts?: { head?: boolean }) { this.head = !!opts?.head; return this }
    insert(rows: Row | Row[]) { this.op = 'insert'; this.payload = ([] as Row[]).concat(rows); return this }
    upsert(rows: Row | Row[], opts: { onConflict: string; ignoreDuplicates?: boolean }) {
      this.op = 'upsert'; this.payload = ([] as Row[]).concat(rows); this.ignore = !!opts.ignoreDuplicates; this.conflict = opts.onConflict.split(','); return this
    }
    update(patch: Row) { this.op = 'update'; this.patch = patch; return this }
    eq(col: string, v: unknown) { this.filters.push(r => r[col] === v); return this }
    in(col: string, vs: unknown[]) { this.filters.push(r => vs.includes(r[col])); return this }
    is(col: string, v: null) { this.filters.push(r => r[col] === v); return this }
    not(col: string, _op: 'is', v: null) { this.filters.push(r => r[col] !== v); return this }
    gt(col: string, v: string) { this.filters.push(r => String(r[col]) > v); return this }
    order(col: string, opts?: { ascending?: boolean }) { this.sort = { col, asc: opts?.ascending !== false }; return this }
    limit(n: number) { this.max = n; return this }
    single() { this.one = 'single'; return this }
    maybeSingle() { this.one = 'maybe'; return this }
    private clash(row: Row, keys: string[]) {
      return tables[this.table].find(r => keys.every(k => r[k] !== null && r[k] !== undefined && r[k] === row[k]))
    }
    private run(): { data: unknown; error: { message: string } | null; count?: number } {
      const all = tables[this.table] ?? (tables[this.table] = [])
      let rows: Row[]
      if (this.op === 'insert' || this.op === 'upsert') {
        rows = []
        for (const input of this.payload) {
          const row: Row = { id: randomUUID(), created_at: new Date().toISOString(), last_message_at: new Date().toISOString(), ...DEFAULTS[this.table], ...input }
          const keys = this.op === 'upsert' ? [this.conflict] : UNIQUE[this.table] ?? []
          if (keys.some(k => this.clash(row, k))) {
            if (this.op === 'upsert' && this.ignore) continue
            return { data: null, error: { message: 'duplicate key value violates unique constraint' } }
          }
          all.push(row)
          rows.push(row)
        }
      } else {
        rows = all.filter(r => this.filters.every(f => f(r)))
        if (this.op === 'update') rows.forEach(r => Object.assign(r, this.patch))
      }
      if (this.sort) {
        const { col, asc } = this.sort
        rows = [...rows].sort((a, b) => String(a[col]).localeCompare(String(b[col])) * (asc ? 1 : -1))
      }
      if (this.head) return { data: null, error: null, count: rows.length }
      rows = rows.slice(0, this.max).map(r => ({ ...r }))
      if (this.one) return rows.length ? { data: rows[0], error: null } : { data: null, error: this.one === 'single' ? { message: 'no rows' } : null }
      return { data: rows, error: null }
    }
    then<T>(resolve: (v: ReturnType<Query['run']>) => T) { return Promise.resolve(this.run()).then(resolve) }
  }
  const client = {
    from: (table: string) => new Query(table),
    auth: { admin: { getUserById: async (id: string) => ({ data: { user: emails[id] ? { email: emails[id], user_metadata: {} } : null } }) } },
    storage: { from: () => ({ createSignedUrls: async () => ({ data: [] }) }) },
  }
  return { admin: client as unknown as SupabaseClient, tables }
}

const SELLER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const BUYER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const STRANGER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const AUCTION = { id: '33333333-3333-4333-8333-333333333333', user_id: SELLER, title: 'Kit de DJing' }
const ORIGIN = 'https://www.tiroir.app'
const SELLER_EMAIL = 'vendeur.prive@example.org'
const BUYER_EMAIL = 'acheteuse.privee@example.org'
const GUEST_EMAIL = 'lea.invitee@example.net'

type Sent = { to: string[]; from: string; subject: string; html: string; text: string }
let sent: Sent[]
let db: ReturnType<typeof fakeDb>
const guest = { name: 'Léa', email: GUEST_EMAIL }
const base = { auction: AUCTION, locale: 'fr' as const, ip: '203.0.113.7', origin: ORIGIN }
const tick = () => vi.advanceTimersByTime(60_000)
const linkIn = (mail: Sent) => /https:\/\/www\.tiroir\.app\/messages\/([0-9a-f-]+)\?k=([^\s"<]+)/.exec(mail.text)!

beforeEach(() => {
  vi.useFakeTimers({ now: new Date('2026-11-27T08:00:00Z'), toFake: ['Date'] })
  process.env.MESSAGES_KEY = 'cle-de-test'
  process.env.RESEND_API_KEY = 'test'
  sent = []
  vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
    sent.push(JSON.parse(init.body))
    return { ok: true, json: async () => ({ id: 'email' }) }
  })
  db = fakeDb({
    auctions: [{ ...AUCTION, token: '24953a59b49e', object_ids: ['o1'], start_price: 450, currency: 'EUR' }],
    profiles: [
      { id: SELLER, display_name: 'Clément Vendeur', avatar_path: null },
      { id: BUYER, display_name: 'Nora Acheteuse', avatar_path: null },
    ],
  }, { [SELLER]: SELLER_EMAIL, [BUYER]: BUYER_EMAIL })
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

/** L'invité ouvre le lien reçu : ce que fait pages/messages/[id].tsx. */
async function openLink(mail: Sent) {
  const [, threadId, key] = linkIn(mail)
  const participantId = readGuestToken(threadId, decodeURIComponent(key))!
  const loaded = (await loadThread(db.admin, threadId))!
  const me = loaded.participants.find(p => p.id === participantId)!
  const delivered = await deliverPending(db.admin, ORIGIN, loaded.thread, loaded.participants, me)
  return { threadId, participantId, delivered }
}

describe('messagerie : un visiteur sans compte écrit au vendeur', () => {
  test('rien n’arrive au vendeur avant la confirmation de l’adresse', async () => {
    const r = await contactSeller(db.admin, { ...base, buyer: guest, text: 'Toujours disponible ?' })
    expect(r).toMatchObject({ ok: true, pending: true })
    expect(sent).toHaveLength(1)
    expect(sent[0].to).toEqual([GUEST_EMAIL])
    expect(sent[0].subject).toBe('Confirme ton message à Clément')
    expect((await listThreads(db.admin, SELLER)).items).toHaveLength(0)
    // En base : chiffré, jamais le texte.
    expect(JSON.stringify(db.tables.thread_messages)).not.toContain('disponible')
  })

  test('le lien confirme : le vendeur reçoit le message, dans Tiroir et par e-mail, sans l’adresse de l’invité', async () => {
    await contactSeller(db.admin, { ...base, buyer: guest, text: 'Toujours disponible ?' })
    tick()
    const { threadId, delivered } = await openLink(sent[0])
    expect(delivered).toBe(1)
    const mail = sent[1]
    expect(mail.to).toEqual([SELLER_EMAIL])
    expect(mail.subject).toBe('Léa t’a écrit à propos de « Kit de DJing »')
    expect(mail.text).toContain('Toujours disponible ?')
    expect(mail.text).toContain(`${ORIGIN}/messages/${threadId}`)
    expect(mail.text).not.toContain('?k=')
    expect(mail.html + mail.text + mail.subject).not.toContain(GUEST_EMAIL)

    const inbox = await listThreads(db.admin, SELLER)
    expect(inbox.unread).toBe(1)
    expect(inbox.items[0]).toMatchObject({ id: threadId, excerpt: 'Toujours disponible ?', lastMine: false, other: { name: 'Léa' }, listing: { title: 'Kit de DJing' } })
    expect(JSON.stringify(inbox)).not.toContain(GUEST_EMAIL)

    // Rouvrir le lien (ou un antivirus qui le visite) ne renvoie rien.
    expect((await openLink(sent[0])).delivered).toBe(0)
    expect(sent).toHaveLength(2)
  })

  test('le vendeur lit (pastille à zéro), répond, et l’invité reçoit la réponse avec un lien pour continuer', async () => {
    await contactSeller(db.admin, { ...base, buyer: guest, text: 'Toujours disponible ?' })
    tick()
    const { threadId, participantId } = await openLink(sent[0])
    tick()
    const view = (await loadThreadView(db.admin, threadId, { userId: SELLER, guestParticipantId: null }))!
    expect(view.messages.map(m => [m.body, m.mine])).toEqual([['Toujours disponible ?', false]])
    expect(view.listing).toMatchObject({ token: '24953a59b49e', title: 'Kit de DJing', price: 450, currency: 'EUR' })
    expect(JSON.stringify(view)).not.toContain(GUEST_EMAIL)
    expect((await listThreads(db.admin, SELLER)).unread).toBe(0)

    tick()
    expect(await reply(db.admin, { threadId, viewer: { userId: SELLER, guestParticipantId: null }, text: 'Oui, passe quand tu veux.', ip: null, origin: ORIGIN })).toEqual({ ok: true })
    const mail = sent[2]
    expect(mail.to).toEqual([GUEST_EMAIL])
    expect(mail.subject).toBe('Clément t’a écrit à propos de « Kit de DJing »')
    expect(mail.text).toContain('Oui, passe quand tu veux.')
    expect(mail.html + mail.text + mail.subject).not.toContain(SELLER_EMAIL)
    const [, linkThread, key] = linkIn(mail)
    expect(linkThread).toBe(threadId)
    expect(readGuestToken(threadId, decodeURIComponent(key))).toBe(participantId)

    // L'invité poursuit le fil par son lien, sans compte.
    tick()
    const guestViewer = { userId: null, guestParticipantId: participantId }
    const asGuest = (await loadThreadView(db.admin, threadId, guestViewer))!
    expect(asGuest.me).toEqual({ name: 'Léa', isGuest: true })
    expect(asGuest.messages.map(m => m.mine)).toEqual([true, false])
    expect(JSON.stringify(asGuest)).not.toContain(SELLER_EMAIL)
    tick()
    expect(await reply(db.admin, { threadId, viewer: guestViewer, text: 'Samedi ?', ip: '203.0.113.7', origin: ORIGIN })).toEqual({ ok: true })
    expect(sent[3].to).toEqual([SELLER_EMAIL])
    expect((await listThreads(db.admin, SELLER)).unread).toBe(1)
  })

  test('un deuxième message du même invité sur la même vente rouvre le même fil', async () => {
    await contactSeller(db.admin, { ...base, buyer: guest, text: 'Un' })
    tick()
    await contactSeller(db.admin, { ...base, buyer: { name: 'Léa', email: GUEST_EMAIL }, text: 'Deux' })
    expect(db.tables.threads).toHaveLength(1)
    expect(db.tables.thread_participants).toHaveLength(2)
    // Un autre invité : un autre fil.
    await contactSeller(db.admin, { ...base, buyer: { name: 'Léo', email: 'leo@example.net' }, text: 'Trois' })
    expect(db.tables.threads).toHaveLength(2)
  })

  test('débit : au-delà du plafond par adresse, l’envoi est refusé et aucun e-mail ne part', async () => {
    for (let i = 0; i < RATE.guestPerEmail; i++) expect((await contactSeller(db.admin, { ...base, buyer: guest, text: `n° ${i}` })).ok).toBe(true)
    const before = sent.length
    expect(await contactSeller(db.admin, { ...base, buyer: guest, text: 'encore' })).toEqual({ ok: false, error: 'RATE_LIMITED' })
    expect(sent).toHaveLength(before)
    // Une heure plus tard, c'est de nouveau permis.
    vi.advanceTimersByTime(3601_000)
    expect((await contactSeller(db.admin, { ...base, buyer: guest, text: 'plus tard' })).ok).toBe(true)
  })
})

describe('messagerie : un compte écrit au vendeur', () => {
  test('sans ressaisir ses coordonnées, remis aussitôt, et un seul fil par vente', async () => {
    const first = await contactSeller(db.admin, { ...base, buyer: { userId: BUYER }, text: 'Bonjour' })
    expect(first).toMatchObject({ ok: true, pending: false })
    expect(sent).toHaveLength(1)
    expect(sent[0].to).toEqual([SELLER_EMAIL])
    expect(sent[0].subject).toBe('Nora t’a écrit à propos de « Kit de DJing »')
    expect(sent[0].html + sent[0].text).not.toContain(BUYER_EMAIL)
    tick()
    const second = await contactSeller(db.admin, { ...base, buyer: { userId: BUYER }, text: 'Encore moi' })
    expect(second).toMatchObject({ ok: true, threadId: (first as { threadId: string }).threadId })
    expect(db.tables.threads).toHaveLength(1)
    expect((await listThreads(db.admin, SELLER)).unread).toBe(2)
    // L'acheteur retrouve aussi le fil dans sa boîte.
    expect((await listThreads(db.admin, BUYER)).items).toHaveLength(1)
  })
  test('le vendeur ne peut pas s’écrire sur sa propre vente', async () => {
    expect(await contactSeller(db.admin, { ...base, buyer: { userId: SELLER }, text: 'Moi-même' })).toEqual({ ok: false, error: 'OWN_LISTING' })
    expect(db.tables.threads).toHaveLength(0)
  })
})

describe('messagerie : base pas encore migrée', () => {
  const missing = { data: null, error: { message: 'relation "public.threads" does not exist' }, count: null }
  const chain: Record<string, unknown> = { then: (resolve: (v: typeof missing) => unknown) => Promise.resolve(missing).then(resolve) }
  for (const m of ['select', 'eq', 'in', 'limit', 'order', 'not']) chain[m] = () => chain
  const unmigrated = { from: () => chain } as unknown as SupabaseClient
  test('la vente ne propose pas le contact, et la boîte de réception reste vide sans planter', async () => {
    expect(await messagingReady(unmigrated)).toBe(false)
    expect(await messagingReady(db.admin)).toBe(true)
    expect(await listThreads(unmigrated, SELLER)).toEqual({ items: [], unread: 0, ready: false })
  })
})

describe('messagerie : un tiers', () => {
  test('ne lit pas, n’écrit pas et ne signale pas, même avec l’identifiant du fil', async () => {
    const r = await contactSeller(db.admin, { ...base, buyer: { userId: BUYER }, text: 'Bonjour' })
    const threadId = (r as { threadId: string }).threadId
    const stranger = { userId: STRANGER, guestParticipantId: null }
    expect(await loadThreadView(db.admin, threadId, stranger)).toBeNull()
    expect(await reply(db.admin, { threadId, viewer: stranger, text: 'Coucou', ip: null, origin: ORIGIN })).toEqual({ ok: false, error: 'NOT_FOUND' })
    expect(await report(db.admin, { threadId, viewer: stranger })).toBe(false)
    expect(await loadThreadView(db.admin, threadId, { userId: null, guestParticipantId: null })).toBeNull()
    expect(db.tables.thread_messages).toHaveLength(1)
    expect((await listThreads(db.admin, STRANGER)).items).toHaveLength(0)
    // Le lien d'un invité d'un autre fil n'ouvre pas celui-ci.
    await contactSeller(db.admin, { ...base, buyer: guest, text: 'Autre fil' })
    const { participantId } = await openLink(sent[sent.length - 1])
    expect(await loadThreadView(db.admin, threadId, { userId: null, guestParticipantId: participantId })).toBeNull()
  })
  test('« Signaler » écrit à l’équipe, sans le contenu ni les adresses', async () => {
    const r = await contactSeller(db.admin, { ...base, buyer: { userId: BUYER }, text: 'Texte privé' })
    const threadId = (r as { threadId: string }).threadId
    expect(await report(db.admin, { threadId, viewer: { userId: SELLER, guestParticipantId: null } })).toBe(true)
    const mail = sent[sent.length - 1]
    expect(mail.to).toEqual(['hello@tiroir.app'])
    expect(mail.text).toContain(threadId)
    expect(mail.text).not.toContain('Texte privé')
    expect(mail.text).not.toContain(BUYER_EMAIL)
  })
})
