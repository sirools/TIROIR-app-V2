import StoreButtons from '../StoreButtons'
import { useCopy } from '../../locales'
import s from './home.module.css'

export default function FinalCta() {
  const { t: { home: { final: t } }, locale } = useCopy()
  return (
    <section className={s.final} aria-labelledby="final-title">
      <div className={s.wrap}>
        <h2 id="final-title" className={s.h2}>{t.title}</h2>
        <p className={s.lead}>{t.sub}</p>
        <div className={s.finalBtns}><StoreButtons variant="onColor" locale={locale} /></div>
      </div>
    </section>
  )
}
