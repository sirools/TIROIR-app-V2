import { useEffect, useRef } from 'react'
import StoreButtons from '../StoreButtons'
import { COPY } from './copy'
import { Ph } from './Ph'
import s from './v2.module.css'

const t = COPY.hero

/**
 * Le geste clé en une boucle CSS de 8 s : une photo d'objet est prise,
 * devient une fiche, puis l'estimation de valeur apparaît. L'état par
 * défaut est la fiche complète (mouvement réduit, sans JS). La boucle se
 * met en pause quand le hero sort de l'écran.
 */
export default function Hero() {
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) el.removeAttribute('data-paused')
      else el.setAttribute('data-paused', '')
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <section ref={ref} className={s.hero} aria-labelledby="v2-hero-title">
      <div className={`${s.wrap} ${s.heroGrid}`}>
        <div>
          <p className={s.eyebrow}><Ph>{t.eyebrow}</Ph></p>
          <h1 id="v2-hero-title" className={s.heroTitle}><Ph>{t.title}</Ph></h1>
          <p className={`${s.lead} ${s.heroSub}`}><Ph>{t.sub}</Ph></p>
          <StoreButtons variant="cardPrimary" />
        </div>

        <div className={s.stageWrap}>
          <figure
            className={s.stage}
            role="img"
            aria-label={`${t.object.name} photographiée, fiche créée, estimée ${t.object.value}`}
            style={{ margin: 0 }}
          >
            <div className={s.card} aria-hidden="true">
              <div className={s.ficheHead}>
                <span className={s.aiBadge}>✦ {t.object.badge}</span>
                <p className={s.objName}>{t.object.name}</p>
                <p className={s.objMeta}>{t.object.meta}</p>
              </div>
              <ul className={s.rows}>
                {t.object.rows.map(([k, v]) => (
                  <li key={k} className={s.row}><span>{k}</span><strong>{v}</strong></li>
                ))}
              </ul>
              <div className={s.value}>
                <div className={s.valueLabel}>{t.object.valueLabel}</div>
                <div className={s.valueAmount}>{t.object.value}</div>
                <div className={s.valueBar} />
              </div>
              <div className={s.scan} />
            </div>
            <div className={s.photo} aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/screens/chain/montre.png" alt="" width={240} height={240} />
            </div>
            <div className={s.photo} aria-hidden="true" style={{ background: 'none', border: 0, overflow: 'visible' }}>
              <div className={s.finder}><i /><i /><i /><i /></div>
            </div>
            <div className={s.flash} aria-hidden="true" />
          </figure>

          <ol className={s.caps} aria-hidden="true">
            {t.steps.map((label, i) => (
              <li key={label} className={s.cap}><b>{i + 1}</b>{label}</li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
