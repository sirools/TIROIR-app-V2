import Image from 'next/image'
import { Search } from 'lucide-react'
import { useCopy } from '../../locales'
import Rail from './Rail'
import s from './home.module.css'

const THUMBS = ['veste', 'jean', 'baskets', 'casquette']

/** Photo → fiche rédigée → inventaire rangé (repris de la page Concept). */
export default function HowItWorks() {
  const { t: { home: { how: t } } } = useCopy()

  const visuals = [
    <div className={s.shot} key="shot">
      <Image src="/screens/chain/veste.png" alt="" width={132} height={132} sizes="132px" />
      <div className={s.shotFinder}><i /><i /><i /><i /></div>
    </div>,
    <div className={s.miniFiche} key="fiche">
      <div className={s.miniHead}>
        <Image src="/screens/chain/veste.png" alt="" width={40} height={40} sizes="40px" />
        <span className={s.miniName}>{t.fiche.name}</span>
      </div>
      {t.fiche.rows.map(([k, v]) => (
        <div key={k} className={s.miniRow}><span>{k}</span><strong>{v}</strong></div>
      ))}
    </div>,
    <div className={s.sorted} key="sorted">
      <div className={s.searchBar}><Search size={14} aria-hidden="true" />{t.search}</div>
      <div className={s.chips}>
        {t.collections.map((c, i) => <span key={c} className={`${s.chip} ${i === 0 ? s.chipOn : ''}`}>{c}</span>)}
      </div>
      <div className={s.thumbs}>
        {THUMBS.map(slug => <Image key={slug} src={`/screens/chain/${slug}.png`} alt="" width={64} height={64} sizes="64px" />)}
      </div>
    </div>,
  ]

  return (
    <section className={s.section} aria-labelledby="how-title">
      <div className={s.wrap}>
        <div className={s.head}>
          <p className={s.eyebrow}>{t.eyebrow}</p>
          <h2 id="how-title" className={s.h2}>{t.title}</h2>
        </div>
        <Rail
          label={t.eyebrow}
          items={t.steps.map((step, i) => (
            <article className={s.card}>
              <div className={s.vis} aria-hidden="true">{visuals[i]}</div>
              <div className={s.cardBody}>
                <h3 className={s.cardTitle}><span className={s.num}>{i + 1}</span>{step.title}</h3>
                <p className={s.cardText}>{step.text}</p>
              </div>
            </article>
          ))}
        />
      </div>
    </section>
  )
}
