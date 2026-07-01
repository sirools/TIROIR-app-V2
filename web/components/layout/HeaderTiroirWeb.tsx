import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState, useEffect } from 'react'
import React from 'react'
import { supabase } from '../../lib/supabase'

export default function HeaderTiroirWeb() {
  const router = useRouter()
  const [scrolled, setScrolled] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  useEffect(() => {
    function syncSession(session: { user: { id: string } } | null) {
      setIsLoggedIn(!!session)
      if (!session) {
        setIsAdmin(false)
        return
      }
      supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', session.user.id)
        .single()
        .then(({ data }) => setIsAdmin(!!data?.is_admin))
    }

    supabase.auth.getSession().then(({ data: { session } }) => syncSession(session))

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      syncSession(session)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function handleAuthClick() {
    if (isLoggedIn) {
      await supabase.auth.signOut()
      router.push('/')
      return
    }
    router.push('/login')
  }

  return (
    <>
      <header className={`ti-header ${scrolled ? 'scrolled' : ''}`}>
        <div className="ti-header__inner">
          {/* Logo */}
          <Link href="/" legacyBehavior passHref>
            <a className="ti-logo">
              <div className="ti-logo__box">T</div>
              <strong className="ti-logo__text">TiROiR</strong>
            </a>
          </Link>

          {/* Actions droite */}
          <nav className="ti-actions">
            {isAdmin && (
              <button
                className="appstore-nav-btn"
                type="button"
                onClick={() => router.push('/admin')}
              >
                Admin
              </button>
            )}
            {isLoggedIn && (
              <button
                className="appstore-nav-btn"
                type="button"
                onClick={() => router.push('/mes-partages')}
              >
                Mes partages
              </button>
            )}
            <a className="appstore-nav-btn" href="/pricing">
              Tarifs
            </a>
            <a
              className="appstore-nav-btn"
              href="https://apps.apple.com/app/id6751784101"
              target="_blank"
              rel="noopener noreferrer"
            >
              App Store
            </a>
            <button
              className="btn btn-primary"
              type="button"
              onClick={handleAuthClick}
            >
              {isLoggedIn ? 'Se déconnecter' : 'Se connecter'}
            </button>
          </nav>
        </div>
        <div className="ti-header__divider" />
      </header>

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
          background: #F26900;
          color: white;
          display: grid;
          place-items: center;
          font-weight: 800;
          font-size: 15px;
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
        .btn {
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
        .btn-primary {
          background: #F26900;
          color: #fff;
        }
        .btn-primary:hover { background: #D85E00; }
        .appstore-nav-btn {
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
        .appstore-nav-btn:hover { background: #f5f5f5; }

        @media (max-width: 768px) {
          .ti-header__inner { gap: 12px; }
        }
      `}</style>
    </>
  )
}
