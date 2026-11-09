// Généré par design/generate.mjs depuis design/tokens.json — ne pas modifier à la main.
export const Brand = {
  color: {
    /** Couleur principale : actions, liens, accents */
    orange: '#F26900',
    /** Orange appuyé : survol, pression */
    orange700: '#D85E00',
    /** Fond chaud des sections */
    beige: '#FFF4E6',
    /** Fond chaud plus clair */
    beige2: '#FFF8EF',
    /** Texte principal */
    ink: '#121212',
    /** Texte secondaire */
    muted: '#5b5b5b',
    /** Surfaces (cartes) et texte sur fond orange */
    white: '#FFFFFF',
    /** Carte imbriquée dans une carte */
    surfaceSubtle: '#FBFAF8',
    /** Texte tertiaire : indications, métadonnées */
    textTertiary: '#A89F96',
    /** Succès, validation */
    success: '#2D5016',
    /** Pastille de statut (disponible) */
    sage: '#7B9B6B',
    /** Erreur */
    error: '#C0392B',
    /** Fond d'erreur */
    errorLight: '#FDECEA',
    /** Séparateurs et bordures */
    border: '#E8E2DA',
    /** Séparateurs discrets */
    borderLight: '#F0EBE3',
  },
  /** Texte courant et titres */
  fontBody: "'Inter', system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif",
  /** Arrondi des cartes et boutons */
  radius: 16,
  /** Ombre des cartes */
  shadow: '0 6px 20px rgba(0,0,0,0.06)',
  space: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48, xxxl: 64 },
  radiusScale: { sm: 8, md: 12, lg: 16, xl: 24, full: 999 },
  type: {
    size: { xs: 11, sm: 13, base: 15, md: 17, lg: 20, xl: 24, xxl: 30, xxxl: 38 },
    weight: { regular: '400', medium: '500', semibold: '600', bold: '700' },
    lineHeight: { tight: 1.2, normal: 1.4, relaxed: 1.6 },
  },
  /** Animations : durées (ms), courbes de Bézier, zoom d'entrée */
  motion: {
    duration: { fast: 180, base: 300, slow: 500, finish: 560 },
    easing: { out: [0.33, 1, 0.68, 1], inOut: [0.65, 0, 0.35, 1] },
    enterScale: 0.96,
  },
  /** Opacités : voile d'attente */
  opacity: { scrim: 0.4 },
} as const
