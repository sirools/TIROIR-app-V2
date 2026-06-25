// apps/next/tamagui.config.ts
import { createTamagui, createFont } from 'tamagui'
import { tokens, themes } from '@tamagui/themes'
import { shorthands } from '@tamagui/shorthands'

// Breakpoints & inputs
const media = {
  xs: { maxWidth: 660 },
  sm: { maxWidth: 800 },
  md: { maxWidth: 1020 },
  lg: { maxWidth: 1280 },
  xl: { maxWidth: 1420 },
  short: { maxHeight: 820 },
  tall: { minHeight: 820 },
  hoverNone: { hover: 'none' },
  pointerCoarse: { pointer: 'coarse' },
}

// Police (tu peux garder Inter via CSS global)
const bodyFont = createFont({
  family: 'var(--font-body), Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif',
  size: {
    1: 12, 2: 14, 3: 16, 4: 18, 5: 20, 6: 24, 7: 32, 8: 40, 9: 48,
  },
  lineHeight: {
    1: 16, 2: 18, 3: 22, 4: 24, 5: 26, 6: 30, 7: 38, 8: 48, 9: 56,
  },
  weight: {
    4: '400',
    6: '600',
    7: '700',
  },
  letterSpacing: {
    4: 0,
    6: -0.25,
    7: -0.5,
  },
})

export const config = createTamagui({
  tokens,            // ✅ important
  themes,            // ✅ important (light/dark etc.)
  shorthands,        // ai/jc/px/mx/br/bg/…
  media,
  fonts: {
    body: bodyFont,
    heading: bodyFont,
  },
})

export type Conf = typeof config
declare module 'tamagui' {
  interface TamaguiCustomConfig extends Conf {}
}
export default config