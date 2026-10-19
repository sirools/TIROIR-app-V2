import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import React from 'react'
import { supabase, signOutEverywhere } from '../../lib/supabase'
import { appStoreUrlFor, playStoreUrlFor } from '../../lib/appLinks'
import { useCopy } from '../../locales'

function UserIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5.5 19c1.2-2.8 3.6-4.25 6.5-4.25s5.3 1.45 6.5 4.25"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function HeaderTiroirWeb() {
  const router = useRouter()
  const { t: { layout: t }, locale } = useCopy()
  const [scrolled, setScrolled] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [userName, setUserName] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [downloadOpen, setDownloadOpen] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  useEffect(() => {
    function syncSession(session: { user: { id: string; email?: string } } | null) {
      setIsLoggedIn(!!session)
      if (!session) {
        setIsAdmin(false)
        setUserName(null)
        return
      }
      setUserName(session.user.email?.split('@')[0] ?? (t.myAccount))
      supabase
        .from('profiles')
        .select('is_admin, display_name')
        .eq('id', session.user.id)
        .single()
        .then(({ data }) => {
          setIsAdmin(!!data?.is_admin)
          if (data?.display_name) setUserName(data.display_name)
        })
    }

    supabase.auth.getSession().then(({ data: { session } }) => syncSession(session))

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      syncSession(session)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  // La page profil signale les changements de nom pour que le chip reste à jour
  useEffect(() => {
    const handler = (e: Event) => {
      const name = (e as CustomEvent<{ displayName?: string }>).detail?.displayName
      if (name) setUserName(name)
    }
    window.addEventListener('tiroir:profile-updated', handler)
    return () => window.removeEventListener('tiroir:profile-updated', handler)
  }, [])

  // Bloque le scroll de la page tant que le menu mobile est ouvert
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  useEffect(() => {
    const close = () => {
      setMenuOpen(false)
      setUserMenuOpen(false)
      setDownloadOpen(false)
    }
    router.events.on('routeChangeStart', close)
    return () => router.events.off('routeChangeStart', close)
  }, [router.events])

  // Ferme le dropdown utilisateur au clic en dehors
  useEffect(() => {
    if (!userMenuOpen) return
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.ti-user')) setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [userMenuOpen])

  // Idem pour le dropdown de téléchargement
  useEffect(() => {
    if (!downloadOpen) return
    const onDown = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.ti-download')) setDownloadOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [downloadOpen])

  async function handleAuthClick() {
    setMenuOpen(false)
    setUserMenuOpen(false)
    if (isLoggedIn) {
      // Déconnexion robuste (efface les cookies sb-* sur l'hôte et ses domaines
      // parents), puis rechargement complet pour repartir d'un état propre.
      await signOutEverywhere()
      window.location.assign('/')
      return
    }
    router.push('/login')
  }

  function navigate(path: string) {
    setMenuOpen(false)
    router.push(path)
  }

  function closeMenus() {
    setMenuOpen(false)
    setDownloadOpen(false)
  }

  // L'accès Admin vit dans le menu utilisateur, pas dans la nav publique :
  // c'est une entrée de compte, pas une destination du site.
  const navItems = (
    <>
      <a className="appstore-nav-btn" href="/concept">
        Concept
      </a>
      {/* Link (et non <a>) : garde la langue en cours. */}
      <Link href="/pricing" legacyBehavior passHref>
        <a className="appstore-nav-btn">{t.pricing}</a>
      </Link>
      {/* App Store + Google Play réunis sous un seul bouton */}
      <div className="ti-download">
        <button
          className="appstore-nav-btn ti-download__btn"
          type="button"
          aria-haspopup="menu"
          aria-expanded={downloadOpen}
          onClick={() => setDownloadOpen(v => !v)}
        >
          {t.download}
          <svg
            className={`ti-download__chevron ${downloadOpen ? 'open' : ''}`}
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {downloadOpen && (
          <div className="ti-download__dropdown" role="menu">
            <a
              className="ti-download__item"
              role="menuitem"
              href={appStoreUrlFor(locale)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={closeMenus}
            >
              App Store
            </a>
            <a
              className="ti-download__item"
              role="menuitem"
              href={playStoreUrlFor(locale)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={closeMenus}
            >
              Google Play
            </a>
          </div>
        )}
      </div>
    </>
  )

  return (
    <>
      <header className={`ti-header ${scrolled ? 'scrolled' : ''}`}>
        <div className="ti-header__inner">
          {/* Logo */}
          <Link href="/" legacyBehavior passHref>
            <a className="ti-logo">
              <img className="ti-logo__box" src="/icons/app-icon.png" alt="" width={32} height={32} />
              <strong className="ti-logo__text">TiROiR</strong>
            </a>
          </Link>

          {/* Actions droite */}
          <nav className="ti-actions">
            {navItems}
            {isLoggedIn ? (
              <div className="ti-user">
                <button
                  className="ti-user__chip"
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={userMenuOpen}
                  onClick={() => setUserMenuOpen(v => !v)}
                >
                  <UserIcon />
                  <span className="ti-user__name">{userName}</span>
                  <svg
                    className={`ti-user__chevron ${userMenuOpen ? 'open' : ''}`}
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                {userMenuOpen && (
                  <div className="ti-user__dropdown" role="menu">
                    {/* Admin en tête : c'est l'entrée la plus utilisée par les
                        rares comptes qui y ont droit, et la seule qu'on ouvre
                        plusieurs fois par jour. */}
                    {isAdmin && (
                      <a className="ti-user__item" href="/admin" role="menuitem">
                        Admin
                      </a>
                    )}
                    <a className="ti-user__item" href="/profil" role="menuitem">
                      {t.myProfile}
                    </a>
                    <a className="ti-user__item" href="/mon-compte" role="menuitem">
                      {t.myAccount}
                    </a>
                    <a className="ti-user__item" href="/mes-partages" role="menuitem">
                      {t.myShares}
                    </a>
                    <button
                      className="ti-user__item ti-user__item--danger"
                      type="button"
                      role="menuitem"
                      onClick={handleAuthClick}
                    >
                      {t.signOut}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                {/* Comme sur mobile : se connecter d'abord, créer un compte
                    en second. */}
                <a className="appstore-nav-btn" href="/inscription" onClick={() => setMenuOpen(false)}>
                  {t.signUp}
                </a>
                <a
                  className="btn btn-primary"
                  href="/login"
                  style={{ textDecoration: 'none' }}
                  onClick={() => setMenuOpen(false)}
                >
                  {t.signIn}
                </a>
              </>
            )}
          </nav>

          {/* Burger mobile */}
          <button
            className="ti-burger"
            type="button"
            aria-label={t.openMenu}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" stroke="#121212" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="ti-header__divider" />
      </header>

      {/* Menu mobile plein écran */}
      {menuOpen && (
        <div className="ti-mobile-menu" role="dialog" aria-modal="true">
          <div className="ti-mobile-menu__header">
            <Link href="/" legacyBehavior passHref>
              <a className="ti-logo" onClick={() => setMenuOpen(false)}>
                <img className="ti-logo__box" src="/icons/app-icon.png" alt="" width={32} height={32} />
                <strong className="ti-logo__text">TiROiR</strong>
              </a>
            </Link>
            <button
              className="ti-mobile-menu__close"
              type="button"
              aria-label={t.closeMenu}
              onClick={() => setMenuOpen(false)}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" stroke="#121212" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <nav className="ti-mobile-menu__nav">
            {navItems}
            {isLoggedIn ? (
              <>
                <div className="ti-mobile-menu__user">
                  <UserIcon size={20} />
                  <span>{userName}</span>
                </div>
                {/* Même ordre que sur le bureau : Admin d'abord. */}
                {isAdmin && (
                  <button
                    className="appstore-nav-btn"
                    type="button"
                    onClick={() => navigate('/admin')}
                  >
                    Admin
                  </button>
                )}
                <button
                  className="appstore-nav-btn"
                  type="button"
                  onClick={() => navigate('/profil')}
                >
                  {t.myProfile}
                </button>
                <button
                  className="appstore-nav-btn"
                  type="button"
                  onClick={() => navigate('/mon-compte')}
                >
                  {t.myAccount}
                </button>
                <button
                  className="appstore-nav-btn"
                  type="button"
                  onClick={() => navigate('/mes-partages')}
                >
                  {t.myShares}
                </button>
                <button
                  className="appstore-nav-btn ti-mobile-menu__logout"
                  type="button"
                  onClick={handleAuthClick}
                >
                  {t.signOut}
                </button>
              </>
            ) : (
              <>
                {/* Mobile : se connecter d'abord (bouton principal) ; créer un
                    compte à part, pour qui n'est pas encore inscrit. */}
                <a
                  className="btn btn-primary"
                  href="/login"
                  style={{ textDecoration: 'none' }}
                  onClick={() => setMenuOpen(false)}
                >
                  {t.signIn}
                </a>
                <div className="ti-mobile-menu__signup">
                  <p className="ti-mobile-menu__signup-text">
                    {t.newHere}
                  </p>
                  <a className="appstore-nav-btn" href="/inscription" onClick={() => setMenuOpen(false)}>
                    {t.signUp}
                  </a>
                </div>
              </>
            )}
          </nav>
        </div>
      )}

      <style jsx>{`
        .ti-header {
          position: sticky;
          top: 0;
          z-index: 50;
          background: rgba(255,255,255,0.92);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          transition: box-shadow 0.2s ease;
        }
        .ti-header.scrolled {
          box-shadow: 0 1px 24px rgba(0,0,0,0.07);
        }
        .ti-header__inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 64px;
          max-width: 1200px;
          padding: 0 24px;
          margin: 0 auto;
          gap: 24px;
        }
        .ti-header__divider {
          height: 1px;
          background: rgba(0,0,0,0.06);
        }

        /* Logo */
        .ti-logo {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          text-decoration: none;
          flex-shrink: 0;
        }
        .ti-logo__box {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          display: block;
        }
        .ti-logo__text {
          font-weight: 800;
          font-size: 17px;
          color: #121212;
          letter-spacing: -0.3px;
        }

        /* Actions droite */
        .ti-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        /* Les items de nav sont rendus via une variable JSX partagée (navItems),
           que styled-jsx ne scope pas : on cible en :global() sous les conteneurs scopés. */
        .ti-actions :global(.btn),
        .ti-mobile-menu__nav :global(.btn) {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 9px 16px;
          border-radius: 10px;
          font-weight: 700;
          font-size: 14px;
          border: 0;
          cursor: pointer;
        }
        .ti-actions :global(.btn-primary),
        .ti-mobile-menu__nav :global(.btn-primary) {
          background: #F26900;
          color: #fff;
        }
        .ti-actions :global(.btn-primary:hover),
        .ti-mobile-menu__nav :global(.btn-primary:hover) { background: #D85E00; }
        .ti-actions :global(.appstore-nav-btn),
        .ti-mobile-menu__nav :global(.appstore-nav-btn) {
          display: inline-flex;
          align-items: center;
          padding: 9px 16px;
          border-radius: 10px;
          border: 1px solid rgba(0,0,0,0.12);
          background: transparent;
          color: #121212;
          font-size: 14px;
          font-weight: 600;
          text-decoration: none;
          cursor: pointer;
          transition: background 0.15s;
        }
        .ti-actions :global(.appstore-nav-btn:hover),
        .ti-mobile-menu__nav :global(.appstore-nav-btn:hover) { background: #f5f5f5; }

        /* Bouton « Télécharger l'app » + dropdown (rendu via navItems : :global) */
        .ti-actions :global(.ti-download),
        .ti-mobile-menu__nav :global(.ti-download) {
          position: relative;
        }
        .ti-actions :global(.ti-download__btn),
        .ti-mobile-menu__nav :global(.ti-download__btn) {
          gap: 6px;
        }
        .ti-actions :global(.ti-download__chevron),
        .ti-mobile-menu__nav :global(.ti-download__chevron) {
          transition: transform 0.15s;
          flex-shrink: 0;
        }
        .ti-actions :global(.ti-download__chevron.open),
        .ti-mobile-menu__nav :global(.ti-download__chevron.open) {
          transform: rotate(180deg);
        }
        .ti-actions :global(.ti-download__dropdown),
        .ti-mobile-menu__nav :global(.ti-download__dropdown) {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          min-width: 180px;
          background: #fff;
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.12);
          padding: 6px;
          display: flex;
          flex-direction: column;
          gap: 2px;
          z-index: 60;
          animation: ti-menu-in 0.15s ease;
        }
        .ti-actions :global(.ti-download__item),
        .ti-mobile-menu__nav :global(.ti-download__item) {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          border-radius: 8px;
          border: 0;
          background: none;
          font-size: 14px;
          font-weight: 600;
          color: #121212;
          text-decoration: none;
          text-align: left;
          cursor: pointer;
          transition: background 0.15s;
        }
        .ti-actions :global(.ti-download__item:hover),
        .ti-mobile-menu__nav :global(.ti-download__item:hover) { background: #f5f5f5; }
        /* Dans le menu plein écran, le dropdown devient un accordéon : il pousse
           les items suivants au lieu de les recouvrir. */
        .ti-mobile-menu__nav :global(.ti-download__btn) {
          width: 100%;
        }
        .ti-mobile-menu__nav :global(.ti-download__dropdown) {
          position: static;
          margin-top: 12px;
          padding: 0;
          gap: 12px;
          border: 0;
          box-shadow: none;
          background: none;
        }
        .ti-mobile-menu__nav :global(.ti-download__item) {
          justify-content: center;
          padding: 14px 16px;
          font-size: 16px;
          border: 1px solid rgba(0,0,0,0.12);
          border-radius: 10px;
        }

        /* Chip utilisateur + dropdown */
        .ti-user {
          position: relative;
        }
        .ti-user__chip {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          border-radius: 10px;
          border: 1px solid rgba(0,0,0,0.12);
          background: #fff;
          color: #121212;
          font-size: 14px;
          font-weight: 700;
          cursor: pointer;
          transition: background 0.15s;
        }
        .ti-user__chip:hover { background: #f5f5f5; }
        .ti-user__name {
          max-width: 140px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .ti-user__chevron {
          transition: transform 0.15s;
          flex-shrink: 0;
        }
        .ti-user__chevron.open { transform: rotate(180deg); }
        .ti-user__dropdown {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          min-width: 200px;
          background: #fff;
          border: 1px solid rgba(0,0,0,0.08);
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.12);
          padding: 6px;
          display: flex;
          flex-direction: column;
          gap: 2px;
          z-index: 60;
          animation: ti-menu-in 0.15s ease;
        }
        .ti-user__item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          border-radius: 8px;
          border: 0;
          background: none;
          font-size: 14px;
          font-weight: 600;
          color: #121212;
          text-decoration: none;
          text-align: left;
          cursor: pointer;
          transition: background 0.15s;
        }
        .ti-user__item:hover { background: #f5f5f5; }
        .ti-user__item--danger { color: #C0392B; }
        .ti-user__item--danger:hover { background: #FDECEA; }

        /* Burger */
        .ti-burger {
          display: none;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          padding: 0;
          border: 1px solid rgba(0,0,0,0.12);
          border-radius: 10px;
          background: transparent;
          cursor: pointer;
        }

        /* Menu mobile plein écran */
        .ti-mobile-menu {
          position: fixed;
          inset: 0;
          z-index: 100;
          background: #fff;
          display: flex;
          flex-direction: column;
          animation: ti-menu-in 0.18s ease;
        }
        @keyframes ti-menu-in {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .ti-mobile-menu__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 64px;
          padding: 0 24px;
          border-bottom: 1px solid rgba(0,0,0,0.06);
        }
        .ti-mobile-menu__close {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          padding: 0;
          border: 1px solid rgba(0,0,0,0.12);
          border-radius: 10px;
          background: transparent;
          cursor: pointer;
        }
        .ti-mobile-menu__nav {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 24px;
        }
        .ti-mobile-menu__nav :global(.appstore-nav-btn),
        .ti-mobile-menu__nav :global(.btn) {
          justify-content: center;
          padding: 14px 16px;
          font-size: 16px;
        }
        .ti-mobile-menu__user {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 12px;
          padding-top: 20px;
          border-top: 1px solid rgba(0,0,0,0.08);
          font-size: 15px;
          font-weight: 700;
          color: #121212;
        }
        .ti-mobile-menu__signup {
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 12px;
          padding: 16px;
          border-radius: var(--radius);
          background: var(--beige-2);
          border: 1px solid var(--border-light);
        }
        .ti-mobile-menu__signup-text {
          margin: 0;
          text-align: center;
          font-size: 14px;
          color: var(--muted);
        }
        .ti-mobile-menu__signup :global(.appstore-nav-btn) {
          background: var(--white);
        }
        .ti-mobile-menu__logout {
          color: #C0392B !important;
        }

        @media (max-width: 768px) {
          .ti-header__inner { gap: 12px; }
          .ti-actions { display: none; }
          .ti-burger { display: inline-flex; }
        }
      `}</style>
    </>
  )
}
