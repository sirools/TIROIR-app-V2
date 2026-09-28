import { describe, expect, test } from 'vitest'
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
