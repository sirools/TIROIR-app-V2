// apps/next/providers/NextTamaguiProvider.tsx
import { ReactNode } from 'react'
import { TamaguiProvider, Theme } from 'tamagui'
import config from '../tamagui.config'

export const NextTamaguiProvider = ({ children }: { children: ReactNode }) => {
  return (
    <TamaguiProvider config={config} defaultTheme="light">
      <Theme name="light">{children}</Theme>
    </TamaguiProvider>
  )
}