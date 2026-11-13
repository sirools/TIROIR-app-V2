import { describe, expect, test } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  buildListing, buildLotListing, canPrepareListing, clip, listingText, listingTitle, parseIds, parsePrice,
  roundEstimate, saleUpdate, slug, suggestCategory, withPractical, MAX_LISTINGS, TITLE_MAX,
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
    expect(l.title).toBe('Technics SL-1200 Platine vinyle')
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
    const f = { title: 'Titre', price: 'Prix', description: 'Description' }
    expect(listingText({ title: 'Fauteuil', price: '120', category: 'Ameublement', description: 'Bon état' }, f, 'EUR'))
      .toBe('Titre : Fauteuil\nPrix : 120 €\nDescription :\nBon état')
    expect(listingText({ title: 'Fauteuil', price: '', category: '', description: '' }, f, 'EUR')).toBe('Titre : Fauteuil')
  })

  test('titre : marque et modèle d’abord, 50 caractères au plus, coupé au mot', () => {
    expect(listingTitle('Enceinte amplifiée JBL EON 615', 'JBL', 'EON 615')).toBe('JBL EON 615 Enceinte amplifiée')
    expect(listingTitle('Enceinte', 'Montarbo', null)).toBe('Montarbo Enceinte')
    expect(listingTitle('JBL EON 615', 'jbl', 'EON 615')).toBe('jbl EON 615')
    const long = listingTitle('Enceinte de sonorisation amplifiée deux voies avec pied et housse', 'Montarbo', 'W440A')
    expect(long.length).toBeLessThanOrEqual(TITLE_MAX)
    expect(long).toBe('Montarbo W440A Enceinte de sonorisation amplifiée')
    expect(clip('a'.repeat(80))).toHaveLength(TITLE_MAX)
  })

  test('jamais de note, d’emplacement, de prêt ni de prix d’achat dans l’annonce', () => {
    const l = buildListing({
      ...base,
      attributes: { notes: 'Code alarme 1234', emplacement: 'Cave, étagère 3', loaned_to: 'Paul', prix_achat: '900', color: 'Noir' },
    }, labels)
    expect(l.description).toBe('Couleur : Noir')
  })

  test('prix conseillé arrondi, avec sa fourchette', () => {
    expect(roundEstimate(12.4)).toBe(12)
    expect(roundEstimate(143)).toBe(145)
    expect(roundEstimate(487)).toBe(490)
    const l = buildListing({ ...base, market_value: 143, value_sources: { value_min: 118, value_max: 171, sources: [] } }, labels)
    expect(l).toMatchObject({ price: 145, priceOrigin: 'estimate', range: { min: 120, max: 170 } })
    expect(buildListing({ ...base, quantity: 2, market_value: 50, value_sources: { value_min: 40, value_max: 60 } }, labels).range)
      .toEqual({ min: 80, max: 120 })
    expect(buildListing({ ...base, sale_price: 123, market_value: 200 }, labels).price).toBe(123)
    expect(buildListing({ ...base, market_value: 100 }, labels).range).toBeNull()
  })

  test('une seule annonce pour le lot : titres réunis, prix sommés s’ils sont tous connus', () => {
    const a = buildListing({ ...base, title: 'Enceinte', attributes: { brand: 'JBL', model: 'EON 615' }, sale_price: 250 }, labels)
    const b = buildListing({ ...base, title: 'Enceinte', attributes: { brand: 'Montarbo' }, market_value: 180 }, labels)
    const lot = buildLotListing([a, b], 'Lot de {n} : {titles}')
    expect(lot.title).toBe('Lot de 2 : JBL EON 615 Enceinte, Montarbo Enceinte')
    expect(lot.title.length).toBeLessThanOrEqual(TITLE_MAX)
    expect(lot).toMatchObject({ price: 430, priceOrigin: 'estimate', category: 'Photo, audio & vidéo', range: null })
    expect(lot.description).toBe('— JBL EON 615 Enceinte\nMarque : JBL\nModèle : EON 615\n\n— Montarbo Enceinte\nMarque : Montarbo')
    const c = buildListing({ ...base, title: 'Pied d’enceinte' }, labels)
    expect(buildLotListing([a, c], 'Lot de {n} : {titles}')).toMatchObject({ price: null, missing: ['price'] })
  })

  test('lignes pratiques : remplacées sans toucher aux retouches', () => {
    const known = ['Remise en main propre uniquement.', 'Remise en main propre ou envoi possible.']
    const one = withPractical('Bon état.\n\nMarque : JBL', [known[0]], known, ['Fiche complète :'])
    expect(one).toBe('Bon état.\n\nMarque : JBL\n\nRemise en main propre uniquement.')
    const two = withPractical(one, [known[1], 'Fiche complète : https://tiroir.app/s/abc'], known, ['Fiche complète :'])
    expect(two).toBe('Bon état.\n\nMarque : JBL\n\nRemise en main propre ou envoi possible.\nFiche complète : https://tiroir.app/s/abc')
    expect(withPractical(two, [known[0]], known, ['Fiche complète :'])).toBe(one)
    expect(withPractical('', [known[0]], known)).toBe(known[0])
  })

  test('prix saisi : chiffres seulement', () => {
    expect(parsePrice('120')).toBe(120)
    expect(parsePrice('1 200,50 €')).toBe(1200.5)
    expect(parsePrice(80)).toBe(80)
    expect(parsePrice('cent')).toBeNull()
    expect(parsePrice('-5')).toBeNull()
    expect(parsePrice('12.345')).toBeNull()
  })

  test('mise en vente : ce qui s’écrit sur une fiche', () => {
    const o = { price: 120, platform: 'leboncoin' as const, shared: false, now: '2026-11-13T10:00:00.000Z' }
    expect(saleUpdate('list', { quantity: 1 }, o)).toEqual({
      status: 'for_sale', listing_platform: 'leboncoin', listed_at: o.now, sold_price: null, sold_at: null, sale_price: 120,
    })
    expect(saleUpdate('list', { quantity: 4 }, o)).toMatchObject({ status: 'for_sale', sale_price_lot: 120 })
    expect(saleUpdate('list', { quantity: 4 }, o)).not.toHaveProperty('sale_price')
    // Une annonce pour plusieurs fiches : le prix du lot ne se répartit pas.
    const shared = saleUpdate('list', { quantity: 1 }, { ...o, shared: true })
    expect(shared).not.toHaveProperty('sale_price')
    expect(shared).not.toHaveProperty('sale_price_lot')
    expect(saleUpdate('list', { quantity: 1 }, { ...o, price: null })).not.toHaveProperty('sale_price')
    expect(saleUpdate('sold', { quantity: 1 }, { ...o, price: 100 })).toEqual({ status: 'sold', sold_at: o.now, sold_price: 100 })
    expect(saleUpdate('sold', { quantity: 1 }, { ...o, shared: true })).toEqual({ status: 'sold', sold_at: o.now, sold_price: null })
    expect(saleUpdate('unlist', { quantity: 1 }, o)).toEqual({ status: 'owned', listing_platform: null, listed_at: null })
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
