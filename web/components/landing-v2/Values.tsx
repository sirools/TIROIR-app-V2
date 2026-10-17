import { Search, Share2, TrendingUp } from 'lucide-react'
import { COPY } from './copy'
import { Ph, rank } from './Ph'
import s from './v2.module.css'

const t = COPY.values
const ICONS = [Search, TrendingUp, Share2]

/** Trois cartes qui s'empilent au scroll sur mobile, en grille sur desktop. */
export default function Values() {
  return (
    <section className={`${s.section} ${s.values}`} aria-labelledby="v2-values-title">
      <div className={s.wrap}>
        <div className={s.sectionHead} data-rv="">
          <p className={s.eyebrow}><Ph>{t.eyebrow}</Ph></p>
          <h2 id="v2-values-title" className={s.h2}><Ph>{t.title}</Ph></h2>
        </div>
        <ul className={s.valList}>
          {t.cards.map((c, i) => {
            const Icon = ICONS[i]
            return (
              <li key={c.title} className={s.valCard} style={rank(i)}>
                <span className={s.valIcon} data-rv=""><Icon size={26} /></span>
                <div data-rv="">
                  <div className={s.valNum}>0{i + 1}</div>
                  <h3 className={s.valTitle}>{c.title}</h3>
                  <p className={s.lead}><Ph>{c.text}</Ph></p>
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
