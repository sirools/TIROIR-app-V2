import Image from 'next/image'
import { fill, formatEur, useCopy } from '../../locales'
import Rail from './Rail'
import s from './home.module.css'

const IMAGES = ['veste', 'appareil-photo', 'montre', 'guitare']

/** Créatifs et pros : styliste, régisseur, brocanteur, musicien. */
export default function ForPros() {
  const { t: { home: { pros: t } }, locale } = useCopy()
  return (
    <section className={`${s.section} ${s.alt}`} aria-labelledby="pros-title">
      <div className={s.wrap}>
        <div className={s.head}>
          <p className={s.eyebrow}>{t.eyebrow}</p>
          <h2 id="pros-title" className={s.h2}>{t.title}</h2>
          <p className={s.lead}>{t.sub}</p>
        </div>
        <Rail
          label={t.eyebrow}
          items={t.personas.map((p, i) => (
            <article className={`${s.card} ${s.persona}`}>
              <div className={s.vis}>
                <Image className={s.personaImg} src={`/screens/chain/${IMAGES[i]}.png`} alt="" width={136} height={136} sizes="136px" />
                <span className={s.personaChip}>{fill(p.chip, { price: formatEur(1200, locale) })}</span>
              </div>
              <div className={s.cardBody}>
                <h3 className={s.cardTitle}>{p.who}</h3>
                <p className={s.cardText}>{p.text}</p>
              </div>
            </article>
          ))}
        />
      </div>
    </section>
  )
}
