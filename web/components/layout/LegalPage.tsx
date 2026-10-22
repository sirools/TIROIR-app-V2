import Head from 'next/head'
import Link from 'next/link'
import HeaderTiroirWeb from './HeaderTiroirWeb'
import FooterTiroirWeb from './FooterTiroirWeb'
import { localeLinks } from './LocaleLinks'
import { useCopy } from '../../locales'

// Gabarit des pages de texte (CGU, confidentialité) : header et footer du
// site, couleurs et police du design system (design/tokens.json).
// Styles globaux préfixés par .legal : le contenu est rendu par des
// sous-composants, que les styles scopés de styled-jsx n'atteindraient pas.
// Hors français, un avertissement en tête rappelle que la traduction est
// donnée pour information et renvoie à la version française, qui fait foi.
export default function LegalPage({
  title,
  description,
  heading,
  updated,
  pathname,
  children,
}: {
  title: string
  description: string
  heading: string
  updated: string
  /** Chemin sans préfixe de langue (« /cgu »), pour canonical, hreflang et le lien vers le français. */
  pathname: string
  children: React.ReactNode
}) {
  const { t: { legal: t }, locale } = useCopy()
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        {localeLinks(locale, pathname)}
      </Head>

      <HeaderTiroirWeb />

      <main className="legal">
        <div className="legal-inner">
          <h1 className="h1 legal-title">{heading}</h1>
          <p className="legal-meta">{updated}</p>
          {locale !== 'fr' && (
            <p className="legal-notice">
              {t.notice}{' '}
              <Link href={pathname} locale="fr" legacyBehavior passHref><a hrefLang="fr">{t.noticeLink}</a></Link>
            </p>
          )}
          {children}
        </div>
      </main>

      <FooterTiroirWeb />

      <style jsx global>{`
        .legal { background: var(--beige-2); }
        .legal-inner { max-width: 760px; margin: 0 auto; padding: 48px 16px 64px; }
        .legal-title { font-size: clamp(28px, 6vw, 40px); margin-bottom: 8px; }
        .legal-meta { font-size: 14px; color: var(--text-tertiary); margin: 0 0 40px; }
        .legal-section { margin-bottom: 32px; }
        .legal-section h2 { font-size: 18px; font-weight: 700; color: var(--ink); margin: 0 0 12px; }
        .legal p, .legal li { font-size: 15px; color: var(--muted); line-height: 1.7; }
        .legal p { margin: 0 0 12px; }
        /* Puces dessinées : la réinitialisation globale (Tamagui) décale les
           puces natives hors de la colonne de texte sur mobile. */
        .legal ul { list-style: none; padding: 0; margin: 0 0 12px; }
        .legal li { display: block; position: relative; padding-left: 18px; margin: 0 0 4px; }
        .legal li::before {
          content: ''; position: absolute; left: 2px; top: 0.75em;
          width: 5px; height: 5px; border-radius: 50%; background: var(--muted);
        }
        .legal strong { color: var(--ink); }
        .legal a { color: var(--orange); text-decoration: underline; }
        .legal a:hover { color: var(--orange-700); }
      `}</style>
    </>
  )
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="legal-section">
      <h2>{title}</h2>
      {children}
    </section>
  )
}
