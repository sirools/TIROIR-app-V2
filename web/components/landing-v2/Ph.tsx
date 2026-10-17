import type { CSSProperties, ReactNode } from 'react'
import s from './v2.module.css'

/** Texte provisoire, suivi de son repère [PLACEHOLDER] (masqué avec /v2?clean). */
export function Ph({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <span className={s.ph}>[PLACEHOLDER]</span>
    </>
  )
}

/** Rang d'un élément dans une cascade de révélations (variable CSS --i). */
export const rank = (i: number) => ({ '--i': i }) as CSSProperties
