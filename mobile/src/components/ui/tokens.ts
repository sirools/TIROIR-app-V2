export const Colors = {
  // Fonds
  background: '#F7F3EE',       // chaud, crème
  surface: '#FFFFFF',
  surfaceWarm: '#F0EBE3',      // carte légèrement plus chaude

  // Texte
  textPrimary: '#1A1612',
  textSecondary: '#6B6158',
  textTertiary: '#A89F96',
  textInverse: '#FFFFFF',

  // Accent principal
  accent: '#2D5016',           // vert profond
  accentLight: '#E8F0E0',      // vert sauge très discret

  // Secondaire
  sage: '#7B9B6B',             // vert sauge

  // États
  error: '#C0392B',
  errorLight: '#FDECEA',
  success: '#2D5016',

  // Séparateurs
  border: '#E8E2DA',
  borderLight: '#F0EBE3',
} as const

export const Typography = {
  // Tailles
  xs: 11,
  sm: 13,
  base: 15,
  md: 17,
  lg: 20,
  xl: 24,
  xxl: 30,
  xxxl: 38,

  // Graisses
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,

  // Hauteurs de ligne
  tight: 1.2,
  normal: 1.4,
  relaxed: 1.6,
} as const

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
} as const
