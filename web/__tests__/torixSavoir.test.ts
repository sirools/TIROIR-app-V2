import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { answerFromSavoir, parseSavoir } from '../lib/torixSavoir'

const md = readFileSync(path.resolve(__dirname, '../components/torix/savoir.md'), 'utf8')
const entries = parseSavoir(md)

describe('Torix puise dans savoir.md', () => {
  test('chaque puce devient une entrée avec son registre', () => {
    expect(entries.length).toBeGreaterThan(10)
    expect(new Set(entries.map(e => e.register))).toEqual(new Set(['fait', 'principe', 'decision']))
    expect(entries.every(e => e.section && e.text)).toBe(true)
  })

  test('les parties « À compléter » ne sont jamais citées', () => {
    expect(entries.some(e => /compléter/i.test(e.text))).toBe(false)
  })

  test('une puce sur plusieurs lignes est lue en entier', () => {
    const fils = entries.find(e => e.text.startsWith('Premiers mots de Torix'))
    expect(fils?.text).toContain('Et le soir, je dors, comme toi.')
  })

  test('il répond sur le fils, la clé et le Tiroir partagé', () => {
    expect(answerFromSavoir('Que dirais-tu à mon fils ?', entries)?.text).toContain('Premiers mots de Torix')
    expect(answerFromSavoir('Qui a la clé des sauvegardes ?', entries)?.text).toContain('personne ne l')
    const t = answerFromSavoir('Qui teste le Tiroir partagé ?', entries)
    expect(t?.text).toContain('Stéphane')
    expect(t?.register).toBe('decision')
  })

  test('sans rapport : il ne répond rien plutôt que d’inventer', () => {
    expect(answerFromSavoir('météo à Tokyo demain', entries)).toBeNull()
  })
})
