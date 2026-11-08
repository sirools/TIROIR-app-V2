// Client minimal de l'API Stripe (fetch, sans SDK) : les quelques appels
// dont Tiroir a besoin. Serveur seulement — la clé ne quitte jamais
// l'environnement (lib/stripeConfig.ts, stripeEnv).
import { STRIPE_API_VERSION, type StripeEnv } from '../stripeConfig'

export type Params = { [key: string]: Param }
type Param = string | number | boolean | null | undefined | Param[] | { [key: string]: Param }

export class StripeApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message)
  }
}

/** { a: { b: [1, 2] } } → « a[b][0]=1&a[b][1]=2 » (format attendu par Stripe). */
export function encodeForm(params: Params): string {
  const out: string[] = []
  const walk = (value: Param, key: string) => {
    if (value === undefined || value === null) return
    if (Array.isArray(value)) value.forEach((v, i) => walk(v, `${key}[${i}]`))
    else if (typeof value === 'object') for (const [k, v] of Object.entries(value)) walk(v, `${key}[${k}]`)
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
  }
  for (const [k, v] of Object.entries(params)) walk(v, k)
  return out.join('&')
}

export type StripeCall = <T = Record<string, unknown>>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  params?: Params,
  opts?: { idempotencyKey?: string },
) => Promise<T>

export function stripeClient(env: StripeEnv, fetchImpl: typeof fetch = fetch): StripeCall {
  return async function call<T>(method: 'GET' | 'POST' | 'DELETE', path: string, params: Params = {}, opts: { idempotencyKey?: string } = {}) {
    const body = encodeForm(params)
    const url = `https://api.stripe.com${path}${method === 'GET' && body ? `?${body}` : ''}`
    const headers: Record<string, string> = {
      Authorization: `Bearer ${env.secretKey}`,
      'Stripe-Version': STRIPE_API_VERSION,
    }
    if (method !== 'GET') headers['Content-Type'] = 'application/x-www-form-urlencoded'
    if (opts.idempotencyKey) headers['Idempotency-Key'] = opts.idempotencyKey
    const res = await fetchImpl(url, { method, headers, body: method === 'GET' ? undefined : body })
    const json = await res.json().catch(() => ({})) as { error?: { message?: string; code?: string } }
    if (!res.ok) throw new StripeApiError(json.error?.message ?? `Stripe ${res.status}`, res.status, json.error?.code)
    return json as T
  }
}

// Identifiants des prix, retrouvés par lookup_key et gardés 10 minutes.
const priceCache = new Map<string, { id: string; at: number }>()

export async function priceIdFor(stripe: StripeCall, lookupKey: string, now = Date.now()): Promise<string> {
  const hit = priceCache.get(lookupKey)
  if (hit && now - hit.at < 10 * 60 * 1000) return hit.id
  const list = await stripe<{ data: { id: string }[] }>('GET', '/v1/prices', { lookup_keys: [lookupKey], active: true, limit: 1 })
  const id = list.data[0]?.id
  if (!id) throw new StripeApiError(`Prix introuvable dans Stripe : ${lookupKey} (lancer scripts/stripe-setup.mjs)`, 500)
  priceCache.set(lookupKey, { id, at: now })
  return id
}
