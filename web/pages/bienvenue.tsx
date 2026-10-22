import Head from 'next/head'
import { useRouter } from 'next/router'
import StoreButtons from '../components/StoreButtons'
import { localePrefix } from '../lib/localeRouting'
import { useCopy } from '../locales'

export default function Bienvenue() {
  const { query } = useRouter()
  const { t: { account: t }, locale } = useCopy()
  const pending = query.pending === '1'

  return (
    <>
      <Head>
        <title>{t.welcome.metaTitle}</title>
        <meta name="robots" content="noindex" />
      </Head>

      <main style={s.root}>
        <div style={s.card}>
          <div style={s.logo}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/app-icon.png" alt="" width={36} height={36} style={{ borderRadius: 10 }} />
            <strong style={s.logoText}>Tiroir</strong>
          </div>

          <h1 style={s.title}>{t.welcome.title}</h1>

          {pending ? (
            <p style={s.text}>
              {t.welcome.pendingBefore}<strong>{t.welcome.pendingStrong}</strong>{t.welcome.pendingAfter}
            </p>
          ) : (
            <p style={s.text}>{t.welcome.ready}</p>
          )}

          <div style={s.stores}>
            <StoreButtons variant="card" full locale={locale} />
          </div>

          <a href={localePrefix(locale) || '/'} style={s.homeLink}>{t.common.backToSite}</a>
        </div>
      </main>
    </>
  )
}

const s: Record<string, React.CSSProperties> = {
  root:     { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#FFF4E6', padding: 24, fontFamily: "'Inter', system-ui, sans-serif" },
  card:     { width: '100%', maxWidth: 440, background: 'white', borderRadius: 20, padding: '40px 32px', boxShadow: '0 6px 24px rgba(0,0,0,0.08)', textAlign: 'center' },
  logo:     { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 28 },
  logoText: { fontSize: 20, fontWeight: 800, color: '#121212' },
  title:    { fontSize: 22, fontWeight: 800, color: '#121212', marginBottom: 12 },
  text:     { fontSize: 15, color: '#5b5b5b', lineHeight: 1.6, marginBottom: 24 },
  stores:   { display: 'flex', justifyContent: 'center' },
  homeLink: { display: 'inline-block', marginTop: 24, fontSize: 13, color: '#5b5b5b', textDecoration: 'none' },
}
