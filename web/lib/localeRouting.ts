// Langues du site et pages traduites.
//
// Le français et l'anglais couvrent tout le site public. L'allemand et
// l'espagnol ne couvrent que les pages de TRANSLATED_PATHS :
// toute autre page demandée dans ces langues renvoie vers sa version
// anglaise (redirection temporaire, le temps de la traduire). Module sans
// dépendance, appelé par middleware.ts, testé à part.

export const LOCALES = ['fr', 'en', 'de', 'es', 'pt'] as const
export type Locale = (typeof LOCALES)[number]

/** Langues où seules les pages de TRANSLATED_PATHS existent. */
export const PARTIAL_LOCALES: readonly Locale[] = ['de', 'es', 'pt']

/**
 * Langues partielles plus restreintes encore : seules ces pages existent.
 * Portugais (du Brésil, la variante par défaut de l'app) : la homepage
 * seulement, ouverte le 08/11/2026.
 */
export const LOCALE_PATHS: Partial<Record<Locale, readonly string[]>> = { pt: ['/'] }

/** Pages traduites dans toutes les langues (textes dans web/locales). */
export const TRANSLATED_PATHS: readonly string[] = [
  '/', '/pricing',
  // Compte (web/locales/account)
  '/login', '/inscription', '/mot-de-passe-oublie', '/nouveau-mot-de-passe',
  '/email-confirme', '/bienvenue', '/merci', '/desinscription',
  '/mon-compte', '/profil', '/mes-partages',
  // Inventaire du propriétaire connecté (inventory, dans web/locales)
  '/mes-collections', '/accueil', '/ventes',
  // À propos et pages juridiques (web/locales/about, web/locales/legal)
  '/about', '/cgu', '/privacy',
]

/** Familles de pages traduites (pages de partage, web/locales/share). */
export const TRANSLATED_PREFIXES: readonly string[] = ['/s/', '/share/o/']

/**
 * Familles de pages traduites réservées au propriétaire connecté. À part
 * de TRANSLATED_PREFIXES, qui désigne aussi les pages des destinataires
 * (servies dans la langue du navigateur) : ici la langue reste celle choisie.
 */
export const OWNER_PREFIXES: readonly string[] = ['/mes-collections/', '/ventes/']

/** La page existe-t-elle dans cette langue ? */
export function isTranslated(locale: Locale, pathname: string): boolean {
  const path = pathname || '/'
  const only = LOCALE_PATHS[locale]
  if (only) return only.includes(path)
  return !PARTIAL_LOCALES.includes(locale)
    || TRANSLATED_PATHS.includes(path)
    || TRANSLATED_PREFIXES.some(prefix => path.startsWith(prefix))
    || OWNER_PREFIXES.some(prefix => path.startsWith(prefix))
}

export function asLocale(raw: string | undefined | null): Locale {
  return (LOCALES as readonly string[]).includes(raw ?? '') ? (raw as Locale) : 'fr'
}

/**
 * Chemin anglais vers lequel renvoyer une page non traduite, ou null.
 * `pathname` est sans préfixe de langue (comme req.nextUrl.pathname).
 */
export function untranslatedRedirect(locale: string | undefined, pathname: string): string | null {
  if (!PARTIAL_LOCALES.includes(locale as Locale)) return null
  if (isTranslated(locale as Locale, pathname)) return null
  if (pathname.startsWith('/api/') || pathname.startsWith('/_next/')) return null
  // Fichiers statiques (favicon, images, vidéos…) : servis tels quels.
  if (/\.[a-z0-9]+$/i.test(pathname)) return null
  return `/en${pathname}`
}

/**
 * Le danois a été servi par erreur du 19/10 au 08/11/2026 (/da/…) : ce
 * n'est pas une langue de Tiroir. Ses anciennes adresses renvoient vers
 * l'anglais, langue par défaut hors de France. `pathname` est tel que le
 * voit le middleware : sans langue reconnue, /da reste dans le chemin.
 */
export function retiredLocaleRedirect(pathname: string): string | null {
  if (pathname === '/da') return '/en'
  if (pathname.startsWith('/da/')) return `/en${pathname.slice(3)}`
  return null
}

/** Préfixe d'URL publique d'une langue (« » pour le français). */
export const localePrefix = (l: Locale) => (l === 'fr' ? '' : `/${l}`)

/** Adresse publique complète d'une page dans une langue. */
export function localeUrl(site: string, l: Locale, pathname: string): string {
  const url = `${site}${localePrefix(l)}${pathname === '/' ? '' : pathname}`
  return url === site ? `${site}/` : url
}

/**
 * Langue d'un destinataire de partage, d'après l'en-tête Accept-Language
 * de son navigateur : il arrive par un lien sans langue (tiroir.app/s/…),
 * qu'il n'a pas choisi. null = rester en français (langue par défaut, ou
 * aucune langue du site reconnue).
 */
export function recipientLocale(acceptLanguage: string | null | undefined): Locale | null {
  if (!acceptLanguage) return null
  const ranked = acceptLanguage
    .split(',')
    .map((part, i) => {
      const [tag, ...params] = part.trim().toLowerCase().split(';')
      const q = params.find(p => p.trim().startsWith('q='))
      return { lang: tag.split('-')[0], q: q ? Number(q.trim().slice(2)) || 0 : 1, i }
    })
    .filter(x => x.lang && x.q > 0)
    .sort((a, b) => b.q - a.q || a.i - b.i)
  // Seulement une langue où les pages de partage sont traduites.
  const first = ranked.find(x =>
    (LOCALES as readonly string[]).includes(x.lang) && isTranslated(x.lang as Locale, '/s/'))
  return first && first.lang !== 'fr' ? (first.lang as Locale) : null
}

/** Pages de partage, ouvertes par des destinataires depuis un lien. */
export const isRecipientPage = (pathname: string) => TRANSLATED_PREFIXES.some(p => pathname.startsWith(p))
