// Le back-office a son propre domaine (ex. backoffice.tiroir.app), séparé
// du site public : on y entre directement dans l'admin, pas à travers
// l'expérience du site.
//
// Un seul site Next.js, qui répond selon le nom de domaine (middleware.ts) :
//   - backoffice : « / » ouvre l'admin ; seules la connexion et les pages
//     admin y existent, le reste renvoie vers le site public ;
//   - site public : /admin renvoie vers le back-office.
//
// Rien ne change tant que BACKOFFICE_HOST n'est pas défini (preprod,
// aperçus Vercel, développement). Les gardes serveur (requireAdminPage,
// requireTorixOwnerPage) restent la vraie protection : ce routage ne fait que
// ranger les pages au bon endroit.
//
// Module sans dépendance, pour rester testable hors de Next.

export type BackofficeRoute =
  | { action: 'next'; noindex?: boolean }
  | { action: 'rewrite'; pathname: string; noindex: true }
  | { action: 'redirect'; url: string }

export type BackofficeConfig = {
  /** Domaine du back-office, ex. « backoffice.tiroir.app ». */
  backofficeHost?: string | null
  /** Domaine du site public, ex. « tiroir.app ». */
  siteHost?: string | null
}

export const DEFAULT_SITE_HOST = 'tiroir.app'

/** Pages communes aux deux domaines : se connecter, retrouver son accès. */
const AUTH_PATHS = ['/login', '/mot-de-passe-oublie', '/nouveau-mot-de-passe', '/email-confirme']

function bareHost(host: string | null | undefined): string {
  return (host ?? '').trim().toLowerCase().replace(/:\d+$/, '')
}

function isAdminPage(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/')
}

function isAllowedOnBackoffice(pathname: string): boolean {
  if (isAdminPage(pathname)) return true
  if (pathname.startsWith('/api/admin/') || pathname === '/api/admin') return true
  // Torix (questions, accès) et l'état du système, appelés par les pages
  // du back-office : ils doivent répondre sur place, pas être redirigés.
  if (pathname.startsWith('/api/torix/') || pathname === '/api/health') return true
  // Mesure d'audience appelée par toutes les pages : la laisser répondre
  // plutôt que de rediriger un POST vers un autre domaine.
  if (pathname === '/api/track') return true
  if (pathname.startsWith('/_next/')) return true
  // Fichiers statiques (favicon, images, polices…).
  if (/\.[a-z0-9]+$/i.test(pathname)) return true
  return AUTH_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`))
}

/**
 * Où envoyer une requête. `pathname` est sans préfixe de langue ; `locale`
 * est la langue de la requête (« fr » par défaut, sans préfixe).
 */
export function routeFor(
  host: string | null | undefined,
  pathname: string,
  search: string,
  config: BackofficeConfig,
  locale = 'fr',
): BackofficeRoute {
  const backoffice = bareHost(config.backofficeHost)
  if (!backoffice) return { action: 'next' }

  const site = bareHost(config.siteHost) || DEFAULT_SITE_HOST
  const current = bareHost(host)
  const prefix = locale && locale !== 'fr' ? `/${locale}` : ''
  const query = search && search !== '?' ? search : ''

  if (current === backoffice) {
    if (pathname === '/' || pathname === '') {
      return { action: 'rewrite', pathname: '/admin', noindex: true }
    }
    if (isAllowedOnBackoffice(pathname)) return { action: 'next', noindex: true }
    return { action: 'redirect', url: `https://${site}${prefix}${pathname}${query}` }
  }

  // Seulement depuis le site public lui-même : les aperçus Vercel et la
  // preprod gardent leur /admin.
  if ((current === site || current === `www.${site}`) && isAdminPage(pathname)) {
    const target = pathname === '/admin' ? '/' : pathname
    return { action: 'redirect', url: `https://${backoffice}${prefix}${target}${query}` }
  }

  return { action: 'next' }
}
