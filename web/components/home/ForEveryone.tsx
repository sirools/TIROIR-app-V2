import { Camera, Link2, ShieldCheck } from 'lucide-react'
import { useCopy } from '../../locales'
import s from './home.module.css'

const ICONS = [Camera, ShieldCheck, Link2]

/** Grand public : simplicité, données privées, partage en lecture seule. */
export default function ForEveryone() {
  const { t: { home: { everyone: t } } } = useCopy()
  return (
    <section className={s.section} aria-labelledby="everyone-title">
      <div className={s.wrap}>
        <div className={s.head}>
          <p className={s.eyebrow}>{t.eyebrow}</p>
          <h2 id="everyone-title" className={s.h2}>{t.title}</h2>
          <p className={s.lead}>{t.sub}</p>
        </div>
        <ul className={s.points}>
          {t.points.map((p, i) => {
            const Icon = ICONS[i]
            return (
              <li key={p.title} className={s.point} data-rv="">
                <span className={s.icon}><Icon size={20} aria-hidden="true" /></span>
                <div>
                  <h3 className={s.pointTitle}>{p.title}</h3>
                  <p className={s.cardText}>{p.text}</p>
                </div>
              </li>
            )
          })}
        </ul>
        <div className={s.uses}>
          <h3 className={s.usesTitle}>{t.usesTitle}</h3>
          <ul className={s.usesList}>
            {t.uses.map(u => <li key={u}>{u}</li>)}
          </ul>
        </div>
        <p className={s.why}>{t.why}</p>
      </div>
    </section>
  )
}
