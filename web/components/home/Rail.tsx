import { useRef, type ReactNode } from 'react'
import { useActiveStep } from './useMotion'
import s from './home.module.css'

/**
 * Série de cartes : défilement horizontal (scroll-snap) sur mobile, avec
 * un point par carte ; grille sur desktop. Chaque carte porte son visuel
 * et son texte ensemble.
 */
export default function Rail({ label, items }: { label: string; items: ReactNode[] }) {
  const list = useRef<HTMLUListElement>(null)
  const active = useActiveStep(list, { root: list, rootMargin: '0px' })
  return (
    <>
      <ul ref={list} className={s.rail} aria-label={label} data-rv="">
        {items.map((it, i) => <li key={i} data-step="">{it}</li>)}
      </ul>
      <ol className={s.dots} aria-hidden="true">
        {items.map((_, i) => <li key={i} data-on={i === active ? '' : undefined} />)}
      </ol>
    </>
  )
}
