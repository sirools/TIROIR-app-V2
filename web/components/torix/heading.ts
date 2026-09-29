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
  const ios = e.webkitCompassHeading
  if (typeof ios === 'number' && !Number.isNaN(ios)) {
    // iOS envoie -1 tant que la boussole n'est pas prête : pas un cap.
    return ios < 0 ? null : normalize(ios + screenAngle)
  }
  if (e.absolute && typeof e.alpha === 'number') {
    return normalize(360 - e.alpha + screenAngle)
  }
  return null
}

/**
 * Puissance de la flamme selon l'alignement vers le nord, de 0 à 1 :
 * 1 face au nord, qui retombe en douceur quand on s'en écarte, 0 face au
 * sud. Courbe cubique : la montée s'accélère dans le dernier quart de
 * tour, pour que l'alignement se sente.
 *   0° → 1 ; 30° → ≈ 0,81 ; 45° → ≈ 0,62 ; 90° → 0,125 ; 180° → 0.
 */
export function northPower(heading: number): number {
  const rad = (angleDelta(heading, 0) * Math.PI) / 180
  const p = ((Math.cos(rad) + 1) / 2) ** 3
  return Math.round(p * 1000) / 1000
}
