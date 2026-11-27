import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, describe, expect, test } from 'vitest'
import {
  BODY_MAX, directKey, everyoneCleared, excerpt, listingKey, parseBody, parseEmail, parsePseudo, rateAllowed, RATE, unreadCount,
  viewerParticipant, visibleTo, type MessageRow, type ParticipantRow,
} from '../lib/messaging'
import {
  decryptBody, decryptEmail, emailHash, encryptBody, encryptEmail, GUEST_LINK_TTL_MS, guestToken, ipHash, readGuestToken,
} from '../lib/messagingCrypto'
import { EMAIL_COLORS, renderNewLink, renderNewMessage, renderVerify } from '../lib/messagingEmails'
import { isLocalHost } from '../lib/messagingServer'
import fr from '../locales/fr'

const THREAD = '11111111-1111-4111-8111-111111111111'
const OTHER_THREAD = '22222222-2222-4222-8222-222222222222'
const AUCTION = '33333333-3333-4333-8333-333333333333'
const SELLER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const BUYER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const STRANGER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

const participant = (over: Partial<ParticipantRow>): ParticipantRow => ({
  id: 'p', thread_id: THREAD, role: 'buyer', user_id: null, guest_name: null, guest_email: null,
  guest_verified_at: null, guest_link_epoch: 0, locale: 'fr', last_read_at: null, cleared_at: null, ...over,
})
const seller = participant({ id: 'p-seller', role: 'seller', user_id: SELLER })
const guest = participant({ id: 'p-guest', guest_name: 'Léa', guest_email: 'v1.chiffre' })
const member = participant({ id: 'p-member', user_id: BUYER })

beforeAll(() => { process.env.MESSAGES_KEY = 'cle-de-test' })

describe('messagerie : droits d’accès', () => {
  test('un compte n’entre que dans les fils où il a une place', () => {
    expect(viewerParticipant([seller, guest], { userId: SELLER, guest: null })).toBe(seller)
    expect(viewerParticipant([seller, member], { userId: BUYER, guest: null })).toBe(member)
  })
  test('un tiers connecté n’entre pas, même avec l’adresse du fil', () => {
    expect(viewerParticipant([seller, guest], { userId: STRANGER, guest: null })).toBeNull()
    expect(viewerParticipant([seller, member], { userId: STRANGER, guest: null })).toBeNull()
  })
  test('un visiteur sans session ni lien n’entre pas', () => {
    expect(viewerParticipant([seller, guest], { userId: null, guest: null })).toBeNull()
  })
  test('le lien d’un invité ouvre sa place, jamais celle d’un compte', () => {
    expect(viewerParticipant([seller, guest], { userId: null, guest: { participantId: 'p-guest', epoch: 0 } })).toBe(guest)
    expect(viewerParticipant([seller, guest], { userId: null, guest: { participantId: 'p-seller', epoch: 0 } })).toBeNull()
    expect(viewerParticipant([seller, guest], { userId: null, guest: { participantId: 'inconnu', epoch: 0 } })).toBeNull()
  })
  test('un tiers connecté qui tient le lien d’un invité lit en tant qu’invité, pas plus', () => {
    expect(viewerParticipant([seller, guest], { userId: STRANGER, guest: { participantId: 'p-guest', epoch: 0 } })).toBe(guest)
  })

  test('lien d’invité : signé, lié à un seul fil, valable 7 jours', () => {
    const now = Date.parse('2026-11-27T08:00:00Z')
    expect(GUEST_LINK_TTL_MS).toBe(7 * 24 * 3600 * 1000)
    const token = guestToken(THREAD, 'p-guest', 0, now)
    expect(readGuestToken(THREAD, token, now)).toEqual({ participantId: 'p-guest', epoch: 0 })
    // Le même lien ne vaut rien pour un autre fil.
    expect(readGuestToken(OTHER_THREAD, token, now)).toBeNull()
    // Passé sept jours, il ne vaut plus rien.
    expect(readGuestToken(THREAD, token, now + GUEST_LINK_TTL_MS + 1)).toBeNull()
    // Changer de participant, d'époque ou allonger la durée casse la signature.
    const [, epoch, expires, signature] = token.split('.')
    expect(readGuestToken(THREAD, `p-seller.${epoch}.${expires}.${signature}`, now)).toBeNull()
    expect(readGuestToken(THREAD, `p-guest.1.${expires}.${signature}`, now)).toBeNull()
    expect(readGuestToken(THREAD, `p-guest.${epoch}.${Number(expires) + 1000}.${signature}`, now)).toBeNull()
    for (const bad of [null, '', 'p-guest', 'a.b.c', 'a.b.c.d', `p-guest.${expires}.${signature}`]) expect(readGuestToken(THREAD, bad, now)).toBeNull()
  })
  test('lien révoqué : un lien d’une ancienne époque n’ouvre plus la place de l’invité', () => {
    const pass = readGuestToken(THREAD, guestToken(THREAD, 'p-guest', 0))!
    expect(viewerParticipant([seller, guest], { userId: null, guest: pass })).toBe(guest)
    const revoked = { ...guest, guest_link_epoch: 1 }
    expect(viewerParticipant([seller, revoked], { userId: null, guest: pass })).toBeNull()
    const fresh = readGuestToken(THREAD, guestToken(THREAD, 'p-guest', 1))!
    expect(viewerParticipant([seller, revoked], { userId: null, guest: fresh })).toBe(revoked)
  })
  test('la clé du lien n’est pas celle d’un autre déploiement', () => {
    const token = guestToken(THREAD, 'p-guest')
    process.env.MESSAGES_KEY = 'autre-cle'
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    expect(readGuestToken(THREAD, token)).toBeNull()
    process.env.MESSAGES_KEY = 'cle-de-test'
    if (service) process.env.SUPABASE_SERVICE_ROLE_KEY = service
    expect(readGuestToken(THREAD, token)).toEqual({ participantId: 'p-guest', epoch: 0 })
  })
})

describe('messagerie : une seule conversation par vente et par acheteur', () => {
  test('même vente, même acheteur : la même clé, donc le même fil', () => {
    expect(listingKey(AUCTION, { userId: BUYER })).toBe(listingKey(AUCTION, { userId: BUYER }))
    expect(listingKey(AUCTION, { emailHash: emailHash('Lea@Example.com ') })).toBe(listingKey(AUCTION, { emailHash: emailHash('lea@example.com') }))
  })
  test('autre acheteur ou autre vente : un autre fil', () => {
    expect(listingKey(AUCTION, { userId: BUYER })).not.toBe(listingKey(AUCTION, { userId: STRANGER }))
    expect(listingKey(AUCTION, { userId: BUYER })).not.toBe(listingKey(OTHER_THREAD, { userId: BUYER }))
    expect(listingKey(AUCTION, { emailHash: emailHash('lea@example.com') })).not.toBe(listingKey(AUCTION, { emailHash: emailHash('leo@example.com') }))
    // Un compte et un invité ne se confondent jamais, quel que soit ce que l'invité saisit.
    expect(listingKey(AUCTION, { emailHash: BUYER })).not.toBe(listingKey(AUCTION, { userId: BUYER }))
    // La clé du fil ne contient jamais l'adresse.
    expect(listingKey(AUCTION, { emailHash: emailHash('lea@example.com') })).not.toContain('lea')
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
  test('changer de clé ne perd pas l’historique (MESSAGES_KEY_PREVIOUS)', () => {
    const stored = encryptBody(THREAD, 'avant la rotation')
    process.env.MESSAGES_KEY = 'nouvelle-cle'
    process.env.MESSAGES_KEY_PREVIOUS = 'cle-de-test'
    expect(decryptBody(THREAD, stored)).toBe('avant la rotation')
    // Le nouveau texte est écrit avec la nouvelle clé : l'ancienne seule ne l'ouvre pas.
    const fresh = encryptBody(THREAD, 'après')
    process.env.MESSAGES_KEY = 'cle-de-test'
    delete process.env.MESSAGES_KEY_PREVIOUS
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    expect(decryptBody(THREAD, fresh)).toBeNull()
    if (service) process.env.SUPABASE_SERVICE_ROLE_KEY = service
  })
  test('les messages écrits avant la pose de MESSAGES_KEY restent lisibles (clé service)', () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'cle-service'
    delete process.env.MESSAGES_KEY
    const before = encryptBody(THREAD, 'écrit sans MESSAGES_KEY')
    process.env.MESSAGES_KEY = 'cle-de-test'
    expect(decryptBody(THREAD, before)).toBe('écrit sans MESSAGES_KEY')
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
  })
  test('adresse d’invité : chiffrée, empreinte stable, ancienne adresse en clair encore lisible', () => {
    const stored = encryptEmail('lea@example.com')
    expect(stored).not.toContain('lea')
    expect(decryptEmail(stored)).toBe('lea@example.com')
    expect(decryptEmail('ancienne@example.com')).toBe('ancienne@example.com')
    expect(decryptEmail(null)).toBeNull()
    expect(emailHash('Lea@Example.com')).toBe(emailHash('lea@example.com'))
    expect(emailHash('lea@example.com')).not.toContain('lea')
    // L'empreinte ne bouge pas quand on fait tourner la clé.
    const h = emailHash('lea@example.com')
    process.env.MESSAGES_KEY = 'nouvelle-cle'
    process.env.MESSAGES_KEY_PREVIOUS = 'cle-de-test'
    expect(emailHash('lea@example.com')).toBe(h)
    expect(decryptEmail(stored)).toBe('lea@example.com')
    process.env.MESSAGES_KEY = 'cle-de-test'
    delete process.env.MESSAGES_KEY_PREVIOUS
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
  test('pseudo : 3 à 24 caractères, lettres, chiffres, point, tiret, tiret bas — ni espace, ni adresse, ni lien', () => {
    for (const ok of ['Léa', 'dj_clement', 'Noël-2026', 'a.b', 'x'.repeat(24), '  vendeur75 ']) expect(parsePseudo(ok)).toBe(ok.trim())
    for (const bad of ['', 'ab', 'x'.repeat(25), 'Léa Martin', 'lea@example.com', 'https://spam', '<b>Léa</b>', '_lea', '.lea', null, 42]) {
      expect(parsePseudo(bad)).toBeNull()
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
    expect(unreadCount(messages, { id: 'p-seller', cleared_at: null, last_read_at: null })).toBe(2)
    expect(unreadCount(messages, { id: 'p-seller', cleared_at: null, last_read_at: '2026-11-27T08:06:00Z' })).toBe(1)
    expect(unreadCount(messages, { id: 'p-guest', cleared_at: null, last_read_at: null })).toBe(1)
  })
  test('la lecture remet la pastille à zéro', () => {
    expect(unreadCount(messages, { id: 'p-seller', cleared_at: null, last_read_at: '2026-11-27T08:10:01Z' })).toBe(0)
  })
  test('un message en attente de confirmation ne compte pas', () => {
    expect(unreadCount([msg('4', 'p-guest', null)], { id: 'p-seller', cleared_at: null, last_read_at: null })).toBe(0)
  })
  test('« Supprimer la conversation » : rien d’antérieur n’est montré ni compté', () => {
    const me = { id: 'p-seller', last_read_at: null, cleared_at: '2026-11-27T08:06:00Z' }
    expect(messages.filter(m => visibleTo(m, me)).map(m => m.id)).toEqual(['3'])
    expect(unreadCount(messages, me)).toBe(1)
    expect(visibleTo(msg('9', 'p-guest', null), { cleared_at: null })).toBe(false)
  })
  test('le fil disparaît quand tous l’ont supprimé depuis le dernier message', () => {
    const last = '2026-11-27T08:10:00Z'
    expect(everyoneCleared([{ cleared_at: '2026-11-27T08:11:00Z' }, { cleared_at: null }], last)).toBe(false)
    expect(everyoneCleared([{ cleared_at: '2026-11-27T08:11:00Z' }, { cleared_at: '2026-11-27T08:09:00Z' }], last)).toBe(false)
    expect(everyoneCleared([{ cleared_at: '2026-11-27T08:11:00Z' }, { cleared_at: '2026-11-27T08:12:00Z' }], last)).toBe(true)
    expect(everyoneCleared([], last)).toBe(false)
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
  const ADDRESS = /[^\s"<>]+@[^\s"<>]+\.[a-z]{2,}/i
  test('notification : pseudo, vente, lien — ni le texte du message, ni aucune adresse', () => {
    const email = renderNewMessage(t, 'fr', { from: 'Léa', title: 'Kit de DJing', link, personal: false })
    expect(email.subject).toBe('Léa t’a écrit à propos de « Kit de DJing »')
    for (const part of [email.html, email.text]) {
      expect(part).toContain('Léa')
      expect(part).toContain('Kit de DJing')
      expect(part).toContain(link)
      expect(part).toContain(t.notCopied)
      expect(part).not.toContain(t.personalLink)
      expect(part).not.toMatch(ADDRESS)
    }
    // Le rendu n'accepte même plus de texte de message.
    expect(renderNewMessage.length).toBe(3)
  })
  test('notification à un invité : rappelle que le lien est personnel', () => {
    const email = renderNewMessage(t, 'fr', { from: 'Clément', title: 'Kit', link: `${link}?k=abc`, personal: true })
    expect(email.text).toContain(t.personalLink)
    expect(email.html).toContain(`${link}?k=abc`)
  })
  test('ce que saisit un utilisateur est échappé, et l’objet tient sur une ligne', () => {
    const email = renderNewMessage(t, 'fr', { from: '<script>x</script>', title: 'Kit\r\nBcc: x', link, personal: false })
    expect(email.html).not.toContain('<script>')
    expect(email.subject).not.toMatch(/[\r\n]/)
  })
  test('vérification : le lien signé, sans le texte ni l’adresse du vendeur', () => {
    const email = renderVerify(t, 'fr', { name: 'Léa', seller: 'Clément', title: 'Kit de DJing', link: `${link}?k=abc` })
    expect(email.subject).toBe('Confirme ton message à Clément')
    expect(email.html).toContain(`${link}?k=abc`)
    expect(email.text).toContain(`${link}?k=abc`)
    expect(email.html).not.toMatch(ADDRESS)
  })
  test('nouveau lien après révocation', () => {
    const email = renderNewLink(t, 'fr', { name: 'Léa', other: 'Clément', title: 'Kit', link: `${link}?k=neuf` })
    expect(email.subject).toBe('Ton nouveau lien pour la conversation avec Clément')
    expect(email.text).toContain(`${link}?k=neuf`)
  })
  test('couleurs : celles de design/tokens.json', () => {
    const tokens = JSON.parse(readFileSync(join(__dirname, '../../design/tokens.json'), 'utf8')).color
    for (const [name, value] of Object.entries(EMAIL_COLORS)) expect(tokens[name].value).toBe(value)
  })
})

describe('messagerie : adresse des liens', () => {
  test('https partout, http seulement en local et sur le réseau privé (préprod du NAS)', () => {
    for (const host of ['localhost:3000', '127.0.0.1:3000', '192.168.1.23:8151', '10.0.0.4', '172.20.1.1']) expect(isLocalHost(host)).toBe(true)
    for (const host of ['www.tiroir.app', 'tiroir.app', '172.32.0.1', '193.168.1.1']) expect(isLocalHost(host)).toBe(false)
  })
})

describe('messagerie : rien d’écrit au vendeur n’est public', () => {
  const read = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8')
  test('la page d’une vente n’affiche ni n’envoie plus de message public', () => {
    const page = read('pages/ventes/[token].tsx')
    expect(page).not.toMatch(/view\.messages|action: 'message'|auction-message/)
    expect(page).toContain('<ContactSeller')
  })
  test('la route de la vente n’a plus d’action « message », et le serveur ne lit plus l’ancien fil', () => {
    expect(read('pages/api/auctions/[token].ts')).not.toMatch(/'message'|from\('auction_messages'\)/)
    expect(read('lib/auctionServer.ts')).not.toMatch(/from\('auction_messages'\)/)
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
  test('le contrôle « base prête » lit vraiment les tables (un HEAD sur une table absente ne renvoie pas d’erreur)', () => {
    const server = read('lib/messagingServer.ts')
    const body = server.slice(server.indexOf('export async function messagingReady('))
    expect(body.slice(0, body.indexOf('\n}\n'))).not.toMatch(/head:\s*true/)
  })
  test('chaque route de fil passe par viewerParticipant', () => {
    const server = read('lib/messagingServer.ts')
    for (const fn of ['reply', 'report', 'loadThreadView']) {
      const body = server.slice(server.indexOf(`export async function ${fn}(`))
      expect(body.slice(0, body.indexOf('\n}\n'))).toContain('viewerParticipant(')
    }
  })
})
