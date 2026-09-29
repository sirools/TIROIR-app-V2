import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { FALLBACK, featureLists, parseQuotas } from '../lib/planQuotas'

describe('parseQuotas : les valeurs réelles de app_settings', () => {
  test('lit les colonnes, y compris les NUMERIC renvoyés en chaînes', () => {
    const q = parseQuotas({
      free_objects_max: 30, free_ai_quota_monthly: '30', free_photos_per_object: 1,
      free_value_estimate_monthly: 3, premium_ai_quota_monthly: '150',
      premium_photo_enhance_quota_monthly: 50, premium_value_estimate_monthly: 20,
      pro_ai_quota_monthly: 300, pro_photo_enhance_quota_monthly: 100, pro_value_estimate_monthly: 60,
    })
    expect(q).toEqual({
      freeObjects: 30, freeAnalyses: 30, freePhotosPerObject: 1, freeEstimates: 3,
      premiumAnalyses: 150, premiumEnhances: 50, premiumEstimates: 20,
      proAnalyses: 300, proEnhances: 100, proEstimates: 60,
    })
  })

  test('valeur absente ou invalide : on garde le repli', () => {
    expect(parseQuotas(null)).toEqual(FALLBACK)
    expect(parseQuotas({ free_objects_max: 'abc', premium_ai_quota_monthly: -5, pro_ai_quota_monthly: null, free_ai_quota_monthly: '' })).toEqual(FALLBACK)
  })
})

describe('featureLists : ce que la page affiche', () => {
  const lists = featureLists({ ...FALLBACK, freeObjects: 30, freeAnalyses: 30, freePhotosPerObject: 1, premiumAnalyses: 150, premiumEnhances: 50 })

  test('les chiffres viennent des quotas', () => {
    expect(lists.free).toContain('30 objets')
    expect(lists.free).toContain('30 analyses IA / mois')
    expect(lists.free).toContain('1 photo par objet')
    expect(lists.premium).toContain('150 analyses IA / mois')
    expect(lists.premium).toContain('50 améliorations photo IA / mois')
    expect(lists.pro).toContain('300 analyses IA / mois')
  })

  test('plusieurs photos au pluriel', () => {
    expect(featureLists(FALLBACK).free).toContain("Jusqu'à 3 photos par objet")
  })

  test('les lignes de quotas payants sont mises en avant', () => {
    expect(lists.highlighted.has('150 analyses IA / mois')).toBe(true)
    expect(lists.highlighted.has('Partage par lien')).toBe(false)
  })

  test('la page n’écrit plus aucun quota en dur', () => {
    const page = readFileSync(path.resolve(__dirname, '../pages/pricing.tsx'), 'utf8')
    expect(page).not.toMatch(/'\d+ (objets|analyses IA)/)
    expect(page).toContain('fetchPlanQuotas')
  })
})
