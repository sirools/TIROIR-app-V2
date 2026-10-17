import { Disc3, PackageOpen, ShieldCheck, Wine } from 'lucide-react'
import { COPY } from './copy'
import { Ph, rank } from './Ph'
import s from './v2.module.css'

const t = COPY.public
const ICONS = [Wine, Disc3, PackageOpen, ShieldCheck]

/** Pont vers le grand public : quatre usages du quotidien. */
export default function GrandPublic() {
  return (
    <section className={s.section} aria-labelledby="v2-public-title">
      <div className={s.wrap}>
        <div className={s.sectionHead} data-rv="">
          <p className={s.eyebrow}><Ph>{t.eyebrow}</Ph></p>
          <h2 id="v2-public-title" className={s.h2}><Ph>{t.title}</Ph></h2>
          <p className={s.lead}><Ph>{t.sub}</Ph></p>
        </div>
        <ul className={s.tiles}>
          {t.examples.map((ex, i) => {
            const Icon = ICONS[i]
            return (
              <li key={ex.title} className={s.tile} data-rv="" style={rank(i)}>
                <span className={s.thumb}><Icon size={22} /></span>
                <h3 className={s.tileTitle}><Ph>{ex.title}</Ph></h3>
                <p className={s.tileText}><Ph>{ex.text}</Ph></p>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
