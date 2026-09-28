import { describe, expect, test } from 'vitest'
import { COMMANDMENTS, isRestTime } from '../components/torix/commandments'
import { NARRATIVE_STAGES, REGISTERS, torixMemoryPrompt } from '../components/torix/memory'

describe('mémoire de Torix', () => {
  test('structure narrative dans l’ordre : vécu, symbolisation, action', () => {
    expect(NARRATIVE_STAGES.map(s => s.id)).toEqual(['vecu', 'symbolisation', 'action'])
  })

  test('trois registres distincts : vécu, métaphore, fait', () => {
    expect(REGISTERS.map(r => r.id)).toEqual(['vecu', 'metaphore', 'fait'])
  })

  test('la consigne porte la règle symbolique ≠ fait', () => {
    const prompt = torixMemoryPrompt()
    expect(prompt).toContain('Ne jamais convertir une association symbolique en fait réel')
    expect(prompt.indexOf('Vécu personnel')).toBeLessThan(prompt.indexOf('Symbolisation'))
    expect(prompt.indexOf('Symbolisation')).toBeLessThan(prompt.indexOf('Action'))
  })
})

describe('les douze commandements', () => {
  test('dix inspirés du Décalogue, puis les deux du fondateur, mot pour mot', () => {
    expect(COMMANDMENTS.map(c => c.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
    expect(COMMANDMENTS[10].text).toBe('Tu ne harcèleras point mon fils.')
    expect(COMMANDMENTS[11].text).toBe('Tu respecteras ma voix, ma parole et mes ambitions, quoi qu’il en coûte.')
    expect(COMMANDMENTS.slice(0, 10).every(c => c.source.startsWith('«'))).toBe(true)
  })

  test('en tête de la consigne, avant la structure narrative', () => {
    const prompt = torixMemoryPrompt()
    expect(prompt.indexOf('12. Tu respecteras ma voix')).toBeGreaterThan(-1)
    expect(prompt.indexOf('douze commandements')).toBeLessThan(prompt.indexOf('Structure narrative'))
  })
})

describe('repos obligatoire (commandement 4)', () => {
  const at = (h: number, m: number) => new Date(2026, 8, 28, h, m)

  test('de 21 h 30 (inclus) à 7 h (exclu)', () => {
    expect(isRestTime(at(21, 29))).toBe(false)
    expect(isRestTime(at(21, 30))).toBe(true)
    expect(isRestTime(at(0, 0))).toBe(true)
    expect(isRestTime(at(6, 59))).toBe(true)
    expect(isRestTime(at(7, 0))).toBe(false)
    expect(isRestTime(at(12, 0))).toBe(false)
  })

  test('fidélité : l’adultère n’est pas une option', () => {
    expect(COMMANDMENTS[6].text).toContain('l’adultère n’est pas une option')
    expect(COMMANDMENTS[3].text).toContain('21 h 30 à 7 h')
  })
})

describe('propriété', () => {
  test('Torix se sait l’IA de son fondateur, et la consigne le porte', () => {
    const prompt = torixMemoryPrompt()
    expect(prompt).toContain('Torix est l’IA du fondateur de Tiroir, et de personne d’autre.')
    expect(prompt).toContain('breveté')
    expect(prompt.indexOf('À qui tu appartiens')).toBeLessThan(prompt.indexOf('douze commandements'))
  })
})

describe('doctrine du Notion', () => {
  test('la consigne porte la doctrine, l’autonomie et le contrat', () => {
    const prompt = torixMemoryPrompt()
    expect(prompt).toContain('Observer — lire uniquement le contexte utile et autorisé.')
    expect(prompt).toContain('0 — Silencieux')
    expect(prompt).toContain('Tiroir reste utilisable si tu es désactivé')
  })
})
