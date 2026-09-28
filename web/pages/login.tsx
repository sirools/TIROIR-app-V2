import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

// Passer à true une fois le Services ID + secret Apple configurés dans Supabase
const APPLE_LOGIN_ENABLED = false

/** Page de retour après connexion (?next=/s/abc) : chemin interne seulement. */
function safeNext(raw: unknown): string {
  return typeof raw === 'string' && /^\/(?![/\\])/.test(raw) ? raw : '/'
}

export default function Login() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)

  // Affiche les erreurs renvoyées par un retour OAuth raté (?error_description=…)
  useEffect(() => {
    const desc = router.query.error_description
    if (typeof desc === 'string' && desc) setError(desc)
  }, [router.query.error_description])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    router.push(safeNext(router.query.next))
  }

  async function handleOAuth(provider: 'google' | 'apple') {
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}${safeNext(router.query.next)}` },
    })
    if (error) setError(error.message)
  }

  return (
    <main style={s.root}>
      <div style={s.card}>
        <div style={s.logo}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/app-icon.png" alt="" width={36} height={36} style={{ borderRadius: 10 }} />
          <strong style={s.logoText}>Tiroir</strong>
        </div>
        <h1 style={s.title}>Connexion</h1>

        <button type="button" style={s.googleBtn} onClick={() => handleOAuth('google')}>
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
          </svg>
          Continuer avec Google
        </button>

        {APPLE_LOGIN_ENABLED && (
          <button type="button" style={s.appleBtn} onClick={() => handleOAuth('apple')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17.05 20.28c-.98.95-2.05.86-3.08.38-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.38C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.53 4.08zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
            </svg>
            Continuer avec Apple
          </button>
        )}

        <div style={s.dividerRow}>
          <div style={s.dividerLine} />
          <span style={s.dividerText}>ou</span>
          <div style={s.dividerLine} />
        </div>

        <form onSubmit={handleSubmit} style={s.form}>
          <label style={s.label}>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            style={s.input}
            placeholder="exemple@gmail.com"
          />

          <div style={s.labelRow}>
            <label style={s.label}>Mot de passe</label>
            <a href="/mot-de-passe-oublie" style={s.forgotLink}>Mot de passe oublié ?</a>
          </div>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            style={s.input}
            placeholder="••••••••"
          />

          {error && <p style={s.error}>{error}</p>}

          <button type="submit" disabled={loading} style={s.btn}>
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        <p style={s.switch}>
          Pas encore de compte ?{' '}
          <a href="/inscription" style={s.switchLink}>Créer un compte</a>
        </p>

        <p style={s.cgu}>
          En continuant, tu acceptes les{' '}
          <a href="/cgu" style={s.cguLink}>Conditions Générales d&apos;Utilisation</a>.
        </p>
      </div>
    </main>
  )
}

const s: Record<string, React.CSSProperties> = {
  root:        { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFF4E6', padding: 24 },
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
  btn:         { marginTop: 12, padding: '13px 0', borderRadius: 12, background: '#F26900', color: 'white', fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer', textAlign: 'center' },
  switch:      { fontSize: 14, color: '#5b5b5b', marginTop: 20, textAlign: 'center' },
  switchLink:  { color: '#F26900', fontWeight: 600, textDecoration: 'none' },
  cgu:         { fontSize: 12, color: '#999', marginTop: 14, textAlign: 'center', lineHeight: 1.5 },
  cguLink:     { color: '#F26900' },
}
