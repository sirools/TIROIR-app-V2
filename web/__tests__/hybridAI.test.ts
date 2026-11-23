// Brique d'IA hybride (« Fiche express ») : lecture des réponses des
// modèles, brouillons gardés sur l'appareil, et règles du hackathon —
// toute l'IA de la brique passe par Firebase AI Logic, aucune clé au dépôt.
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { enrichmentPrompt, parseEnrichment, parseQuickCard, quickCardPrompt } from '../lib/hybridAI/card'
import { DRAFTS_KEY, MAX_DRAFTS, loadDrafts, nextStep, saveDrafts, upsertDraft, type Draft } from '../lib/hybridAI/drafts'
import { debugTokenFor } from '../lib/hybridAI/firebase'

const web = path.resolve(__dirname, '..')

describe('fiche rapide', () => {
  test('lit un objet JSON, même entouré de balises de code', () => {
    const raw = '```json\n{"name": "Lampe de bureau.", "category": "luminaire", "description": "Lampe  articulée\\nen métal noir."}\n```'
    expect(parseQuickCard(raw)).toEqual({
      name: 'Lampe de bureau', category: 'luminaire', description: 'Lampe articulée en métal noir.',
    })
  })

  test('refuse une réponse sans nom ou sans JSON', () => {
    expect(() => parseQuickCard('{"name": "  ", "category": "x", "description": "y"}')).toThrow()
    expect(() => parseQuickCard('Je ne sais pas.')).toThrow()
    expect(() => parseQuickCard('[1, 2]')).toThrow()
  })

  test('coupe un nom trop long', () => {
    const card = parseQuickCard(JSON.stringify({ name: 'a'.repeat(200), category: 'c', description: 'd' }))
    expect(card.name).toHaveLength(80)
  })

  test('la consigne demande la langue de la page', () => {
    expect(quickCardPrompt('fr')).toContain('French')
    expect(quickCardPrompt('de')).toContain('German')
    expect(quickCardPrompt('xx')).toContain('English')
  })
})

describe('enrichissement', () => {
  const answer = (o: object) => JSON.stringify({ detailedDescription: 'Lampe en métal.', valueNote: 'Selon l’état.', ...o })

  test('fourchette en euros, remise dans l’ordre et arrondie', () => {
    expect(parseEnrichment(answer({ valueLow: 40.4, valueHigh: 15 })).value).toEqual({
      low: 15, high: 40, currency: 'EUR', note: 'Selon l’état.',
    })
  })

  test('0 – 0, négatif ou illisible : pas d’estimation', () => {
    expect(parseEnrichment(answer({ valueLow: 0, valueHigh: 0 })).value).toBeNull()
    expect(parseEnrichment(answer({ valueLow: -5, valueHigh: 10 })).value).toBeNull()
    expect(parseEnrichment(answer({ valueLow: 'cher', valueHigh: 10 })).value).toBeNull()
  })

  test('refuse une réponse sans description détaillée', () => {
    expect(() => parseEnrichment('{"valueLow": 1, "valueHigh": 2}')).toThrow()
  })

  test('la consigne reprend la fiche rapide et signe Torix', () => {
    const prompt = enrichmentPrompt('en', { name: 'Desk lamp', category: 'lighting', description: '' })
    expect(prompt).toContain('Desk lamp')
    expect(prompt).toContain('Torix')
  })
})

describe('brouillons sur l’appareil', () => {
  const draft = (id: string, createdAt: number, over: Partial<Draft> = {}): Draft => ({
    id, createdAt, photo: { base64: 'AAAA', mimeType: 'image/jpeg' }, quick: null, enrichment: null, ...over,
  })
  const memory = (limit = Infinity) => {
    const data = new Map<string, string>()
    return {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (v.length > limit) throw new Error('QuotaExceededError')
        data.set(k, v)
      },
    }
  }

  test('étapes : fiche rapide, puis enrichissement, puis terminé', () => {
    const quick = { data: { name: 'n', category: 'c', description: 'd' }, source: 'on_device' as const }
    const enrichment = { data: { detailedDescription: 'x', value: null }, source: 'cloud' as const }
    expect(nextStep(draft('a', 1))).toBe('quick')
    expect(nextStep(draft('a', 1, { quick }))).toBe('enrich')
    expect(nextStep(draft('a', 1, { quick, enrichment }))).toBe('done')
  })

  test('enregistre les plus récents d’abord et les relit', () => {
    const store = memory()
    saveDrafts(store, [draft('vieux', 1), draft('neuf', 2)])
    expect(loadDrafts(store).map(d => d.id)).toEqual(['neuf', 'vieux'])
  })

  test('ne garde que les derniers brouillons', () => {
    const many = Array.from({ length: MAX_DRAFTS + 3 }, (_, i) => draft(`d${i}`, i))
    const kept = saveDrafts(memory(), many)
    expect(kept).toHaveLength(MAX_DRAFTS)
    expect(kept[0].id).toBe(`d${MAX_DRAFTS + 2}`)
  })

  test('stockage plein : abandonne les plus anciens', () => {
    const one = JSON.stringify([draft('a', 1)]).length
    const kept = saveDrafts(memory(one + 10), [draft('a', 1), draft('b', 2), draft('c', 3)])
    expect(kept.map(d => d.id)).toEqual(['c'])
  })

  test('stockage illisible : aucune fiche, pas d’erreur', () => {
    const store = memory()
    store.setItem(DRAFTS_KEY, '{cassé')
    expect(loadDrafts(store)).toEqual([])
  })

  test('mettre à jour un brouillon ne le duplique pas', () => {
    const next = upsertDraft([draft('a', 1), draft('b', 2)], draft('a', 1, { createdAt: 5 }))
    expect(next.map(d => d.id)).toEqual(['a', 'b'])
  })
})

describe('App Check : jeton de debug', () => {
  test('ignoré hors de localhost', () => {
    expect(debugTokenFor('abc', false)).toBeUndefined()
    expect(debugTokenFor('true', false)).toBeUndefined()
  })

  test('en local : la valeur, ou true pour en faire créer un', () => {
    expect(debugTokenFor('abc', true)).toBe('abc')
    expect(debugTokenFor('true', true)).toBe(true)
    expect(debugTokenFor(undefined, true)).toBeUndefined()
  })
})

describe('règles du hackathon', () => {
  const read = (file: string) => readFileSync(path.join(web, file), 'utf8')

  test('la page ne parle qu’au service : ni Firebase ni fournisseur d’IA en direct', () => {
    const page = read('pages/fiche-express.tsx')
    expect(page).toContain("from '../lib/hybridAI'")
    expect(page).not.toMatch(/from 'firebase|supabase|anthropic|generativelanguage/)
  })

  test('toute l’IA de la brique passe par Firebase AI Logic, App Check actif', () => {
    const files = readdirSync(path.join(web, 'lib/hybridAI')).map(f => read(`lib/hybridAI/${f}`)).join('\n')
    expect(files).toContain("from 'firebase/ai'")
    expect(files).toContain('initializeAppCheck')
    expect(files).not.toMatch(/api\.anthropic\.com|generativelanguage\.googleapis\.com|api\.openai\.com/)
  })

  test('sans le drapeau hackathon, la page n’existe pas', () => {
    expect(read('pages/fiche-express.tsx')).toContain('HACKATHON_BUILD ? { props: {} } : { notFound: true')
  })

  test('.env.example : les variables Firebase, sans aucune valeur', () => {
    const lines = read('.env.example').split('\n').filter(l => l.startsWith('NEXT_PUBLIC_FIREBASE_'))
    expect(lines.length).toBeGreaterThanOrEqual(6)
    for (const line of lines) expect(line).toMatch(/^[A-Z_]+=$/)
  })
})
