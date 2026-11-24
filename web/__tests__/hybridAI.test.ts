// Brique d'IA hybride (« Fiche express ») : lecture des réponses des
// modèles, brouillons gardés sur l'appareil, et règles du hackathon —
// toute l'IA de la brique passe par Firebase AI Logic, aucune clé au dépôt.
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { enrichmentPrompt, observationsPrompt, parseEnrichment, parseQuickCard, quickCardPrompt } from '../lib/hybridAI/card'
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
  const mobile = (file: string) => readFileSync(path.join(web, '../mobile', file), 'utf8')

  test('site et app partagent le même contrat, les mêmes consignes, les mêmes brouillons', () => {
    for (const file of ['types.ts', 'card.ts', 'drafts.ts']) {
      expect(mobile(`src/services/hybridAI/${file}`), file).toBe(read(`lib/hybridAI/${file}`))
    }
  })

  test('app : l’écran ne parle qu’au service, le cloud passe par Firebase AI Logic', () => {
    const screen = mobile('app/(app)/capture/express.tsx')
    expect(screen).toContain("from '@/services/hybridAI'")
    expect(screen).not.toMatch(/tiroir-hybrid-ai|supabase|functions\/v1/)
    const swift = mobile('modules/tiroir-hybrid-ai/ios/TiroirHybridAIModule.swift')
    expect(swift).toContain('import FirebaseAILogic')
    expect(swift).toContain('AppCheck.setAppCheckProviderFactory')
    expect(swift).toContain('geminiLanguageModel')
    expect(swift).not.toMatch(/api\.anthropic\.com|generativelanguage\.googleapis\.com|api\.openai\.com/)
  })

  test('app : sans le drapeau, Firebase n’entre pas dans le build', () => {
    expect(mobile('modules/tiroir-hybrid-ai/ios/TiroirHybridAI.podspec')).toMatch(/if hackathon\s+spm_dependency/)
    expect(mobile('app.config.js')).toContain('if (!HACKATHON) return config')
    const lines = mobile('.env.example').split('\n').filter(l => l.startsWith('EXPO_PUBLIC_FIREBASE_') && !l.includes('APPCHECK_DEBUG'))
    expect(lines.length).toBeGreaterThanOrEqual(4)
    for (const line of lines) expect(line).toMatch(/^[A-Z_]+=$/)
  })

  test('app : les sept fonctions d’IA hors Firebase ne passent que par la porte, fermée dans le build hackathon', () => {
    const gate = mobile('src/services/legacyAI.ts')
    expect(gate).toContain('export const LEGACY_AI_ENABLED = !HACKATHON_BUILD')
    const functions = ['chat-turn', 'describe-object', 'detect-scene', 'estimate-value', 'assistant-chat', 'enhance-object-photo', 'scene-thumbnail']
    for (const fn of functions) expect(gate, fn).toContain(`'${fn}'`)

    // Aucun écran ni service n'appelle l'une d'elles en direct.
    const walk = (dir: string): string[] => readdirSync(path.join(web, '../mobile', dir), { withFileTypes: true })
      .flatMap(e => e.isDirectory() ? walk(`${dir}/${e.name}`) : /\.tsx?$/.test(e.name) ? [`${dir}/${e.name}`] : [])
    for (const file of [...walk('app'), ...walk('src')]) {
      if (file === 'src/services/legacyAI.ts') continue
      const code = mobile(file)
      for (const fn of functions) {
        expect(code, `${file} → ${fn}`).not.toContain(`functions.invoke('${fn}'`)
      }
      // chat-turn est appelé par fetch : seul son service a le droit de le nommer.
      if (code.includes('functions/v1/chat-turn')) expect(file).toBe('src/services/assistant/SupabaseAssistantService.ts')
    }
    // Ce service n'est pas instancié dans le build hackathon.
    expect(mobile('src/services/assistant/index.ts')).toMatch(/!LEGACY_AI_ENABLED\s+\? disabled/)
    // Les drapeaux serveur (scène, assistant) restent fermés.
    expect(mobile('src/features/objects/useFeatureFlags.ts')).toContain('if (!LEGACY_AI_ENABLED)')
  })

  test('la consigne de l’appareil ne s’appuie que sur ce que Vision a vu', () => {
    const prompt = observationsPrompt('fr', { labels: ['lamp', 'desk'], texts: ['IKEA "TERTIAL"'] })
    expect(prompt).toContain('lamp, desk')
    expect(prompt).toContain('IKEA  TERTIAL')
    expect(prompt).toContain('French')
    expect(observationsPrompt('en', { labels: [], texts: [] })).toContain('readable on the object: none')
  })

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
