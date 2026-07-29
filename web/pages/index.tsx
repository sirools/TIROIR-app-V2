import Head from "next/head"
import { useRouter } from "next/router"
import HeaderTiroirWeb from '../components/layout/HeaderTiroirWeb'
import FooterTiroirWeb from '../components/layout/FooterTiroirWeb'
import Hero from "../components/landing/Hero"
import FlowSteps from "../components/landing/FlowSteps"
import StoryScroll from "../components/landing/StoryScroll"
import Principles from "../components/landing/Principles"
import FinalCTA from "../components/landing/FinalCTA"
import SurveyInvite from "../components/SurveyInvite"

export default function Landing() {
  const { locale } = useRouter()
  const isEn = locale === 'en'
  return (
    <>
      <Head>
        <title>{isEn ? 'Tiroir — Snap a photo. The AI writes the entry.' : "Tiroir — Photographiez. L'IA crée la fiche."}</title>
        <meta
          name="description"
          content={isEn
            ? 'Smart personal inventory. Photograph your belongings, the AI generates the entry. Market value, collections, share with one link.'
            : "Inventaire personnel intelligent. Photographiez vos objets, l'IA génère la fiche. Valeur marché, collections, partage en un lien."}
        />
      </Head>

      <HeaderTiroirWeb />

      <main>
        <Hero />
        <FlowSteps />
        <StoryScroll />
        <Principles />
        <FinalCTA />
      </main>

      <FooterTiroirWeb />

      <SurveyInvite />
    </>
  )
}
