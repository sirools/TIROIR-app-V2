import { describe, expect, test } from 'vitest'
import { cardsFor, computeStats, effectivePlan, PROFILE_CARDS, type StatRow } from '../lib/dashboard'
import { familyOf, isPersona, needsBusinessContact, PERSONAS, PERSONA_FAMILIES } from '../lib/personas'

const row = (over: Partial<StatRow> = {}): StatRow => ({
  status: 'owned', quantity: 1, user_value: null, market_value: null, value_currency: '€', sold_price: null, ...over,
})

describe('tableau de bord : chiffres personnels', () => {
  test('valeur : la sienne avant l’estimation, fois la quantité, hors objets sortis du Tiroir', () => {
    const s = computeStats([
      row({ market_value: 100 }),
      row({ user_value: 40, market_value: 900, quantity: 3 }),
      row({ status: 'sold', market_value: 500, sold_price: 450 }),
      row({ status: 'given', market_value: 70 }),
      row({ status: 'lost', user_value: 30 }),
      row({ status: 'for_sale', market_value: 60 }),
      row({ status: 'loaned', market_value: 20 }),
      row(),
    ], 7)
    expect(s).toEqual({ objects: 8, value: 300, currency: 'EUR', shares: 7, loaned: 1, forSale: 1, sold: 1, salesTotal: 450 })
  })

  test('plusieurs devises : celle qui porte le plus de fiches, jamais une somme mélangée', () => {
    const s = computeStats([row({ market_value: 10 }), row({ market_value: 20 }), row({ market_value: 999, value_currency: '$' })], 0)
    expect(s).toMatchObject({ value: 30, currency: 'EUR' })
  })

  test('compte vide', () => {
    expect(computeStats([], 0)).toMatchObject({ objects: 0, value: 0, currency: 'EUR', salesTotal: 0 })
  })
})

describe('tableau de bord : cartes selon l’offre et le profil', () => {
  test('palier effectif : un Pro échu redevient gratuit', () => {
    expect(effectivePlan('pro', '2020-01-01', '2026-11-13')).toBe('free')
    expect(effectivePlan('pro', '2999-01-01', '2026-11-13')).toBe('pro')
    expect(effectivePlan('pro', null)).toBe('pro')
    expect(effectivePlan('premium', null)).toBe('premium')
    expect(effectivePlan(null, null)).toBe('free')
  })

  test('base pour l’offre gratuite, une carte de plus en Premium et en Pro', () => {
    expect(cardsFor({ plan: 'free' })).toEqual(['objects', 'value', 'shares'])
    expect(cardsFor({ plan: 'premium' })).toEqual(['objects', 'value', 'shares', 'loaned'])
    expect(cardsFor({ plan: 'pro' })).toEqual(['objects', 'value', 'shares', 'forSale'])
  })

  test('cartes par famille de profils ; le profil l’emporte sur l’offre', () => {
    expect(cardsFor({ plan: 'free', profile: 'brocanteur' })).toEqual(['forSale', 'sold', 'salesTotal', 'value'])
    expect(cardsFor({ plan: 'pro', profile: 'antiquaire' })).toEqual(['forSale', 'sold', 'salesTotal', 'value'])
    expect(cardsFor({ plan: 'free', profile: 'videaste' })).toEqual(['value', 'loaned', 'shares', 'objects'])
    expect(cardsFor({ plan: 'free', profile: 'mecano' })).toEqual(['objects', 'value', 'loaned', 'shares'])
    // Maison, santé, autre : le profil de base, enrichi avec l'offre.
    expect(cardsFor({ plan: 'free', profile: 'particulier' })).toEqual(['objects', 'value', 'shares'])
    expect(cardsFor({ plan: 'premium', profile: 'autre' })).toEqual(['objects', 'value', 'shares', 'loaned'])
    expect(cardsFor({ plan: 'free', profile: 'chirurgien' })).toEqual(['objects', 'value', 'shares'])
  })

  test('liste des profils : sans doublon, au format accepté par la base, santé vers un contact', () => {
    expect(new Set(PERSONAS).size).toBe(PERSONAS.length)
    for (const p of PERSONAS) expect(p).toMatch(/^[a-z][a-z_]{1,39}$/)
    expect(PERSONA_FAMILIES.map(f => f.key)).toEqual(['home', 'creation', 'trades', 'commerce', 'health', 'other'])
    expect(isPersona('videaste')).toBe(true)
    expect(isPersona('admin')).toBe(false)
    expect(familyOf('brocanteur')).toBe('commerce')
    expect(familyOf(null)).toBeNull()
    expect(needsBusinessContact('service_hospitalier')).toBe(true)
    expect(needsBusinessContact('particulier')).toBe(false)
  })

  test('un profil sans cartes propres retombe sur la base ; quatre cartes au plus', () => {
    expect(cardsFor({ plan: 'free', profile: 'inconnu' })).toEqual(['objects', 'value', 'shares'])
    PROFILE_CARDS.essai = ['forSale', 'sold', 'salesTotal', 'value', 'objects']
    expect(cardsFor({ plan: 'free', profile: 'essai' })).toEqual(['forSale', 'sold', 'salesTotal', 'value'])
    delete PROFILE_CARDS.essai
  })
})
