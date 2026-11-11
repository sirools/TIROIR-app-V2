import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

import { APPLE_WEB_ENABLED as APPLE_LOGIN_ENABLED } from '../lib/identities'
import { authHref, safeNext } from '../lib/authFlow'
import { authErrorFromUrl, authErrorKey, suggestsSignup, type AccountErrorKey, type AuthErrorKey } from '../lib/authErrors'
import { localePrefix } from '../lib/localeRouting'
import { useCopy } from '../locales'
import { useBillingCopy } from '../locales/billing'
import OfferRecap from '../components/billing/OfferRecap'
import { offerFromNext } from '../lib/subscribeFlow'

export default function Login() {
  const router = useRouter()
  const { t: { account: t }, locale } = useCopy()
  // Préfixe de langue des liens <a> et des retours Supabase (« » en français).
  const prefix = localePrefix(locale)
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState<AccountErrorKey | null>(null)
  const [hint, setHint]         = useState<AuthErrorKey | null>(null)
  const [loading, setLoading]   = useState(false)
  const next = typeof router.query.next === 'string' ? safeNext(router.query.next) : null
  // Venu du tunnel d'abonnement : l'offre choisie reste affichée à côté.
  const offer = offerFromNext(next)
  const { t: { subscribe: ts } } = useBillingCopy()

  // Le propriétaire de Torix choisit où aller ; les autres vont dans Tiroir.
  const [choice, setChoice]     = useState(false)
  const routed = useRef(false)

  async function afterLogin() {
    if (routed.current) return
    routed.current = true
    if (next) {
      router.replace(next)
      return
    }
    const r = await fetch('/api/torix/access').catch(() => null)
    if (r?.ok) setChoice(true)
    else router.replace('/')
  }

  // Déjà connecté (retour d'un e-mail de confirmation, de Google, autre
  // onglet) ou connexion qui aboutit : on route une seule fois.
  useEffect(() => {
    if (!router.isReady) return
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) void afterLogin()
    })
    return () => data.subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady])

  // Affiche les erreurs renvoyées par un retour OAuth raté (?error_description=…)
  useEffect(() => {
    const desc = router.query.error_description
    if (typeof desc === 'string' && desc) {
      setError(authErrorFromUrl(k => {
        const v = router.query[k]
        return typeof v === 'string' ? v : null
      }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.query.error_description])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setHint(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setHint(authErrorKey(error))
      setLoading(false)
      return
    }
    await afterLogin()
  }

  async function handleOAuth(provider: 'google' | 'apple') {
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      // Sans destination, retour ici : le propriétaire y choisit Tiroir ou Torix.
      options: { redirectTo: `${window.location.origin}${prefix}${next ?? '/login'}` },
    })
    if (error) setError(authErrorKey(error))
  }

  return (
    <main style={s.root}>
      <div style={s.card}>
        <div style={s.logo}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/app-icon.png" alt="" width={36} height={36} style={{ borderRadius: 10 }} />
          <strong style={s.logoText}>Tiroir</strong>
        </div>
        {choice ? (
          <>
            <h1 style={s.title}>{t.login.choiceTitle}</h1>
            <div style={s.choice}>
              <a href={prefix || '/'} style={s.choiceTiroir}>Tiroir</a>
              <a href="/admin/torix-lab" style={s.choiceTorix}>Torix</a>
            </div>
          </>
        ) : (
        <>
        <h1 style={s.title}>{t.login.title}</h1>

        <button type="button" style={s.googleBtn} onClick={() => handleOAuth('google')}>
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          {t.common.continueGoogle}
        </button>

        {APPLE_LOGIN_ENABLED && (
          <button type="button" style={s.appleBtn} onClick={() => handleOAuth('apple')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17.05 20.28c-.98.95-2.05.86-3.08.38-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.38C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
            </svg>
            {t.common.continueApple}
          </button>
        )}

        <div style={s.dividerRow}>
          <div style={s.dividerLine} />
          <span style={s.dividerText}>{t.common.or}</span>
          <div style={s.dividerLine} />
        </div>

        <form onSubmit={handleSubmit} style={s.form}>
          <label style={s.label}>{t.common.email}</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={s.input}
            placeholder={t.common.emailPlaceholder}
          />

          <div style={s.labelRow}>
            <label style={s.label}>{t.common.password}</label>
            <a href={`${prefix}/mot-de-passe-oublie`} style={s.forgotLink}>{t.login.forgot}</a>
          </div>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={s.input}
            placeholder="••••••••"
          />

          {error && <p style={s.error}>{t.errors[error]}</p>}
          {hint && (
            <div style={s.error} role="alert">
              <p style={{ margin: 0 }}>{t.errors[hint]}</p>
              {suggestsSignup(hint) && (
                <a href={prefix + authHref('/inscription', next)} style={s.hintLink}>{t.login.createMyAccount}</a>
              )}
            </div>
          )}

          <button type="submit" disabled={loading} style={s.btn}>
            {loading ? t.login.submitting : t.login.submit}
          </button>
        </form>

        <p style={s.switch}>
          {t.login.noAccount}{' '}
          <a href={prefix + authHref('/inscription', next)} style={s.switchLink}>{t.login.createAccount}</a>
        </p>

        <p style={s.cgu}>
          {t.common.termsBefore}{' '}
          <a href={`${prefix}/cgu`} style={s.cguLink}>{t.common.termsLink}</a>{t.common.termsAfter}
        </p>
        </>
        )}
      </div>
    {offer && <OfferRecap plan={offer.plan} changeHref={`${prefix}/pricing#formules`} />}
    </main>
  )
}

const s: Record<string, React.CSSProperties> = {
  root:        { minHeight: '100vh', display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'center', justifyContent: 'center', background: '#FFF4E6', padding: 24 },
  card:        { width: '100%', maxWidth: 400, background: 'white', borderRadius: 20, padding: '40px 32px', boxShadow: '0 6px 24px rgba(0,0,0,0.08)' },
  logo:        { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 },
  logoText:    { fontSize: 20, fontWeight: 800, color: '#121212' },
  title:       { fontSize: 20, fontWeight: 700, color: '#121212', marginBottom: 24 },
  googleBtn:   { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '12px 0', borderRadius: 12, background: 'white', color: '#121212', fontWeight: 600, fontSize: 15, border: '1px solid rgba(0,0,0,0.15)', cursor: 'pointer' },
  appleBtn:    { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '12px 0', borderRadius: 12, background: '#000', color: 'white', fontWeight: 600, fontSize: 15, border: 'none', cursor: 'pointer', marginTop: 10 },
  dividerRow:  { display: 'flex', alignItems: 'center', gap: 10, margin: '20px 0' },
  dividerLine: { flex: 1, height: 1, background: 'rgba(0,0,0,0.1)' },
  dividerText: { fontSize: 13, color: '#999' },
  form:        { display: 'flex', flexDirection: 'column', gap: 8 },
  label:       { fontSize: 13, fontWeight: 600, color: '#555', marginTop: 8 },
  labelRow:    { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
  forgotLink:  { fontSize: 13, color: '#F26900', fontWeight: 600, textDecoration: 'none', marginTop: 8 },
  input:       { padding: '10px 14px', borderRadius: 10, border: '1px solid #e0e0e0', fontSize: 15, outline: 'none', transition: 'border-color 0.15s' },
  error:       { fontSize: 13, color: '#c0392b', background: '#fdf0ef', borderRadius: 8, padding: '8px 12px', marginTop: 4 },
  choice:      { display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 },
  choiceTiroir:{ display: 'block', padding: '14px 0', borderRadius: 12, background: '#F26900', color: '#fff', fontWeight: 700, fontSize: 16, textAlign: 'center', textDecoration: 'none' },
  // Même bouton noir et blanc que dans le back-office.
  choiceTorix: { display: 'block', padding: '14px 0', borderRadius: 12, background: '#121212', color: '#fff', fontWeight: 700, fontSize: 16, textAlign: 'center', textDecoration: 'none' },
  hintLink:    { display: 'inline-block', marginTop: 6, color: '#F26900', fontWeight: 700, textDecoration: 'none' },
  btn:         { marginTop: 12, padding: '13px 0', borderRadius: 12, background: '#F26900', color: 'white', fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer', textAlign: 'center' },
  switch:      { fontSize: 14, color: '#5b5b5b', marginTop: 20, textAlign: 'center' },
  switchLink:  { color: '#F26900', fontWeight: 600, textDecoration: 'none' },
  cgu:         { fontSize: 12, color: '#999', marginTop: 14, textAlign: 'center', lineHeight: 1.5 },
  cguLink:     { color: '#F26900' },
}
