import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'

// Les packs vendus dans l'app et ceux que le webhook crédite doivent être
// exactement les mêmes : sinon un achat ne crédite rien, ou pas le bon nombre.
const root = path.resolve(__dirname, '../..')
const packsIn = (file: string) => {
  const src = readFileSync(path.join(root, file), 'utf8')
  const block = src.match(/CREDIT_PACKS[^{]*\{([^}]*)\}/)?.[1] ?? ''
  return Object.fromEntries([...block.matchAll(/(\w+):\s*(\d+)/g)].map(m => [m[1], Number(m[2])]))
}

describe('packs de crédits', () => {
  test('app et webhook vendent et créditent les mêmes packs', () => {
    const app = packsIn('mobile/src/lib/creditPacks.ts')
    const webhook = packsIn('supabase/functions/revenuecat-webhook/index.ts')
    expect(app).toEqual({ tiroir_credits_30: 30, tiroir_credits_80: 80 })
    expect(webhook).toEqual(app)
  })
})

describe('grille affichée (lib/offers.ts)', () => {
  test('la page Tarifs affiche les packs que l’app vend', async () => {
    const { OFFERS } = await import('../lib/offers')
    const shown = Object.fromEntries(OFFERS.packs.map(p => [p.id, p.credits]))
    expect(shown).toEqual(packsIn('mobile/src/lib/creditPacks.ts'))
  })

  test('le coût d’un crédit est celui que le serveur débite', async () => {
    const { OFFERS } = await import('../lib/offers')
    const sql = readFileSync(path.join(root, 'supabase/drafts/ai_credits_spend.sql'), 'utf8')
    const cost = (kind: string) => Number(sql.match(new RegExp(`WHEN '${kind}' THEN (\\d+)`))?.[1])
    expect(OFFERS.creditCosts.map(c => c.credits)).toEqual([1, cost('photo'), cost('estimate')])
    expect(sql).toMatch(/WHEN 'analysis' THEN p_units/)
  })

  test('le devis Pro suit le socle puis le crédit', async () => {
    const { proMonthlyHt } = await import('../lib/offers')
    expect(proMonthlyHt(0)).toBe(1700)
    expect(proMonthlyHt(20000)).toBe(1700)
    expect(proMonthlyHt(50000)).toBe(3200)
  })
})
