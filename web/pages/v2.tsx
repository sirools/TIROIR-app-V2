import { useRef } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import HeaderTiroirWeb from '../components/layout/HeaderTiroirWeb'
import FooterTiroirWeb from '../components/layout/FooterTiroirWeb'
import Hero from '../components/landing-v2/Hero'
import Camille from '../components/landing-v2/Camille'
import Values from '../components/landing-v2/Values'
import GrandPublic from '../components/landing-v2/GrandPublic'
import Offers from '../components/landing-v2/Offers'
import { useMotion } from '../components/landing-v2/useMotion'
import s from '../components/landing-v2/v2.module.css'

// Prototype de la homepage V2 (mobile d'abord, scroll continu). La
// homepage actuelle (pages/index.tsx) n'est pas touchée. Hors index tant
// que ce n'est qu'un prototype. /v2?clean masque les repères [PLACEHOLDER].
export default function HomeV2() {
  const root = useRef<HTMLDivElement>(null)
  const motion = useMotion(root)
  const { query } = useRouter()

  return (
    <>
      <Head>
        <title>Tiroir — Une photo. Une fiche. Sa valeur.</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <HeaderTiroirWeb />

      <div ref={root} className={s.page} data-motion={motion} data-clean={'clean' in query ? '' : undefined}>
        <main>
          <Hero />
          <Camille />
          <Values />
          <GrandPublic />
          <Offers />
        </main>
      </div>

      <FooterTiroirWeb />
    </>
  )
}
