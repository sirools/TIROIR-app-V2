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
