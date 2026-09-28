// Arithmétique de cap, sans dépendance au navigateur (testable).
// Convention : degrés, 0 = nord, sens horaire, valeurs dans [0, 360).

export function normalize(deg: number): number {
  return ((deg % 360) + 360) % 360
}

/** Plus court écart signé pour aller de `from` à `to`, dans (-180, 180]. */
export function angleDelta(from: number, to: number): number {
  const d = normalize(to - from)
  return d > 180 ? d - 360 : d
}

/**
 * Filtre passe-bas circulaire : suit `raw` d'une fraction `factor` de
 * l'écart restant, par le plus court chemin — 359° → 1° passe par 0°,
 * pas par un tour complet.
 */
export function smoothHeading(prev: number | null, raw: number, factor: number): number {
  if (prev === null) return normalize(raw)
  return normalize(prev + angleDelta(prev, raw) * factor)
}

/** Écart au nord, en valeur absolue, dans [0, 180]. */
export function offNorth(heading: number): number {
  return Math.abs(angleDelta(heading, 0))
}

// Hystérésis : on « trouve » le nord à moins de ENTER degrés, on ne le
// « perd » qu'au-delà de EXIT. Sans cet écart, la main qui tremble ferait
// clignoter l'état à la frontière.
export const NORTH_ENTER_DEG = 12
export const NORTH_EXIT_DEG = 22

export function isFacingNorth(heading: number, wasFacing: boolean): boolean {
  const off = offNorth(heading)
  return wasFacing ? off <= NORTH_EXIT_DEG : off <= NORTH_ENTER_DEG
}

/**
 * Cap de l'appareil à partir d'un événement d'orientation, corrigé de la
 * rotation de l'écran. `null` si l'événement ne porte pas de cap absolu.
 *   - iOS : webkitCompassHeading, déjà un cap (nord magnétique, horaire) ;
 *   - ailleurs : deviceorientationabsolute, dont alpha tourne en sens
 *     antihoraire → cap = 360 − alpha.
 */
export function headingFromEvent(
  e: { alpha: number | null; absolute?: boolean; webkitCompassHeading?: number },
  screenAngle: number,
): number | null {
  if (typeof e.webkitCompassHeading === 'number' && !Number.isNaN(e.webkitCompassHeading)) {
    return normalize(e.webkitCompassHeading + screenAngle)
  }
  if (e.absolute && typeof e.alpha === 'number') {
    return normalize(360 - e.alpha + screenAngle)
  }
  return null
}
