// components/layout/SectionBlock.tsx

import { YStack } from 'tamagui'

export const SectionBlock = ({ children }: { children: React.ReactNode }) => {
  return (
    <YStack
      width="100%"
      backgroundColor="$white"
      borderRadius="$4"
      borderWidth="$0.5"
      borderColor="$border"
      padding="$4"
      elevation="$1"
    >
      {children}
    </YStack>
  )
}