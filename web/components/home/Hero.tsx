import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import StoreButtons from '../StoreButtons'
import { HERO_VARIANT, useCopy } from '../../locales'
import s from './home.module.css'

const POSTER = '/hero/trois-tiroirs-poster.jpg'

/**
 * Accroche + l'animation « trois tiroirs » (un téléphone-commode dont les
 * tiroirs s'ouvrent tour à tour, boucle de 16 s, public/hero/).
 *
 * Le poster (première image, une <Image> sous la vidéo) s'affiche tout
 * de suite. La vidéo n'est
 * branchée qu'après le chargement de la page — le texte du hero reste
 * l'élément qui compte pour le LCP — et jamais en mouvement réduit : le
 * poster reste alors seul. Elle se met en pause hors de l'écran.
 */
export default function Hero() {
  const { t: { home: { hero: t } }, locale } = useCopy()
  const { title, sub } = t.variants[HERO_VARIANT - 1]
  const ref = useRef<HTMLElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [withVideo, setWithVideo] = useState(false)
  const [playing, setPlaying] = useState(false)

  // Brancher la vidéo une fois la page chargée, sauf en mouvement réduit.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    let started = false
    const start = () => {
      if (started || mq.matches) return
      started = true
      setWithVideo(true)
    }
    const onMotion = () => {
      if (mq.matches) { setWithVideo(false); setPlaying(false); started = false }
      else if (document.readyState === 'complete') start()
    }
    mq.addEventListener('change', onMotion)
    if (document.readyState === 'complete') start()
    else window.addEventListener('load', start, { once: true })
    return () => {
      mq.removeEventListener('change', onMotion)
      window.removeEventListener('load', start)
    }
  }, [])

  // Lecture seulement quand le hero est à l'écran.
  useEffect(() => {
    const el = ref.current
    const video = videoRef.current
    if (!withVideo || !el || !video) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) video.play().catch(() => {})
      else video.pause()
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [withVideo])

  return (
    <section ref={ref} className={s.hero} aria-labelledby="home-title">
      <div className={`${s.wrap} ${s.heroGrid}`}>
        <div>
          <span className={s.badge}>{t.badge}</span>
          <h1 id="home-title" className={s.heroTitle}>{title}</h1>
          <p className={s.heroSub}>{sub}</p>
          <StoreButtons variant="dark" locale={locale} />
          <p className={s.heroFree}>{t.free}</p>
        </div>

        <div className={s.heroMedia} aria-hidden="true">
          <Image src={POSTER} alt={t.mediaAlt} width={1080} height={1350} sizes="(min-width: 700px) 64vh, 100vw" loading="eager" />
          {withVideo && (
            <video
              ref={videoRef}
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              disablePictureInPicture
              data-playing={playing ? '' : undefined}
              onPlaying={() => setPlaying(true)}
            >
              <source src="/hero/trois-tiroirs.webm" type="video/webm" />
              <source src="/hero/trois-tiroirs.mp4" type="video/mp4" />
            </video>
          )}
        </div>
      </div>
    </section>
  )
}
