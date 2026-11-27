// En-tête de l'espace connecté (« Mon Tiroir ») : Accueil, Collections,
// Partages, Ventes, Messages (avec sa pastille de non-lus), puis l'avatar et son menu — Profil, Abonnement,
// Réglages, Déconnexion, et tout en bas un retour discret vers le site et
// les tarifs. Le site vitrine garde son propre en-tête (HeaderTiroirWeb),
// qui montre « Mon Tiroir » à l'utilisateur connecté.
//
// Les pages qui l'affichent exigent déjà une session côté serveur : ici,
// la session ne sert qu'à montrer le nom, la photo et l'entrée Admin.
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState } from 'react'
import { supabase, signOutEverywhere } from '../../lib/supabase'
import { useCopy } from '../../locales'

/** Onglets, de gauche à droite ; `match` : les adresses qui allument l'onglet. */
const TABS = [
  { key: 'navHome', href: '/accueil', match: ['/accueil'] },
  { key: 'navCollections', href: '/mes-collections', match: ['/mes-collections'] },
  { key: 'navShares', href: '/mes-partages', match: ['/mes-partages'] },
  { key: 'navSales', href: '/ventes', match: ['/ventes'] },
  { key: 'navMessages', href: '/messages', match: ['/messages'] },
] as const

export default function HeaderApp() {
  const router = useRouter()
  const { t: { layout: t } } = useCopy()
  const [unread, setUnread] = useState(0)
  const [name, setName] = useState<string | null>(null)
  const [avatar, setAvatar] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [open, setOpen] = useState(false)
  const menu = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let alive = true
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session || !alive) return
      setName(session.user.email?.split('@')[0] ?? null)
      const { data } = await supabase
        .from('profiles').select('display_name, avatar_path, is_admin').eq('id', session.user.id).single()
      if (!alive || !data) return
      if (data.display_name) setName(data.display_name)
      setIsAdmin(!!data.is_admin)
      if (data.avatar_path) {
        const { data: signed } = await supabase.storage.from('object-images').createSignedUrl(data.avatar_path, 3600)
        if (alive && signed?.signedUrl) setAvatar(signed.signedUrl)
      }
    })
    // La page profil signale un nouveau nom : la pastille suit.
    const onProfile = (e: Event) => {
      const next = (e as CustomEvent<{ displayName?: string }>).detail?.displayName
      if (next) setName(next)
    }
    window.addEventListener('tiroir:profile-updated', onProfile)
    return () => {
      alive = false
      window.removeEventListener('tiroir:profile-updated', onProfile)
    }
  }, [])

  // Pastille de non-lus : relue à chaque changement de page (ouvrir un fil
  // le marque lu) et toutes les minutes tant que l'onglet est visible.
  useEffect(() => {
    let alive = true
    const load = () => {
      if (document.visibilityState !== 'visible') return
      fetch('/api/messages')
        .then(r => (r.ok ? r.json() : null))
        .then(d => { if (alive && d) setUnread(Number(d.unread) || 0) })
        .catch(() => { /* la pastille attendra */ })
    }
    load()
    const poll = setInterval(load, 60_000)
    router.events.on('routeChangeComplete', load)
    return () => {
      alive = false
      clearInterval(poll)
      router.events.off('routeChangeComplete', load)
    }
  }, [router.events])

  // Le menu se ferme au clic ailleurs, à Échap et au changement de page.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!menu.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const close = () => setOpen(false)
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    router.events.on('routeChangeStart', close)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
      router.events.off('routeChangeStart', close)
    }
  }, [open, router.events])

  async function signOut() {
    setOpen(false)
    // Déconnexion robuste, puis rechargement complet pour repartir d'un état propre.
    await signOutEverywhere()
    window.location.assign('/')
  }

  const path = router.pathname
  const initial = (name ?? '?').trim().charAt(0).toUpperCase() || '?'

  return (
    <header className="app-header">
      <div className="inner">
        <Link href="/accueil" legacyBehavior passHref>
          <a className="logo" aria-label={t.myTiroir}>
            <img src="/icons/app-icon.png" alt="" width={32} height={32} />
            <strong>TiROiR</strong>
          </a>
        </Link>

        <nav className="tabs" aria-label={t.appNav}>
          {TABS.map(tab => {
            const active = tab.match.some(m => path === m || path.startsWith(`${m}/`))
            return (
              <Link key={tab.key} href={tab.href} legacyBehavior passHref>
                <a className={active ? 'tab active' : 'tab'} aria-current={active ? 'page' : undefined}>
                  {t[tab.key]}
                  {tab.key === 'navMessages' && unread > 0 && (
                    <span className="badge" aria-label={t.navUnread.replace('{n}', String(unread))}>{unread > 99 ? '99+' : unread}</span>
                  )}
                </a>
              </Link>
            )
          })}
        </nav>

        <div className="account" ref={menu}>
          <button
            type="button" className="avatar" aria-haspopup="menu" aria-expanded={open}
            aria-label={name ? `${t.accountMenu} — ${name}` : t.accountMenu} onClick={() => setOpen(v => !v)}
          >
            {avatar ? <img src={avatar} alt="" /> : <span aria-hidden="true">{initial}</span>}
          </button>
          {open && (
            <div className="menu" role="menu">
              {name && <p className="who">{name}</p>}
              {/* Admin en tête : l'entrée la plus ouverte par les rares comptes qui y ont droit. */}
              {isAdmin && <a className="item" href="/admin" role="menuitem">Admin</a>}
              <Link href="/profil" legacyBehavior passHref><a className="item" role="menuitem">{t.menuProfile}</a></Link>
              <Link href="/abonnement" legacyBehavior passHref><a className="item" role="menuitem">{t.menuSubscription}</a></Link>
              <Link href="/mon-compte" legacyBehavior passHref><a className="item" role="menuitem">{t.menuSettings}</a></Link>
              <button type="button" className="item danger" role="menuitem" onClick={signOut}>{t.signOut}</button>
              <div className="quiet">
                <Link href="/" legacyBehavior passHref><a role="menuitem">{t.backToSite}</a></Link>
                <span aria-hidden="true">·</span>
                <Link href="/pricing" legacyBehavior passHref><a role="menuitem">{t.pricing}</a></Link>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        * { box-sizing: border-box; }
        .app-header { position: sticky; top: 0; z-index: 50; background: var(--white); border-bottom: 1px solid var(--border-light); font-family: var(--font-body); color: var(--ink); }
        .inner { max-width: 1152px; margin: 0 auto; padding: 0 16px; min-height: 60px; display: flex; align-items: center; gap: 24px; }
        .logo { display: flex; align-items: center; gap: 8px; text-decoration: none; color: inherit; flex-shrink: 0; }
        .logo img { border-radius: 8px; display: block; }
        .logo strong { font-size: 16px; font-weight: 800; letter-spacing: 0.2px; }
        .tabs { display: flex; align-items: stretch; gap: 4px; flex: 1; min-width: 0; overflow-x: auto; scrollbar-width: none; }
        .tabs::-webkit-scrollbar { display: none; }
        .tab { display: flex; align-items: center; min-height: 60px; padding: 0 12px; font-size: 15px; font-weight: 600; color: var(--muted); text-decoration: none; white-space: nowrap; border-bottom: 2px solid transparent; }
        .tab:hover { color: var(--ink); }
        .tab.active { color: var(--ink); border-bottom-color: var(--orange); }
        .badge { margin-left: 6px; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px; background: var(--orange); color: var(--white); font-size: 12px; font-weight: 700; line-height: 20px; text-align: center; font-variant-numeric: tabular-nums; }
        .account { position: relative; flex-shrink: 0; }
        .avatar { width: 40px; height: 40px; padding: 0; border-radius: 999px; border: 1.5px solid var(--border); background: var(--beige); color: var(--ink); font: inherit; font-size: 15px; font-weight: 700; cursor: pointer; overflow: hidden; display: flex; align-items: center; justify-content: center; }
        .avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .menu { position: absolute; right: 0; top: calc(100% + 8px); min-width: 220px; padding: 6px; background: var(--white); border: 1px solid var(--border-light); border-radius: 14px; box-shadow: 0 12px 32px rgba(0, 0, 0, 0.14); }
        .who { margin: 0; padding: 8px 12px 6px; font-size: 13px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 260px; }
        .item { display: flex; align-items: center; width: 100%; min-height: 40px; padding: 0 12px; border: 0; border-radius: 8px; background: none; font: inherit; font-size: 15px; font-weight: 500; color: var(--ink); text-decoration: none; text-align: left; cursor: pointer; }
        .item:hover { background: var(--beige); }
        .item.danger { color: var(--error); }
        .quiet { display: flex; flex-wrap: wrap; gap: 4px 8px; margin-top: 6px; padding: 10px 12px 6px; border-top: 1px solid var(--border-light); font-size: 13px; color: var(--muted); }
        .quiet a { color: var(--muted); text-decoration: none; }
        .quiet a:hover { text-decoration: underline; }
        a:focus-visible, button:focus-visible { outline: 2px solid var(--orange); outline-offset: -2px; border-radius: 8px; }
        .avatar:focus-visible { outline-offset: 2px; border-radius: 999px; }
        @media (max-width: 640px) {
          .inner { flex-wrap: wrap; gap: 0 12px; }
          .logo { min-height: 56px; }
          .logo strong { display: none; }
          .account { margin-left: auto; }
          .tabs { order: 3; flex-basis: 100%; margin: 0 -16px; padding: 0 8px; border-top: 1px solid var(--border-light); }
          .tab { min-height: 46px; font-size: 14px; padding: 0 8px; }
          .tabs { gap: 0; }
          .badge { margin-left: 4px; }
        }
      `}</style>
    </header>
  )
}
