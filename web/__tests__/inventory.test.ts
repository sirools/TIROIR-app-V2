import { describe, expect, test } from 'vitest'
import {
  filterObjects, objectValue, safeBack, sortCollections, sortObjects, statusPatch, toggleSelection, isStatus,
  type CollectionRow, type ObjectRow,
} from '../lib/inventory'

const col = (id: string, over: Partial<CollectionRow> = {}): CollectionRow => ({
  id, name: id, emoji: null, icon_color: null, pinned_at: null,
  created_at: '2026-01-01', last_activity_at: null, object_count: 0, ...over,
})
const obj = (id: string, over: Partial<ObjectRow> = {}): ObjectRow => ({
  id, title: id, status: 'owned', group_id: null, quantity: 1, attributes: null,
  user_value: null, market_value: null, value_currency: '€', created_at: '2026-01-01', ...over,
})
const ids = (list: { id: string }[]) => list.map(x => x.id)

describe('inventaire : collections', () => {
  const list = [
    col('b', { name: 'Bureau', created_at: '2026-01-02', object_count: 3 }),
    col('a', { name: 'atelier', created_at: '2026-01-01', object_count: 9 }),
    col('p1', { pinned_at: '2026-02-01', created_at: '2026-01-03' }),
    col('p2', { pinned_at: '2026-03-01', created_at: '2026-01-04' }),
  ]
  test('épinglées d’abord, la dernière épinglée en tête ; le tri vaut pour le reste', () => {
    expect(ids(sortCollections(list, 'created_asc'))).toEqual(['p2', 'p1', 'a', 'b'])
    expect(ids(sortCollections(list, 'created_desc'))).toEqual(['p2', 'p1', 'b', 'a'])
    expect(ids(sortCollections(list, 'name_asc'))).toEqual(['p2', 'p1', 'a', 'b'])
    expect(ids(sortCollections(list, 'count_asc'))).toEqual(['p2', 'p1', 'b', 'a'])
    expect(ids(sortCollections(list, 'count_desc'))).toEqual(['p2', 'p1', 'a', 'b'])
  })
})

describe('inventaire : objets', () => {
  const list = [
    obj('1', { title: 'Enceinte', attributes: { brand: 'JBL', model: 'EON 615' }, market_value: 200, created_at: '2026-01-03' }),
    obj('2', { title: 'Ampli', attributes: { brand: 'Yamaha' }, user_value: 50, market_value: 900, quantity: 2, status: 'for_sale', created_at: '2026-01-02' }),
    obj('3', { title: 'Câble', created_at: '2026-01-01', status: 'sold' }),
  ]
  test('valeur : la sienne avant l’estimation, fois la quantité', () => {
    expect(list.map(objectValue)).toEqual([200, 100, null])
  })
  test('recherche sans accents sur nom, marque, modèle ; filtre par statut', () => {
    expect(ids(filterObjects(list, { query: 'jbl', status: '' }))).toEqual(['1'])
    expect(ids(filterObjects(list, { query: 'eon', status: '' }))).toEqual(['1'])
    expect(ids(filterObjects(list, { query: 'cable', status: '' }))).toEqual(['3'])
    expect(ids(filterObjects(list, { query: '', status: 'for_sale' }))).toEqual(['2'])
    expect(ids(filterObjects(list, { query: 'jbl', status: 'sold' }))).toEqual([])
  })
  test('tris ; un objet sans valeur reste en fin de liste', () => {
    expect(ids(sortObjects(list, 'recent'))).toEqual(['1', '2', '3'])
    expect(ids(sortObjects(list, 'name'))).toEqual(['2', '3', '1'])
    expect(ids(sortObjects(list, 'value_desc'))).toEqual(['1', '2', '3'])
    expect(ids(sortObjects(list, 'value_asc'))).toEqual(['2', '1', '3'])
  })
})

describe('inventaire : sélection', () => {
  const order = ['a', 'b', 'c', 'd', 'e']
  test('clic : la case bascule', () => {
    const one = toggleSelection(new Set(), order, 'b', { shift: false, anchor: null })
    expect([...one]).toEqual(['b'])
    expect([...toggleSelection(one, order, 'b', { shift: false, anchor: 'b' })]).toEqual([])
  })
  test('Maj + clic : la plage, dans un sens comme dans l’autre', () => {
    expect([...toggleSelection(new Set(['b']), order, 'd', { shift: true, anchor: 'b' })].sort()).toEqual(['b', 'c', 'd'])
    expect([...toggleSelection(new Set(['d']), order, 'a', { shift: true, anchor: 'd' })].sort()).toEqual(['a', 'b', 'c', 'd'])
    // Ancre absente de la liste affichée (filtrée depuis) : simple bascule.
    expect([...toggleSelection(new Set(), order, 'c', { shift: true, anchor: 'zz' })]).toEqual(['c'])
  })
})

describe('inventaire : statut et retour', () => {
  test('« en vente » et « vendu » datent l’événement ; tout autre statut efface le suivi de vente', () => {
    const now = '2026-11-13T10:00:00.000Z'
    expect(statusPatch('for_sale', now)).toEqual({ status: 'for_sale', listed_at: now, sold_at: null, sold_price: null })
    expect(statusPatch('sold', now)).toEqual({ status: 'sold', sold_at: now })
    expect(statusPatch('owned', now)).toEqual({ status: 'owned', listing_platform: null, listed_at: null, sold_at: null, sold_price: null })
    expect(isStatus('for_sale')).toBe(true)
    expect(isStatus('to_keep')).toBe(false)
  })
  test('retour : une page de l’inventaire, rien d’autre', () => {
    expect(safeBack('/mes-collections/abc-123')).toBe('/mes-collections/abc-123')
    expect(safeBack('/mes-collections/objets/abc')).toBe('/mes-collections/objets/abc')
    expect(safeBack('https://exemple.test')).toBe('/mes-collections')
    expect(safeBack('//exemple.test')).toBe('/mes-collections')
    expect(safeBack('/mes-collections/../admin')).toBe('/mes-collections')
    expect(safeBack(undefined)).toBe('/mes-collections')
  })
})
