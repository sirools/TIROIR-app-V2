// Écran d'arrivée du lien de réinitialisation envoyé depuis le site.
//
// Le client navigateur (auth-helpers) détecte seul la session posée par le
// lien — soit un fragment #access_token en flux implicite, soit un ?code= en
// PKCE. On attend donc simplement qu'une session apparaisse, avec un repli
// explicite sur exchangeCodeForSession si le code est encore dans l'URL.
import Head from 'next/head'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'

const MIN_PASSWORD_LENGTH = 8

type Phase = 'opening' | 'ready' | 'invalid' | 'done'

export default function NouveauMotDePasse() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('opening')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    // Erreur renvoyée par Supabase (lien expiré, déjà utilisé…)
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const urlError = hash.get('error_description')
      ?? (typeof router.query.error_description === 'string' ? router.query.error_description : null)
    if (urlError) {
      setError(urlError)
      setPhase('invalid')
      return
    }

    async function resolveSession() {
      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      if (data.session) { setPhase('ready'); return }

      const code = typeof router.query.code === 'string' ? router.query.code : null
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (cancelled) return
        if (exchangeError) { setError(exchangeError.message); setPhase('invalid'); return }
        setPhase('ready')
        return
      }

      setPhase('invalid')
    }

    // Le client peut poser la session juste après le montage : on écoute aussi.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled && session) setPhase('ready')
    })

    resolveSession()
    return () => { cancelled = true; subscription.unsubscribe() }
  }, [router.query.code, router.query.error_description])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.`)
      return
    }
    if (password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.')
      return
    }

    setLoading(true)
    setError(null)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) { setError(updateError.message); return }
    setPhase('done')
  }

  return (
    <>
      <Head><title>Nouveau mot de passe — Tiroir</title></Head>
      <main style={s.root}>
        <div style={s.card}>
          <div style={s.logo}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/app-icon-v2.png" alt="" width={36} height={36} style={{ borderRadius: 10 }} />
            <strong style={s.logoText}>Tiroir</strong>
          </div>

          {phase === 'opening' && (
            <>
              <h1 style={s.title}>Nouveau mot de passe</h1>
              <p style={s.text}>Ouverture du lien…</p>
            </>
          )}

          {phase === 'invalid' && (
            <>
              <h1 style={s.title}>Lien invalide</h1>
              <p style={s.text}>
                Ce lien n&apos;est plus valable. Les liens de réinitialisation expirent au bout
                d&apos;une heure et ne servent qu&apos;une fois.
              </p>
              {error && <p style={s.error}>{error}</p>}
              <a href="/mot-de-passe-oublie" style={s.btnLink}>Demander un nouveau lien</a>
            </>
          )}

          {phase === 'ready' && (
            <>
              <h1 style={s.title}>Nouveau mot de passe</h1>
              <p style={s.text}>Choisis un mot de passe pour ton compte Tiroir.</p>
              <form onSubmit={handleSubmit} style={s.form}>
                <label style={s.label}>Nouveau mot de passe</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoFocus
                  autoComplete="new-password"
                  style={s.input}
                  placeholder="8 caractères minimum"
                />
                <label style={s.label}>Confirmer</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                  style={s.input}
                  placeholder="••••••••"
                />
                {error && <p style={s.error}>{error}</p>}
                <button type="submit" disabled={loading} style={s.btn}>
                  {loading ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </form>
            </>
          )}

          {phase === 'done' && (
            <>
              <h1 style={s.title}>Mot de passe enregistré</h1>
              <p style={s.text}>
                Tu es connecté. Ce mot de passe fonctionne aussi dans l&apos;application mobile.
              </p>
              <button type="button" style={s.btn} onClick={() => router.push('/')}>
                Continuer
              </button>
            </>
          )}
        </div>
      </main>
    </>
  )
}

const s: Record<string, React.CSSProperties> = {
  root:     { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFF4E6', padding: 24 },
  card:     { width: '100%', maxWidth: 400, background: 'white', borderRadius: 20, padding: '40px 32px', boxShadow: '0 6px 24px rgba(0,0,0,0.08)' },
  logo:     { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 },
  logoText: { fontSize: 20, fontWeight: 800, color: '#121212' },
  title:    { fontSize: 20, fontWeight: 700, color: '#121212', marginBottom: 12 },
  text:     { fontSize: 14, color: '#5b5b5b', lineHeight: 1.6, marginBottom: 16 },
  form:     { display: 'flex', flexDirection: 'column', gap: 8 },
  label:    { fontSize: 13, fontWeight: 600, color: '#555', marginTop: 8 },
  input:    { padding: '10px 14px', borderRadius: 10, border: '1px solid #e0e0e0', fontSize: 15, outline: 'none' },
  error:    { fontSize: 13, color: '#c0392b', background: '#fdf0ef', borderRadius: 8, padding: '8px 12px', marginTop: 4 },
  btn:      { width: '100%', marginTop: 12, padding: '13px 0', borderRadius: 12, background: '#F26900', color: 'white', fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer', textAlign: 'center' },
  btnLink:  { display: 'block', marginTop: 12, padding: '13px 0', borderRadius: 12, background: '#F26900', color: 'white', fontWeight: 700, fontSize: 15, textAlign: 'center', textDecoration: 'none' },
}
