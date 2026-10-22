import Head from 'next/head'
import { useEffect, useState } from 'react'
import { appStoreUrlFor, playStoreUrlFor } from '../lib/appLinks'
import { authHref, safeNext } from '../lib/authFlow'
import { localePrefix } from '../lib/localeRouting'
import { useCopy } from '../locales'

export default function EmailConfirme() {
  const { t: { account: t }, locale } = useCopy()
  // Préfixe de langue des liens <a> (« » en français).
  const prefix = localePrefix(locale)
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
        <title>{isError ? t.confirm.metaTitleError : t.confirm.metaTitle}</title>
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
              <h1 style={s.title}>{t.confirm.errorTitle}</h1>
              <p style={s.text}>
                {isExpired ? t.confirm.expired : t.confirm.maybeExpired}
                {' '}{t.confirm.retry}
              </p>
            </>
          ) : (
            <>
              <h1 style={s.title}>{t.confirm.title}</h1>
              <p style={s.text}>{t.confirm.text}</p>
            </>
          )}

          {next && !isError && (
            // Passe par la connexion : elle file directement au partage si la
            // session est déjà ouverte, sinon demande le mot de passe choisi.
            <a href={prefix + authHref('/login', next)} style={s.btnPrimary}>
              {t.confirm.backToShare}
            </a>
          )}
          <a href="tiroir://" style={next && !isError ? s.btnSecondary : s.btnPrimary}>
            {t.confirm.openApp}
          </a>
          {/* Fiche du store du pays de la langue du site. */}
          <a href={appStoreUrlFor(locale)} target="_blank" rel="noopener noreferrer" style={s.btnSecondary}>
            {t.confirm.appStore}
          </a>
          <a href={playStoreUrlFor(locale)} target="_blank" rel="noopener noreferrer" style={s.btnSecondary}>
            {t.confirm.googlePlay}
          </a>

          <a href={prefix || '/'} style={s.homeLink}>
            {t.common.backToSite}
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
