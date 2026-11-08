import { useEffect, useRef, useState, type ReactNode } from 'react'
import s from './DemoVideo.module.css'

export type DemoCaption = {
  /** Début du texte, en fraction de la durée (0 à 1) : suit la vidéo finale quelle que soit sa longueur. */
  from: number
  text: string
}

/**
 * Vidéo de démonstration muette, réutilisable : lecture auto, muette, en
 * boucle, inline, avec poster.
 *
 * - Rien n'est téléchargé (ni vidéo ni poster) avant que le bloc approche
 *   de l'écran : aucun poids ajouté au chargement de la page.
 * - Lecture seulement à l'écran ; pause hors de l'écran.
 * - Mouvement réduit : pas de lecture automatique, le poster reste avec un
 *   bouton « Lire ». Un bouton pause est toujours là (WCAG 2.2.2).
 * - Vidéo muette : les textes superposés (`captions`) disent ce qui se
 *   passe ; ils sont décoratifs (aria-hidden), la page doit se comprendre
 *   sans la vidéo.
 * - `frame="phone"` : plein cadre 9:16 sur mobile, dans un téléphone à
 *   partir de 1000 px.
 */
export default function DemoVideo({
  src,
  poster,
  label,
  captions = [],
  badge,
  frame = 'none',
  playLabel,
  pauseLabel,
}: {
  src: string
  poster: string
  /** Ce que montre la vidéo, pour les lecteurs d'écran. */
  label: string
  captions?: DemoCaption[]
  badge?: ReactNode
  frame?: 'none' | 'phone'
  playLabel: string
  pauseLabel: string
}) {
  const box = useRef<HTMLDivElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const userPaused = useRef(false)
  const [near, setNear] = useState(false)
  const [visible, setVisible] = useState(false)
  const [reduce, setReduce] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [ready, setReady] = useState(false)
  const [cap, setCap] = useState(0)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduce(mq.matches)
    const on = () => setReduce(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  // Chargement différé (marge de 300 px) puis suivi de la visibilité.
  useEffect(() => {
    const el = box.current
    if (!el) return
    const lazy = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setNear(true); lazy.disconnect() }
    }, { rootMargin: '300px 0px' })
    const seen = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.25 })
    lazy.observe(el)
    seen.observe(el)
    return () => { lazy.disconnect(); seen.disconnect() }
  }, [])

  useEffect(() => {
    const v = video.current
    if (!v || !near) return
    if (visible && !reduce && !userPaused.current) v.play().catch(() => {})
    else if (!visible) v.pause()
  }, [near, visible, reduce])

  function toggle() {
    const v = video.current
    if (!v) return
    if (v.paused) { userPaused.current = false; v.play().catch(() => {}) }
    else { userPaused.current = true; v.pause() }
  }

  function onTime() {
    const v = video.current
    if (!v || !v.duration || captions.length === 0) return
    const p = v.currentTime / v.duration
    let i = 0
    captions.forEach((c, k) => { if (p >= c.from) i = k })
    if (i !== cap) setCap(i)
  }

  return (
    <div ref={box} className={`${s.box} ${frame === 'phone' ? s.phone : ''}`}>
      <div className={s.screen}>
        {near && (
          <video
            ref={video}
            className={s.video}
            src={src}
            poster={poster}
            muted
            loop
            playsInline
            preload={reduce ? 'none' : 'metadata'}
            disablePictureInPicture
            aria-label={label}
            data-ready={ready ? '' : undefined}
            onLoadedData={() => setReady(true)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onTimeUpdate={onTime}
          />
        )}
        {captions.length > 0 && (
          <p className={s.caption} aria-hidden="true" key={cap}>{captions[cap].text}</p>
        )}
        {badge && <span className={s.badge}>{badge}</span>}
        <button
          type="button"
          className={s.toggle}
          onClick={toggle}
          aria-label={playing ? pauseLabel : playLabel}
          disabled={!near}
        >
          {playing ? (
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M7 4v16l13-8z" /></svg>
          )}
        </button>
      </div>
    </div>
  )
}
