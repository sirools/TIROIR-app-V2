import { useRef } from 'react'
import Head from 'next/head'
import HeaderTiroirWeb from '../components/layout/HeaderTiroirWeb'
import FooterTiroirWeb from '../components/layout/FooterTiroirWeb'
import SurveyInvite from '../components/SurveyInvite'
import Hero from '../components/home/Hero'
import HowItWorks from '../components/home/HowItWorks'
import ForPros from '../components/home/ForPros'
import ForEveryone from '../components/home/ForEveryone'
import Value from '../components/home/Value'
import PricingFaq from '../components/home/PricingFaq'
import FinalCta from '../components/home/FinalCta'
import { useMotion } from '../components/home/useMotion'
import { useCopy } from '../locales'
import { LOCALES, localePrefix } from '../lib/localeRouting'
import s from '../components/home/home.module.css'

const SITE = 'https://tiroir.app'

// Homepage unique : elle explique le concept et la valeur (la page
// Concept y est fusionnée). Textes : web/locales/<langue>.ts.
export default function Landing() {
  const { t: { home: t }, locale } = useCopy()
  const root = useRef<HTMLDivElement>(null)
  const motion = useMotion(root)

  return (
    <>
      <Head>
        <title>{t.meta.title}</title>
        <meta name="description" content={t.meta.description} />
        <link rel="canonical" href={`${SITE}${localePrefix(locale) || "/"}`} />
        {LOCALES.map(l => (
          <link key={l} rel="alternate" hrefLang={l} href={`${SITE}${localePrefix(l) || "/"}`} />
        ))}
        <link rel="alternate" hrefLang="x-default" href={`${SITE}/`} />
      </Head>

      <HeaderTiroirWeb />

      <div ref={root} className={s.page} data-motion={motion}>
        <main>
          <Hero />
          <HowItWorks />
          <ForPros />
          <ForEveryone />
          <Value />
          <PricingFaq />
          <FinalCta />
        </main>
      </div>

      <FooterTiroirWeb />

      {/* L'enquête n'existe qu'en français et en anglais. */}
      {(locale === 'fr' || locale === 'en') && <SurveyInvite />}
    </>
  )
}
