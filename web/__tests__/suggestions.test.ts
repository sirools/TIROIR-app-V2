import { describe, expect, test } from 'vitest'
import {
  firstNameOf,
  initialTriageState,
  linkHost,
  parseSuggestionInput,
  pendingWishes,
  showTriage,
  triageReducer,
  visibleWishes,
  type Wish,
} from '../lib/suggestions'

function wish(id: string, status: Wish['status'] = 'suggested', createdAt = `2026-09-0${id}T10:00:00Z`): Wish {
  return { id, status, title: `Objet ${id}`, url: null, price: null, currency: 'EUR', createdAt, author: null, imageUrl: null, fromTiroir: false }
}

describe('parseSuggestionInput', () => {
  test('nom seul', () => {
    expect(parseSuggestionInput({ title: '  Couteau   de chef ' })).toEqual({
      ok: true, value: { title: 'Couteau de chef', url: null, price: null, sourceObjectId: null },
    })
  })

  test('objet de son Tiroir : le titre devient facultatif', () => {
    const id = '0b0f6f4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b'
    expect(parseSuggestionInput({ sourceObjectId: id })).toEqual({
      ok: true, value: { title: '', url: null, price: null, sourceObjectId: id },
    })
    expect(parseSuggestionInput({ sourceObjectId: 'pas-un-uuid' })).toEqual({ ok: false, error: 'source_invalid' })
  })

  test('nom obligatoire', () => {
    expect(parseSuggestionInput({ title: '   ' })).toEqual({ ok: false, error: 'title_required' })
    expect(parseSuggestionInput({})).toEqual({ ok: false, error: 'title_required' })
  })

  test('nom trop long', () => {
    expect(parseSuggestionInput({ title: 'x'.repeat(121) })).toEqual({ ok: false, error: 'title_too_long' })
  })

  test('lien : https ajouté si absent, autres protocoles refusés', () => {
    const r = parseSuggestionInput({ title: 'A', url: 'exemple.fr/produit' })
    expect(r.ok && r.value.url).toBe('https://exemple.fr/produit')
    expect(parseSuggestionInput({ title: 'A', url: 'javascript:alert(1)' })).toEqual({ ok: false, error: 'url_invalid' })
    expect(parseSuggestionInput({ title: 'A', url: 'pas un lien' })).toEqual({ ok: false, error: 'url_invalid' })
  })

  test('prix à la française', () => {
    const r = parseSuggestionInput({ title: 'A', price: '1 200,50 €' })
    expect(r.ok && r.value.price).toBe(1200.5)
    const n = parseSuggestionInput({ title: 'A', price: 19.999 })
    expect(n.ok && n.value.price).toBe(20)
  })

  test('prix invalide', () => {
    expect(parseSuggestionInput({ title: 'A', price: '-3' })).toEqual({ ok: false, error: 'price_invalid' })
    expect(parseSuggestionInput({ title: 'A', price: 'douze' })).toEqual({ ok: false, error: 'price_invalid' })
    expect(parseSuggestionInput({ title: 'A', price: 1e9 })).toEqual({ ok: false, error: 'price_invalid' })
  })
})

describe('affichage', () => {
  test('prénom', () => {
    expect(firstNameOf('Clément Ougier')).toBe('Clément')
    expect(firstNameOf(null)).toBe('Quelqu’un')
  })

  test('domaine du lien', () => {
    expect(linkHost('https://www.exemple.fr/a')).toBe('exemple.fr')
    expect(linkHost(null)).toBeNull()
  })
})

describe('tri des suggestions', () => {
  const start = () => initialTriageState([wish('2'), wish('1'), wish('3', 'idea')])

  test('la pile commence par la plus ancienne', () => {
    expect(pendingWishes(start()).map(w => w.id)).toEqual(['1', '2'])
  })

  test('garder → idée, écarter → masquée de la grille', () => {
    let s = triageReducer(start(), { type: 'decide', id: '1', decision: 'keep' })
    s = triageReducer(s, { type: 'decide', id: '2', decision: 'dismiss' })
    expect(s.wishes.find(w => w.id === '1')?.status).toBe('idea')
    expect(visibleWishes(s).map(w => w.id).sort()).toEqual(['1', '3'])
    expect(pendingWishes(s)).toEqual([])
  })

  test('annuler rétablit la dernière décision, puis la précédente', () => {
    let s = triageReducer(start(), { type: 'decide', id: '1', decision: 'keep' })
    s = triageReducer(s, { type: 'decide', id: '2', decision: 'dismiss' })
    s = triageReducer(s, { type: 'undo' })
    expect(s.wishes.find(w => w.id === '2')?.status).toBe('suggested')
    expect(pendingWishes(s)[0].id).toBe('2')
    s = triageReducer(s, { type: 'undo' })
    expect(pendingWishes(s).map(w => w.id)).toEqual(['1', '2'])
    expect(triageReducer(s, { type: 'undo' })).toBe(s)
  })

  test('une idée ou une décision déjà prise ne se re-trie pas', () => {
    const s = start()
    expect(triageReducer(s, { type: 'decide', id: '3', decision: 'dismiss' })).toBe(s)
    expect(triageReducer(s, { type: 'decide', id: 'inconnu', decision: 'keep' })).toBe(s)
  })

  test('rollback après refus du serveur', () => {
    const s0 = start()
    const s1 = triageReducer(s0, { type: 'decide', id: '1', decision: 'keep' })
    const s2 = triageReducer(s1, { type: 'rollback', id: '1', status: 'suggested', history: s0.history })
    expect(s2).toEqual(s0)
  })

  test('visibilité du module', () => {
    expect(showTriage(initialTriageState([wish('3', 'idea')]))).toBe(false)
    let s = initialTriageState([wish('1')])
    expect(showTriage(s)).toBe(true)
    s = triageReducer(s, { type: 'decide', id: '1', decision: 'dismiss' })
    // Plus rien en attente, mais l'annulation reste possible pendant la session.
    expect(showTriage(s)).toBe(true)
  })

  test('ajout d’une suggestion créée par le visiteur', () => {
    const s = triageReducer(initialTriageState([]), { type: 'add', wish: wish('4') })
    expect(visibleWishes(s).map(w => w.id)).toEqual(['4'])
    expect(triageReducer(s, { type: 'add', wish: wish('4') })).toBe(s)
  })
})
