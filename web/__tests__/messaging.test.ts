import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, test } from 'vitest'
import {
  BODY_MAX, directKey, excerpt, listingKey, parseBody, parseEmail, parseGuestName, rateAllowed, RATE, unreadCount,
  viewerParticipant, type MessageRow, type ParticipantRow,
} from '../lib/messaging'
import { decryptBody, encryptBody, GUEST_LINK_TTL_MS, guestToken, ipHash, readGuestToken } from '../lib/messagingCrypto'
import { EMAIL_COLORS, renderNewMessage, renderVerify } from '../lib/messagingEmails'
import fr from '../locales/fr'

const THREAD = '11111111-1111-4111-8111-111111111111'
const OTHER_THREAD = '22222222-2222-4222-8222-222222222222'
const AUCTION = '33333333-3333-4333-8333-333333333333'
const SELLER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const BUYER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const STRANGER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

const participant = (over: Partial<ParticipantRow>): ParticipantRow => ({
  id: 'p', thread_id: THREAD, role: 'buyer', user_id: null, guest_name: null, guest_email: null,
  guest_verified_at: null, locale: 'fr', last_read_at: null, ...over,
})
const seller = participant({ id: 'p-seller', role: 'seller', user_id: SELLER })
const guest = participant({ id: 'p-guest', guest_name: 'Léa', guest_email: 'lea@example.com' })
const member = participant({ id: 'p-member', user_id: BUYER })

beforeAll(() => { process.env.MESSAGES_KEY = 'cle-de-test' })

describe('messagerie : droits d’accès', () => {
  test('un compte n’entre que dans les fils où il a une place', () => {
    expect(viewerParticipant([seller, guest], { userId: SELLER, guestParticipantId: null })).toBe(seller)
    expect(viewerParticipant([seller, member], { userId: BUYER, guestParticipantId: null })).toBe(member)
  })
  test('un tiers connecté n’entre pas, même avec l’adresse du fil', () => {
    expect(viewerParticipant([seller, guest], { userId: STRANGER, guestParticipantId: null })).toBeNull()
    expect(viewerParticipant([seller, member], { userId: STRANGER, guestParticipantId: null })).toBeNull()
  })
  test('un visiteur sans session ni lien n’entre pas', () => {
    expect(viewerParticipant([seller, guest], { userId: null, guestParticipantId: null })).toBeNull()
  })
  test('le lien d’un invité ouvre sa place, jamais celle d’un compte', () => {
    expect(viewerParticipant([seller, guest], { userId: null, guestParticipantId: 'p-guest' })).toBe(guest)
    expect(viewerParticipant([seller, guest], { userId: null, guestParticipantId: 'p-seller' })).toBeNull()
    expect(viewerParticipant([seller, guest], { userId: null, guestParticipantId: 'inconnu' })).toBeNull()
  })
  test('un tiers connecté qui tient le lien d’un invité lit en tant qu’invité, pas plus', () => {
    expect(viewerParticipant([seller, guest], { userId: STRANGER, guestParticipantId: 'p-guest' })).toBe(guest)
  })

  test('lien d’invité : signé, lié à un seul fil, à durée limitée', () => {
    const now = Date.parse('2026-11-27T08:00:00Z')
    const token = guestToken(THREAD, 'p-guest', now)
    expect(readGuestToken(THREAD, token, now)).toBe('p-guest')
    // Le même lien ne vaut rien pour un autre fil.
    expect(readGuestToken(OTHER_THREAD, token, now)).toBeNull()
    // Passé trente jours, il ne vaut plus rien.
    expect(readGuestToken(THREAD, token, now + GUEST_LINK_TTL_MS + 1)).toBeNull()
    // Changer de participant ou allonger la durée casse la signature.
    const [, expires, signature] = token.split('.')
    expect(readGuestToken(THREAD, `p-seller.${expires}.${signature}`, now)).toBeNull()
    expect(readGuestToken(THREAD, `p-guest.${Number(expires) + 1000}.${signature}`, now)).toBeNull()
    for (const bad of [null, '', 'p-guest', 'a.b.c', `p-guest.${expires}.`]) expect(readGuestToken(THREAD, bad, now)).toBeNull()
  })
  test('la clé du lien n’est pas celle d’un autre déploiement', () => {
    const token = guestToken(THREAD, 'p-guest')
    process.env.MESSAGES_KEY = 'autre-cle'
    expect(readGuestToken(THREAD, token)).toBeNull()
    process.env.MESSAGES_KEY = 'cle-de-test'
    expect(readGuestToken(THREAD, token)).toBe('p-guest')
  })
})

describe('messagerie : une seule conversation par vente et par acheteur', () => {
  test('même vente, même acheteur : la même clé, donc le même fil', () => {
    expect(listingKey(AUCTION, { userId: BUYER })).toBe(listingKey(AUCTION, { userId: BUYER }))
    expect(listingKey(AUCTION, { email: 'Lea@Example.com ' })).toBe(listingKey(AUCTION, { email: 'lea@example.com' }))
  })
  test('autre acheteur ou autre vente : un autre fil', () => {
    expect(listingKey(AUCTION, { userId: BUYER })).not.toBe(listingKey(AUCTION, { userId: STRANGER }))
    expect(listingKey(AUCTION, { userId: BUYER })).not.toBe(listingKey(OTHER_THREAD, { userId: BUYER }))
    expect(listingKey(AUCTION, { email: 'lea@example.com' })).not.toBe(listingKey(AUCTION, { email: 'leo@example.com' }))
    // Un compte et un invité ne se confondent jamais, quel que soit ce que l'invité saisit.
    expect(listingKey(AUCTION, { email: BUYER })).not.toBe(listingKey(AUCTION, { userId: BUYER }))
  })
  test('phase 2 : un fil direct par paire de membres, dans les deux sens', () => {
    expect(directKey(SELLER, BUYER)).toBe(directKey(BUYER, SELLER))
    expect(directKey(SELLER, BUYER)).not.toBe(directKey(SELLER, STRANGER))
  })
  test('la base impose l’unicité, et ferme les tables à la clé publique', () => {
    const dir = join(__dirname, '../../supabase/migrations')
    const sql = readFileSync(join(dir, require('node:fs').readdirSync(dir).find((f: string) => f.endsWith('_messagerie.sql'))), 'utf8')
    expect(sql).toMatch(/CONSTRAINT threads_dedupe_key_key UNIQUE \(dedupe_key\)/)
    expect(sql).toMatch(/kind = 'direct' AND auction_id IS NULL/)
    for (const table of ['threads', 'thread_participants', 'thread_messages']) {
      expect(sql).toContain(`ALTER TABLE public.${table}`)
    }
    expect(sql.match(/ENABLE ROW LEVEL SECURITY/g)).toHaveLength(3)
    expect(sql).toMatch(/REVOKE ALL ON public\.threads, public\.thread_participants, public\.thread_messages FROM anon, authenticated/)
    expect(sql).not.toMatch(/CREATE POLICY/)
  })
})

describe('messagerie : chiffrement', () => {
  test('le texte stocké n’est pas lisible, et se déchiffre dans son fil', () => {
    const text = 'Bonjour, le kit de DJing est-il toujours disponible ? 🎧'
    const stored = encryptBody(THREAD, text)
    expect(stored).toMatch(/^v1\./)
    expect(stored).not.toContain('Bonjour')
    expect(decryptBody(THREAD, stored)).toBe(text)
    // Deux chiffrements du même texte ne se ressemblent pas.
    expect(encryptBody(THREAD, text)).not.toBe(stored)
  })
  test('recopié dans un autre fil, altéré, ou sans la bonne clé : illisible', () => {
    const stored = encryptBody(THREAD, 'secret')
    expect(decryptBody(OTHER_THREAD, stored)).toBeNull()
    const parts = stored.split('.')
    expect(decryptBody(THREAD, [parts[0], parts[1], parts[2], `${parts[3]}AA`].join('.'))).toBeNull()
    expect(decryptBody(THREAD, 'secret')).toBeNull()
    process.env.MESSAGES_KEY = 'autre-cle'
    expect(decryptBody(THREAD, stored)).toBeNull()
    process.env.MESSAGES_KEY = 'cle-de-test'
  })
  test('le texte le plus long tient dans la colonne (12 000 caractères)', () => {
    expect(encryptBody(THREAD, '€'.repeat(BODY_MAX)).length).toBeLessThanOrEqual(12000)
  })
  test('empreinte d’IP : stable, et sans l’adresse', () => {
    expect(ipHash('203.0.113.7')).toBe(ipHash('203.0.113.7'))
    expect(ipHash('203.0.113.7')).not.toContain('203')
    expect(ipHash(null)).toBeNull()
  })
})

describe('messagerie : saisie et anti-abus', () => {
  test('corps : texte brut, 2000 caractères au plus', () => {
    expect(parseBody('  Bonjour\r\n\n\n\nMerci  ')).toBe('Bonjour\n\nMerci')
    expect(parseBody('a'.repeat(BODY_MAX))).toHaveLength(BODY_MAX)
    expect(parseBody('a'.repeat(BODY_MAX + 1))).toBeNull()
    expect(parseBody('   ')).toBeNull()
    expect(parseBody(42)).toBeNull()
  })
  test('prénom d’un invité : ni adresse ni lien', () => {
    expect(parseGuestName('  Léa   Martin ')).toBe('Léa Martin')
    for (const bad of ['', 'x'.repeat(61), 'lea@example.com', 'voir https://spam.example', 'www.spam.example', '<b>Léa</b>', null]) {
      expect(parseGuestName(bad)).toBeNull()
    }
  })
  test('adresse d’un invité', () => {
    expect(parseEmail(' Lea@Example.COM ')).toBe('lea@example.com')
    for (const bad of ['lea', 'lea@', 'lea@example', 'a b@example.com', '', undefined]) expect(parseEmail(bad)).toBeNull()
  })
  test('débit : formulaire sans compte, par IP et par adresse', () => {
    expect(rateAllowed('guest', { byIp: 0, byAuthor: 0 })).toBe(true)
    expect(rateAllowed('guest', { byIp: RATE.guestPerIp, byAuthor: 0 })).toBe(false)
    expect(rateAllowed('guest', { byIp: 0, byAuthor: RATE.guestPerEmail })).toBe(false)
    expect(rateAllowed('member', { byIp: 10, byAuthor: RATE.memberPerHour - 1 })).toBe(true)
    expect(rateAllowed('member', { byIp: 0, byAuthor: RATE.memberPerHour })).toBe(false)
  })
})

describe('messagerie : non-lus et boîte de réception', () => {
  const msg = (id: string, author: string, at: string | null): MessageRow =>
    ({ id, thread_id: THREAD, author_id: author, delivered_at: at, created_at: at ?? '2026-11-27T08:00:00Z' })
  const messages = [
    msg('1', 'p-guest', '2026-11-27T08:00:00Z'),
    msg('2', 'p-seller', '2026-11-27T08:05:00Z'),
    msg('3', 'p-guest', '2026-11-27T08:10:00Z'),
    msg('4', 'p-guest', null),
  ]
  test('comptent les messages remis par l’autre depuis la dernière lecture', () => {
    expect(unreadCount(messages, { id: 'p-seller', last_read_at: null })).toBe(2)
    expect(unreadCount(messages, { id: 'p-seller', last_read_at: '2026-11-27T08:06:00Z' })).toBe(1)
    expect(unreadCount(messages, { id: 'p-guest', last_read_at: null })).toBe(1)
  })
  test('la lecture remet la pastille à zéro', () => {
    expect(unreadCount(messages, { id: 'p-seller', last_read_at: '2026-11-27T08:10:01Z' })).toBe(0)
  })
  test('un message en attente de confirmation ne compte pas', () => {
    expect(unreadCount([msg('4', 'p-guest', null)], { id: 'p-seller', last_read_at: null })).toBe(0)
  })
  test('extrait : une ligne, raccourcie', () => {
    expect(excerpt('Bonjour\n\nmerci')).toBe('Bonjour merci')
    expect(excerpt('a'.repeat(300))).toHaveLength(120)
    expect(excerpt('a'.repeat(300)).endsWith('…')).toBe(true)
  })
})

describe('messagerie : e-mails', () => {
  const t = fr.messages.email
  const link = `https://tiroir.app/messages/${THREAD}`
  test('notification : prénom, vente, texte, lien — et aucune adresse', () => {
    const email = renderNewMessage(t, 'fr', { from: 'Léa', title: 'Kit de DJing', text: 'Toujours disponible ?', link })
    expect(email.subject).toBe('Léa t’a écrit à propos de « Kit de DJing »')
    for (const part of [email.html, email.text]) {
      expect(part).toContain('Léa')
      expect(part).toContain('Kit de DJing')
      expect(part).toContain('Toujours disponible ?')
      expect(part).toContain(link)
      expect(part).not.toMatch(/[^\s"<>]+@[^\s"<>]+\.[a-z]{2,}/i)
    }
  })
  test('ce que saisit un utilisateur est échappé, et l’objet tient sur une ligne', () => {
    const email = renderNewMessage(t, 'fr', { from: '<script>x</script>', title: 'Kit\r\nBcc: x', text: '<img src=x onerror=alert(1)>', link })
    expect(email.html).not.toContain('<script>')
    expect(email.html).not.toContain('<img')
    expect(email.html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(email.subject).not.toMatch(/[\r\n]/)
  })
  test('vérification : le lien signé, et rien sur l’adresse du vendeur', () => {
    const email = renderVerify(t, 'fr', { name: 'Léa', seller: 'Clément', title: 'Kit de DJing', text: 'Bonjour', link: `${link}?k=abc` })
    expect(email.subject).toBe('Confirme ton message à Clément')
    expect(email.html).toContain(`${link}?k=abc`)
    expect(email.text).toContain(`${link}?k=abc`)
    expect(email.html).not.toMatch(/[^\s"<>]+@[^\s"<>]+\.[a-z]{2,}/i)
  })
  test('couleurs : celles de design/tokens.json', () => {
    const tokens = JSON.parse(readFileSync(join(__dirname, '../../design/tokens.json'), 'utf8')).color
    for (const [name, value] of Object.entries(EMAIL_COLORS)) expect(tokens[name].value).toBe(value)
  })
})

describe('messagerie : rien de privé dans le navigateur', () => {
  const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8')
  test('les pages et le formulaire ne manipulent jamais l’adresse d’un participant', () => {
    for (const file of ['pages/messages/index.tsx', 'pages/messages/[id].tsx']) {
      expect(read(file)).not.toMatch(/guest_email|\.email\b/)
    }
  })
  test('les vues envoyées au navigateur n’ont pas de champ d’adresse', () => {
    const server = read('lib/messagingServer.ts')
    const views = server.slice(server.indexOf('export type ThreadView'), server.indexOf('export async function loadThreadView'))
      + server.slice(server.indexOf('export type InboxItem'), server.indexOf('export async function listThreads'))
    expect(views).not.toMatch(/email/i)
  })
  test('chaque route de fil passe par viewerParticipant', () => {
    const server = read('lib/messagingServer.ts')
    for (const fn of ['reply', 'report', 'loadThreadView']) {
      const body = server.slice(server.indexOf(`export async function ${fn}(`))
      expect(body.slice(0, body.indexOf('\n}\n'))).toContain('viewerParticipant(')
    }
  })
})
