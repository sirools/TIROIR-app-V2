// Tunnel d'abonnement, étape « paiement » : récapitulatif de l'offre et un
// seul bouton vers Stripe Checkout (hébergé : carte, Apple Pay, Google Pay).
//
//   /abonnement?offre=premium&periode=annuel
//
// Pas connecté : direction la création de compte, qui ramène ici
// (l'offre reste affichée à côté du formulaire). Déjà abonné sur le site :
// gestion de l'abonnement (portail Stripe). Palier payant venu de l'app ou
// d'une facture : on ne vend pas un second abonnement.
//
// Cette page n'active rien : seul le webhook Stripe change le palier.
import Head from 'next/head'
import { useState } from 'react'
import type { GetServerSideProps } from 'next'
import HeaderTiroirWeb from '../../components/layout/HeaderTiroirWeb'
import FooterTiroirWeb from '../../components/layout/FooterTiroirWeb'
import OfferRecap from '../../components/billing/OfferRecap'
import { serverSupabase, adminSupabase } from '../../lib/supabase'
import { asLocale, localePrefix } from '../../lib/localeRouting'
import { stripeEnv, subscriptionPlanFor, type BillingPeriod, type PlanTier } from '../../lib/stripeConfig'
import { offerFromQuery, subscribePath } from '../../lib/subscribeFlow'
import { fill, formatEur } from '../../locales'
import { displayVatRate, withVat } from '../../lib/offers'
import { useBillingCopy } from '../../locales/billing'

type Gate = 'OK' | 'WEB' | 'OTHER' | 'CLOSED'
type Props = { tier: PlanTier; period: BillingPeriod; email: string; gate: Gate }

export default function Abonnement({ tier, period, email, gate }: Props) {
  const { t: { subscribe: t }, locale } = useBillingCopy()
  const plan = subscriptionPlanFor(tier, period)!
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Montant TTC débité (TVA 20 % si assujetti).
  const price = formatEur(withVat(plan.amount / 100, displayVatRate()), locale)

  async function go(path: '/api/stripe/subscription' | '/api/stripe/portal') {
    setBusy(true); setError(null)
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, period, locale }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok && json.url) { window.location.href = json.url; return }
      setError(json.error === 'ALREADY_SUBSCRIBED' ? t.already : json.error === 'PAID_ELSEWHERE' ? t.elsewhere : t.error)
    } catch {
      setError(t.error)
    }
    setBusy(false)
  }

  return (
    <>
      <Head><title>{t.metaTitle}</title><meta name="robots" content="noindex" /></Head>
      <HeaderTiroirWeb />
      <main className="section" style={{ background: 'var(--beige-2)' }}>
        <div className="container" style={s.layout}>
          <div style={s.main}>
            <h1 className="h2" style={{ marginBottom: 8 }}>{t.title}</h1>
            <p style={s.muted}>
              {fill(t.signedInAs, { email })} · <a href={`${localePrefix(locale)}/login?next=${encodeURIComponent(subscribePath(tier, period))}`} style={s.link}>{t.switchAccount}</a>
            </p>

            {gate === 'OK' && (
              <>
                <button type="button" disabled={busy} onClick={() => go('/api/stripe/subscription')} style={{ ...s.btn, opacity: busy ? 0.7 : 1 }}>
                  {busy ? t.redirecting : fill(t.pay, { price })}
                </button>
                <p style={s.muted}>{t.payNote}</p>
                <p style={s.muted}>{t.consentNote}</p>
              </>
            )}
            {gate === 'WEB' && (
              <>
                <p role="status" style={s.note}>{t.already}</p>
                <button type="button" disabled={busy} onClick={() => go('/api/stripe/portal')} style={s.btn}>{t.manage}</button>
              </>
            )}
            {gate === 'OTHER' && <p role="status" style={s.note}>{t.elsewhere}</p>}
            {gate === 'CLOSED' && <p role="status" style={s.note}>{t.closed}</p>}
            {error && <p role="alert" style={s.error}>{error}</p>}
          </div>
          <OfferRecap plan={plan} />
        </div>
      </main>
      <FooterTiroirWeb />
    </>
  )
}

export const getServerSideProps: GetServerSideProps<Props> = async ctx => {
  ctx.res.setHeader('Cache-Control', 'private, no-store')
  const prefix = localePrefix(asLocale(ctx.locale))
  const offer = offerFromQuery(ctx.query)
  if (!offer) return { redirect: { destination: `${prefix}/pricing#formules`, permanent: false } }

  // getUser() : jeton validé par Supabase, pas seulement lu dans le cookie.
  const { data: { user } } = await serverSupabase(ctx).auth.getUser()
  if (!user) {
    // L'inscription (ou la connexion) ramène ici, offre comprise.
    const next = subscribePath(offer.tier, offer.period)
    return { redirect: { destination: `${prefix}/inscription?next=${encodeURIComponent(next)}`, permanent: false } }
  }

  let gate: Gate = 'CLOSED'
  if (stripeEnv()) {
    const { data, error } = await adminSupabase().rpc('stripe_subscription_gate', { p_user_id: user.id })
    // Base pas encore migrée (stripe_subscriptions.sql) : paiement fermé.
    gate = error ? 'CLOSED' : data === 'WEB' || data === 'OTHER' ? data : 'OK'
  }
  return { props: { tier: offer.tier, period: offer.period, email: user.email ?? '', gate } }
}

const s: Record<string, React.CSSProperties> = {
  layout: { display: 'flex', flexWrap: 'wrap', gap: 32, alignItems: 'flex-start', justifyContent: 'center', maxWidth: 880 },
  main:   { flex: '1 1 320px', minWidth: 0, maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 12 },
  muted:  { fontSize: 14, color: 'var(--muted)', lineHeight: 1.5, margin: 0 },
  link:   { color: 'var(--orange)', fontWeight: 600, textDecoration: 'none' },
  btn:    { marginTop: 12, width: '100%', padding: '15px 0', textAlign: 'center', display: 'block', borderRadius: 12, background: 'var(--orange)', color: 'white', fontWeight: 700, fontSize: 16, border: 'none', cursor: 'pointer', fontFamily: 'inherit' },
  note:   { fontSize: 15, color: 'var(--ink)', background: 'white', borderRadius: 12, padding: '12px 16px', margin: '8px 0 0', lineHeight: 1.5 },
  error:  { fontSize: 14, color: 'var(--error)', margin: 0 },
}
