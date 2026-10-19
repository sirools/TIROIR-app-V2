import { useEffect, useRef } from 'react'
import Image from 'next/image'
import StoreButtons from '../StoreButtons'
import { HERO_VARIANT, formatEur, useCopy } from '../../locales'
import s from './home.module.css'

/**
 * Accroche + le geste clé en une boucle CSS de 8 s : la photo d'un objet
 * devient une fiche, puis sa valeur apparaît. L'état par défaut est la
 * fiche complète (mouvement réduit, sans JS). La boucle se met en pause
 * hors de l'écran.
 */
export default function Hero() {
  const { t: { home: { hero: t } }, locale } = useCopy()
  const { title, sub } = t.variants[HERO_VARIANT - 1]
  const value = `${formatEur(380, locale)} – ${formatEur(460, locale)}`
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
    <section ref={ref} className={s.hero} aria-labelledby="home-title">
      <div className={`${s.wrap} ${s.heroGrid}`}>
        <div>
          <span className={s.badge}>{t.badge}</span>
          <h1 id="home-title" className={s.heroTitle}>{title}</h1>
          <p className={s.heroSub}>{sub}</p>
          <StoreButtons variant="dark" locale={locale} />
          <p className={s.heroFree}>{t.free}</p>
        </div>

        <div className={s.stageWrap}>
          <div className={s.stageBox}>
            <figure className={s.stage} role="img" aria-label={t.demoLabel}>
              <div className={s.fiche} aria-hidden="true">
                <div className={s.ficheHead}>
                  <span className={s.ready}>✓ {t.object.ready}</span>
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
                  <div className={s.valueAmount}>{value}</div>
                </div>
              </div>
              <div className={s.photo} aria-hidden="true">
                <Image src="/screens/chain/montre.png" alt="" width={180} height={180} priority sizes="180px" />
              </div>
              <div className={s.finder} aria-hidden="true"><i /><i /><i /><i /></div>
              <div className={s.flash} aria-hidden="true" />
            </figure>
          </div>
          <ol className={s.caps} aria-hidden="true">
            {t.steps.map((label, i) => <li key={label} className={s.cap}><b>{i + 1}</b>{label}</li>)}
          </ol>
        </div>
      </div>
    </section>
  )
}
