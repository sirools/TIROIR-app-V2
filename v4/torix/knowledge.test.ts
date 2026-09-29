import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { answerQuestion, findTopic, SUGGESTIONS, TOPICS, UNKNOWN } from './knowledge.ts'
import { cleValide, peutFaire } from '../domain/serrure.ts'
import { estEnRetard, estTermine, statutObjetPendant, transition } from '../domain/pret.ts'

const v4 = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const byId = (id: string) => TOPICS.find(t => t.id === id)!.answer

// ── Torix trouve la bonne fiche ──────────────────────────────────────────

const QUESTIONS: [string, string][] = [
  ['C’est quoi la V4 ?', 'vision'],
  ['À quoi sert le Tiroir collaboratif ?', 'vision'],
  ['Comment marche le trousseau de clés ?', 'trousseau'],
  ['Comment inviter un membre ?', 'trousseau'],
  ['Qui peut modifier un objet ?', 'droits'],
  ['Qui peut prêter un objet ?', 'droits'],
  ['Comment marche la serrure ?', 'serrure'],
  ['Que veut dire entrouvert ?', 'serrure'],
  ['Quel est le cycle de vie d’un prêt ?', 'pret'],
  ['Quand un prêt est-il en retard ?', 'pret'],
  ['Comment marchent les suggestions ?', 'suggestions'],
  ['Comment trier les suggestions ?', 'suggestions'],
  ['Comment marche le parrainage ?', 'parrainage'],
  ['Que gagne le filleul ?', 'parrainage'],
  ['Quel est le plan de migration ?', 'migration'],
  ['Pourquoi ne pas ouvrir la RLS ?', 'migration'],
  ['Est-ce que la V4 touche la prod ?', 'prod'],
  ['Où en est la V4 ?', 'etat'],
  ['Quelles sont les prochaines étapes ?', 'etat'],
  ['On en est où de la V4 ?', 'etat'],
  ['La fusion entre les deux mondes est-elle probable ?', 'fusion'],
  ['Y a-t-il un risque de fission ?', 'fusion'],
  ['Quelles questions ouvertes restent ?', 'questions'],
  ['Et si un objet n’est pas rendu ?', 'questions'],
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
      assert.ok(file.startsWith('v4/'), `${t.id} : ${file}`)
      assert.doesNotThrow(() => v4(file.slice('v4/'.length)), `${t.id} : ${file} introuvable`)
    }
  }
})

test('les identifiants sont uniques', () => {
  assert.equal(new Set(TOPICS.map(t => t.id)).size, TOPICS.length)
})

test('hors de son savoir, il le dit', () => {
  assert.equal(answerQuestion('Quel temps fera-t-il demain ?').text, UNKNOWN)
})

test('le parrainage, non codé, reste un principe', () => {
  const a = answerQuestion('Comment marche le parrainage ?')
  assert.equal(a.register, 'principe')
  assert.match(a.text, /pas codé/)
})

// ── Les fiches suivent le code V4 ───────────────────────────────────────

const t0 = new Date('2026-09-29T12:00:00Z')

test('droits : ce que dit la fiche, domain/serrure.ts le fait', () => {
  const peut = (role: 'owner' | 'editor' | 'viewer', action: Parameters<typeof peutFaire>[2]) =>
    peutFaire('entrouvert', { role }, action, t0)
  // « Voir : lecteur et plus. Modifier : éditeur et plus. »
  assert.equal(peut('viewer', 'voir'), true)
  assert.equal(peut('viewer', 'modifier'), false)
  assert.equal(peut('editor', 'modifier'), true)
  // « Prêter et gérer les membres : le propriétaire seul. »
  for (const action of ['preter', 'gerer_membres'] as const) {
    assert.equal(peut('editor', action), false)
    assert.equal(peut('owner', action), true)
  }
  // « fermé, seul le propriétaire entre ; ouvert, tout le monde voit… »
  assert.equal(peutFaire('ferme', { role: 'editor' }, 'voir', t0), false)
  assert.equal(peutFaire('ouvert', null, 'voir', t0), true)
  assert.equal(peutFaire('ouvert', null, 'modifier', t0), false)
})

test('trousseau : rôles, expiration et invitation de 7 jours', () => {
  const sql = v4('supabase/drafts/0001_drawer_members.sql')
  assert.match(sql, /CHECK \(role IN \('owner', 'editor', 'viewer'\)\)/)
  assert.match(sql, /now\(\) \+ interval '7 days'/)
  assert.match(byId('trousseau'), /valable 7 jours/)
  const hier = new Date('2026-09-28T12:00:00Z')
  assert.equal(cleValide({ role: 'editor', expiresAt: hier }, t0), false)
  assert.equal(cleValide({ role: 'owner', expiresAt: hier }, t0), true)
})

test('serrure : trois niveaux, fermé par défaut', () => {
  const ts = v4('domain/serrure.ts')
  assert.match(ts, /type Serrure = 'ferme' \| 'entrouvert' \| 'ouvert'/)
  const sql = v4('supabase/drafts/0001_drawer_members.sql')
  assert.match(sql, /serrure TEXT NOT NULL DEFAULT 'ferme'/)
  assert.match(byId('serrure'), /réglage par défaut/)
})

test('prêt : le cycle de la fiche est celui de domain/pret.ts', () => {
  assert.equal(transition('demande', 'accepter'), 'accepte')
  assert.equal(transition('accepte', 'remettre'), 'en_cours')
  assert.equal(transition('en_cours', 'rendre'), 'rendu')
  assert.equal(transition('demande', 'refuser'), 'refuse')
  assert.equal(transition('demande', 'annuler'), 'annule')
  assert.equal(transition('accepte', 'annuler'), 'annule')
  // « un prêt en cours ne peut que revenir »
  assert.throws(() => transition('en_cours', 'annuler'))
  for (const s of ['rendu', 'refuse', 'annule'] as const) assert.equal(estTermine(s), true)
  // « échéance dépassée, jour inclus »
  const echeance = new Date(2026, 8, 29)
  assert.equal(estEnRetard({ statut: 'en_cours', echeance }, new Date(2026, 8, 29, 23, 0)), false)
  assert.equal(estEnRetard({ statut: 'en_cours', echeance }, new Date(2026, 8, 30, 0, 1)), true)
  assert.equal(statutObjetPendant('en_cours'), 'loaned')
  assert.match(byId('pret'), /« loaned »/)
  // Le SQL connaît les mêmes statuts.
  assert.match(v4('supabase/drafts/0002_object_loans.sql'),
    /status IN \('demande', 'accepte', 'en_cours', 'rendu', 'refuse', 'annule'\)/)
})

test('suggestions : garde-fous du brouillon 0003', () => {
  const sql = v4('supabase/drafts/0003_collection_suggestions.sql')
  const fiche = byId('suggestions')
  assert.match(sql, /BETWEEN 1 AND 120/)
  assert.match(fiche, /120 caractères/)
  assert.match(sql, /price BETWEEN 0 AND 10000000/)
  assert.match(fiche, /entre 0 et 10 M/)
  assert.match(sql, /v_pending >= 50/)
  assert.match(fiche, /50 suggestions en attente/)
  assert.match(sql, /suggestions_enabled BOOLEAN NOT NULL DEFAULT false/)
  assert.match(fiche, /Désactivé par défaut/)
})

test('parrainage : seuil et remise des décisions du 28 septembre', () => {
  const doc = v4('docs/parrainage.md')
  assert.match(doc, /Seuil : 2 à 3 filleuls/)
  assert.match(doc, /−50 %/)
  assert.match(byId('parrainage'), /2 à 3 filleuls/)
  assert.match(byId('parrainage'), /−50 %/)
})

test('état : la fiche suit prochaines-etapes.md', () => {
  const doc = v4('docs/prochaines-etapes.md')
  assert.match(doc, /feature\/v4-suggestions-web/)
  assert.match(doc, /rien n'est fusionné dans `main`/)
  assert.match(byId('etat'), /rien de la V4 n’est fusionné/)
})

test('fusion : la fiche suit la section « Fusion ou fission ? »', () => {
  const doc = v4('docs/prochaines-etapes.md')
  assert.match(doc, /## 5\. Fusion ou fission \?/)
  assert.match(doc, /table `collection_wishes` existe/)
  assert.match(byId('fusion'), /collection_wishes/)
  assert.match(doc, /suggestions appliquées en prod/)
  assert.match(byId('etat'), /déjà appliquées en prod, à vérifier/)
})
