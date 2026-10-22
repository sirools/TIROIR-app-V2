// pages/privacy.tsx — Politique de confidentialité TiROiR
// Corps par langue dans components/legal/privacy (le français fait foi),
// textes courts dans locales/legal.
import LegalPage from '../components/layout/LegalPage'
import { PRIVACY_BODIES, PRIVACY_UPDATED } from '../components/legal/privacy'
import { formatLegalDate } from '../components/legal/date'
import { fill, useCopy } from '../locales'

export default function PrivacyPage() {
  const { t: { legal: t }, locale } = useCopy()
  const Body = PRIVACY_BODIES[locale]
  return (
    <LegalPage
      title={t.privacy.title}
      description={t.privacy.description}
      heading={t.privacy.heading}
      updated={fill(t.updated, { date: formatLegalDate(PRIVACY_UPDATED, locale) })}
      pathname="/privacy"
    >
      <Body />
    </LegalPage>
  )
}
