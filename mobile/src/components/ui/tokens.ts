// Jetons de l'app (iOS et Android), tirés de la seule source de vérité du
// design : design/tokens.json → brandTokens.generated.ts. Ne jamais écrire
// une couleur ici : la changer dans design/tokens.json, puis
// `node design/generate.mjs`. Les noms restent ceux que les écrans
// utilisent déjà (Colors.accent, Spacing.md…).
import { Brand } from './brandTokens.generated'

const c = Brand.color

export const Colors = {
  // Fonds
  background: c.beige2,          // fond chaud clair du site
  surface: c.white,
  surfaceWarm: c.beige,          // carte légèrement plus chaude
  surfaceSubtle: c.surfaceSubtle, // carte imbriquée dans une carte

  // Texte
  textPrimary: c.ink,
  textSecondary: c.muted,
  textTertiary: c.textTertiary,
  textInverse: c.white,

  // Accent principal : l'orange du site
  accent: c.orange,
  accentLight: c.beige,

  // Secondaire
  sage: c.sage,

  // États
  error: c.error,
  errorLight: c.errorLight,
  success: c.success,

  // Séparateurs
  border: c.border,
  borderLight: c.borderLight,
} as const

export const Typography = {
  // Tailles
  ...Brand.type.size,

  // Graisses
  ...Brand.type.weight,

  // Hauteurs de ligne
  ...Brand.type.lineHeight,
} as const

export const Spacing = Brand.space

export const Radius = Brand.radiusScale

/** Durées (ms), courbes et zoom d'entrée des animations. */
export const Motion = Brand.motion

/** Opacités partagées (voile posé sur une photo en attente). */
export const Opacity = Brand.opacity
