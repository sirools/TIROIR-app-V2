// L'onboarding de l'app (mobile/app/(app)/onboarding.tsx) : chaque usage,
// chaque métier et chaque collection suggérée a son texte dans toutes les
// langues de l'app, et les identifiants tiennent dans les contraintes de la
// migration profile_onboarding.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import {
  METIERS, METIERS_BY_USAGE, METIER_AUTRE, SUGGESTIONS, USAGES,
  suggestionFor, usageOfMetier, webPersonaFor,
} from '../../mobile/src/features/onboarding/metiers'
import { PERSONAS } from '../lib/personas'

const root = join(__dirname, '..', '..')
const json = (p: string) => JSON.parse(readFileSync(join(root, p), 'utf8'))
const languages: { code: string; app: boolean; fallback?: string }[] = json('design/i18n/languages.json').languages

describe('onboarding : usages, métiers, première collection', () => {
  test('les identifiants passent les contraintes de la base', () => {
    const dir = join(root, 'supabase/migrations')
    const file = readdirSync(dir).find(f => f.endsWith('_profile_onboarding.sql'))!
    const sql = readFileSync(join(dir, file), 'utf8')
    for (const u of USAGES) expect(sql).toContain(`'${u}'`)
    for (const m of [...METIERS, METIER_AUTRE]) expect(m).toMatch(/^[a-z][a-z_]{1,39}$/)
  })

  test('un métier n’appartient qu’à un usage, et le retrouve', () => {
    expect(new Set(METIERS).size).toBe(METIERS.length)
    for (const u of USAGES) for (const m of METIERS_BY_USAGE[u]) expect(usageOfMetier(m)).toBe(u)
    expect(usageOfMetier(METIER_AUTRE)).toBeNull()
  })

  test('le profil du site n’est rempli que par un métier que le site connaît', () => {
    for (const m of [...METIERS, METIER_AUTRE]) {
      const persona = webPersonaFor(m)
      if (persona) expect(PERSONAS).toContain(persona)
      else expect(PERSONAS).not.toContain(m)
    }
    expect(webPersonaFor(null)).toBeNull()
  })

  test('brocanteur → « Mon stock » ; « autre » suit l’usage', () => {
    const fr = json('design/i18n/app/fr.json').onboarding.collection.suggestions
    expect(fr[suggestionFor('business', 'brocanteur')]).toBe('Mon stock')
    expect(suggestionFor('creatif', METIER_AUTRE)).toBe('materiel')
    expect(suggestionFor('perso', null)).toBe('maison')
    expect(suggestionFor(null, null)).toBe('maison')
  })

  test.each(languages.filter(l => l.app).map(l => l.code))('%s : aucun texte manquant', code => {
    const lang = languages.find(l => l.code === code)!
    const own = json(`design/i18n/app/${code}.json`).onboarding ?? {}
    const base = lang.fallback ? json(`design/i18n/app/${lang.fallback}.json`).onboarding : {}
    const text = (path: string) => {
      const pick = (o: any) => path.split('.').reduce((v, k) => v?.[k], o)
      return pick(own) ?? pick(base)
    }
    const keys = [
      'skip', 'continue', 'progress',
      'usage.title', 'usage.subtitle',
      ...USAGES.flatMap(u => [`usage.${u}`, `usage.${u}Hint`]),
      'metier.title', 'metier.titlePerso', 'metier.subtitle', 'metier.other', 'metier.otherLabel', 'metier.otherPlaceholder',
      ...METIERS.map(m => `metier.names.${m}`),
      'collection.title', 'collection.subtitle', 'collection.nameLabel', 'collection.create', 'collection.later',
      ...Object.keys(SUGGESTIONS).map(s => `collection.suggestions.${s}`),
    ]
    for (const k of keys) expect(text(k), `${code} : onboarding.${k}`).toEqual(expect.stringMatching(/\S/))
  })
})
