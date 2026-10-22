import { LOCALES, localeUrl, type Locale } from '../../lib/localeRouting'

const SITE = 'https://tiroir.app'

/**
 * Adresse canonique et balises hreflang d'une page traduite dans les cinq
 * langues (à placer dans <Head>). Le français, sans préfixe, sert de
 * x-default.
 */
export function localeLinks(locale: Locale, pathname: string) {
  return [
    <link key="canonical" rel="canonical" href={localeUrl(SITE, locale, pathname)} />,
    ...LOCALES.map(l => <link key={l} rel="alternate" hrefLang={l} href={localeUrl(SITE, l, pathname)} />),
    <link key="x-default" rel="alternate" hrefLang="x-default" href={localeUrl(SITE, 'fr', pathname)} />,
  ]
}
