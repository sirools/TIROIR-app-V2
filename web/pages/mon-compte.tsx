// Gestion du compte : changement de mot de passe en direct, ou envoi d'un
// lien de réinitialisation par e-mail.
//
// Les comptes créés via Google n'ont pas de mot de passe : on le détecte via
// les identités de l'utilisateur et on adapte le libellé (« définir » plutôt
// que « changer »), sans jamais bloquer l'action — poser un mot de passe sur
// un compte OAuth est justement ce qui permet ensuite les deux méthodes.
import Head from 'next/head'
import { useEffect, useState } from 'react'
import type { GetServerSideProps } from 'next'
import HeaderTiroirWeb from '../components/layout/HeaderTiroirWeb'
import FooterTiroirWeb from '../components/layout/FooterTiroirWeb'
import { supabase, serverSupabase, adminSupabase } from '../lib/supabase'
import { providerRows, type IdentityLike, type Provider } from '../lib/identities'
import { authErrorKey, linkErrorKey, type AccountErrorKey } from '../lib/authErrors'
import { asLocale, localePrefix } from '../lib/localeRouting'
import { fill, formatEur, intlLocale, useCopy } from '../locales'
import { useBillingCopy } from '../locales/billing'
import { tierName } from '../components/billing/OfferRecap'
import { stripeEnv } from '../lib/stripeConfig'
import { stripeClient } from '../lib/stripe/api'

/** Palier du compte et abonnement du site (Stripe), lus côté serveur. */
type Subscription = {
  plan: 'free' | 'premium' | 'pro'
  source: 'web' | 'app' | 'invoice' | null
  status: string | null
  periodEnd: string | null
  cancelAtPeriodEnd: boolean
  canManage: boolean
  /** Factures Stripe du compte (abonnements, crédits), les plus récentes d'abord. */
  invoices: InvoiceLine[]
}
type InvoiceLine = { id: string; number: string | null; date: string; total: number; currency: string; paid: boolean; url: string | null; pdf: string | null }

const MIN_PASSWORD_LENGTH = 8

export default function MonCompte({ subscription }: { subscription: Subscription | null }) {
  const { t: { account: t }, locale } = useCopy()
  // Préfixe de langue des liens <a> et des retours Supabase (« » en français).
  const prefix = localePrefix(locale)
  // Libellés des moyens de connexion (Google et Apple sont des marques).
  const providerLabel: Record<Provider, string> = { email: t.myAccount.providerEmail, google: 'Google', apple: 'Apple' }
  const [email, setEmail] = useState('')
  const [providers, setProviders] = useState<string[]>([])

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [passwordDone, setPasswordDone] = useState(false)
  const [error, setError] = useState<AccountErrorKey | null>(null)

  const [resetSent, setResetSent] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  const [identities, setIdentities] = useState<IdentityLike[]>([])
  const [linkBusy, setLinkBusy] = useState<Provider | null>(null)
  const [linkError, setLinkError] = useState<AccountErrorKey | null>(null)
  const [linkDone, setLinkDone] = useState<'linkAdded' | 'linkRemoved' | null>(null)

  async function refreshIdentities() {
    const { data } = await supabase.auth.getUser()
    if (!data.user) return
    setEmail(data.user.email ?? '')
    const ids = (data.user.identities ?? []) as IdentityLike[]
    setIdentities(ids)
    setProviders(ids.map(i => i.provider))
  }

  useEffect(() => {
    refreshIdentities()
    // Retour d'une liaison (Google renvoie ici après accord).
    if (new URLSearchParams(window.location.search).has('lie')) setLinkDone('linkAdded')
  }, [])

  async function handleLink(provider: Provider) {
    if (provider === 'email') return
    setLinkError(null); setLinkDone(null); setLinkBusy(provider)
    const { error: linkErr } = await supabase.auth.linkIdentity({
      provider,
      options: { redirectTo: `${window.location.origin}${prefix}/mon-compte?lie=1` },
    })
    // En cas de succès, le navigateur part chez le fournisseur : on ne revient ici qu'en cas d'erreur.
    if (linkErr) { setLinkError(linkErrorKey(linkErr)); setLinkBusy(null) }
  }

  async function handleUnlink(provider: Provider) {
    setLinkError(null); setLinkDone(null); setLinkBusy(provider)
    const { data } = await supabase.auth.getUserIdentities()
    const identity = data?.identities.find(i => i.provider === provider)
    if (!identity) { setLinkBusy(null); return }
    const { error: unlinkErr } = await supabase.auth.unlinkIdentity(identity)
    setLinkBusy(null)
    if (unlinkErr) { setLinkError(linkErrorKey(unlinkErr)); return }
    setLinkDone('linkRemoved')
    refreshIdentities()
  }

  const hasPassword = providers.includes('email')
  const oauthOnly = providers.length > 0 && !hasPassword

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPasswordDone(false)

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError('passwordTooShort')
      return
    }
    if (password !== confirm) {
      setError('passwordMismatch')
      return
    }

    setSaving(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSaving(false)

    if (updateError) { setError(authErrorKey(updateError)); return }

    setPassword('')
    setConfirm('')
    setPasswordDone(true)
    // L'identité e-mail vient d'être créée sur un compte OAuth : on rafraîchit
    // pour que le libellé passe de « définir » à « changer ».
    supabase.auth.getUser().then(({ data }) => {
      setProviders((data.user?.identities ?? []).map(i => i.provider))
    })
  }

  async function handleSendReset() {
    setResetLoading(true)
    setError(null)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${prefix}/nouveau-mot-de-passe`,
    })
    setResetLoading(false)
    if (resetError) { setError(authErrorKey(resetError)); return }
    setResetSent(true)
  }

  return (
    <>
      <Head><title>{t.myAccount.metaTitle}</title></Head>
      <HeaderTiroirWeb />

      <main className="section">
        <div className="container" style={{ maxWidth: 640 }}>
          <h1 className="h2" style={{ marginBottom: 8 }}>{t.myAccount.title}</h1>
          <p className="p" style={{ marginBottom: 32 }}>
            {t.myAccount.signedInAs}<strong>{email || '…'}</strong>
            {oauthOnly && t.myAccount.noPassword}
          </p>

          {subscription && <SubscriptionCard sub={subscription} />}

          {/* ── Moyens de connexion ── */}
          <div className="card" style={s.card}>
            <h2 style={s.cardTitle}>{t.myAccount.methodsTitle}</h2>
            <p style={s.cardText}>{t.myAccount.methodsText}</p>
            <ul style={s.rows}>
              {providerRows(identities).map(row => (
                <li key={row.provider} style={s.row}>
                  <span style={{ flex: 1 }}>
                    <strong style={{ color: '#121212' }}>{providerLabel[row.provider]}</strong>
                    <span style={s.rowState}>
                      {row.linked
                        ? (row.email && row.email !== email ? fill(t.myAccount.linkedAs, { email: row.email }) : t.myAccount.linked)
                        : t.myAccount.notLinked}
                    </span>
                  </span>
                  {row.action === 'link' && (
                    <button type="button" style={s.btnSmall} disabled={linkBusy !== null} onClick={() => handleLink(row.provider)}>
                      {linkBusy === row.provider ? '…' : t.myAccount.link}
                    </button>
                  )}
                  {row.action === 'unlink' && (
                    <button type="button" style={s.btnSmallGhost} disabled={linkBusy !== null} onClick={() => handleUnlink(row.provider)}>
                      {linkBusy === row.provider ? '…' : t.myAccount.unlink}
                    </button>
                  )}
                  {row.action === 'set-password' && (
                    <a href="#mot-de-passe" style={s.link}>{t.myAccount.setPassword}</a>
                  )}
                  {row.action === 'app-only' && (
                    <span style={s.rowHint}>{t.myAccount.appOnly}</span>
                  )}
                </li>
              ))}
            </ul>
            {linkError && <p style={s.error}>{t.errors[linkError]}</p>}
            {linkDone && <p style={s.success}>✓ {t.myAccount[linkDone]}</p>}
          </div>

          {/* ── Mot de passe ── */}
          {/* ── Crédits IA et équipe Business (pages /credits et /equipe) ── */}
          <div className="card" style={s.card}>
            <h2 style={s.cardTitle}>{t.myAccount.billingTitle}</h2>
            <p style={s.cardText}>{t.myAccount.billingText}</p>
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              <a href={`${prefix}/credits`} style={s.link}>{t.myAccount.creditsLink}</a>
              <a href={`${prefix}/equipe`} style={s.link}>{t.myAccount.teamLink}</a>
            </div>
          </div>

          <div id="mot-de-passe" className="card" style={s.card}>
            <h2 style={s.cardTitle}>
              {oauthOnly ? t.myAccount.setPasswordTitle : t.myAccount.changePasswordTitle}
            </h2>
            <p style={s.cardText}>
              {oauthOnly ? t.myAccount.setPasswordText : t.myAccount.changePasswordText}
            </p>

            <form onSubmit={handleChangePassword} style={s.form}>
              <label style={s.label}>{t.myAccount.newPassword}</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                style={s.input}
                placeholder={fill(t.myAccount.passwordPlaceholder, { min: MIN_PASSWORD_LENGTH })}
              />
              <label style={s.label}>{t.myAccount.confirm}</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                autoComplete="new-password"
                style={s.input}
                placeholder="••••••••"
              />
              {error && <p style={s.error}>{fill(t.errors[error], { min: MIN_PASSWORD_LENGTH })}</p>}
              {passwordDone && <p style={s.success}>✓ {t.myAccount.passwordSaved}</p>}
              <button type="submit" disabled={saving} style={s.btn}>
                {saving ? t.myAccount.saving : t.myAccount.save}
              </button>
            </form>
          </div>

          {/* ── Reset par e-mail ── */}
          <div className="card" style={s.card}>
            <h2 style={s.cardTitle}>{t.myAccount.resetTitle}</h2>
            <p style={s.cardText}>
              {t.myAccount.resetBefore}<strong>{email || '…'}</strong>{t.myAccount.resetAfter}
            </p>
            {resetSent ? (
              <p style={s.success}>✓ {t.myAccount.resetSent}</p>
            ) : (
              <button
                type="button"
                onClick={handleSendReset}
                disabled={resetLoading || !email}
                style={s.btnSecondary}
              >
                {resetLoading ? t.myAccount.sending : t.myAccount.sendLink}
              </button>
            )}
          </div>

          <p style={s.footnote}>
            {t.myAccount.footnoteBefore}<a href={`${prefix}/profil`} style={s.link}>{t.myAccount.footnoteLink}</a>{t.myAccount.footnoteAfter}
          </p>
        </div>
      </main>

      <FooterTiroirWeb />
    </>
  )
}

// Page réservée aux comptes connectés.
export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const supabaseServer = serverSupabase(ctx)
  // getUser() et non getSession() : getSession() lit le cookie sans vérifier
  // sa signature ; un cookie fabriqué passerait. getUser() fait valider le
  // jeton par Supabase avant toute lecture avec la clé service.
  const { data: { user: verifiedUser } } = await supabaseServer.auth.getUser()
  const session = verifiedUser ? { user: verifiedUser } : null
  if (!session) {
    // Destination absolue : Next n'y ajoute pas la langue, on la garde.
    return { redirect: { destination: `${localePrefix(asLocale(ctx.locale))}/login`, permanent: false } }
  }
  return { props: { subscription: await readSubscription(session.user.id) } }
}

async function readSubscription(userId: string): Promise<Subscription | null> {
  const db = adminSupabase()
  const { data, error } = await db.from('profiles')
    .select('plan, pro_expires_at, pro_invoice_ref, plan_source, subscription_status, subscription_period_end, subscription_cancel_at_period_end, stripe_customer_id, stripe_livemode')
    .eq('id', userId).maybeSingle()
  // Base pas encore migrée (stripe_subscriptions.sql) : carte masquée.
  if (error || !data) return null
  const expired = data.plan === 'pro' && data.pro_expires_at && data.pro_expires_at < new Date().toISOString().slice(0, 10)
  const plan = (expired ? 'free' : data.plan) as Subscription['plan']
  return {
    plan,
    source: plan === 'free' ? null : data.plan_source === 'web' ? 'web' : data.pro_invoice_ref ? 'invoice' : 'app',
    status: data.subscription_status,
    periodEnd: data.subscription_period_end,
    cancelAtPeriodEnd: !!data.subscription_cancel_at_period_end,
    canManage: !!data.stripe_customer_id,
    invoices: await readInvoices(data.stripe_customer_id, data.stripe_livemode),
  }
}

/** Factures du client Stripe (lues côté serveur ; rien si Stripe n'est pas configuré). */
async function readInvoices(customerId: string | null, livemode: boolean | null): Promise<InvoiceLine[]> {
  const env = stripeEnv()
  if (!env || !customerId || livemode !== (env.mode === 'live')) return []
  try {
    const list = await stripeClient(env)<{ data: Record<string, unknown>[] }>('GET', '/v1/invoices', { customer: customerId, limit: 24 })
    return list.data
      .filter(i => i.status === 'paid' || i.status === 'open')
      .map(i => ({
        id: String(i.id),
        number: typeof i.number === 'string' ? i.number : null,
        date: new Date(Number(i.created) * 1000).toISOString(),
        total: Number(i.total) / 100,
        currency: String(i.currency ?? 'eur'),
        paid: i.status === 'paid',
        url: typeof i.hosted_invoice_url === 'string' ? i.hosted_invoice_url : null,
        pdf: typeof i.invoice_pdf === 'string' ? i.invoice_pdf : null,
      }))
  } catch (e) {
    console.warn('[mon-compte] factures', (e as Error).message)
    return []
  }
}

function SubscriptionCard({ sub }: { sub: Subscription }) {
  const { t: { subscribe: t }, locale } = useBillingCopy()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(intlLocale(locale), { day: 'numeric', month: 'long', year: 'numeric' }) : '—')
  const tier = sub.plan === 'free' ? '' : tierName(sub.plan)

  async function manage() {
    setBusy(true); setError(false)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locale }) })
      const json = await res.json().catch(() => ({}))
      if (res.ok && json.url) { window.location.href = json.url; return }
    } catch { /* message ci-dessous */ }
    setError(true); setBusy(false)
  }

  return (
    <div className="card" style={s.card}>
      <h2 style={s.cardTitle}>{t.accountTitle}</h2>
      {sub.plan === 'free' && (
        <p style={s.cardText}>{t.planFree} <a href={`${localePrefix(locale)}/pricing#formules`} style={s.link}>{t.seeOffers} →</a></p>
      )}
      {sub.source === 'app' && <p style={s.cardText}>{fill(t.fromApp, { tier })}</p>}
      {sub.source === 'invoice' && <p style={s.cardText}>{fill(t.fromInvoice, { tier })}</p>}
      {sub.source === 'web' && (
        <>
          <p style={{ ...s.cardText, marginBottom: 4 }}><strong style={{ color: '#121212' }}>{fill(t.planActive, { tier })}</strong></p>
          {sub.status === 'past_due'
            ? <p style={s.error}>{t.pastDue}</p>
            : <p style={s.cardText}>{fill(sub.cancelAtPeriodEnd ? t.endsOn : t.renewsOn, { date: date(sub.periodEnd) })}</p>}
        </>
      )}
      {sub.canManage && (sub.source === 'web' || sub.plan === 'free') && (
        <button type="button" disabled={busy} onClick={manage} style={s.btnSecondary}>{t.manage}</button>
      )}
      {error && <p role="alert" style={s.error}>{t.portalError}</p>}
      {sub.invoices.length > 0 && (
        <>
          <h3 style={{ ...s.cardTitle, fontSize: 15, marginTop: 20 }}>{t.invoicesTitle}</h3>
          <ul style={s.rows}>
            {sub.invoices.map(i => (
              <li key={i.id} style={s.row}>
                <span style={{ flex: 1 }}>
                  <strong style={{ color: '#121212' }}>{i.number ?? '—'}</strong>
                  <span style={s.rowState}> · {date(i.date)} · {i.paid ? t.invoicePaid : t.invoiceOpen}</span>
                </span>
                <span style={{ fontWeight: 700 }}>{formatEur(i.total, locale)}</span>
                {i.url && <a href={i.url} target="_blank" rel="noreferrer" style={s.link}>↗</a>}
                {i.pdf && <a href={i.pdf} target="_blank" rel="noreferrer" style={s.link}>{t.invoicePdf}</a>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  card:         { padding: 24, marginBottom: 20 },
  cardTitle:    { fontSize: 17, fontWeight: 700, color: '#121212', marginBottom: 8 },
  cardText:     { fontSize: 14, color: '#5b5b5b', lineHeight: 1.6, marginBottom: 16 },
  form:         { display: 'flex', flexDirection: 'column', gap: 8 },
  label:        { fontSize: 13, fontWeight: 600, color: '#555', marginTop: 8 },
  input:        { padding: '10px 14px', borderRadius: 10, border: '1px solid #e0e0e0', fontSize: 15, outline: 'none' },
  error:        { fontSize: 13, color: '#c0392b', background: '#fdf0ef', borderRadius: 8, padding: '8px 12px', marginTop: 4 },
  success:      { fontSize: 13, color: '#2e7d32', fontWeight: 600, marginTop: 4 },
  btn:          { marginTop: 12, padding: '13px 0', borderRadius: 12, background: '#F26900', color: 'white', fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer', textAlign: 'center' },
  btnSecondary: { padding: '12px 20px', borderRadius: 12, background: 'white', color: '#121212', fontWeight: 700, fontSize: 15, border: '1.5px solid rgba(0,0,0,0.15)', cursor: 'pointer' },
  footnote:     { fontSize: 13, color: '#999', marginTop: 8 },
  link:         { color: '#F26900', fontWeight: 600, textDecoration: 'none' },
  rows:         { listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 },
  row:          { display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, padding: '10px 0', borderTop: '1px solid rgba(0,0,0,0.06)' },
  rowState:     { color: '#5b5b5b' },
  rowHint:      { fontSize: 12, color: '#999' },
  btnSmall:     { padding: '8px 14px', borderRadius: 10, background: '#F26900', color: 'white', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer' },
  btnSmallGhost:{ padding: '8px 14px', borderRadius: 10, background: 'white', color: '#121212', fontWeight: 700, fontSize: 13, border: '1.5px solid rgba(0,0,0,0.15)', cursor: 'pointer' },
}
