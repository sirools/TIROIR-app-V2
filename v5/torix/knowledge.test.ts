import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { answerQuestion, findTopic, SUGGESTIONS, TOPICS, UNKNOWN } from './knowledge.ts'

const v5 = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

const QUESTIONS: [string, string][] = [
  ['C’est quoi la V5 ?', 'vision'],
  ['Que contient la V5 ?', 'vision'],
  ['Qu’apporte la V5 par rapport à la V4 ?', 'v4'],
  ['Quelles questions ouvertes restent ?', 'questions'],
  ['Est-ce que la V5 touche la prod ?', 'prod'],
  ['Qui es-tu ?', 'torix'],
]

for (const [question, id] of QUESTIONS) {
  test(`${question} → ${id}`, () => {
    assert.equal(findTopic(question)?.id, id)
  })
}

test('chaque suggestion affichée a une réponse', () => {
  for (const s of SUGGESTIONS) assert.notEqual(findTopic(s), null, s)
})

test('chaque fiche annonce son registre et une source qui existe', () => {
  for (const t of TOPICS) {
    assert.ok(['fait', 'estimation', 'principe'].includes(t.register), t.id)
    for (const file of t.source.split(' · ')) {
      assert.ok(file.startsWith('v5/'), `${t.id} : ${file}`)
      assert.doesNotThrow(() => v5(file.slice('v5/'.length)), `${t.id} : ${file} introuvable`)
    }
  }
})

test('les identifiants sont uniques', () => {
  assert.equal(new Set(TOPICS.map(t => t.id)).size, TOPICS.length)
})

test('hors de son savoir, il le dit', () => {
  assert.equal(answerQuestion('Quel temps fera-t-il demain ?').text, UNKNOWN)
})

// Tant que docs/vision.md ne consigne aucune décision, Torix ne doit rien
// affirmer de la V5. Dès qu'une décision y entre, ce test casse : il faut
// alors écrire la fiche correspondante et mettre ce test à jour.
test('les fiches suivent docs/vision.md : aucune décision, rien d’inventé', () => {
  const doc = v5('docs/vision.md')
  const decisions = doc.slice(doc.indexOf('## Décisions'), doc.indexOf('## Questions ouvertes'))
  assert.match(decisions, /_Aucune pour l'instant\._/)
  assert.match(answerQuestion('C’est quoi la V5 ?').text, /pas encore définie/)
  assert.match(doc, /Que couvre la V5, par rapport à la V4\.0/)
  assert.match(TOPICS.find(t => t.id === 'questions')!.answer, /que couvre la V5 par rapport à la V4\.0/)
})
