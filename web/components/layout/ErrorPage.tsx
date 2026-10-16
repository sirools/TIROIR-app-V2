import Head from 'next/head'
import Link from 'next/link'
import HeaderTiroirWeb from './HeaderTiroirWeb'
import FooterTiroirWeb from './FooterTiroirWeb'

// Gabarit des pages d'erreur (404, 500) : header et footer du site.
export default function ErrorPage({ title, text }: { title: string; text: string }) {
  return (
    <>
      <Head><title>{`${title} — Tiroir`}</title></Head>
      <HeaderTiroirWeb />
      <main className="section" style={{ background: 'var(--beige-2)', minHeight: '50vh', display: 'grid', placeItems: 'center' }}>
        <div className="container" style={{ textAlign: 'center', maxWidth: 520 }}>
          <h1 className="h2" style={{ marginBottom: 8 }}>{title}</h1>
          <p className="p" style={{ marginBottom: 20 }}>{text}</p>
          <Link href="/" className="btn btn-primary">Retour à l’accueil</Link>
        </div>
      </main>
      <FooterTiroirWeb />
    </>
  )
}
