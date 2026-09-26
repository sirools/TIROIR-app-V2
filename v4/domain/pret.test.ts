import { test } from 'node:test'
import assert from 'node:assert/strict'
import { estEnRetard, estTermine, statutObjetPendant, transition } from './pret.ts'

test('parcours nominal : demande, acceptation, remise, retour', () => {
  let statut = transition('demande', 'accepter')
  assert.equal(statut, 'accepte')
  statut = transition(statut, 'remettre')
  assert.equal(statut, 'en_cours')
  statut = transition(statut, 'rendre')
  assert.equal(statut, 'rendu')
  assert.equal(estTermine(statut), true)
})

test('une demande peut être refusée ou annulée, un prêt accepté annulé', () => {
  assert.equal(transition('demande', 'refuser'), 'refuse')
  assert.equal(transition('demande', 'annuler'), 'annule')
  assert.equal(transition('accepte', 'annuler'), 'annule')
})

test('les transitions impossibles sont refusées', () => {
  assert.throws(() => transition('demande', 'rendre'))
  assert.throws(() => transition('en_cours', 'annuler'))
  assert.throws(() => transition('rendu', 'remettre'))
  assert.throws(() => transition('refuse', 'accepter'))
})

test('retard : seulement un prêt remis dont l\'échéance est passée', () => {
  const echeance = new Date(2026, 8, 25)
  assert.equal(estEnRetard({ statut: 'en_cours', echeance }, new Date(2026, 8, 25, 20)), false)
  assert.equal(estEnRetard({ statut: 'en_cours', echeance }, new Date(2026, 8, 26, 9)), true)
  assert.equal(estEnRetard({ statut: 'accepte', echeance }, new Date(2026, 8, 26, 9)), false)
  assert.equal(estEnRetard({ statut: 'en_cours', echeance: null }, new Date(2026, 8, 26, 9)), false)
})

test('l\'objet passe en « loaned » uniquement pendant le prêt', () => {
  assert.equal(statutObjetPendant('en_cours'), 'loaned')
  assert.equal(statutObjetPendant('accepte'), null)
  assert.equal(statutObjetPendant('rendu'), null)
})
