import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { OFFERS, credits, euros } from '../lib/offers'
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
    // Fiches tirées du Notion du fondateur
    ['Quelle est ta doctrine ?', 'doctrine'],
    ['Quels sont tes niveaux d’autonomie ?', 'autonomie'],
    ['Que dit le contrat entre Tiroir et Torix ?', 'contrat'],
    ['Quels sont les principes de design de Tiroir ?', 'design'],
    ['Quelle est la direction artistique ?', 'da'],
    ['Pourquoi l’orange ?', 'da'],
    ['Si Tiroir était une personne ?', 'voix'],
    ['Et l’écologie dans Tiroir ?', 'ecologie'],
    ['Quelles idées pour le futur ?', 'futur'],
    ['Quels articles ai-je écrits sur Medium ?', 'articles'],
    ['Parle-moi de la piste de doctorat', 'these'],
    ['Où est mon portfolio ?', 'fondateur'],
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

  test('les fiches Notion disent d’où elles viennent', () => {
    for (const id of ['doctrine', 'autonomie', 'contrat', 'design', 'da', 'voix', 'ecologie', 'futur', 'articles', 'these']) {
      expect(TOPICS.find(t => t.id === id)!.source.startsWith('Notion')).toBe(true)
    }
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

  test('prix des forfaits : la fiche suit lib/offers.ts, la page aussi', () => {
    const pricing = repo('web/pages/pricing.tsx')
    expect(pricing).toContain("from '../lib/offers'")
    expect(pricing).not.toMatch(/\d+,\d{2} €/)
    const fiche = byId('quotas')
    expect(fiche).toContain(`${OFFERS.free.aiObjects} objets`)
    for (const pack of OFFERS.packs) expect(fiche).toContain(`${pack.credits} ${pack === OFFERS.packs[0] ? 'crédits ' : ''}à ${euros(pack.priceTtc)}`)
    expect(fiche).toContain(euros(OFFERS.premium.monthlyTtc))
    expect(fiche).toContain(euros(OFFERS.pro.baseHt))
    expect(fiche).toContain(`${credits(OFFERS.pro.includedCredits)} crédits`)
    expect(fiche).toContain(euros(OFFERS.pro.extraCreditHt))
    expect(fiche).toContain(euros(OFFERS.legacyPremiumTtc))
  })
})

describe('Torix connaît la V4.0, qui porte aussi la V5', () => {
  const byId = (id: string) => TOPICS.find(t => t.id === id)!.answer

  test.each([
    ['C’est quoi la V4 ?', 'v4'],
    ['Comment marche le trousseau de clés ?', 'v4-trousseau'],
    ['Qui peut prêter un objet ?', 'v4-droits'],
    ['Comment marche la serrure ?', 'v4-serrure'],
    ['Quel est le cycle de vie d’un prêt ?', 'v4-pret'],
    ['Comment marchent les suggestions ?', 'v4-suggestions'],
    ['Comment marche le parrainage ?', 'v4-parrainage'],
    ['Quel est le plan de migration vers le Tiroir partagé ?', 'v4-migration'],
    ['Où en est la V4 ?', 'v4-etat'],
    ['On en est où de la V4 ?', 'v4-etat'],
    ['La fusion entre les deux mondes est-elle probable ?', 'v4-fusion'],
    ['Y a-t-il un risque de fission ?', 'v4-fusion'],
    ['C’est quoi la V5 ?', 'v5'],
  ])('%s → %s', (question, id) => {
    expect(findTopic(question)?.id).toBe(id)
  })

  test('chaque source V4 existe dans le dépôt', () => {
    for (const t of TOPICS.filter(t => t.id.startsWith('v4') || t.id === 'v5')) {
      for (const file of t.source.split(' · ')) expect(() => repo(file)).not.toThrow()
    }
  })

  test('les fiches V4 sont identiques à celles de v4/torix', () => {
    // Même texte que le chantier : on compare les phrases, pas le code.
    const v4 = repo('v4/torix/knowledge.ts')
    const pairs: [string, string][] = [
      ['v4', 'vision'], ['v4-trousseau', 'trousseau'], ['v4-droits', 'droits'],
      ['v4-serrure', 'serrure'], ['v4-pret', 'pret'], ['v4-suggestions', 'suggestions'],
      ['v4-parrainage', 'parrainage'], ['v4-migration', 'migration'], ['v4-etat', 'etat'], ['v4-fusion', 'fusion'], ['v5', 'v5'],
    ]
    for (const [webId] of pairs) {
      for (const line of byId(webId).split('\n')) {
        expect(v4, `${webId} : « ${line} »`).toContain(line.replace(/'/g, "\\'"))
      }
    }
  })

  test('les faits V4 suivent les brouillons et le domaine', () => {
    expect(repo('v4/supabase/drafts/0001_drawer_members.sql')).toContain("now() + interval '7 days'")
    expect(repo('v4/supabase/drafts/0001_drawer_members.sql')).toContain("serrure TEXT NOT NULL DEFAULT 'ferme'")
    expect(repo('v4/supabase/drafts/0003_collection_suggestions.sql')).toContain('v_pending >= 50')
    expect(repo('v4/domain/serrure.ts')).toContain("preter: 'owner'")
    expect(repo('v4/domain/serrure.ts')).toContain("modifier: 'editor'")
    expect(repo('v4/domain/pret.ts')).toContain("en_cours: { rendre: 'rendu' }")
  })

  test('la V5 se fait dans la V4, comme le dit vision.md', () => {
    expect(repo('v4/docs/vision.md')).toContain('pas de V5 séparée')
    expect(byId('v5')).toContain('plus de V5 à part')
  })
})
