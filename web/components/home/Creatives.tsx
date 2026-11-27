import Image from 'next/image'
import Link from 'next/link'
import { MouseEvent } from 'react'
import { LineChart, Search, Share2 } from 'lucide-react'
import { formatEur, useCopy } from '../../locales'
import s from './home.module.css'

const ICONS = [Search, LineChart, Share2]

/** Points de la courbe (valeur sur 12 mois), dans un cadre de 160 × 48. */
const TREND = '0,44 16,41 32,42 48,34 64,36 80,27 96,29 112,19 128,17 144,10 160,5'

/**
 * Section créatifs, vers l'offre Premium (vouvoiement : offre payante).
 *
 * ISO avec l'app : retrouver par collection et partager en lecture seule
 * existent déjà ; l'estimation automatique et la courbe de valeur viennent
 * avec Premium, encore à venir (badge « Bientôt », verbes au futur). Pas
 * de mot de passe promis sur les partages.
 */
export default function Creatives() {
  const { t: { home: { creatives: t } }, locale } = useCopy()
  const eur = (n: number) => formatEur(n, locale)

  // Défile jusqu'à la section Pro ; sans JS, l'ancre #pro suffit.
  function toPro(e: MouseEvent<HTMLAnchorElement>) {
    const target = document.getElementById('pro')
    if (!target) return
    e.preventDefault()
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    history.replaceState(null, '', '#pro')
  }

  return (
    <section className={`${s.section} ${s.crSec}`} aria-labelledby="creatives-title">
      <div className={s.wrap}>
        <div className={s.crGrid}>
          <div>
            <div className={s.head}>
              <p className={s.eyebrow}>{t.eyebrow}</p>
              <h2 id="creatives-title" className={s.h2}>{t.title}</h2>
              <p className={s.lead}>{t.sub}</p>
            </div>

            <ul className={s.crPoints}>
              {t.points.map((p, i) => {
                const Icon = ICONS[i]
                return (
                  <li key={p.title} className={s.crPoint} data-rv="">
                    <span className={s.icon}><Icon size={20} aria-hidden="true" /></span>
                    <div>
                      <h3 className={s.pointTitle}>
                        {p.title}
                        {p.soon && <span className={s.soon}>{t.soon}</span>}
                      </h3>
                      <p className={s.cardText}>{p.text}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          <figure className={s.crCard} role="img" aria-label={t.card.label} data-rv="">
            <span className={s.crPreview} aria-hidden="true">{t.card.preview}</span>
            <div className={s.crHead} aria-hidden="true">
              <Image src="/screens/chain/appareil-photo.png" alt="" width={72} height={72} sizes="72px" />
              <div>
                <p className={s.crName}>{t.card.name}</p>
                <p className={s.crMeta}>{t.card.meta}</p>
              </div>
            </div>
            <div className={s.crEstimate} aria-hidden="true">
              <span className={s.crLabel}>{t.card.estimateLabel}</span>
              <strong>{eur(420)} – {eur(510)}</strong>
            </div>
            <div className={s.crTrend} aria-hidden="true">
              <span className={s.trendLabel}>{t.card.trendLabel}</span>
              <svg viewBox="0 0 160 48" fill="none" preserveAspectRatio="none">
                <polyline className={s.crLine} points={TREND} pathLength={1} stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              </svg>
            </div>
          </figure>
        </div>

        <div className={s.crFoot}>
          <p className={s.crBridge}>
            {t.bridge}{' '}
            <a href="#pro" onClick={toPro} className={s.crBridgeLink}>{t.bridgeLink}</a>
          </p>
          <Link href="/pricing" className={s.crCta}>{t.cta}</Link>
          <p className={s.crCtaNote}>{t.ctaNote}</p>
        </div>
      </div>
    </section>
  )
}
