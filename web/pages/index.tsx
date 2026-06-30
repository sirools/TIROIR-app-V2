import Head from "next/head"
import HeaderTiroirWeb from '../components/layout/HeaderTiroirWeb'
import Hero from "../components/landing/Hero"
import FlowSteps from "../components/landing/FlowSteps"
import StoryScroll from "../components/landing/StoryScroll"
import FinalCTA from "../components/landing/FinalCTA"

export default function Landing() {
  return (
    <>
      <Head>
        <title>Tiroir — Photographiez. L'IA crée la fiche.</title>
        <meta name="description" content="Inventaire personnel intelligent. Photographiez vos objets, l'IA génère la fiche. Valeur marché, collections, partage en un lien." />
      </Head>

      <HeaderTiroirWeb />

      <main>
        <Hero />
        <FlowSteps />
        <StoryScroll />
        <FinalCTA />
      </main>

      <footer className="footer">
        <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 28, height: 28, background: 'var(--orange)', borderRadius: 8 }} />
            <span>© {new Date().getFullYear()} Tiroir</span>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <a href="mailto:hello@tiroir.app">Contact</a>
            <a href="/privacy">Confidentialité</a>
          </div>
        </div>
      </footer>
    </>
  )
}
