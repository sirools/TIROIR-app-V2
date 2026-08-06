import { loadFont } from '@remotion/google-fonts/Manrope'

// Sans police chargée, Chrome headless tombe sur une serif : le rendu
// paraît cassé alors qu'il ne l'est pas. On charge donc explicitement.
export const { fontFamily } = loadFont()

// Repris des tokens de l'app (mobile/src/components/ui/tokens.ts) pour que
// le reel et le produit parlent la même langue.
export const Colors = {
  background: '#F7F3EE',
  surface: '#FFFFFF',
  ink: '#1A1612',
  inkSoft: '#6B6158',
  accent: '#F26900',
  green: '#2D5016',
  greenLight: '#E8F0E0',
  dark: '#14100D',
} as const

/**
 * Le montage se cale sur la musique, pas sur des secondes rondes : tout est
 * exprimé en temps (beats). Change le BPM et l'ensemble se resserre ou
 * s'étire sans qu'aucune valeur de séquence ne bouge.
 */
export const FPS = 30
export const BPM = 120

/** Durée d'un temps, en frames. */
export const beat = (n = 1) => Math.round((60 / BPM) * FPS * n)

/**
 * Mise en page : le téléphone occupe le haut, le texte vit dans la bande
 * du bas. Le titre ne doit jamais mordre sur l'écran — sinon il masque
 * l'interaction qu'il est censé annoncer.
 */
export const PHONE = { width: 620, height: 1344, top: 96 } as const
export const TEXT_BAND_TOP = PHONE.top + PHONE.height + 40
