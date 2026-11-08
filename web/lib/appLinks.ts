// Liens de téléchargement des stores — centralisés pour rester synchronisés
// partout (hero, pricing, header, e-mails…).
export const APP_STORE_URL_FR = 'https://apps.apple.com/fr/app/tiroir/id6751784101'
export const APP_STORE_URL_EN = 'https://apps.apple.com/us/app/tiroir/id6751784101'
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.tiroir.app'

export const appStoreUrl = (isEn?: boolean) => (isEn ? APP_STORE_URL_EN : APP_STORE_URL_FR)
export const playStoreUrl = (isEn?: boolean) =>
  `${PLAY_STORE_URL}${isEn ? '&hl=en' : '&hl=fr'}`

// Par langue du site : la fiche du store du pays correspondant.
const APP_STORE_COUNTRY = { fr: 'fr', en: 'us', de: 'de', es: 'es' } as const
type SiteLocale = keyof typeof APP_STORE_COUNTRY

export const appStoreUrlFor = (locale: SiteLocale) =>
  `https://apps.apple.com/${APP_STORE_COUNTRY[locale]}/app/tiroir/id6751784101`
export const playStoreUrlFor = (locale: SiteLocale) => `${PLAY_STORE_URL}&hl=${locale}`
