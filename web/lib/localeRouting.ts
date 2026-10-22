// Langues du site et pages traduites.
//
// Le français et l'anglais couvrent tout le site public. Le danois,
// l'allemand et l'espagnol ne couvrent que les pages de TRANSLATED_PATHS :
// toute autre page demandée dans ces langues renvoie vers sa version
// anglaise (redirection temporaire, le temps de la traduire). Module sans
// dépendance, appelé par middleware.ts, testé à part.

export const LOCALES = ['fr', 'en', 'da', 'de', 'es'] as const
export type Locale = (typeof LOCALES)[number]

/** Langues où seules les pages de TRANSLATED_PATHS existent. */
export const PARTIAL_LOCALES: readonly Locale[] = ['da', 'de', 'es']

/** Pages traduites dans toutes les langues (textes dans web/locales). */
export const TRANSLATED_PATHS: readonly string[] = ['/', '/pricing']

/** La page existe-t-elle dans cette langue ? */
export const isTranslated = (locale: Locale, pathname: string) =>
  !PARTIAL_LOCALES.includes(locale) || TRANSLATED_PATHS.includes(pathname || '/')

export function asLocale(raw: string | undefined | null): Locale {
  return (LOCALES as readonly string[]).includes(raw ?? '') ? (raw as Locale) : 'fr'
}

/**
 * Chemin anglais vers lequel renvoyer une page non traduite, ou null.
 * `pathname` est sans préfixe de langue (comme req.nextUrl.pathname).
 */
export function untranslatedRedirect(locale: string | undefined, pathname: string): string | null {
  if (!PARTIAL_LOCALES.includes(locale as Locale)) return null
  if (TRANSLATED_PATHS.includes(pathname || '/')) return null
  if (pathname.startsWith('/api/') || pathname.startsWith('/_next/')) return null
  // Fichiers statiques (favicon, images, vidéos…) : servis tels quels.
  if (/\.[a-z0-9]+$/i.test(pathname)) return null
  return `/en${pathname}`
}

/** Préfixe d'URL publique d'une langue (« » pour le français). */
export const localePrefix = (l: Locale) => (l === 'fr' ? '' : `/${l}`)

/** Adresse publique complète d'une page dans une langue. */
export function localeUrl(site: string, l: Locale, pathname: string): string {
  const url = `${site}${localePrefix(l)}${pathname === '/' ? '' : pathname}`
  return url === site ? `${site}/` : url
}
