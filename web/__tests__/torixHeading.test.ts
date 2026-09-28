import { describe, expect, test } from 'vitest'
import {
  angleDelta,
  headingFromEvent,
  isFacingNorth,
  NORTH_ENTER_DEG,
  NORTH_EXIT_DEG,
  normalize,
  offNorth,
  smoothHeading,
} from '../components/torix/heading'

describe('normalize / angleDelta', () => {
  test('ramène dans [0, 360)', () => {
    expect(normalize(-10)).toBe(350)
    expect(normalize(720)).toBe(0)
  })

  test('plus court chemin à travers 0°', () => {
    expect(angleDelta(359, 1)).toBe(2)
    expect(angleDelta(1, 359)).toBe(-2)
    expect(angleDelta(90, 270)).toBe(180)
  })
})

describe('smoothHeading', () => {
  test('premier échantillon pris tel quel', () => {
    expect(smoothHeading(null, 42, 0.2)).toBe(42)
  })

  test('359° → 1° passe par 0°, sans faire le tour', () => {
    const h = smoothHeading(359, 1, 0.5)
    expect(h).toBeCloseTo(0)
  })

  test('converge vers la cible', () => {
    let h: number | null = 10
    for (let i = 0; i < 100; i++) h = smoothHeading(h, 200, 0.2)
    expect(h).toBeCloseTo(200)
  })
})

describe('isFacingNorth (hystérésis)', () => {
  test('entre sous le seuil d’entrée, des deux côtés du nord', () => {
    expect(isFacingNorth(NORTH_ENTER_DEG - 1, false)).toBe(true)
    expect(isFacingNorth(360 - NORTH_ENTER_DEG + 1, false)).toBe(true)
    expect(isFacingNorth(NORTH_ENTER_DEG + 3, false)).toBe(false)
  })

  test('ne ressort qu’au-delà du seuil de sortie', () => {
    expect(isFacingNorth(NORTH_ENTER_DEG + 3, true)).toBe(true)
    expect(isFacingNorth(NORTH_EXIT_DEG + 1, true)).toBe(false)
  })

  test('offNorth', () => {
    expect(offNorth(350)).toBe(10)
    expect(offNorth(180)).toBe(180)
  })
})

describe('headingFromEvent', () => {
  test('iOS : webkitCompassHeading, corrigé de la rotation écran', () => {
    expect(headingFromEvent({ alpha: 12, webkitCompassHeading: 100 }, 0)).toBe(100)
    expect(headingFromEvent({ alpha: 12, webkitCompassHeading: 300 }, 90)).toBe(30)
  })

  test('Android : alpha absolu, sens antihoraire', () => {
    expect(headingFromEvent({ alpha: 90, absolute: true }, 0)).toBe(270)
    expect(headingFromEvent({ alpha: 0, absolute: true }, 0)).toBe(0)
  })

  test('orientation relative sans cap : ignorée', () => {
    expect(headingFromEvent({ alpha: 90, absolute: false }, 0)).toBeNull()
    expect(headingFromEvent({ alpha: null }, 0)).toBeNull()
  })
})
