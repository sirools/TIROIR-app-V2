import { useRef } from 'react'
import Head from 'next/head'
import HeaderTiroirWeb from '../components/layout/HeaderTiroirWeb'
import FooterTiroirWeb from '../components/layout/FooterTiroirWeb'
import UluleInvite from '../components/UluleInvite'
import Hero from '../components/home/Hero'
import PhotoSimple from '../components/home/PhotoSimple'
import Creatives from '../components/home/Creatives'
import ProBusiness from '../components/home/ProBusiness'
import ForEveryone from '../components/home/ForEveryone'
import Value from '../components/home/Value'
import PricingFaq from '../components/home/PricingFaq'
import FinalCta from '../components/home/FinalCta'
import { useMotion } from '../components/home/useMotion'
import { useHomeJsonLd } from '../components/home/HomeJsonLd'
import { useCopy } from '../locales'
import { localeLinks } from '../components/layout/LocaleLinks'
import s from '../components/home/home.module.css'

// Homepage unique : elle explique le concept et la valeur (la page
// Concept y est fusionnée). Textes : web/locales/<langue>.ts.
export default function Landing() {
  const { t: { home: t }, locale } = useCopy()
  const root = useRef<HTMLDivElement>(null)
  const motion = useMotion(root)
  const jsonLd = useHomeJsonLd()

  return (
    <>
      <Head>
        <title>{t.meta.title}</title>
        <meta name="description" content={t.meta.description} />
        {localeLinks(locale, '/')}
        {jsonLd}
      </Head>

      <HeaderTiroirWeb />

      <div ref={root} className={s.page} data-motion={motion}>
        <main>
          <Hero />
          <PhotoSimple />
          <Creatives />
          <ProBusiness />
          <ForEveryone />
          <Value />
          <PricingFaq />
          <FinalCta />
        </main>
      </div>

      <FooterTiroirWeb />

      {/* L'enquête n'existe qu'en français et en anglais. */}
      {(locale === 'fr' || locale === 'en') && <UluleInvite />}
    </>
  )
}
