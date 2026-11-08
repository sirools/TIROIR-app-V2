import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { Check, Clock } from 'lucide-react'
import StoreButtons from '../StoreButtons'
import DemoVideo from '../DemoVideo'
import { fill, useCopy } from '../../locales'
import { OFFERS_V4 } from '../../lib/offers'
import s from './home.module.css'

const PHOTO = '/screens/chain/veste.png'

/**
 * « Une photo, c'est tout. » — rassurer le grand public sur la
 * simplicité, juste après le hero.
 *
 * Trois étapes qui suffisent seules à comprendre (la vidéo est un plus) :
 * la photo, la fiche qui se remplit champ par champ, l'objet qui glisse
 * dans son tiroir. Une boucle CSS de 9 s les enchaîne (transform et
 * opacity seulement), en pause hors de l'écran. L'état par défaut est
 * l'état final : c'est lui qu'on voit sans JS et en mouvement réduit.
 *
 * ISO avec l'app : Torix remplit nom, catégorie, état ; l'estimation est
 * un geste de plus (« Estimer avec Torix ») ; le tiroir se choisit
 * pendant l'analyse (capture → sélecteur de collection).
 */
export default function PhotoSimple() {
  const { t: { home: { photo: t } }, locale } = useCopy()
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) el.setAttribute('data-play', '')
      else el.removeAttribute('data-play')
    }, { threshold: 0.2 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const visuals = [
    <div className={s.psShot} key="shot">
      <Image src={PHOTO} alt="" width={112} height={112} sizes="112px" />
      <div className={s.psFinder}><i /><i /><i /><i /></div>
      <span className={s.psShutter} />
      <span className={s.psFlash} />
    </div>,
    <div className={s.psFiche} key="fiche">
      <div className={s.psFicheHead}>
        <Image src={PHOTO} alt="" width={36} height={36} sizes="36px" />
        <span className={s.psField}><i /><strong>{t.fiche.name}</strong></span>
      </div>
      {t.fiche.rows.map(([k, v]) => (
        <div key={k} className={s.psRow}>
          <span>{k}</span>
          <span className={s.psField}><i /><strong>{v}</strong></span>
        </div>
      ))}
      <div className={s.psRow}>
        <span>{t.fiche.estimate}</span>
        <span className={s.psField}><i /><strong className={s.psEstimate}>{t.fiche.estimateCta}</strong></span>
      </div>
    </div>,
    <div className={s.psCabinet} key="drawer">
      <Image className={s.psItem} src={PHOTO} alt="" width={52} height={52} sizes="52px" />
      <div className={s.psDrawer}>
        <span className={s.psHandle} />
        <span className={s.psLabel}>{t.drawer}</span>
      </div>
      <div className={s.psDrawerBelow}><span className={s.psHandle} /></div>
      <span className={s.psStored}><Check size={12} strokeWidth={3} aria-hidden="true" />{t.stored}</span>
    </div>,
  ]

  return (
    <section ref={ref} className={`${s.section} ${s.photoSec}`} aria-labelledby="photo-title">
      <div className={s.wrap}>
        <div className={`${s.head} ${s.center}`}>
          <h2 id="photo-title" className={s.h2}>{t.title}</h2>
          <p className={s.lead}>{t.sub}</p>
        </div>

        <ol className={s.psSteps}>
          {t.steps.map((step, i) => (
            <li key={step.title} className={s.psStep} data-rv="">
              <div className={s.psVis} aria-hidden="true">{visuals[i]}</div>
              <div>
                <h3 className={s.cardTitle}><span className={s.num}>{i + 1}</span>{step.title}</h3>
                <p className={s.cardText}>{step.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className={s.psDemo}>
          <DemoVideo
            src="/assets/video/demo-photo.mp4"
            poster="/assets/video/demo-photo-poster.jpg"
            frame="phone"
            label={t.video.label}
            captions={t.steps.map((step, i) => ({ from: i / t.steps.length, text: step.title }))}
            badge={<><Clock size={14} strokeWidth={2.5} aria-hidden="true" />{t.video.badge}</>}
            playLabel={t.video.play}
            pauseLabel={t.video.pause}
          />
          <div className={s.psCta}>
            <p className={s.psReassure}>{fill(t.reassure, { n: OFFERS_V4.free.aiActionsPerMonth })}</p>
            <div role="group" aria-labelledby="photo-cta">
              <p id="photo-cta" className={s.psCtaLabel}>{t.cta}</p>
              <StoreButtons variant="card" locale={locale} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
