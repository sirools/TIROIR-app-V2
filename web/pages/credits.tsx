// Crédits IA du compte connecté : solde, quota du mois, achat de packs
// (Stripe Checkout) et historique.
//
// Le solde et l'historique sont lus avec la session de l'utilisateur :
// la base (RLS, fonctions get_my_*) ne lui montre que les siens. L'achat
// ne crédite rien ici : c'est le webhook Stripe qui crédite, une fois le
// paiement confirmé.
//
// Achat sur le site uniquement : l'app ne renvoie pas ici (règles des
// stores, voir strategie/paiements-stripe.md).
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState } from 'react'
import type { GetServerSideProps } from 'next'
import HeaderTiroirWeb from '../components/layout/HeaderTiroirWeb'
import FooterTiroirWeb from '../components/layout/FooterTiroirWeb'
import { serverSupabase } from '../lib/supabase'
import { asLocale, localePrefix } from '../lib/localeRouting'
import { CREDIT_PACKS, stripeEnv } from '../lib/stripeConfig'
import { OFFERS_V4 } from '../lib/offers'
import { fill, formatEur, intlLocale } from '../locales'
import { useBillingCopy } from '../locales/billing'

type HistoryRow = { at: string; delta: number; reason: string; detail: string | null; refunded: boolean }
type Props = {
  balance: number
  quota: { used: number; quota: number; resetAt: string } | null
  history: HistoryRow[]
  paymentOpen: boolean
  inTeam: boolean
}

const POPULAR = OFFERS_V4.packs.findIndex(p => p.popular)

export default function Credits({ balance, quota, history, paymentOpen, inTeam }: Props) {
  const { t: { credits: t }, locale } = useBillingCopy()
  const router = useRouter()
  const [waiver, setWaiver] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const eur = (n: number) => formatEur(n, locale)
  const day = (iso: string) => new Date(iso).toLocaleDateString(intlLocale(locale), { day: 'numeric', month: 'long' })
  const outOfAi = balance <= 0 && !!quota && quota.used >= quota.quota
  const back = router.query.achat

  async function buy(pack: string) {
    setError(null)
    if (!waiver) { setError(t.waiverMissing); return }
    setBusy(pack)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack, waiver: true, locale }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.url) throw new Error(json.error)
      window.location.href = json.url
    } catch {
      setError(t.error)
      setBusy(null)
    }
  }

  return (
    <>
      <Head><title>{t.metaTitle}</title><meta name="robots" content="noindex" /></Head>
      <HeaderTiroirWeb />

      <main className="section">
        <div className="container" style={{ maxWidth: 720 }}>
          <h1 className="h2" style={{ marginBottom: 8 }}>{t.title}</h1>
          <p className="p" style={{ marginBottom: 24 }}>{fill(t.intro, { n: OFFERS_V4.free.aiActionsPerMonth })}</p>

          {back === 'ok' && <p role="status" style={s.ok}>{t.success}</p>}
          {back === 'annule' && <p role="status" style={s.note}>{t.cancelled}</p>}
          {outOfAi && (
            <div role="alert" style={s.alert}>
              <span>{t.empty}</span>
              <a href="#acheter" style={s.alertCta}>{t.buyCta}</a>
            </div>
          )}

          {/* ── Solde ── */}
          <div className="card" style={s.card}>
            <div style={s.stats}>
              <div>
                <div style={s.label}>{t.balance}</div>
                <div style={{ ...s.big, color: balance < 0 ? 'var(--error)' : 'var(--ink)' }}>{balance.toLocaleString(intlLocale(locale))}</div>
                {balance < 0 && <div style={s.small}>{t.negative}</div>}
              </div>
              {quota && (
                <div>
                  <div style={s.label}>{t.quota}</div>
                  <div style={s.mid}>{fill(t.quotaLine, { used: quota.used, quota: quota.quota, date: day(quota.resetAt) })}</div>
                </div>
              )}
            </div>
            {inTeam && <a href={`${localePrefix(locale)}/equipe`} style={s.link}>{t.team} →</a>}
          </div>

          {/* ── Achat ── */}
          <h2 id="acheter" style={s.h2}>{t.buyTitle}</h2>
          <div style={s.packs}>
            {CREDIT_PACKS.map((p, i) => (
              <div key={p.key} className="card" style={{ ...s.pack, ...(i === POPULAR ? s.packPopular : {}) }}>
                {i === POPULAR && <div style={s.badge}>{t.popular}</div>}
                <div style={s.packCredits}>{p.credits.toLocaleString(intlLocale(locale))}</div>
                <div style={s.packPrice}>{eur(p.amount / 100)}</div>
                <div style={s.small}>{fill(t.perCredit, { price: eur(Math.round(p.amount / p.credits) / 100) })}</div>
                <button
                  type="button"
                  disabled={!paymentOpen || busy !== null}
                  onClick={() => buy(p.key)}
                  style={{ ...s.btn, ...(i === POPULAR ? {} : s.btnGhost), opacity: paymentOpen ? 1 : 0.6, cursor: paymentOpen ? 'pointer' : 'not-allowed' }}
                >
                  {!paymentOpen ? t.soon : busy === p.key ? t.redirecting : t.buy}
                </button>
              </div>
            ))}
          </div>
          {paymentOpen && (
            <label style={s.waiver}>
              <input type="checkbox" checked={waiver} onChange={e => { setWaiver(e.target.checked); setError(null) }} style={{ marginTop: 3, appearance: 'auto', WebkitAppearance: 'checkbox', width: 18, height: 18, flexShrink: 0, accentColor: 'var(--orange)' }} />
              <span>{t.waiver}</span>
            </label>
          )}
          {error && <p role="alert" style={s.error}>{error}</p>}
          <p style={s.small}>{t.secure}</p>

          {/* ── Historique ── */}
          <h2 style={s.h2}>{t.historyTitle}</h2>
          <div className="card" style={s.card}>
            {history.length === 0 ? <p style={s.small}>{t.historyEmpty}</p> : (
              <ul style={s.rows}>
                {history.map((h, i) => (
                  <li key={i} style={s.row}>
                    <span style={{ flex: 1 }}>
                      <strong style={{ color: 'var(--ink)' }}>{t.reasons[h.reason] ?? h.reason}</strong>
                      {h.detail === 'site' && <span style={s.small}> · {t.viaSite}</span>}
                      {h.detail === 'app' && <span style={s.small}> · {t.viaApp}</span>}
                      {h.refunded && <span style={s.small}> · {t.refunded}</span>}
                      <div style={s.small}>{new Date(h.at).toLocaleString(intlLocale(locale), { dateStyle: 'medium', timeStyle: 'short' })}</div>
                    </span>
                    <span style={{ fontWeight: 700, color: h.reason === 'quota' ? 'var(--muted)' : h.delta > 0 ? 'var(--success)' : 'var(--ink)' }}>
                      {h.delta > 0 ? '+' : ''}{h.delta}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>

      <FooterTiroirWeb />
    </>
  )
}

export const getServerSideProps: GetServerSideProps<Props> = async ctx => {
  ctx.res.setHeader('Cache-Control', 'private, no-store')
  const supabase = serverSupabase(ctx)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    const prefix = localePrefix(asLocale(ctx.locale))
    return { redirect: { destination: `${prefix}/login?next=${encodeURIComponent(`${prefix}/credits`)}`, permanent: false } }
  }

  // Tout avec la session de l'utilisateur : la base ne lui montre que le sien.
  const [credits, quota, history, team] = await Promise.all([
    supabase.rpc('get_my_ai_credits'),
    supabase.rpc('get_ai_quota'),
    supabase.rpc('get_my_credit_history', { p_limit: 50 }),
    supabase.from('org_members').select('org_id').eq('user_id', user.id).eq('status', 'active').maybeSingle(),
  ])

  // Tant que stripe_credits.sql n'est pas appliqué, l'historique se limite au journal.
  let rows = (history.data ?? []) as HistoryRow[]
  if (history.error) {
    const { data } = await supabase.from('ai_credit_ledger').select('created_at, delta, reason, ref').order('created_at', { ascending: false }).limit(50)
    rows = ((data ?? []) as { created_at: string; delta: number; reason: string; ref: string | null }[]).map(l => ({
      at: l.created_at, delta: l.delta, reason: l.reason, refunded: false,
      detail: l.ref?.startsWith('stripe:') ? 'site' : l.ref?.startsWith('rc:') ? 'app' : null,
    }))
  }
  const q = (Array.isArray(quota.data) ? quota.data[0] : quota.data) as { used: number; quota: number; reset_at: string } | null

  return {
    props: {
      balance: typeof credits.data === 'number' ? credits.data : 0,
      quota: q ? { used: q.used, quota: q.quota, resetAt: q.reset_at } : null,
      history: rows,
      paymentOpen: stripeEnv() !== null,
      inTeam: !!team.data,
    },
  }
}

const s: Record<string, React.CSSProperties> = {
  card:        { padding: 24, marginBottom: 20 },
  stats:       { display: 'flex', flexWrap: 'wrap', gap: 32, marginBottom: 8 },
  label:       { fontSize: 13, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 },
  big:         { fontSize: 40, fontWeight: 800, lineHeight: 1 },
  mid:         { fontSize: 16, fontWeight: 600, color: 'var(--ink)' },
  small:       { fontSize: 13, color: 'var(--muted)' },
  h2:          { fontSize: 20, fontWeight: 800, color: 'var(--ink)', margin: '32px 0 12px' },
  packs:       { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 },
  pack:        { padding: 20, display: 'flex', flexDirection: 'column', gap: 6, position: 'relative', minWidth: 0 },
  packPopular: { border: '2px solid var(--orange)' },
  badge:       { position: 'absolute', top: -11, left: 16, background: 'var(--orange)', color: 'var(--white)', fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 999 },
  packCredits: { fontSize: 28, fontWeight: 800, color: 'var(--ink)' },
  packPrice:   { fontSize: 18, fontWeight: 700, color: 'var(--ink)' },
  btn:         { marginTop: 10, padding: '11px 0', borderRadius: 12, background: 'var(--orange)', color: 'var(--white)', fontWeight: 700, fontSize: 15, border: 'none', fontFamily: 'inherit' },
  btnGhost:    { background: 'var(--white)', color: 'var(--ink)', border: '1.5px solid var(--border)' },
  waiver:      { display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 14, color: 'var(--ink)', lineHeight: 1.5, margin: '16px 0 8px', cursor: 'pointer' },
  error:       { fontSize: 14, color: 'var(--error)', background: 'var(--error-light)', borderRadius: 8, padding: '8px 12px' },
  ok:          { fontSize: 14, color: 'var(--success)', fontWeight: 600, marginBottom: 16 },
  note:        { fontSize: 14, color: 'var(--muted)', marginBottom: 16 },
  alert:       { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, justifyContent: 'space-between', background: 'var(--error-light)', color: 'var(--ink)', borderRadius: 12, padding: '14px 16px', marginBottom: 20, fontSize: 14 },
  alertCta:    { background: 'var(--orange)', color: 'var(--white)', fontWeight: 700, padding: '8px 14px', borderRadius: 10, textDecoration: 'none', whiteSpace: 'nowrap' },
  link:        { color: 'var(--orange)', fontWeight: 600, textDecoration: 'none', fontSize: 14 },
  rows:        { listStyle: 'none', padding: 0, margin: 0 },
  row:         { display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, padding: '10px 0', borderTop: '1px solid var(--border-light)' },
}
