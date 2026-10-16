import Head from 'next/head'
import HeaderTiroirWeb from './HeaderTiroirWeb'
import FooterTiroirWeb from './FooterTiroirWeb'

// Gabarit des pages de texte (CGU, confidentialité) : header et footer du
// site, couleurs et police du design system (design/tokens.json).
// Styles globaux préfixés par .legal : le contenu est rendu par des
// sous-composants, que les styles scopés de styled-jsx n'atteindraient pas.
export default function LegalPage({
  title,
  description,
  heading,
  updated,
  children,
}: {
  title: string
  description: string
  heading: string
  updated: string
  children: React.ReactNode
}) {
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
      </Head>

      <HeaderTiroirWeb />

      <main className="legal">
        <div className="legal-inner">
          <h1 className="h1 legal-title">{heading}</h1>
          <p className="legal-meta">{updated}</p>
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
        .legal ul { padding-left: 20px; margin: 0 0 12px; }
        .legal li { margin-bottom: 4px; }
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
