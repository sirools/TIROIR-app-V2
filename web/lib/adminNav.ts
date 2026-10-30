// Navigation du back-office : la liste des sections du header admin
// (components/admin/AdminLayout.tsx), et qui voit quoi.
//
// Lue seulement dans getServerSideProps : chaque page admin renvoie
// `adminNav: adminNavFor(...)` dans ses props, après sa garde. Le header
// n'affiche donc que les sections auxquelles le compte a droit — et rien
// du tout si la garde a refusé l'accès (pas de props, pas de header). Les
// libellés partent du serveur, pas du code public (cf. test torixPrive).
//
// Ajouter une section : une entrée dans SECTIONS, puis la page renvoie
// `adminNav` comme les autres. Voir web/BACKOFFICE.md.
//
// Module sans dépendance Next, pour rester testable hors de Next.
import { isTorixOwner } from './torixOwner'
import { isMarketingMember } from './marketingAccess'
import { DEFAULT_SITE_HOST } from './backofficeRouting'
import type { AdminNav, AdminNavSection } from '../components/admin/adminNavPaths'

export type { AdminNav, AdminNavSection }

type Viewer = {
  email?: string | null
  email_confirmed_at?: string | null
}

type Access = { isAdmin: boolean; isTorixOwner: boolean; isMarketing: boolean }

/**
 * Sections du header, dans l'ordre d'affichage. `visible` doit refléter la
 * garde serveur de la page : le header ne protège rien, il évite seulement
 * d'afficher un onglet qui mènerait à un 404.
 */
const SECTIONS: (AdminNavSection & { visible: (a: Access) => boolean })[] = [
  { key: 'accueil', label: 'Accueil', href: '/admin', visible: a => a.isAdmin },
  { key: 'marketing', label: 'Marketing', href: '/admin/marketing', visible: a => a.isAdmin || a.isMarketing },
  { key: 'design', label: 'Design system', href: '/admin/design-system', visible: a => a.isAdmin },
  { key: 'torix', label: 'Torix Lab', href: '/admin/torix-lab', tone: 'dark', visible: a => a.isAdmin && a.isTorixOwner },
]

/** À appeler après la garde de la page, avec le compte qu'elle a validé. */
export function adminNavFor(user: Viewer, isAdmin: boolean): AdminNav {
  const access: Access = {
    isAdmin,
    isTorixOwner: isTorixOwner(user),
    isMarketing: isMarketingMember(user),
  }
  return {
    sections: SECTIONS.filter(s => s.visible(access)).map(({ visible: _visible, ...s }) => s),
    account: { email: user.email ?? null },
    siteUrl: siteUrlFor(),
  }
}

/**
 * Accueil du site public, pour le lien « Voir le site » du header. Sur
 * backoffice.tiroir.app, « / » ouvre l'admin (middleware.ts) : il faut
 * l'adresse complète du site. Sans BACKOFFICE_HOST (preprod, aperçus,
 * développement), site et admin partagent le domaine : « / » suffit.
 */
export function siteUrlFor(
  backofficeHost = process.env.BACKOFFICE_HOST,
  siteHost = process.env.SITE_HOST,
): string {
  if (!backofficeHost?.trim()) return '/'
  return `https://${siteHost?.trim() || DEFAULT_SITE_HOST}/`
}
