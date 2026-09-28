import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { answerQuestion, findTopic, SUGGESTIONS, TOPICS, UNKNOWN } from '../components/torix/knowledge'

const repo = (p: string) => readFileSync(path.resolve(__dirname, '../..', p), 'utf8')

describe('Torix trouve la bonne fiche', () => {
  test.each([
    ['Quelles IA utilise Tiroir ?', 'ia'],
    ['Combien ça coûte à 150 000 ?', 'echelle'],
    ['Comment réduire les coûts ?', 'leviers'],
    ['Quelle est la prochaine étape ?', 'phases'],
    ['Combien coûte une analyse de scène ?', 'couts'],
    ['À quoi sert Tiroir ?', 'principes'],
    ['Qui dois-je contacter chez Supabase ?', 'contacts'],
    ['À qui appartiens-tu ?', 'gouvernance'],
    ['Quels sont les quotas du forfait Premium ?', 'quotas'],
    ['Quels sont tes commandements ?', 'commandements'],
    ['Qui es-tu ?', 'torix'],
    ['Est-ce que Tiroir dépend de Claude ?', 'ia'],
  ])('%s → %s', (question, id) => {
    expect(findTopic(question)?.id).toBe(id)
  })

  test('chaque suggestion affichée a une réponse', () => {
    for (const s of SUGGESTIONS) expect(findTopic(s)).not.toBeNull()
  })
})

describe('answerQuestion', () => {
  test('les directions marchent toujours', () => {
    expect(answerQuestion('Où est le nord ?').text).toBe('Le nord est devant toi.')
    expect(answerQuestion("Où est l'ouest ?").text).toBe("L'ouest est à ta gauche.")
  })

  test('chaque fiche annonce son registre et sa source', () => {
    const a = answerQuestion('Combien ça coûte à 150 000 ?')
    expect(a.register).toBe('estimation')
    expect(a.source).toBe('strategie/torix-et-tiroir.md')
    for (const t of TOPICS) expect(t.source.length).toBeGreaterThan(0)
  })

  test('hors de son savoir, il le dit', () => {
    expect(answerQuestion('Quel temps fera-t-il demain ?').text).toBe(UNKNOWN)
  })
})

describe('les fiches suivent le code', () => {
  const aiUsage = repo('supabase/functions/_shared/aiUsage.ts')
  const byId = (id: string) => TOPICS.find(t => t.id === id)!.answer

  test('coûts mesurés', () => {
    const measured = (key: string) => Number(new RegExp(`'${key}': ([0-9.]+)`).exec(aiUsage)![1])
    const cents = (usd: number, digits: number) => (usd * 100).toFixed(digits).replace('.', ',') + ' c'
    const couts = byId('couts')
    expect(couts).toContain(cents(measured('detect_scene:claude-haiku-4-5'), 2))
    expect(couts).toContain(cents(measured('detect_scene:claude-sonnet-5'), 1))
    expect(couts).toContain(cents(measured('detect_scene:claude-opus-5'), 1))
    expect(couts).toContain(cents(measured('describe_object:claude-haiku-4-5'), 2))
  })

  test('prix d’une image Gemini (1 290 tokens de sortie)', () => {
    const out = Number(/'gemini-2\.5-flash-image': \{ input: [0-9.]+, output: ([0-9.]+) \}/.exec(aiUsage)![1])
    const cents = ((1290 * out) / 1_000_000 * 100).toFixed(1).replace('.', ',')
    expect(byId('couts')).toContain(`${cents} c`)
  })

  test('modèles par fonction', () => {
    const model = (fn: string) => /const (?:CLAUDE_MODEL|GEMINI_MODEL|DEFAULT_MODEL) = '([^']+)'/.exec(repo(`supabase/functions/${fn}/index.ts`))![1]
    expect(model('detect-scene')).toBe('claude-haiku-4-5')
    expect(model('describe-object')).toBe('claude-haiku-4-5')
    expect(model('estimate-value')).toBe('claude-sonnet-4-6')
    expect(model('enhance-object-photo')).toBe('gemini-2.5-flash-image')
    expect(byId('ia')).toContain('Sonnet 4.6 + recherche web')
  })

  test('prix des forfaits', () => {
    const pricing = repo('web/pages/pricing.tsx')
    expect(pricing).toContain('6,99 €')
    expect(pricing).toContain('29 €')
  })
})
