import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cleValide, peutFaire } from './serrure.ts'

const maintenant = new Date('2026-09-26T12:00:00Z')
const hier = new Date('2026-09-25T12:00:00Z')
const demain = new Date('2026-09-27T12:00:00Z')

test('le propriétaire peut tout, quelle que soit la serrure', () => {
  for (const serrure of ['ferme', 'entrouvert', 'ouvert'] as const) {
    for (const action of ['voir', 'modifier', 'preter', 'gerer_membres'] as const) {
      assert.equal(peutFaire(serrure, { role: 'owner' }, action, maintenant), true)
    }
  }
})

test('fermé : seul le propriétaire entre, même avec une clé', () => {
  assert.equal(peutFaire('ferme', { role: 'editor' }, 'voir', maintenant), false)
  assert.equal(peutFaire('ferme', { role: 'viewer' }, 'voir', maintenant), false)
  assert.equal(peutFaire('ferme', null, 'voir', maintenant), false)
})

test('entrouvert : les membres agissent selon leur rôle, les autres ne voient rien', () => {
  assert.equal(peutFaire('entrouvert', { role: 'viewer' }, 'voir', maintenant), true)
  assert.equal(peutFaire('entrouvert', { role: 'viewer' }, 'modifier', maintenant), false)
  assert.equal(peutFaire('entrouvert', { role: 'editor' }, 'modifier', maintenant), true)
  assert.equal(peutFaire('entrouvert', { role: 'editor' }, 'preter', maintenant), false)
  assert.equal(peutFaire('entrouvert', { role: 'editor' }, 'gerer_membres', maintenant), false)
  assert.equal(peutFaire('entrouvert', null, 'voir', maintenant), false)
})

test('ouvert : tout le monde voit, seules les clés permettent de modifier', () => {
  assert.equal(peutFaire('ouvert', null, 'voir', maintenant), true)
  assert.equal(peutFaire('ouvert', null, 'modifier', maintenant), false)
  assert.equal(peutFaire('ouvert', { role: 'editor' }, 'modifier', maintenant), true)
})

test('une clé confiée expire', () => {
  assert.equal(cleValide({ role: 'editor', expiresAt: demain }, maintenant), true)
  assert.equal(cleValide({ role: 'editor', expiresAt: hier }, maintenant), false)
  assert.equal(peutFaire('entrouvert', { role: 'editor', expiresAt: hier }, 'voir', maintenant), false)
  assert.equal(peutFaire('ouvert', { role: 'editor', expiresAt: hier }, 'modifier', maintenant), false)
})

test('la clé du propriétaire ne dépend pas d\'une date', () => {
  assert.equal(cleValide({ role: 'owner', expiresAt: hier }, maintenant), true)
})
