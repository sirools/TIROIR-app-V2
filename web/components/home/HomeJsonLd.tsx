import { HERO_VARIANT, useCopy } from '../../locales'
import { localeUrl } from '../../lib/localeRouting'
import { APP_STORE_URL_FR, PLAY_STORE_URL } from '../../lib/appLinks'
import { OFFERS_V4 } from '../../lib/offers'

const SITE = 'https://tiroir.app'
const IN_LANGUAGE = { fr: 'fr-FR', en: 'en', de: 'de-DE', es: 'es-ES' } as const

/**
 * Balise <script> à placer directement dans <Head> (next/head ne garde que
 * ses enfants directs, d'où un hook et non un composant).
 *
 * Données structurées de la homepage (schema.org, JSON-LD) : l'organisation,
 * le site, la page et l'application. Titre, description et accroche suivent
 * la langue de la page ; le détail (mots-clés, publics, fonctions) n'existe
 * qu'en français, la langue de référence. Le quota gratuit vient de
 * lib/offers.ts pour ne jamais diverger de l'offre réelle.
 */
export function useHomeJsonLd() {
  const { t: { home: t }, locale } = useCopy()
  const fr = locale === 'fr'
  const pageUrl = localeUrl(SITE, locale, '/')
  const free = OFFERS_V4.free.aiActionsPerMonth

  const data = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      '@id': `${SITE}/#organization`,
      url: SITE,
      name: 'Tiroir',
      logo: `${SITE}/icons/app-icon.png`,
      brand: { '@type': 'Brand', name: 'Tiroir' },
      ...(fr && { description: 'Tiroir aide à photographier, documenter, organiser et estimer les objets que l’on possède.' }),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      '@id': `${SITE}/#website`,
      url: SITE,
      name: 'Tiroir',
      publisher: { '@id': `${SITE}/#organization` },
      inLanguage: Object.values(IN_LANGUAGE),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      '@id': `${pageUrl}#webpage`,
      url: pageUrl,
      name: t.meta.title,
      headline: t.hero.variants[HERO_VARIANT - 1].title,
      description: t.meta.description,
      inLanguage: IN_LANGUAGE[locale],
      isPartOf: { '@id': `${SITE}/#website` },
      publisher: { '@id': `${SITE}/#organization` },
      about: { '@id': `${SITE}/#application` },
      mainEntity: { '@id': `${SITE}/#application` },
      ...(fr && {
        keywords: [
          'gestion d’objets', 'inventaire photo', 'application d’inventaire', 'reconnaissance d’objets',
          'estimation de valeur', 'organisation des possessions', 'gestion de stock', 'application mobile',
        ],
      }),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      '@id': `${SITE}/#application`,
      url: SITE,
      name: 'Tiroir',
      image: `${SITE}/icons/app-icon.png`,
      operatingSystem: ['iOS', 'Android'],
      applicationCategory: ['ProductivityApplication', 'UtilitiesApplication'],
      sameAs: [APP_STORE_URL_FR, PLAY_STORE_URL],
      publisher: { '@id': `${SITE}/#organization` },
      offers: {
        '@type': 'Offer',
        url: localeUrl(SITE, locale, '/pricing'),
        price: '0',
        priceCurrency: 'EUR',
        category: 'free',
        availability: 'https://schema.org/InStock',
        ...(fr && { description: `Version gratuite avec ${free} actions IA incluses par mois, sans carte bancaire.` }),
      },
      ...(fr && {
        inLanguage: 'fr-FR',
        description: 'Application mobile qui reconnaît les objets photographiés, rédige automatiquement leur fiche, les classe et aide à estimer leur valeur.',
        audience: ['Particuliers', 'Créatifs', 'Professionnels', 'Brocanteurs', 'Musiciens', 'Régisseurs', 'Stylistes']
          .map(audienceType => ({ '@type': 'Audience', audienceType })),
        featureList: [
          'Reconnaissance d’objets à partir d’une photo',
          'Génération automatique d’une fiche objet',
          'Classement des objets par tiroirs et collections',
          'Catégorisation automatique',
          'Évaluation de l’état des objets',
          'Estimation de la valeur',
          'Mode rafale pour photographier plusieurs objets',
          'Suivi des objets prêtés',
          'Partage d’une collection en lecture seule',
          'Utilisation pour inventaire, assurance, déménagement, revente et gestion de stock',
          'Suppression complète du compte et des données',
        ],
      }),
      ...(!fr && { description: t.meta.description }),
    },
  ]

  return (
    <script
      key="jsonld"
      type="application/ld+json"
      // Échappe « < » pour qu'aucun texte ne puisse fermer la balise.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  )
}
