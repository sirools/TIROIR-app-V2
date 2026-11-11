import { describe, expect, test, vi } from 'vitest'
import { handleRevenueCatWebhook } from '../../supabase/functions/revenuecat-webhook/handler'

// Webhook RevenueCat, déployé sans vérification JWT : toute requête sans le
// bon secret est refusée en 401 AVANT de lire le corps ou de toucher à la
// base (le client Supabase n'est même pas créé).
const SECRET = 'rc_7f3a9c1e5b2d4f6a8c0e1b3d5f7a9c2e4b6d8f0a'
const NEXT = 'rc_next_0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c'

const purchase = { event: { type: 'NON_RENEWING_PURCHASE', app_user_id: 'u1', product_id: 'tiroir_credits_50', transaction_id: 'tx1', store: 'APP_STORE' } }

function request(auth: string | null, body: unknown = purchase, method = 'POST') {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (auth !== null) headers.Authorization = auth
  return new Request('https://example.test/revenuecat-webhook', {
    method, headers, body: method === 'POST' ? JSON.stringify(body) : undefined,
  })
}

/** Faux client Supabase : compte chaque appel. */
function fakeDb() {
  const calls: string[] = []
  const db = {
    rpc: vi.fn(async (name: string) => { calls.push(`rpc:${name}`); return { error: null } }),
    from: vi.fn((table: string) => {
      calls.push(`from:${table}`)
      return { insert: async () => ({ error: null }) }
    }),
  }
  const factory = vi.fn(() => db)
  return { factory, db, calls }
}

describe('webhook RevenueCat : authentification', () => {
  const refused: [string, string | null][] = [
    ['sans en-tête', null],
    ['en-tête vide', ''],
    ['mauvais secret', 'rc_pas_le_bon_secret_0000000000000000000000'],
    ['secret tronqué', SECRET.slice(0, -1)],
    ['secret avec un caractère de plus', `${SECRET}x`],
    ['secret précédé de Bearer', `Bearer ${SECRET}`],
    ['clé anon de Supabase', 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.c2ln'],
  ]

  test.each(refused)('%s : 401, base jamais touchée', async (_label, auth) => {
    const { factory, calls } = fakeDb()
    const res = await handleRevenueCatWebhook(request(auth), { secrets: [SECRET], db: factory })
    expect(res.status).toBe(401)
    expect(factory).not.toHaveBeenCalled()
    expect(calls).toEqual([])
  })

  test('aucun secret configuré : tout est refusé', async () => {
    const { factory } = fakeDb()
    const res = await handleRevenueCatWebhook(request(''), { secrets: [undefined, undefined], db: factory })
    expect(res.status).toBe(401)
    expect(factory).not.toHaveBeenCalled()
  })

  test('corps illisible sans le secret : 401, pas 400 (le corps n’est pas lu)', async () => {
    const { factory } = fakeDb()
    const req = new Request('https://example.test/revenuecat-webhook', { method: 'POST', body: '{pas du json' })
    const res = await handleRevenueCatWebhook(req, { secrets: [SECRET], db: factory })
    expect(res.status).toBe(401)
    expect(factory).not.toHaveBeenCalled()
  })

  test('autre méthode que POST : 405', async () => {
    const { factory } = fakeDb()
    const res = await handleRevenueCatWebhook(request(SECRET, null, 'GET'), { secrets: [SECRET], db: factory })
    expect(res.status).toBe(405)
    expect(factory).not.toHaveBeenCalled()
  })

  test('bon secret : l’événement est traité (pack crédité)', async () => {
    const { factory, calls } = fakeDb()
    const res = await handleRevenueCatWebhook(request(SECRET), { secrets: [SECRET], db: factory })
    expect(res.status).toBe(200)
    expect(factory).toHaveBeenCalledTimes(1)
    expect(calls).toContain('rpc:grant_ai_credits')
  })

  test('rotation : ancien et nouveau secret acceptés, rien d’autre', async () => {
    for (const auth of [SECRET, NEXT]) {
      const { factory } = fakeDb()
      const res = await handleRevenueCatWebhook(request(auth), { secrets: [SECRET, NEXT], db: factory })
      expect(res.status).toBe(200)
    }
    const { factory } = fakeDb()
    const res = await handleRevenueCatWebhook(request('rc_autre_secret_000000000000000000000000000'), { secrets: [SECRET, NEXT], db: factory })
    expect(res.status).toBe(401)
    expect(factory).not.toHaveBeenCalled()
  })

  test('bon secret, corps illisible : 400', async () => {
    const { factory } = fakeDb()
    const req = new Request('https://example.test/revenuecat-webhook', { method: 'POST', headers: { Authorization: SECRET }, body: '{pas du json' })
    const res = await handleRevenueCatWebhook(req, { secrets: [SECRET], db: factory })
    expect(res.status).toBe(400)
    expect(factory).not.toHaveBeenCalled()
  })
})
