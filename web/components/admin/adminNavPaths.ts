// Section active et fil d'Ariane du header admin (AdminLayout.tsx), à
// partir des sections que le serveur a choisies (lib/adminNav.ts).
//
// Ce module part dans le navigateur : n'importer ici rien de serveur
// (ni torixOwner, ni marketingAccess, ni le registre des sections).

/** Ce que reçoit le header : uniquement les sections visibles par ce compte. */
export type AdminNavSection = {
  key: string
  label: string
  href: string
  /** Fond sombre du header sur cette section (Torix Lab). */
  tone?: 'dark'
  /** Libellés des sous-pages pour le fil d'Ariane, par segment d'URL. */
  pages?: Record<string, string>
}

export type AdminNav = {
  sections: AdminNavSection[]
  account: { email: string | null }
  /** Accueil du site public : « / » tant que le back-office n'a pas son domaine. */
  siteUrl: string
}

/**
 * Section active pour un chemin : la plus longue dont l'adresse est un
 * préfixe du chemin. L'accueil (/admin) ne l'emporte donc que sur
 * lui-même et sur les pages qu'aucune autre section ne couvre.
 */
export function activeSection(sections: AdminNavSection[], path: string): AdminNavSection | null {
  let best: AdminNavSection | null = null
  for (const s of sections) {
    if ((path === s.href || path.startsWith(`${s.href}/`)) && (!best || s.href.length > best.href.length)) best = s
  }
  return best
}

export type Crumb = { label: string; href: string }

/**
 * Fil d'Ariane d'une sous-page : Back-office › Section › Sous-page…
 * Vide sur la page d'une section elle-même (le header suffit).
 */
export function breadcrumbsFor(sections: AdminNavSection[], path: string): Crumb[] {
  const section = activeSection(sections, path)
  if (!section || path === section.href) return []
  const rest = path.slice(section.href.length).split('/').filter(Boolean)
  const crumbs: Crumb[] = [{ label: 'Back-office', href: '/admin' }, { label: section.label, href: section.href }]
  let href = section.href
  for (const segment of rest) {
    href += `/${segment}`
    crumbs.push({ label: section.pages?.[segment] ?? humanize(segment), href })
  }
  return crumbs
}

function humanize(segment: string): string {
  const text = decodeURIComponent(segment).replace(/[-_]+/g, ' ').trim()
  return text.charAt(0).toUpperCase() + text.slice(1)
}
