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

export type Cardinal = 'N' | 'E' | 'S' | 'W'

const CARDINALS: { id: Cardinal; deg: number }[] = [
  { id: 'N', deg: 0 },
  { id: 'E', deg: 90 },
  { id: 'S', deg: 180 },
  { id: 'W', deg: 270 },
]

// Hystérésis : on « trouve » un point cardinal à moins de ENTER degrés, on
// ne le « perd » qu'au-delà de EXIT. Sans cet écart, la main qui tremble
// ferait clignoter l'état à la frontière.
export const CARDINAL_ENTER_DEG = 12
export const CARDINAL_EXIT_DEG = 22

/** Point cardinal auquel on fait face, ou null entre deux. */
export function facingCardinal(heading: number, current: Cardinal | null): Cardinal | null {
  if (current) {
    const deg = CARDINALS.find(c => c.id === current)!.deg
    if (Math.abs(angleDelta(heading, deg)) <= CARDINAL_EXIT_DEG) return current
  }
  const hit = CARDINALS.find(c => Math.abs(angleDelta(heading, c.deg)) <= CARDINAL_ENTER_DEG)
  return hit ? hit.id : null
}

const POINTS_FR = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']

/** Abréviation française à huit points, comme la boussole iPhone. */
export function compassPoint(heading: number): string {
  return POINTS_FR[Math.round(normalize(heading) / 45) % 8]
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
