// Demande d'un lien de réinitialisation depuis le site.
// Le lien renvoie vers /nouveau-mot-de-passe, qui pose le nouveau mot de passe.
import Head from 'next/head'
import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function MotDePasseOublie() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/nouveau-mot-de-passe`,
    })
    setLoading(false)

    // Seul le rate limit est affiché : signaler qu'une adresse est inconnue
    // permettrait d'énumérer les comptes. Sinon on confirme dans tous les cas.
    if (error && /rate limit|too many/i.test(error.message)) {
      setError(error.message)
      return
    }
    setSent(true)
  }

  return (
    <>
      <Head><title>Mot de passe oublié — Tiroir</title></Head>
      <main style={s.root}>
        <div style={s.card}>
          <div style={s.logo}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/app-icon-v2.png" alt="" width={36} height={36} style={{ borderRadius: 10 }} />
            <strong style={s.logoText}>Tiroir</strong>
          </div>

          {sent ? (
            <>
              <h1 style={s.title}>E-mail envoyé</h1>
              <p style={s.text}>
                Si un compte existe pour <strong>{email.trim()}</strong>, un lien de réinitialisation
                vient d&apos;y être envoyé. Il est valable une heure et ne sert qu&apos;une fois.
              </p>
              <p style={s.hint}>
                Rien reçu ? Vérifie les indésirables. Si tu t&apos;es inscrit avec Google, ton compte
                n&apos;a pas de mot de passe — utilise le bouton « Continuer avec Google » sur la page
                de connexion.
              </p>
              <a href="/login" style={s.btnLink}>Retour à la connexion</a>
            </>
          ) : (
            <>
              <h1 style={s.title}>Mot de passe oublié</h1>
              <p style={s.text}>
                Indique ton adresse e-mail : on t&apos;envoie un lien pour choisir un nouveau mot de passe.
              </p>
              <form onSubmit={handleSubmit} style={s.form}>
                <label style={s.label}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                  style={s.input}
                  placeholder="exemple@gmail.com"
                />
                {error && <p style={s.error}>{error}</p>}
                <button type="submit" disabled={loading} style={s.btn}>
                  {loading ? 'Envoi…' : 'Envoyer le lien'}
                </button>
              </form>
              <p style={s.switch}>
                <a href="/login" style={s.switchLink}>Retour à la connexion</a>
              </p>
            </>
          )}
        </div>
      </main>
    </>
  )
}

const s: Record<string, React.CSSProperties> = {
  root:       { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFF4E6', padding: 24 },
  card:       { width: '100%', maxWidth: 400, background: 'white', borderRadius: 20, padding: '40px 32px', boxShadow: '0 6px 24px rgba(0,0,0,0.08)' },
  logo:       { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 },
  logoText:   { fontSize: 20, fontWeight: 800, color: '#121212' },
  title:      { fontSize: 20, fontWeight: 700, color: '#121212', marginBottom: 12 },
  text:       { fontSize: 14, color: '#5b5b5b', lineHeight: 1.6, marginBottom: 16 },
  hint:       { fontSize: 13, color: '#999', lineHeight: 1.6, marginBottom: 20 },
  form:       { display: 'flex', flexDirection: 'column', gap: 8 },
  label:      { fontSize: 13, fontWeight: 600, color: '#555', marginTop: 8 },
  input:      { padding: '10px 14px', borderRadius: 10, border: '1px solid #e0e0e0', fontSize: 15, outline: 'none' },
  error:      { fontSize: 13, color: '#c0392b', background: '#fdf0ef', borderRadius: 8, padding: '8px 12px', marginTop: 4 },
  btn:        { marginTop: 12, padding: '13px 0', borderRadius: 12, background: '#F26900', color: 'white', fontWeight: 700, fontSize: 15, border: 'none', cursor: 'pointer', textAlign: 'center' },
  btnLink:    { display: 'block', marginTop: 12, padding: '13px 0', borderRadius: 12, background: '#F26900', color: 'white', fontWeight: 700, fontSize: 15, textAlign: 'center', textDecoration: 'none' },
  switch:     { fontSize: 14, color: '#5b5b5b', marginTop: 20, textAlign: 'center' },
  switchLink: { color: '#F26900', fontWeight: 600, textDecoration: 'none' },
}
