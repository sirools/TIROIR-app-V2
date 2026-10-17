import { useRef } from 'react'
import Link from 'next/link'
import { Check } from 'lucide-react'
import StoreButtons from '../StoreButtons'
import { OFFERS_V4, euros } from '../../lib/offers'
import { COPY } from './copy'
import { Ph } from './Ph'
import { useActiveStep } from './useMotion'
import s from './v2.module.css'

const t = COPY.offers
const { free, premium, pro, business } = OFFERS_V4

// Prix : lib/offers.ts, seule source (comme la page Tarifs). Le paiement
// n'est pas ouvert : Premium et Pro restent « Bientôt disponible ».
const PLANS = [
  { key: 'free', name: 'Free', price: '0 €', unit: '', extra: `${free.aiActionsPerMonth} actions IA par mois` },
  { key: 'premium', name: 'Premium', price: euros(premium.monthlyTtc), unit: '/mois', extra: `ou ${euros(premium.yearlyTtc)} par an` },
  { key: 'pro', name: 'Pro', price: euros(pro.monthlyTtc), unit: '/mois', extra: '' },
  { key: 'business', name: 'Business', price: euros(business.seatMonthly), unit: 'par siège/mois', extra: '' },
] as const

/** Offres en cartes swipables (scroll-snap) sur mobile, en grille sur desktop, puis le CTA final. */
export default function Offers() {
  const list = useRef<HTMLUListElement>(null)
  const active = useActiveStep(list, { root: list, rootMargin: '0px' })

  return (
    <>
      <section className={`${s.section} ${s.offers}`} aria-labelledby="v2-offers-title">
        <div className={s.wrap}>
          <div className={`${s.sectionHead} ${s.center}`} data-rv="">
            <p className={s.eyebrow}><Ph>{t.eyebrow}</Ph></p>
            <h2 id="v2-offers-title" className={s.h2}><Ph>{t.title}</Ph></h2>
            <p className={s.lead}><Ph>{t.sub}</Ph></p>
          </div>

          <ul ref={list} className={s.plans} aria-label="Formules" data-rv="">
            {PLANS.map((p, i) => {
              const c = t.plans[p.key]
              const cls = p.key === 'premium' ? s.planHot : p.key === 'business' ? s.planDark : ''
              return (
                <li key={p.key} className={`${s.plan} ${cls}`} data-step="">
                  <div className={s.planName}>
                    {p.name}
                    {p.key === 'premium' && <span><Ph>{t.recommended}</Ph></span>}
                  </div>
                  <div>
                    <span className={s.planPrice}>{p.price}</span> <span className={s.planUnit}>{p.unit}</span>
                  </div>
                  <p className={s.planTag}>
                    {p.extra && <>{p.extra}<br /></>}
                    <Ph>{c.tagline}</Ph>
                  </p>
                  <ul className={s.feats}>
                    {c.features.map(f => <li key={f}><Check size={16} />{f}</li>)}
                  </ul>
                  <div className={s.planCta}>
                    {p.key === 'free' && <StoreButtons variant="card" full />}
                    {(p.key === 'premium' || p.key === 'pro') && (
                      <button type="button" disabled className={`${s.soon} ${p.key === 'premium' ? s.soonPrimary : ''}`}>
                        {t.soon}
                      </button>
                    )}
                    {p.key === 'business' && (
                      <a className={s.contact} href="mailto:hello@tiroir.app?subject=Tiroir%20Business">{t.contact}</a>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
          <ol className={s.dots} aria-hidden="true">
            {PLANS.map((p, i) => <li key={p.key} data-on={i === active ? '' : undefined} />)}
          </ol>
          <Link href="/pricing" className={s.details}>{t.details} ›</Link>
        </div>
      </section>

      <section className={s.final} aria-labelledby="v2-final-title">
        <div className={s.wrap} data-rv="">
          <h2 id="v2-final-title" className={s.h2}><Ph>{COPY.final.title}</Ph></h2>
          <p className={s.lead}><Ph>{COPY.final.sub}</Ph></p>
          <div className={s.finalBtns}><StoreButtons variant="onColor" /></div>
        </div>
      </section>
    </>
  )
}
