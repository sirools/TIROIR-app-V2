#!/usr/bin/env node
// Crée dans Stripe les produits et prix que vend le site, s'ils n'existent
// pas encore : packs de crédits IA (paiement unique) et siège Business
// (abonnement mensuel). Rejouable sans effet : chaque prix est retrouvé
// par sa lookup_key, la même en mode test et en mode réel.
//
//   STRIPE_SECRET_KEY=sk_test_… node scripts/stripe-setup.mjs
//
// D'abord avec la clé de TEST (préprod). La clé réelle seulement le jour
// de l'ouverture, après validation. La clé n'est jamais écrite nulle part.
//
// La liste doit rester celle de web/lib/stripeConfig.ts (grille OFFERS_V4) :
// le test web/__tests__/stripeBilling.test.ts les compare.

export const PRODUCTS = [
  { lookupKey: 'tiroir_web_credits_50', name: 'Tiroir — 50 crédits IA', amount: 299 },
  { lookupKey: 'tiroir_web_credits_150', name: 'Tiroir — 150 crédits IA', amount: 699 },
  { lookupKey: 'tiroir_web_credits_500', name: 'Tiroir — 500 crédits IA', amount: 1999 },
  { lookupKey: 'tiroir_business_seat_monthly', name: 'Tiroir Business — siège', amount: 3900, recurring: 'month' },
]

const API_VERSION = '2024-06-20'

function form(params, prefix = '') {
  return Object.entries(params).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}[${k}]` : k
    if (v === undefined || v === null) return []
    if (typeof v === 'object') return [form(v, key)]
    return [`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`]
  }).filter(Boolean).join('&')
}

async function stripe(key, method, path, params = {}) {
  const body = form(params)
  const res = await fetch(`https://api.stripe.com${path}${method === 'GET' ? `?${body}` : ''}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, 'Stripe-Version': API_VERSION, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: method === 'GET' ? undefined : body,
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.message ?? `Stripe ${res.status}`)
  return json
}

async function main() {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) throw new Error('STRIPE_SECRET_KEY manquante')
  const mode = key.includes('_live_') ? 'RÉEL' : 'test'
  console.log(`Stripe, mode ${mode}`)

  for (const p of PRODUCTS) {
    const found = await stripe(key, 'GET', '/v1/prices', { 'lookup_keys[0]': p.lookupKey, active: true, limit: 1 })
    if (found.data[0]) {
      const price = found.data[0]
      const ok = price.unit_amount === p.amount && price.currency === 'eur'
      console.log(`${ok ? '✓' : '⚠ montant différent :'} ${p.lookupKey} → ${price.id} (${price.unit_amount / 100} €)`)
      continue
    }
    const product = await stripe(key, 'POST', '/v1/products', { name: p.name, metadata: { lookup_key: p.lookupKey } })
    const price = await stripe(key, 'POST', '/v1/prices', {
      product: product.id,
      currency: 'eur',
      unit_amount: p.amount,
      // Prix TTC : en franchise en base, TTC = HT.
      tax_behavior: 'inclusive',
      lookup_key: p.lookupKey,
      ...(p.recurring ? { recurring: { interval: p.recurring } } : {}),
    })
    console.log(`+ ${p.lookupKey} → ${price.id} (${p.amount / 100} €)`)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(e => { console.error(e.message); process.exit(1) })
}
