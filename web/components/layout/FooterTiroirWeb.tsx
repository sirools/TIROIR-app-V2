import Link from 'next/link'
import { useRouter } from 'next/router'
import { appStoreUrlFor, playStoreUrlFor } from '../../lib/appLinks'
import { HOME_ONLY_LOCALES, LOCALES } from '../../lib/localeRouting'
import { LOCALE_NAMES, useCopy } from '../../locales'
import { FOUNDER, CONTACT_EMAIL, agendaHref } from '../../lib/founderLinks'

function LinkedInIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zM3 9h4v12H3V9zm7 0h3.8v1.65h.05c.53-.95 1.83-1.95 3.77-1.95 4.03 0 4.78 2.5 4.78 5.76V21h-4v-5.65c0-1.35-.03-3.08-1.9-3.08-1.9 0-2.2 1.46-2.2 2.98V21h-4V9z" />
    </svg>
  )
}

function GlobeIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7" />
      <path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  )
}

function MailIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M4 7.5l8 5 8-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

/**
 * Footer principal du site — 4 colonnes sur desktop, empilées sur mobile,
 * avec une barre basse (copyright + réseaux du fondateur).
 * Utilisé sur les pages publiques : accueil, tarifs, à propos.
 */
export default function FooterTiroirWeb() {
  const { t: { layout: t }, locale } = useCopy()
  const { asPath } = useRouter()
  const year = new Date().getFullYear()

  return (
    <footer className="ti-footer">
      <div className="ti-footer__inner">
        <div className="ti-footer__grid">
          {/* Marque */}
          <div className="ti-footer__brand">
            <Link href="/" legacyBehavior passHref>
              <a className="ti-footer__logo">
                <img src="/icons/app-icon.png" alt="" width={36} height={36} />
                <strong>TiROiR</strong>
              </a>
            </Link>
            <p className="ti-footer__baseline">
              {t.footerTagline}
            </p>
            <div className="ti-footer__stores">
              <a href={appStoreUrlFor(locale)} target="_blank" rel="noopener noreferrer" className="ti-footer__store">
                App Store
              </a>
              <a href={playStoreUrlFor(locale)} target="_blank" rel="noopener noreferrer" className="ti-footer__store">
                Google Play
              </a>
            </div>
          </div>

          {/* Produit */}
          <nav className="ti-footer__col" aria-label={t.product}>
            <h3>{t.product}</h3>
            <Link href="/pricing" legacyBehavior passHref>
              <a>{t.pricing}</a>
            </Link>
            <Link href="/inscription" legacyBehavior passHref>
              <a>{t.signUp}</a>
            </Link>
            <Link href="/login" legacyBehavior passHref>
              <a>{t.signIn}</a>
            </Link>
            <Link href="/mes-partages" legacyBehavior passHref>
              <a>{t.myShares}</a>
            </Link>
          </nav>

          {/* Le projet */}
          <nav className="ti-footer__col" aria-label={t.project}>
            <h3>{t.project}</h3>
            <Link href="/about" legacyBehavior passHref>
              <a>{t.about}</a>
            </Link>
            <a href={agendaHref(t.bookSubject)}>
              {t.bookSlot}
            </a>
            <a href={`mailto:${CONTACT_EMAIL}`}>{t.contact}</a>
          </nav>

          {/* Légal */}
          <nav className="ti-footer__col" aria-label={t.legal}>
            <h3>{t.legal}</h3>
            <Link href="/cgu" legacyBehavior passHref>
              <a>{t.terms}</a>
            </Link>
            <Link href="/privacy" legacyBehavior passHref>
              <a>{t.privacy}</a>
            </Link>
          </nav>
        </div>

        {/* Barre basse */}
        <div className="ti-footer__bottom">
          <span className="ti-footer__copy">© {year} Tiroir · {t.madeIn}</span>

          {/* Langues. En danois, allemand et espagnol, seule la homepage
              existe : depuis une autre page, on y arrive. */}
          <nav className="ti-footer__langs" aria-label={t.language}>
            {LOCALES.map(l => (
              <Link
                key={l}
                href={HOME_ONLY_LOCALES.includes(l) ? '/' : asPath}
                locale={l}
                legacyBehavior
                passHref
              >
                <a hrefLang={l} lang={l} aria-current={l === locale ? 'true' : undefined}>
                  {LOCALE_NAMES[l]}
                </a>
              </Link>
            ))}
          </nav>

          <div className="ti-footer__social">
            <a
              href={FOUNDER.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              title="LinkedIn"
            >
              <LinkedInIcon />
            </a>
            <a
              href={FOUNDER.blog}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={FOUNDER.blogLabel}
              title={FOUNDER.blogLabel}
            >
              <GlobeIcon />
            </a>
            <a href={`mailto:${CONTACT_EMAIL}`} aria-label="E-mail" title={CONTACT_EMAIL}>
              <MailIcon />
            </a>
          </div>
        </div>
      </div>

      <style jsx>{`
        .ti-footer {
          background: var(--beige-2);
          border-top: 1px solid rgba(0, 0, 0, 0.06);
          color: var(--muted);
        }
        .ti-footer__inner {
          max-width: 1200px;
          margin: 0 auto;
          padding: 56px 24px 24px;
        }
        .ti-footer__grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 36px 24px;
        }
        @media (min-width: 760px) {
          .ti-footer__grid { grid-template-columns: 1.6fr 1fr 1fr 1fr; gap: 32px; }
        }

        /* Colonne marque */
        .ti-footer__logo {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          color: var(--ink);
        }
        .ti-footer__logo img { border-radius: 9px; display: block; }
        .ti-footer__logo strong { font-size: 18px; font-weight: 800; letter-spacing: -0.3px; }
        .ti-footer__baseline {
          margin: 12px 0 16px;
          max-width: 320px;
          font-size: 14px;
          line-height: 1.6;
          color: var(--muted);
        }
        .ti-footer__stores { display: flex; gap: 8px; flex-wrap: wrap; }
        .ti-footer__store {
          display: inline-flex;
          align-items: center;
          padding: 8px 14px;
          border-radius: 999px;
          border: 1px solid rgba(0, 0, 0, 0.12);
          background: #fff;
          color: var(--ink);
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          transition: border-color 0.15s, color 0.15s;
        }
        .ti-footer__store:hover { border-color: var(--orange); color: var(--orange); }

        /* Colonnes de liens */
        .ti-footer__col { display: flex; flex-direction: column; gap: 10px; }
        .ti-footer__col h3 {
          margin: 0 0 2px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--ink);
        }
        .ti-footer__col a {
          font-size: 14px;
          color: var(--muted);
          text-decoration: none;
          width: fit-content;
          transition: color 0.15s;
        }
        .ti-footer__col a:hover { color: var(--orange); }

        /* Barre basse */
        .ti-footer__bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid rgba(0, 0, 0, 0.08);
        }
        .ti-footer__copy { font-size: 13px; color: #8a8177; }
        .ti-footer__social { display: flex; align-items: center; gap: 6px; }
        .ti-footer__langs { display: flex; flex-wrap: wrap; gap: 4px 14px; font-size: 13px; }
        .ti-footer__langs a { color: var(--muted); text-decoration: none; padding: 6px 0; }
        .ti-footer__langs a:hover { color: var(--ink); }
        .ti-footer__langs a[aria-current] { color: var(--ink); font-weight: 700; }
        .ti-footer__social a {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          border-radius: 10px;
          color: var(--muted);
          text-decoration: none;
          transition: background 0.15s, color 0.15s;
        }
        .ti-footer__social a:hover { background: #fff; color: var(--orange); }
      `}</style>
    </footer>
  )
}
