import { describe, expect, test } from 'vitest'
import {
  angleDelta,
  CARDINAL_ENTER_DEG,
  CARDINAL_EXIT_DEG,
  northPower,
  compassPoint,
  facingCardinal,
  headingFromEvent,
  normalize,
  smoothHeading,
} from '../components/torix/heading'
import { PALETTES, paletteAt } from '../components/torix/palette'

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

describe('facingCardinal (hystérésis)', () => {
  test('les quatre points, des deux côtés', () => {
    expect(facingCardinal(360 - CARDINAL_ENTER_DEG + 1, null)).toBe('N')
    expect(facingCardinal(90 + CARDINAL_ENTER_DEG - 1, null)).toBe('E')
    expect(facingCardinal(180, null)).toBe('S')
    expect(facingCardinal(265, null)).toBe('W')
  })

  test('rien entre deux points', () => {
    expect(facingCardinal(45, null)).toBeNull()
    expect(facingCardinal(CARDINAL_ENTER_DEG + 3, null)).toBeNull()
  })

  test('garde le point jusqu’au seuil de sortie', () => {
    expect(facingCardinal(CARDINAL_ENTER_DEG + 3, 'N')).toBe('N')
    expect(facingCardinal(CARDINAL_EXIT_DEG + 1, 'N')).toBeNull()
  })
})

describe('compassPoint', () => {
  test('huit points, en français', () => {
    expect(compassPoint(0)).toBe('N')
    expect(compassPoint(124)).toBe('SE')
    expect(compassPoint(230)).toBe('SO')
    expect(compassPoint(275)).toBe('O')
    expect(compassPoint(350)).toBe('N')
  })
})

describe('paletteAt', () => {
  test('exacte sur chaque point cardinal', () => {
    expect(paletteAt(0)).toEqual(PALETTES.N)
    expect(paletteAt(90)).toEqual(PALETTES.E)
    expect(paletteAt(180)).toEqual(PALETTES.S)
    expect(paletteAt(270)).toEqual(PALETTES.W)
    expect(paletteAt(360)).toEqual(PALETTES.N)
  })

  test('le sud est un petit feu', () => {
    expect(paletteAt(180).scale).toBeLessThan(paletteAt(0).scale)
    expect(paletteAt(135).scale).toBeGreaterThan(paletteAt(180).scale)
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

  test('iOS pas prêt (-1) : ignoré', () => {
    expect(headingFromEvent({ alpha: 12, webkitCompassHeading: -1 }, 0)).toBeNull()
  })

  test('orientation relative sans cap : ignorée', () => {
    expect(headingFromEvent({ alpha: 90, absolute: false }, 0)).toBeNull()
    expect(headingFromEvent({ alpha: null }, 0)).toBeNull()
  })
})

describe('northPower : la flamme monte en puissance vers le nord', () => {
  test('maximale face au nord, nulle face au sud', () => {
    expect(northPower(0)).toBe(1)
    expect(northPower(360)).toBe(1)
    expect(northPower(180)).toBe(0)
  })

  test('symétrique et croissante en approchant du nord', () => {
    expect(northPower(30)).toBe(northPower(330))
    expect(northPower(90)).toBe(northPower(270))
    const steps = [180, 135, 90, 60, 45, 30, 15, 5, 0].map(northPower)
    for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeGreaterThan(steps[i - 1])
  })

  test('forte près du nord, faible sur les côtés', () => {
    expect(northPower(12)).toBeGreaterThan(0.95)
    expect(northPower(45)).toBeCloseTo(0.62, 2)
    expect(northPower(90)).toBe(0.125)
  })
})
