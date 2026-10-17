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

/**
 * Indice (0, 1, 2…) de l'enfant `[data-step]` le plus centré dans l'écran.
 * Sert aux états discrets (étape de Camille, point du carrousel d'offres) :
 * ce n'est pas du mouvement, il tourne donc aussi en mouvement réduit.
 */
export function useActiveStep(
  container: RefObject<HTMLElement | null>,
  opts: { root?: RefObject<HTMLElement | null>; rootMargin?: string } = {},
): number {
  const [active, setActive] = useState(0)
  const { root, rootMargin = '-45% 0px -45% 0px' } = opts

  useEffect(() => {
    const el = container.current
    if (!el) return
    const steps = Array.from(el.querySelectorAll<HTMLElement>('[data-step]'))
    const obs = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(steps.indexOf(e.target as HTMLElement))
        }
      },
      { root: root?.current ?? null, rootMargin, threshold: root ? 0.6 : 0 },
    )
    steps.forEach(s => obs.observe(s))
    return () => obs.disconnect()
  }, [container, root, rootMargin])

  return active
}
