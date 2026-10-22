// pages/cgu.tsx — Conditions Générales d'Utilisation TiROiR
// Corps par langue dans components/legal/cgu (le français fait foi),
// textes courts dans locales/legal.
import LegalPage from '../components/layout/LegalPage'
import { CGU_BODIES, CGU_UPDATED } from '../components/legal/cgu'
import { formatLegalDate } from '../components/legal/date'
import { fill, useCopy } from '../locales'

export default function CguPage() {
  const { t: { legal: t }, locale } = useCopy()
  const Body = CGU_BODIES[locale]
  return (
    <LegalPage
      title={t.cgu.title}
      description={t.cgu.description}
      heading={t.cgu.heading}
      updated={fill(t.updated, { date: formatLegalDate(CGU_UPDATED, locale) })}
      pathname="/cgu"
    >
      <Body />
    </LegalPage>
  )
}
