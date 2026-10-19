// Header du back-office, commun à toutes les pages admin : posé une seule
// fois par _app.tsx autour de toute page dont getServerSideProps renvoie
// `adminNav` (lib/adminNav.ts). Il reste monté d'une page admin à l'autre.
//
// Les sections viennent du serveur, après la garde de la page : un compte
// non autorisé n'a pas de props, donc pas de header. Ce composant ne
// protège rien — les gardes serveur (lib/adminAuth.ts) restent la vraie
// protection.
//
//   gauche : logo, retour à l'accueil du back-office ;
//   centre : une entrée par section, l'active en évidence (sous-pages
//            comprises) ; sous 760 px, un menu compact ;
//   droite : retour au site public, compte et déconnexion.
// Sous le header, sur les sous-pages : fil d'Ariane.
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { ExternalLink, LogOut, Menu, X } from 'lucide-react'
import { signOutEverywhere } from '../../lib/supabase'
import { activeSection, breadcrumbsFor, type AdminNav } from './adminNavPaths'

/** Hauteur du header, hors encoche : exposée en --admin-header-h. */
const HEADER_H = 56

export default function AdminLayout({ nav, children }: { nav: AdminNav; children: ReactNode }) {
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)

  // Sur backoffice.tiroir.app, « / » est réécrit vers /admin : l'adresse
  // affichée n'est alors pas celle de la page.
  const asPath = router.asPath.split(/[?#]/)[0]
  const path = asPath.startsWith('/admin') ? asPath : router.pathname
  const active = activeSection(nav.sections, path)
  const crumbs = breadcrumbsFor(nav.sections, path)
  const home = nav.sections[0]?.href ?? '/admin'

  useEffect(() => {
    const close = () => setMenuOpen(false)
    router.events.on('routeChangeStart', close)
    return () => router.events.off('routeChangeStart', close)
  }, [router.events])

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.ah')) setMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [menuOpen])

  async function signOut() {
    setLeaving(true)
    // Comme le header du site : efface les cookies sb-* puis recharge tout.
    await signOutEverywhere()
    window.location.assign('/login')
  }

  const tabs = nav.sections.map(s => (
    <Link
      key={s.key}
      href={s.href}
      className={`ah-tab${s === active ? ' ah-tab--on' : ''}`}
      aria-current={s === active ? 'page' : undefined}
    >
      {s.label}
    </Link>
  ))

  return (
    <div className="admin-shell" style={{ '--admin-header-h': `calc(${HEADER_H}px + env(safe-area-inset-top, 0px))` } as CSSProperties}>
      <header className={`ah${active?.tone === 'dark' ? ' ah--dark' : ''}`}>
        <div className="ah-bar">
          <Link href={home} className="ah-logo" aria-label="Accueil du back-office">
            <img src="/icons/app-icon.png" alt="" width={28} height={28} />
            <strong>TiROiR</strong>
            <span className="ah-logo__sub">Back-office</span>
          </Link>

          <nav className="ah-tabs" aria-label="Sections du back-office">{tabs}</nav>

          <div className="ah-account">
            {/* <a> et non Link : le site peut être sur un autre domaine. */}
            <a className="ah-site" href={nav.siteUrl}>
              Voir le site <ExternalLink size={14} strokeWidth={1.9} aria-hidden="true" />
            </a>
            {nav.account.email && <span className="ah-email" title={nav.account.email}>{nav.account.email}</span>}
            <button type="button" className="ah-icon" onClick={signOut} disabled={leaving} aria-label="Se déconnecter" title="Se déconnecter">
              <LogOut size={18} strokeWidth={1.9} />
            </button>
            {active && <span className="ah-current">{active.label}</span>}
            <button
              type="button"
              className="ah-icon ah-burger"
              onClick={() => setMenuOpen(o => !o)}
              aria-expanded={menuOpen}
              aria-controls="ah-menu"
              aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            >
              {menuOpen ? <X size={20} strokeWidth={1.9} /> : <Menu size={20} strokeWidth={1.9} />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="ah-menu" id="ah-menu">
            <nav aria-label="Sections du back-office">{tabs}</nav>
            <a className="ah-menu__site" href={nav.siteUrl}>
              Voir le site <ExternalLink size={15} strokeWidth={1.9} aria-hidden="true" />
            </a>
            {nav.account.email && <p className="ah-menu__email">{nav.account.email}</p>}
            <button type="button" className="ah-menu__out" onClick={signOut} disabled={leaving}>
              <LogOut size={16} strokeWidth={1.9} /> Se déconnecter
            </button>
          </div>
        )}
      </header>

      {crumbs.length > 0 && (
        <nav className="ah-crumbs" aria-label="Fil d’Ariane">
          <ol>
            {crumbs.map((c, i) => (
              <li key={c.href}>
                {i < crumbs.length - 1
                  ? <Link href={c.href}>{c.label}</Link>
                  : <span aria-current="page">{c.label}</span>}
              </li>
            ))}
          </ol>
        </nav>
      )}

      {children}

      <style jsx>{`
        .ah {
          position: sticky;
          top: 0;
          z-index: 100;
          padding-top: env(safe-area-inset-top, 0px);
          background: var(--white);
          color: var(--ink);
          border-bottom: 1px solid var(--border);
          font-family: var(--font-body);
        }
        .ah--dark {
          background: var(--ink);
          color: var(--white);
          border-bottom-color: color-mix(in srgb, var(--white) 12%, transparent);
        }
        .ah-bar {
          height: ${HEADER_H}px;
          box-sizing: border-box;
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 12px;
          padding: 0 max(16px, env(safe-area-inset-right, 0px)) 0 max(16px, env(safe-area-inset-left, 0px));
        }
        .ah-bar :global(.ah-logo) {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: inherit;
          text-decoration: none;
          justify-self: start;
          min-width: 0;
        }
        .ah-bar :global(.ah-logo img) { border-radius: 7px; }
        .ah-bar :global(.ah-logo strong) { font-size: 16px; letter-spacing: 0.02em; }
        .ah-logo__sub {
          font-size: 12px;
          color: var(--muted);
          padding-left: 8px;
          border-left: 1px solid var(--border);
          white-space: nowrap;
        }
        .ah--dark .ah-logo__sub { color: var(--text-tertiary); border-left-color: color-mix(in srgb, var(--white) 20%, transparent); }

        .ah-tabs { display: flex; gap: 4px; }
        .ah :global(.ah-tab) {
          padding: 8px 16px;
          border-radius: 9px;
          color: var(--muted);
          font-weight: 700;
          font-size: 14px;
          text-decoration: none;
          white-space: nowrap;
        }
        .ah--dark :global(.ah-tab) { color: var(--text-tertiary); }
        .ah :global(.ah-tab:hover) { color: var(--ink); background: var(--beige-2); }
        .ah--dark :global(.ah-tab:hover) { color: var(--white); background: color-mix(in srgb, var(--white) 8%, transparent); }
        .ah :global(.ah-tab--on),
        .ah :global(.ah-tab--on:hover) { background: var(--orange); color: var(--white); }

        .ah-account { display: flex; align-items: center; gap: 4px; justify-self: end; min-width: 0; }
        .ah-site {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          margin-right: 8px;
          border: 1px solid var(--border);
          border-radius: 9px;
          color: inherit;
          font-size: 13px;
          font-weight: 600;
          text-decoration: none;
          white-space: nowrap;
        }
        .ah-site:hover { background: var(--beige-2); }
        .ah--dark .ah-site { border-color: color-mix(in srgb, var(--white) 20%, transparent); }
        .ah--dark .ah-site:hover { background: color-mix(in srgb, var(--white) 8%, transparent); }
        .ah-email {
          font-size: 13px;
          color: var(--muted);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 220px;
          margin-right: 4px;
        }
        .ah--dark .ah-email { color: var(--text-tertiary); }
        .ah-icon {
          width: 40px;
          height: 40px;
          display: grid;
          place-items: center;
          border: 0;
          border-radius: 10px;
          background: transparent;
          color: inherit;
          cursor: pointer;
        }
        .ah-icon:hover { background: var(--beige-2); }
        .ah--dark .ah-icon:hover { background: color-mix(in srgb, var(--white) 8%, transparent); }
        .ah-icon:disabled { opacity: 0.5; cursor: default; }
        .ah-burger { display: none; }
        .ah-current {
          display: none;
          padding: 6px 12px;
          border-radius: 999px;
          background: var(--orange);
          color: var(--white);
          font-size: 13px;
          font-weight: 700;
          white-space: nowrap;
        }

        .ah-menu {
          display: none;
          padding: 8px 16px 16px;
          border-top: 1px solid var(--border-light);
        }
        .ah--dark .ah-menu { border-top-color: color-mix(in srgb, var(--white) 12%, transparent); }
        .ah-menu nav { display: flex; flex-direction: column; gap: 4px; }
        .ah-menu :global(.ah-tab) { padding: 12px 14px; font-size: 15px; }
        .ah-menu__site {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-top: 8px;
          padding: 12px 14px;
          color: inherit;
          font-weight: 700;
          font-size: 15px;
          text-decoration: none;
        }
        .ah-menu__email { margin: 12px 0 4px; font-size: 13px; color: var(--muted); overflow-wrap: anywhere; }
        .ah-menu__out {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border: 1px solid var(--border);
          border-radius: 10px;
          background: transparent;
          color: inherit;
          font-weight: 600;
          font-size: 14px;
          cursor: pointer;
        }

        .ah-crumbs {
          padding: 10px 16px 0;
          font-family: var(--font-body);
          font-size: 13px;
          color: var(--muted);
        }
        .ah-crumbs ol { display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; list-style: none; }
        .ah-crumbs li { display: inline; margin: 0; }
        .ah-crumbs li + li::before { content: '›'; margin-right: 6px; color: var(--text-tertiary); }
        .ah-crumbs :global(a) { color: inherit; text-decoration: none; }
        .ah-crumbs :global(a:hover) { color: var(--ink); text-decoration: underline; }
        .ah-crumbs span { color: var(--ink); }

        @media (max-width: 760px) {
          .ah-bar { grid-template-columns: 1fr auto; }
          .ah-tabs, .ah-email, .ah-site, .ah-account > .ah-icon:not(.ah-burger) { display: none; }
          .ah-burger { display: grid; }
          .ah-current { display: inline-block; }
          .ah-menu { display: block; }
        }
        @media (max-width: 1000px) and (min-width: 761px) {
          .ah-email { display: none; }
        }
        @media (max-width: 380px) {
          .ah-logo__sub { display: none; }
        }
      `}</style>
    </div>
  )
}
