// Équipe Business du compte connecté : état de l'abonnement, membres,
// factures. L'owner et les admins ajoutent et retirent des membres ; chaque
// changement ajuste les sièges facturés (/api/business/members).
import Head from 'next/head'
import { useCallback, useEffect, useState } from 'react'
import type { GetServerSideProps } from 'next'
import HeaderTiroirWeb from '../components/layout/HeaderTiroirWeb'
import FooterTiroirWeb from '../components/layout/FooterTiroirWeb'
import { serverSupabase } from '../lib/supabase'
import { asLocale, localePrefix } from '../lib/localeRouting'
import { fill, formatEur, intlLocale } from '../locales'
import { useBillingCopy } from '../locales/billing'

type Member = { user_id: string; email: string | null; role: string; plan: string | null; pro_from_org: boolean }
type Invoice = {
  stripe_invoice_id: string; number: string | null; status: string; amount_due: number; amount_paid: number
  due_date: string | null; hosted_invoice_url: string | null; invoice_pdf: string | null; created_at: string
}
type Team = {
  org: null | { name: string; subscription_status: string | null; seat_quantity: number | null; seat_unit_amount: number | null; pro_access_until: string | null }
  role?: string
  members?: Member[]
  invoices?: Invoice[]
}

export default function Equipe({ userId }: { userId: string }) {
  const { t: { team: t }, locale } = useBillingCopy()
  const [team, setTeam] = useState<Team | null>(null)
  const [email, setEmail] = useState('')
  const [asAdmin, setAsAdmin] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const day = (iso: string) => new Date(iso).toLocaleDateString(intlLocale(locale), { day: 'numeric', month: 'long', year: 'numeric' })
  const eur = (cents: number) => formatEur(cents / 100, locale)

  const load = useCallback(async () => {
    const res = await fetch('/api/business/members')
    setTeam(res.ok ? await res.json() : { org: null })
  }, [])
  useEffect(() => { load() }, [load])

  async function change(method: 'POST' | 'DELETE', body: Record<string, unknown>) {
    setBusy(true); setMessage(null)
    const res = await fetch('/api/business/members', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const json = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setMessage({ ok: false, text: t.errors[json.error] ?? t.errors.default }); return }
    if (json.billingPending) setMessage({ ok: true, text: t.billingPending })
    if (method === 'POST') { setEmail(''); setAsAdmin(false) }
    load()
  }

  const manager = team?.role === 'owner' || team?.role === 'admin'
  const org = team?.org

  return (
    <>
      <Head><title>{t.metaTitle}</title><meta name="robots" content="noindex" /></Head>
      <HeaderTiroirWeb />
      <main className="section">
        <div className="container" style={{ maxWidth: 720 }}>
          <h1 className="h2" style={{ marginBottom: 16 }}>{org?.name ?? t.title}</h1>

          {team && !org && (
            <div className="card" style={s.card}>
              <p style={s.text}>{t.none}</p>
              <a href={`${localePrefix(locale)}/pricing`} style={s.link}>{t.noneCta} →</a>
            </div>
          )}

          {org && (
            <>
              <div className="card" style={s.card}>
                <div style={s.label}>{t.status}</div>
                <div style={s.mid}>{t.statuses[org.subscription_status ?? 'none'] ?? org.subscription_status}</div>
                {org.seat_quantity != null && org.seat_unit_amount != null && (
                  <div style={s.small}>{fill(t.seats, { n: org.seat_quantity, price: eur(org.seat_unit_amount) })}</div>
                )}
                {org.pro_access_until && <div style={s.small}>{fill(t.proUntil, { date: day(org.pro_access_until) })}</div>}
              </div>

              <h2 style={s.h2}>{t.members}</h2>
              <div className="card" style={s.card}>
                <ul style={s.rows}>
                  {(team?.members ?? []).map(m => (
                    <li key={m.user_id} style={s.row}>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ color: 'var(--ink)', wordBreak: 'break-all' }}>{m.email ?? '—'}</strong>
                        {m.user_id === userId && <span style={s.small}> ({t.you})</span>}
                        <div style={s.small}>
                          {t.roles[m.role] ?? m.role}
                          {!m.pro_from_org && m.plan !== 'free' && ` · ${t.ownPlan}`}
                        </div>
                      </span>
                      {manager && m.role !== 'owner' && m.user_id !== userId && (
                        <button type="button" disabled={busy} style={s.btnGhost}
                          onClick={() => { if (window.confirm(t.confirmRemove)) change('DELETE', { user_id: m.user_id }) }}>
                          {t.remove}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>

              {manager && (
                <form className="card" style={s.card} onSubmit={e => { e.preventDefault(); if (email.trim()) change('POST', { email, role: asAdmin ? 'admin' : 'member' }) }}>
                  <h3 style={s.cardTitle}>{t.addTitle}</h3>
                  <p style={s.text}>{t.addHint}</p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder={t.emailPlaceholder} style={s.input} />
                    <button type="submit" disabled={busy} style={s.btn}>{t.add}</button>
                  </div>
                  {team?.role === 'owner' && (
                    <label style={{ ...s.small, display: 'flex', gap: 8, marginTop: 10 }}>
                      <input type="checkbox" checked={asAdmin} onChange={e => setAsAdmin(e.target.checked)} /> {t.asAdmin}
                    </label>
                  )}
                </form>
              )}
              {message && <p role="status" style={message.ok ? s.ok : s.error}>{message.text}</p>}

              {manager && (
                <>
                  <h2 style={s.h2}>{t.invoices}</h2>
                  <div className="card" style={s.card}>
                    {(team?.invoices ?? []).length === 0 ? <p style={s.small}>{t.noInvoices}</p> : (
                      <ul style={s.rows}>
                        {(team?.invoices ?? []).map(i => (
                          <li key={i.stripe_invoice_id} style={s.row}>
                            <span style={{ flex: 1 }}>
                              <strong style={{ color: 'var(--ink)' }}>{i.number ?? '—'}</strong>
                              <span style={s.small}> · {day(i.created_at)} · {t.invoiceStatus[i.status] ?? i.status}</span>
                              {i.status === 'open' && i.due_date && <div style={s.small}>{fill(t.due, { date: day(i.due_date) })}</div>}
                            </span>
                            <strong style={{ color: 'var(--ink)' }}>{eur(i.status === 'paid' ? i.amount_paid : i.amount_due)}</strong>
                            {i.hosted_invoice_url && <a href={i.hosted_invoice_url} target="_blank" rel="noreferrer" style={s.link}>{t.view}</a>}
                            {i.invoice_pdf && <a href={i.invoice_pdf} target="_blank" rel="noreferrer" style={s.link}>{t.pdf}</a>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </main>
      <FooterTiroirWeb />
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async ctx => {
  ctx.res.setHeader('Cache-Control', 'private, no-store')
  const { data: { user } } = await serverSupabase(ctx).auth.getUser()
  if (!user) {
    const prefix = localePrefix(asLocale(ctx.locale))
    return { redirect: { destination: `${prefix}/login?next=${encodeURIComponent(`${prefix}/equipe`)}`, permanent: false } }
  }
  return { props: { userId: user.id } }
}

const s: Record<string, React.CSSProperties> = {
  card:      { padding: 24, marginBottom: 20 },
  cardTitle: { fontSize: 17, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 },
  text:      { fontSize: 14, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 12 },
  label:     { fontSize: 13, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 },
  mid:       { fontSize: 18, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 },
  small:     { fontSize: 13, color: 'var(--muted)' },
  h2:        { fontSize: 20, fontWeight: 800, color: 'var(--ink)', margin: '28px 0 12px' },
  rows:      { listStyle: 'none', padding: 0, margin: 0 },
  row:       { display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, padding: '10px 0', borderTop: '1px solid var(--border-light)', flexWrap: 'wrap' },
  input:     { flex: 1, minWidth: 200, padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 15, fontFamily: 'inherit' },
  btn:       { padding: '10px 18px', borderRadius: 10, background: 'var(--orange)', color: 'var(--white)', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer', fontFamily: 'inherit' },
  btnGhost:  { padding: '7px 12px', borderRadius: 10, background: 'var(--white)', color: 'var(--ink)', fontWeight: 700, fontSize: 13, border: '1.5px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' },
  link:      { color: 'var(--orange)', fontWeight: 600, textDecoration: 'none', fontSize: 14 },
  ok:        { fontSize: 14, color: 'var(--success)', fontWeight: 600 },
  error:     { fontSize: 14, color: 'var(--error)', background: 'var(--error-light)', borderRadius: 8, padding: '8px 12px' },
}
