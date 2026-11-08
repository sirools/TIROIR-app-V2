// Retour de Stripe Checkout après paiement. Cette page N'ACTIVE RIEN :
// elle attend que le webhook Stripe ait posé le palier (GET
// /api/stripe/subscription), l'annonce, puis renvoie vers l'app.
import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { GetServerSideProps } from 'next'
import HeaderTiroirWeb from '../../components/layout/HeaderTiroirWeb'
import FooterTiroirWeb from '../../components/layout/FooterTiroirWeb'
import StoreButtons from '../../components/StoreButtons'
import { tierName } from '../../components/billing/OfferRecap'
import { serverSupabase } from '../../lib/supabase'
import { asLocale, localePrefix } from '../../lib/localeRouting'
import { offerFromQuery } from '../../lib/subscribeFlow'
import type { PlanTier } from '../../lib/stripeConfig'
import { fill } from '../../locales'
import { useBillingCopy } from '../../locales/billing'

type Props = { tier: PlanTier }
type State = 'waiting' | 'active' | 'slow'

const POLL_MS = 2000
const POLL_MAX = 20 // ≈ 40 s

export default function AbonnementMerci({ tier }: Props) {
  const { t: { subscribe: t }, locale } = useBillingCopy()
  const [state, setState] = useState<State>('waiting')

  useEffect(() => {
    let tries = 0
    let stop = false
    async function check() {
      tries += 1
      try {
        const res = await fetch('/api/stripe/subscription', { cache: 'no-store' })
        const json = await res.json()
        if (!stop && json.source === 'web' && json.plan === tier) { setState('active'); return }
      } catch { /* on réessaie */ }
      if (stop) return
      if (tries >= POLL_MAX) { setState('slow'); return }
      setTimeout(check, POLL_MS)
    }
    check()
    return () => { stop = true }
  }, [tier])

  return (
    <>
      <Head><title>{t.successMetaTitle}</title><meta name="robots" content="noindex" /></Head>
      <HeaderTiroirWeb />
      <main className="section" style={{ minHeight: '60vh', display: 'grid', placeItems: 'center', background: 'var(--beige-2)' }}>
        <div className="card" style={{ padding: 28, maxWidth: 520, width: '100%', boxSizing: 'border-box', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h1 className="h2" style={{ margin: 0 }}>{t.successTitle}</h1>
          <p role="status" aria-live="polite" className="p" style={{ margin: 0, fontWeight: 600 }}>
            {state === 'active' ? fill(t.active, { tier: tierName(tier) }) : state === 'slow' ? t.slow : t.waiting}
          </p>
          <p className="p" style={{ margin: 0 }}>{t.next}</p>
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>{t.getApp}</div>
            <StoreButtons variant="card" full locale={locale} />
          </div>
          <Link href={`${localePrefix(locale)}/mon-compte`} style={{ color: 'var(--orange)', fontWeight: 600, textDecoration: 'none' }}>{t.seeAccount} →</Link>
        </div>
      </main>
      <FooterTiroirWeb />
    </>
  )
}

export const getServerSideProps: GetServerSideProps<Props> = async ctx => {
  ctx.res.setHeader('Cache-Control', 'private, no-store')
  const prefix = localePrefix(asLocale(ctx.locale))
  const { data: { user } } = await serverSupabase(ctx).auth.getUser()
  if (!user) return { redirect: { destination: `${prefix}/login?next=${encodeURIComponent('/mon-compte')}`, permanent: false } }
  const offer = offerFromQuery(ctx.query)
  return { props: { tier: offer?.tier ?? 'premium' } }
}
