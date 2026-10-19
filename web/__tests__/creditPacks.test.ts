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
    const webhook = packsIn('supabase/functions/_shared/storeProducts.ts')
    expect(app).toEqual({
      tiroir_credits_50: 50, tiroir_credits_150: 150, tiroir_credits_500: 500,
      tiroir_credits_30: 30, tiroir_credits_80: 80,
    })
    expect(webhook).toEqual(app)
    // Le webhook passe bien par le module partagé, sans copie locale.
    const src = readFileSync(path.join(root, 'supabase/functions/revenuecat-webhook/index.ts'), 'utf8')
    expect(src).toContain("from '../_shared/storeProducts.ts'")
    expect(src).not.toMatch(/CREDIT_PACKS\s*[:=]/)
  })
})

describe('grille affichée (lib/offers.ts)', () => {
  test('le site affiche les packs que l’app vend (plus les anciens, retirés de la vente)', async () => {
    const { OFFERS_V4 } = await import('../lib/offers')
    const shown = Object.fromEntries(OFFERS_V4.packs.map(p => [p.id, p.credits]))
    const app = packsIn('mobile/src/lib/creditPacks.ts')
    expect(app).toMatchObject(shown)
    expect(Object.keys(app).filter(id => !(id in shown)).sort()).toEqual(['tiroir_credits_30', 'tiroir_credits_80'])
  })

  test('le coût d’un crédit est celui que le serveur débite', async () => {
    const { CREDIT_COSTS } = await import('../lib/offers')
    const sql = readFileSync(path.join(root, 'supabase/drafts/ai_credits_spend.sql'), 'utf8')
    const cost = (kind: string) => Number(sql.match(new RegExp(`WHEN '${kind}' THEN (\\d+)`))?.[1])
    expect(CREDIT_COSTS.map(c => c.credits)).toEqual([1, cost('photo'), cost('estimate')])
    expect(sql).toMatch(/WHEN 'analysis' THEN p_units/)
  })
})
