import Head from 'next/head'
import { useEffect, useState } from 'react'
import { APP_STORE_URL_FR, PLAY_STORE_URL } from '../lib/appLinks'
import { authHref, safeNext } from '../lib/authFlow'

export default function EmailConfirme() {
  const [errorCode, setErrorCode] = useState<string | null>(null)
  // Venu d'un partage (?next=/s/…) : le bouton principal y ramène.
  const [next, setNext] = useState<string | null>(null)

  useEffect(() => {
    // Supabase renvoie les erreurs (lien expiré, déjà utilisé…) dans le hash ou la query
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''))
    const queryParams = new URLSearchParams(window.location.search)
    const code =
      hashParams.get('error_code') ??
      queryParams.get('error_code') ??
      hashParams.get('error') ??
      queryParams.get('error')
    if (code) setErrorCode(code)
    const rawNext = queryParams.get('next')
    if (rawNext && safeNext(rawNext) !== '/') setNext(safeNext(rawNext))

    // Le lien de vérification peut aussi transporter des tokens de session : on nettoie l'URL
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
  }, [])

  const isError = errorCode !== null
  const isExpired = errorCode === 'otp_expired'

  return (
    <>
      <Head>
        <title>{isError ? 'Lien invalide — Tiroir' : 'Email confirmé — Tiroir'}</title>
        <meta name="robots" content="noindex" />
      </Head>

      <main style={s.root}>
        <div style={s.card}>
          <div style={s.logo}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/app-icon.png" alt="" width={36} height={36} style={{ borderRadius: 10 }} />
            <strong style={s.logoText}>Tiroir</strong>
          </div>

          {isError ? (
            <>
              <h1 style={s.title}>Ce lien n&apos;est plus valide</h1>
              <p style={s.text}>
                {isExpired
                  ? 'Le lien de confirmation a expiré.'
                  : 'Le lien de confirmation a peut-être expiré ou déjà été utilisé.'}
                {' '}Réessaie de te connecter dans l&apos;app : si ton adresse n&apos;est pas encore
                confirmée, un nouveau lien pourra t&apos;être envoyé.
              </p>
            </>
          ) : (
            <>
              <h1 style={s.title}>Adresse email confirmée 🎉</h1>
              <p style={s.text}>
                Ton compte Tiroir est activé. Retourne dans l&apos;app et connecte-toi pour
                commencer à cataloguer tes objets.
              </p>
            </>
          )}

          {next && !isError && (
            // Passe par la connexion : elle file directement au partage si la
            // session est déjà ouverte, sinon demande le mot de passe choisi.
            <a href={authHref('/login', next)} style={s.btnPrimary}>
              Revenir au partage et suggérer
            </a>
          )}
          <a href="tiroir://" style={next && !isError ? s.btnSecondary : s.btnPrimary}>
            Ouvrir l&apos;app Tiroir
          </a>
          <a href={APP_STORE_URL_FR} target="_blank" rel="noopener noreferrer" style={s.btnSecondary}>
            Télécharger sur l&apos;App Store
          </a>
          <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" style={s.btnSecondary}>
            Télécharger sur Google Play
          </a>

          <a href="/" style={s.homeLink}>
            ← Retour au site
          </a>
        </div>
      </main>
    </>
  )
}

const s: Record<string, React.CSSProperties> = {
  root:         { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFF4E6', padding: 24, fontFamily: "'Inter', system-ui, sans-serif" },
  card:         { width: '100%', maxWidth: 440, background: 'white', borderRadius: 20, padding: '40px 32px', boxShadow: '0 6px 24px rgba(0,0,0,0.08)', textAlign: 'center' },
  logo:         { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 28 },
  logoText:     { fontSize: 20, fontWeight: 800, color: '#121212' },
  title:        { fontSize: 22, fontWeight: 800, color: '#121212', marginBottom: 12 },
  text:         { fontSize: 15, color: '#5b5b5b', lineHeight: 1.6, marginBottom: 28 },
  btnPrimary:   { display: 'block', padding: '13px 0', borderRadius: 12, background: '#F26900', color: 'white', fontWeight: 700, fontSize: 15, textDecoration: 'none', marginBottom: 10 },
  btnSecondary: { display: 'block', padding: '13px 0', borderRadius: 12, background: 'white', color: '#121212', fontWeight: 700, fontSize: 15, textDecoration: 'none', border: '1px solid rgba(0,0,0,0.12)', marginBottom: 10 },
  homeLink:     { display: 'inline-block', marginTop: 24, fontSize: 13, color: '#5b5b5b', textDecoration: 'none' },
}
