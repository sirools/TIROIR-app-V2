#!/usr/bin/env node
// Crée dans Stripe les produits et prix que vend le site, s'ils n'existent
// pas encore : packs de crédits IA (paiement unique) et siège Business
// (abonnement mensuel). Rejouable sans effet : chaque prix est retrouvé
// par sa lookup_key, la même en mode test et en mode réel.
//
//   STRIPE_SECRET_KEY=sk_test_… node scripts/stripe-setup.mjs
//   STRIPE_SECRET_KEY=sk_test_… node scripts/stripe-setup.mjs --apply-price-changes
//
// Un prix Stripe ne se modifie pas. Sans option, un montant qui a changé
// dans la grille est seulement signalé (⚠). Avec --apply-price-changes, un
// nouveau prix est créé sur le même produit et reprend la lookup_key
// (transfer_lookup_key) : les nouveaux achats et les nouveaux abonnements
// paient le nouveau montant ; les abonnements Business en cours gardent
// l'ancien prix tant qu'on ne les migre pas (l'ancien prix est désactivé,
// pas supprimé).
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
  // Abonnements des particuliers : un produit par palier (`product`), un
  // prix par période.
  { lookupKey: 'tiroir_web_premium_monthly', name: 'Tiroir Premium', product: 'premium', amount: 1500, recurring: 'month' },
  { lookupKey: 'tiroir_web_premium_yearly', name: 'Tiroir Premium', product: 'premium', amount: 15000, recurring: 'year' },
  { lookupKey: 'tiroir_web_pro_monthly', name: 'Tiroir Pro', product: 'pro', amount: 5000, recurring: 'month' },
  { lookupKey: 'tiroir_web_pro_yearly', name: 'Tiroir Pro', product: 'pro', amount: 50000, recurring: 'year' },
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
  const applyChanges = process.argv.includes('--apply-price-changes')
  console.log(`Stripe, mode ${mode}${applyChanges ? ' — changements de prix appliqués' : ''}`)

  // Produit Stripe déjà utilisé par un palier (Premium mensuel et annuel
  // partagent le même produit).
  const productOf = new Map()
  for (const p of PRODUCTS) {
    const found = await stripe(key, 'GET', '/v1/prices', { 'lookup_keys[0]': p.lookupKey, active: true, limit: 1 })
    if (found.data[0]) {
      const price = found.data[0]
      if (p.product) productOf.set(p.product, typeof price.product === 'string' ? price.product : price.product.id)
      // Palier sur le prix : le webhook le reconnaît encore une fois archivé.
      if (p.product && price.metadata?.tier !== p.product) await stripe(key, 'POST', `/v1/prices/${price.id}`, { metadata: { tier: p.product } })
      const ok = price.unit_amount === p.amount && price.currency === 'eur'
      if (ok || !applyChanges) {
        console.log(`${ok ? '✓' : `⚠ montant différent (grille : ${p.amount / 100} €) :`} ${p.lookupKey} → ${price.id} (${price.unit_amount / 100} €)`)
        continue
      }
      const next = await stripe(key, 'POST', '/v1/prices', {
        product: typeof price.product === 'string' ? price.product : price.product.id,
        currency: 'eur',
        unit_amount: p.amount,
        tax_behavior: 'inclusive',
        lookup_key: p.lookupKey,
        transfer_lookup_key: true,
        ...(p.product ? { metadata: { tier: p.product } } : {}),
        ...(p.recurring ? { recurring: { interval: p.recurring } } : {}),
      })
      await stripe(key, 'POST', `/v1/prices/${price.id}`, { active: false })
      console.log(`↻ ${p.lookupKey} : ${price.unit_amount / 100} € → ${p.amount / 100} € (${price.id} désactivé, ${next.id} actif)`)
      continue
    }
    let productId = p.product ? productOf.get(p.product) : null
    if (!productId) {
      const product = await stripe(key, 'POST', '/v1/products', { name: p.name, metadata: p.product ? { tier: p.product } : { lookup_key: p.lookupKey } })
      productId = product.id
      if (p.product) productOf.set(p.product, productId)
    }
    const price = await stripe(key, 'POST', '/v1/prices', {
      product: productId,
      currency: 'eur',
      unit_amount: p.amount,
      // Prix TTC : en franchise en base, TTC = HT.
      tax_behavior: 'inclusive',
      lookup_key: p.lookupKey,
      ...(p.product ? { metadata: { tier: p.product } } : {}),
      ...(p.recurring ? { recurring: { interval: p.recurring } } : {}),
    })
    console.log(`+ ${p.lookupKey} → ${price.id} (${p.amount / 100} €)`)
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(e => { console.error(e.message); process.exit(1) })
}
