import { describe, expect, test } from 'vitest'
import { answerFor, detectDirections, UNKNOWN_ANSWER } from '../components/torix/directions'

describe('detectDirections', () => {
  test.each([
    ['Où est le nord ?', ['nord']],
    ['où est le SUD', ['sud']],
    ["Où est l'est ?", ['est']],
    ['Où est l’Est ?', ['est']],
    ["Où est l'ouest ?", ['ouest']],
    ['OUEST', ['ouest']],
    ['est ?', ['est']],
    ['Et à l est ?', ['est']],
    ['Je vais vers est', ['est']],
    ['direction est', ['est']],
    ['nord-est', ['nord', 'est']],
    ['Nord ou sud ?', ['nord', 'sud']],
  ])('%s', (input, expected) => {
    expect(detectDirections(input)).toEqual(expected)
  })

  test.each([
    'Où est le nord ?',
    'Le nord est où ?',
    'Dans quelle direction est le nord ?',
    "C'est où le nord ?",
    'Est-ce que le nord est loin ?',
  ])('le verbe « est » ne compte pas : %s', input => {
    expect(detectDirections(input)).not.toContain('est')
  })

  test.each(['Quelle heure est-il ?', 'Bonjour', '', "Qu'est-ce que tu es ?"])(
    'aucune direction : %s',
    input => {
      expect(detectDirections(input)).toEqual([])
    },
  )
})

describe('answerFor', () => {
  test('les quatre réponses', () => {
    expect(answerFor('Où est le nord ?')).toBe('Le nord est devant toi.')
    expect(answerFor('Où est le sud ?')).toBe('Le sud est derrière toi.')
    expect(answerFor("Où est l'est ?")).toBe("L'est est à ta droite.")
    expect(answerFor("Où est l'ouest ?")).toBe("L'ouest est à ta gauche.")
  })

  test('hors sujet', () => {
    expect(answerFor('Quel temps fait-il ?')).toBe(UNKNOWN_ANSWER)
  })
})
