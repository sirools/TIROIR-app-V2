// pages/merci.tsx
import Head from 'next/head'
import Link from 'next/link'
import HeaderTiroirWeb from '../components/layout/HeaderTiroirWeb'
import FooterTiroirWeb from '../components/layout/FooterTiroirWeb'
import { useCopy } from '../locales'

export default function Merci() {
  const { t: { account: { thanks: t } } } = useCopy()
  return (
    <>
      <Head><title>{t.metaTitle}</title></Head>
      <HeaderTiroirWeb />
      <main className="section" style={{minHeight:'60vh', display:'grid', placeItems:'center', background:'var(--beige-2)', padding:'64px 16px'}}>
        <div className="card" style={{padding:24, maxWidth:520, textAlign:'center'}}>
          <div className="badge" style={{marginBottom:12}}>{t.badge}</div>
          <h1 className="h2" style={{marginBottom:8}}>{t.title}</h1>
          <p className="p" style={{marginBottom:16}}>{t.text}</p>
          <div style={{display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap'}}>
            <Link href="/#features" className="btn btn-primary">{t.features}</Link>
            <Link href="/" className="btn" style={{border:'1px solid rgba(0,0,0,0.12)'}}>{t.home}</Link>
          </div>
        </div>
      </main>
      <FooterTiroirWeb />
    </>
  )
}