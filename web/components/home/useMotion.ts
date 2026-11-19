import { useEffect, useState, type RefObject } from 'react'

export type Motion = 'static' | 'sda' | 'io'

/**
 * Choisit le mode d'animation de la page et, en repli, observe les
 * éléments `[data-rv]` pour leur poser `data-in` à l'entrée dans l'écran.
 *
 * - static : mouvement réduit demandé (ou avant hydratation) — rien ne bouge ;
 * - sda : le navigateur gère `animation-timeline: view()`, tout est en CSS ;
 * - io : repli IntersectionObserver, les mêmes états en transitions CSS.
 *
 * Sans JS, la page reste en « static » : tout le contenu est visible.
 */
export function useMotion(root: RefObject<HTMLElement | null>): Motion {
  const [motion, setMotion] = useState<Motion>('static')

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    const pick = (): Motion =>
      reduce.matches
        ? 'static'
        : typeof CSS !== 'undefined' && CSS.supports('animation-timeline', 'view()')
          ? 'sda'
          : 'io'
    setMotion(pick())
    const onChange = () => setMotion(pick())
    reduce.addEventListener('change', onChange)
    return () => reduce.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    if (motion !== 'io' || !root.current) return
    const obs = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          e.target.setAttribute('data-in', '')
          obs.unobserve(e.target)
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.15 },
    )
    root.current.querySelectorAll('[data-rv]').forEach(el => obs.observe(el))
    return () => obs.disconnect()
  }, [motion, root])

  return motion
}
