// Couleurs de Torix selon le cap, comme une boussole qui s'allume :
//   nord → bleu · est → vert · sud → petit feu vert, rouge, jaune, argent
//   · ouest → violet.
// Entre deux points cardinaux, les couleurs se fondent ; la courbe
// (smoothstep) les laisse « tenir » autour de chaque point cardinal.
//
// Chaque couleur est un triplet « r, g, b » destiné à rgba(var(--x), a).
import type { CSSProperties } from 'react'
import { normalize } from './heading'

type RGB = [number, number, number]
/** Cœur chaud, teinte, bord sombre d'une langue de flamme ou d'une lueur. */
type Tone = { hi: RGB; mid: RGB; lo: RGB }
type Palette = {
  /** Quatre teintes réparties entre les langues de flamme. */
  slots: [Tone, Tone, Tone, Tone]
  /** Halo, aura, foyer. */
  glow: Tone
  /** Taille de la flamme (le sud est un petit feu). */
  scale: number
}

const tone = (hi: RGB, mid: RGB, lo: RGB): Tone => ({ hi, mid, lo })
const same = (t: Tone): [Tone, Tone, Tone, Tone] => [t, t, t, t]

const BLUE = tone([185, 238, 255], [85, 175, 255], [34, 96, 240])
const GREEN = tone([205, 255, 220], [70, 222, 140], [18, 150, 88])
const VIOLET = tone([228, 208, 255], [160, 112, 255], [98, 50, 220])

const FIRE_GREEN = tone([205, 255, 200], [84, 222, 110], [28, 150, 60])
const FIRE_RED = tone([255, 205, 190], [255, 86, 62], [190, 30, 30])
const FIRE_YELLOW = tone([255, 246, 205], [255, 212, 72], [212, 140, 20])
const FIRE_SILVER = tone([252, 253, 255], [208, 217, 230], [140, 150, 172])

export const PALETTES: Record<'N' | 'E' | 'S' | 'W', Palette> = {
  N: {
    slots: same(BLUE),
    glow: tone([150, 205, 255], [80, 150, 255], [40, 95, 235]),
    scale: 1,
  },
  E: {
    slots: same(GREEN),
    glow: tone([165, 245, 200], [60, 200, 130], [20, 128, 80]),
    scale: 1,
  },
  S: {
    slots: [FIRE_RED, FIRE_YELLOW, FIRE_GREEN, FIRE_SILVER],
    glow: tone([255, 226, 200], [236, 146, 104], [150, 64, 60]),
    scale: 0.7,
  },
  W: {
    slots: same(VIOLET),
    glow: tone([205, 182, 255], [140, 96, 245], [84, 44, 200]),
    scale: 1,
  },
}

const ORDER = [PALETTES.N, PALETTES.E, PALETTES.S, PALETTES.W, PALETTES.N]

const smoothstep = (t: number) => t * t * (3 - 2 * t)
const mixRGB = (a: RGB, b: RGB, t: number): RGB =>
  [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB
const mixTone = (a: Tone, b: Tone, t: number): Tone =>
  tone(mixRGB(a.hi, b.hi, t), mixRGB(a.mid, b.mid, t), mixRGB(a.lo, b.lo, t))

/** Palette au cap donné (0 = nord, horaire). */
export function paletteAt(heading: number): Palette {
  const h = normalize(heading)
  const i = Math.floor(h / 90)
  const t = smoothstep((h - i * 90) / 90)
  const a = ORDER[i]
  const b = ORDER[i + 1]
  return {
    slots: a.slots.map((s, k) => mixTone(s, b.slots[k], t)) as Palette['slots'],
    glow: mixTone(a.glow, b.glow, t),
    scale: a.scale + (b.scale - a.scale) * t,
  }
}

const css = (c: RGB) => c.join(', ')

/** Variables CSS consommées par TorixOrb. */
export function paletteVars(p: Palette): CSSProperties {
  const vars: Record<string, string | number> = { '--fire-scale': p.scale }
  p.slots.forEach((s, k) => {
    vars[`--s${k}-hi`] = css(s.hi)
    vars[`--s${k}-mid`] = css(s.mid)
    vars[`--s${k}-lo`] = css(s.lo)
  })
  vars['--glow-hi'] = css(p.glow.hi)
  vars['--glow-mid'] = css(p.glow.mid)
  vars['--glow-lo'] = css(p.glow.lo)
  return vars as CSSProperties
}
