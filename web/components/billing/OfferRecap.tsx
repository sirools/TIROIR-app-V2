// Récapitulatif de l'offre choisie, toujours visible pendant le tunnel
// d'abonnement (création de compte, connexion, paiement). Prix tirés de
// la config Stripe (grille OFFERS_V4), textes de la page Tarifs.
import Link from 'next/link'
import { fill, formatEur, useCopy } from '../../locales'
import { useBillingCopy } from '../../locales/billing'
import type { SubscriptionPlan } from '../../lib/stripeConfig'
import { displayVatRate, withVat } from '../../lib/offers'

const NAME = { premium: 'Premium', pro: 'Pro' } as const

export function tierName(tier: SubscriptionPlan['tier']): string {
  return NAME[tier]
}

export default function OfferRecap({ plan, changeHref = '/pricing#formules' }: { plan: SubscriptionPlan; changeHref?: string }) {
  const { t: { pricing }, locale } = useCopy()
  const { t: { subscribe: t } } = useBillingCopy()
  // Prix TTC (TVA 20 % si assujetti), HT en dessous.
  const vat = displayVatRate()
  const ht = plan.amount / 100
  const price = formatEur(withVat(ht, vat), locale)
  const features = pricing[plan.tier].features
  return (
    <aside className="card" aria-label={t.recapTitle} style={s.card}>
      <div style={s.label}>{t.recapTitle}</div>
      <div style={s.name}>Tiroir {NAME[plan.tier]}</div>
      <div style={s.priceRow}>
        <span style={s.price}>{price}</span>
        <span style={s.unit}>{plan.period === 'yearly' ? t.perYearUnit : pricing.perMonth}{vat ? ` ${pricing.vatIncl}` : ''}</span>
      </div>
      {vat > 0 && <div style={s.small}>{fill(pricing.vatExcl, { price: formatEur(ht, locale) })}</div>}
      <div style={s.small}>{fill(plan.period === 'yearly' ? t.billedYearly : t.billedMonthly, { price })}</div>
      <ul style={s.list}>
        {features.map(f => <li key={f} style={s.item}><span aria-hidden="true" style={s.check}>✓</span>{f}</li>)}
      </ul>
      <div style={s.small}>{t.renewal}</div>
      <Link href={changeHref} style={s.change}>{t.change}</Link>
    </aside>
  )
}

const s: Record<string, React.CSSProperties> = {
  card:     { padding: 24, display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 360, boxSizing: 'border-box', border: '2px solid var(--orange)' },
  label:    { fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' },
  name:     { fontSize: 20, fontWeight: 800, color: 'var(--ink)' },
  priceRow: { display: 'flex', alignItems: 'baseline', gap: 4 },
  price:    { fontSize: 32, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.1 },
  unit:     { fontSize: 15, color: 'var(--muted)' },
  small:    { fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 },
  list:     { listStyle: 'none', padding: 0, margin: '8px 0', display: 'flex', flexDirection: 'column', gap: 8 },
  item:     { display: 'flex', gap: 8, fontSize: 14, color: 'var(--ink)', lineHeight: 1.35 },
  check:    { color: 'var(--orange)', fontWeight: 700 },
  change:   { fontSize: 14, fontWeight: 600, color: 'var(--orange)', textDecoration: 'none', marginTop: 4 },
}
