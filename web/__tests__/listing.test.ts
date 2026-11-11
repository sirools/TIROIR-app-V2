import { describe, expect, test } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  buildListing, canPrepareListing, listingText, parseIds, slug, suggestCategory, MAX_LISTINGS,
  type ListingInput, type ListingLabels,
} from '../lib/listing'
import { crc32, uniqueNames, zipStore } from '../lib/zipStore'

const labels: ListingLabels = {
  attrs: { condition: 'État', brand: 'Marque', model: 'Modèle', dimensions: 'Dimensions', accessories: 'Accessoires', color: 'Couleur' },
  quantity: 'Quantité',
  lot: 'lot de {n}',
}

const base: ListingInput = {
  title: 'Fauteuil', description: null, attributes: null, quantity: 1,
  sale_price: null, sale_price_lot: null, user_value: null, market_value: null, value_currency: '€',
}

describe('préparer une annonce : paliers', () => {
  test('Pro et Business seulement', () => {
    expect(canPrepareListing('pro', null, undefined)).toBe(true)
    expect(canPrepareListing('business', null, undefined)).toBe(true)
    expect(canPrepareListing('premium', null, undefined)).toBe(false)
    expect(canPrepareListing('free', null, undefined)).toBe(false)
    expect(canPrepareListing(null, null, undefined)).toBe(false)
  })

  test('un Pro échu redevient gratuit ; le drapeau coupe tout le monde', () => {
    expect(canPrepareListing('pro', '2020-01-01', undefined)).toBe(false)
    expect(canPrepareListing('pro', '2999-01-01', undefined)).toBe(true)
    expect(canPrepareListing('pro', null, 'off')).toBe(false)
    expect(canPrepareListing('business', null, 'off')).toBe(false)
  })
})

describe('préparer une annonce : contenu', () => {
  test('description structurée, dans l’ordre état, marque, modèle, dimensions, accessoires', () => {
    const l = buildListing({
      ...base,
      title: 'Platine vinyle',
      description: 'Fonctionne très bien.',
      attributes: { model: 'SL-1200', brand: 'Technics', accessories: 'Cellule, couvercle', condition: 'Bon état', dimensions: '45 × 36 cm', color: 'Argent' },
    }, labels)
    expect(l.description).toBe(
      'Fonctionne très bien.\n\nÉtat : Bon état\nMarque : Technics\nModèle : SL-1200\nDimensions : 45 × 36 cm\nAccessoires : Cellule, couvercle\nCouleur : Argent',
    )
    expect(l.title).toBe('Platine vinyle Technics SL-1200')
    expect(l.missing).toEqual(['price'])
  })

  test('le titre ne répète pas une marque qu’il contient déjà', () => {
    const l = buildListing({ ...base, title: 'Lampe Jieldé', attributes: { brand: 'Jielde' } }, labels)
    expect(l.title).toBe('Lampe Jieldé')
  })

  test('clés françaises des fiches anciennes ; jamais le numéro de série', () => {
    const l = buildListing({ ...base, attributes: { 'État': 'Neuf', Marque: 'Ikea', 'N° de série': 'X123', serial_number: 'X123', vide: ' ' } }, labels)
    expect(l.description).toBe('État : Neuf\nMarque : Ikea')
    expect(l.description).not.toContain('X123')
  })

  test('ce qui manque est listé', () => {
    expect(buildListing(base, labels).missing).toEqual(['description', 'condition', 'brand', 'model', 'dimensions', 'accessories', 'price'])
  })

  test('prix : celui du vendeur, sinon l’estimation ; lot compris', () => {
    expect(buildListing({ ...base, sale_price: 120, market_value: 200 }, labels)).toMatchObject({ price: 120, priceOrigin: 'seller', currency: 'EUR' })
    expect(buildListing({ ...base, user_value: 90, market_value: 200 }, labels)).toMatchObject({ price: 90, priceOrigin: 'estimate' })
    expect(buildListing({ ...base, market_value: 79.6 }, labels).price).toBe(80)
    expect(buildListing(base, labels)).toMatchObject({ price: null, priceOrigin: null })
    const lot = buildListing({ ...base, quantity: 4, sale_price: 10 }, labels)
    expect(lot.price).toBe(40)
    expect(lot.description).toBe('Quantité : lot de 4')
    expect(buildListing({ ...base, quantity: 4, sale_price: 10, sale_price_lot: 30 }, labels).price).toBe(30)
    expect(buildListing({ ...base, quantity: 3, market_value: 20 }, labels).price).toBe(60)
  })

  test('catégorie suggérée, ou rien plutôt qu’une rubrique inventée', () => {
    expect(suggestCategory('Table basse en verre')).toBe('Ameublement')
    expect(suggestCategory('Six chaises bistrot')).toBe('Ameublement')
    expect(suggestCategory('Vélo de course')).toBe('Vélos')
    expect(suggestCategory('iPhone 13')).toBe('Téléphones & Objets connectés')
    expect(suggestCategory('Bijoux anciens')).toBe('Montres & Bijoux')
    expect(suggestCategory('Truc indéfinissable')).toBeNull()
    expect(suggestCategory(null, '')).toBeNull()
    expect(buildListing({ ...base, title: 'Sans nom', attributes: { category: 'Jouets' } }, labels).category).toBe('Jeux & Jouets')
  })

  test('tout copier : les champs remplis seulement', () => {
    const f = { title: 'Titre', price: 'Prix', category: 'Catégorie', description: 'Description' }
    expect(listingText({ title: 'Fauteuil', price: '120', category: '', description: 'Bon état' }, f, 'EUR'))
      .toBe('Titre : Fauteuil\nPrix : 120 €\nDescription :\nBon état')
  })

  test('identifiants de l’adresse : uniques et bornés', () => {
    expect(parseIds('a, b,,a')).toEqual(['a', 'b'])
    expect(parseIds(undefined)).toEqual([])
    expect(parseIds(Array.from({ length: 80 }, (_, i) => `id${i}`).join(','))).toHaveLength(MAX_LISTINGS)
  })

  test('nom de dossier sûr', () => {
    expect(slug('Fauteuil Émile / n°2')).toBe('fauteuil-emile-n-2')
    expect(slug('···')).toBe('objet')
  })
})

describe('archive des photos', () => {
  test('CRC-32 de référence', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
  })

  test('noms en double distingués', () => {
    expect(uniqueNames(['a/photo-1.jpg', 'a/photo-1.jpg', 'b/photo-1.jpg', 'a/photo-1.jpg']))
      .toEqual(['a/photo-1.jpg', 'a/photo-1-2.jpg', 'b/photo-1.jpg', 'a/photo-1-3.jpg'])
  })

  test('archive lisible par unzip', () => {
    const zip = zipStore([
      { name: 'fauteuil-émile/photo-1.jpg', data: new Uint8Array([1, 2, 3, 4]) },
      { name: 'photo-2.jpg', data: new Uint8Array(0) },
    ])
    expect(new DataView(zip.buffer).getUint32(0, true)).toBe(0x04034b50)
    const file = join(mkdtempSync(join(tmpdir(), 'tiroir-zip-')), 't.zip')
    writeFileSync(file, zip)
    let listing: string
    try {
      listing = execFileSync('unzip', ['-t', file], { encoding: 'utf8' })
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return // pas d'unzip sur cette machine
      throw e
    }
    expect(listing).toContain('No errors detected')
    expect(listing).toContain('photo-2.jpg')
  })
})
