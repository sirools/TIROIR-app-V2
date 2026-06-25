import type { ReactNode } from 'react'

// No-op web provider (keeps the same API shape)
export function Provider({ children }: { children: ReactNode }) {
  return <>{children}</>
}