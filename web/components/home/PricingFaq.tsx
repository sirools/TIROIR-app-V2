import Link from 'next/link'
import { OFFERS_V4, displayVatRate, withVat } from '../../lib/offers'
import { fill, formatEur, useCopy } from '../../locales'
import s from './home.module.css'

// Prix : lib/offers.ts, seule source (la page Tarifs lit la même).
const { free, premium, pro } = OFFERS_V4

/** Tarifs en résumé (détail sur /pricing) puis FAQ courte. */
export default function PricingFaq() {
  const { t: { home: { pricing: t, faq }, pricing: { business } }, locale } = useCopy()
  const plans = [
    { key: 'free', name: 'Free', price: formatEur(0, locale), unit: '', tag: fill(t.plans.free, { n: free.aiActionsPerMonth }) },
    { key: 'premium', name: 'Premium', price: formatEur(withVat(premium.monthlyHt, displayVatRate()), locale), unit: t.perMonth, tag: t.plans.premium },
    { key: 'pro', name: 'Pro', price: formatEur(withVat(pro.monthlyHt, displayVatRate()), locale), unit: t.perMonth, tag: t.plans.pro },
    { key: 'business', name: 'Business', price: business.quote, unit: '', tag: t.plans.business },
  ]
  return (
    <section className={s.section} aria-labelledby="pricing-title">
      <div className={s.wrap}>
        <div className={s.head}>
          <p className={s.eyebrow}>{t.eyebrow}</p>
          <h2 id="pricing-title" className={s.h2}>{t.title}</h2>
          <p className={s.lead}>{t.sub}</p>
        </div>
        <ul className={s.plans}>
          {plans.map(p => (
            <li key={p.key} className={`${s.plan} ${p.key === 'premium' ? s.planHot : ''}`}>
              <span className={s.planName}>{p.name}</span>
              <span className={s.planPrice}>{p.price} <small>{p.unit}</small></span>
              <p className={s.planTag}>{p.tag}</p>
            </li>
          ))}
        </ul>
        <p className={s.priceNote}>{t.note}</p>
        <Link href="/pricing" className={s.more}>{t.details} ›</Link>

        <div className={s.faq}>
          <h2 className={s.h2}>{faq.title}</h2>
          {faq.items.map(item => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
