import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { OFFERS_V4 } from '../lib/offers'

// config/tiers.json est le brouillon de la source unique des paliers (V4).
// Tant qu'il n'est pas branché, il ne doit pas dire autre chose que la
// grille figée le 19/10 (OFFERS_V4) ni que la checklist des stores.
const root = path.resolve(__dirname, '../..')
const tiers = JSON.parse(readFileSync(path.join(root, 'config/tiers.json'), 'utf8'))
const LANGS = ['fr', 'en', 'es', 'de', 'pt-BR', 'pt-PT']

describe('config/tiers.json', () => {
  test('les prix sont ceux de la grille V4 du site', () => {
    expect(tiers.tiers.premium.price.monthly).toBe(OFFERS_V4.premium.monthlyHt)
    expect(tiers.tiers.premium.price.yearly).toBe(OFFERS_V4.premium.yearlyHt)
    expect(tiers.tiers.pro.price.monthly).toBe(OFFERS_V4.pro.monthlyHt)
    expect(tiers.tiers.business.price.seatMonthly).toBe(OFFERS_V4.business.seatMonthly)
    expect(tiers.tiers.free.quotas.aiActionsMonthly.value).toBe(OFFERS_V4.free.aiActionsPerMonth)
  })

  test('les packs sont ceux de la grille V4', () => {
    const packs = tiers.creditPacks.packs.map((p: { id: string; credits: number; price: number; popular: boolean }) =>
      ({ id: p.id, credits: p.credits, priceTtc: p.price, popular: p.popular }))
    expect(packs).toEqual(OFFERS_V4.packs)
  })

  test('chaque produit des stores est dans la checklist strategie/packs-stores.md', () => {
    const checklist = readFileSync(path.join(root, 'strategie/packs-stores.md'), 'utf8')
    const ids = [
      ...tiers.tiers.premium.store.products,
      ...tiers.tiers.pro.store.products,
      ...tiers.creditPacks.packs.map((p: { id: string }) => p.id),
    ]
    for (const id of ids) expect(checklist).toContain(`\`${id}\``)
  })

  test('chaque palier a un libellé dans les six langues', () => {
    for (const tier of Object.values(tiers.tiers) as { label: Record<string, string> }[]) {
      expect(Object.keys(tier.label).sort()).toEqual([...LANGS].sort())
    }
  })

  test('chaque quota nomme une vraie colonne de app_settings', () => {
    const migrations = path.join(root, 'supabase/migrations')
    const sql = require('node:fs').readdirSync(migrations)
      .map((f: string) => readFileSync(path.join(migrations, f), 'utf8')).join('\n')
    for (const tier of Object.values(tiers.tiers) as { quotas?: Record<string, { setting: string }> }[]) {
      for (const q of Object.values(tier.quotas ?? {})) expect(sql).toContain(q.setting)
    }
  })

  test('le coût des actions est celui que le serveur débite', () => {
    const sql = readFileSync(path.join(root, 'supabase/migrations/20261108143238_ai_credits_spend.sql'), 'utf8')
    const cost = (kind: string) => Number(sql.match(new RegExp(`WHEN '${kind}' THEN (\\d+)`))?.[1])
    expect(tiers.creditCosts.photo).toBe(cost('photo'))
    expect(tiers.creditCosts.estimate).toBe(cost('estimate'))
  })
})
