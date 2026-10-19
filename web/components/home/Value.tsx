import { History, LineChart, Tag } from 'lucide-react'
import { formatEur, useCopy } from '../../locales'
import s from './home.module.css'

const ICONS = [Tag, LineChart, History]

/** Estimation, suivi, revente — avec un visuel collé au texte. */
export default function Value() {
  const { t: { home: { value: t } }, locale } = useCopy()
  const eur = (n: number) => formatEur(n, locale)
  return (
    <section className={`${s.section} ${s.alt}`} aria-labelledby="value-title">
      <div className={s.wrap}>
        <div className={s.head}>
          <p className={s.eyebrow}>{t.eyebrow}</p>
          <h2 id="value-title" className={s.h2}>{t.title}</h2>
          <p className={s.lead}>{t.sub}</p>
        </div>
        <div className={s.valueGrid}>
          <div className={s.valueCard} aria-hidden="true" data-rv="">
            <div className={s.range}>{eur(380)} – {eur(460)}</div>
            <div className={s.rangeBar} />
            <ul className={s.comps}>
              <li><span>{t.demo.comparable}</span><strong>{eur(410)}</strong></li>
              <li><span>{t.demo.comparable}</span><strong>{eur(445)}</strong></li>
            </ul>
            <div className={s.trend}>
              <div>
                <div className={s.trendLabel}>{t.demo.trend}</div>
                <svg width="150" height="40" viewBox="0 0 150 40" fill="none">
                  <polyline points="0,34 25,30 50,32 75,22 100,24 125,12 150,8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className={s.sold}>{t.demo.sold} · {eur(430)}</span>
            </div>
          </div>
          <div>
            <ul className={s.valueItems}>
              {t.items.map((it, i) => {
                const Icon = ICONS[i]
                return (
                  <li key={it.title}>
                    <span className={s.icon}><Icon size={20} aria-hidden="true" /></span>
                    <div>
                      <h3 className={s.pointTitle}>{it.title}</h3>
                      <p className={s.cardText}>{it.text}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
            <p className={s.note}>{t.note}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
