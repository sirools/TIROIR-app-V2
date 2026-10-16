// pages/merci.tsx
import Head from 'next/head'
import Link from 'next/link'
import HeaderTiroirWeb from '../components/layout/HeaderTiroirWeb'
import FooterTiroirWeb from '../components/layout/FooterTiroirWeb'

export default function Merci() {
  return (
    <>
      <Head><title>Merci — Tiroir</title></Head>
      <HeaderTiroirWeb />
      <main className="section" style={{minHeight:'60vh', display:'grid', placeItems:'center', background:'var(--beige-2)', padding:'64px 16px'}}>
        <div className="card" style={{padding:24, maxWidth:520, textAlign:'center'}}>
          <div className="badge" style={{marginBottom:12}}>Inscription confirmée</div>
          <h1 className="h2" style={{marginBottom:8}}>Merci d’avoir rejoint la bêta ✨</h1>
          <p className="p" style={{marginBottom:16}}>
            On te prévient dès qu’un accès est dispo. En attendant, découvre les fonctionnalités.
          </p>
          <div style={{display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap'}}>
            <Link href="/#features" className="btn btn-primary">Voir les fonctionnalités</Link>
            <Link href="/" className="btn" style={{border:'1px solid rgba(0,0,0,0.12)'}}>Retour à l’accueil</Link>
          </div>
        </div>
      </main>
      <FooterTiroirWeb />
    </>
  )
}