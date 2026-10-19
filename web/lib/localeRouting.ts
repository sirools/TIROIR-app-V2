// Langues du site et pages traduites.
//
// Le français et l'anglais couvrent tout le site public. Le danois,
// l'allemand et l'espagnol ne couvrent encore que la homepage : toute autre
// page demandée dans ces langues renvoie vers sa version anglaise
// (redirection temporaire, le temps de la traduire). Module sans
// dépendance, appelé par middleware.ts, testé à part.

export const LOCALES = ['fr', 'en', 'da', 'de', 'es'] as const
export type Locale = (typeof LOCALES)[number]

/** Langues où seule la homepage existe. */
export const HOME_ONLY_LOCALES: readonly Locale[] = ['da', 'de', 'es']

export function asLocale(raw: string | undefined | null): Locale {
  return (LOCALES as readonly string[]).includes(raw ?? '') ? (raw as Locale) : 'fr'
}

/**
 * Chemin anglais vers lequel renvoyer une page non traduite, ou null.
 * `pathname` est sans préfixe de langue (comme req.nextUrl.pathname).
 */
export function untranslatedRedirect(locale: string | undefined, pathname: string): string | null {
  if (!HOME_ONLY_LOCALES.includes(locale as Locale)) return null
  if (pathname === '/' || pathname === '') return null
  if (pathname.startsWith('/api/') || pathname.startsWith('/_next/')) return null
  // Fichiers statiques (favicon, images, vidéos…) : servis tels quels.
  if (/\.[a-z0-9]+$/i.test(pathname)) return null
  return `/en${pathname}`
}

/** Préfixe d'URL publique d'une langue (« » pour le français). */
export const localePrefix = (l: Locale) => (l === 'fr' ? '' : `/${l}`)
