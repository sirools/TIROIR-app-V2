// pages/messages/index.tsx — la boîte de réception : les conversations
// privées du compte, la plus récente d'abord, avec la photo et le titre de
// la vente, le prénom de l'interlocuteur, un extrait du dernier message et
// l'état lu ou non lu. Réservée au compte connecté ; rien de ce qui est
// affiché ne contient d'adresse e-mail (lib/messagingServer.ts).
import type { GetServerSidePropsContext } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect } from 'react'
import HeaderApp from '../../components/layout/HeaderApp'
import FooterTiroirWeb from '../../components/layout/FooterTiroirWeb'
import { adminSupabase, serverSupabase } from '../../lib/supabase'
import { asLocale, localePrefix } from '../../lib/localeRouting'
import { listThreads, type InboxItem } from '../../lib/messagingServer'
import { intlLocale, useCopy } from '../../locales'

type Props = { items: InboxItem[] }

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  ctx.res.setHeader('X-Robots-Tag', 'noindex, nofollow')
  ctx.res.setHeader('Cache-Control', 'private, no-store')
  // getUser() et non getSession() : le jeton est vérifié auprès de Supabase.
  const { data: { user } } = await serverSupabase(ctx).auth.getUser()
  if (!user) {
    return { redirect: { destination: `${localePrefix(asLocale(ctx.locale))}/login?next=${encodeURIComponent('/messages')}`, permanent: false } }
  }
  const { items } = await listThreads(adminSupabase(), user.id)
  return { props: { items } }
}

export default function InboxPage({ items }: Props) {
  const router = useRouter()
  const { t: { messages: { inbox: t } }, locale } = useCopy()
  const day = (iso: string) => new Date(iso).toLocaleDateString(intlLocale(locale), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  // Pas de temps réel : la liste se relit toutes les trente secondes, onglet visible.
  useEffect(() => {
    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') void router.replace(router.asPath, undefined, { scroll: false })
    }, 30_000)
    return () => clearInterval(poll)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <Head>
        <title>{t.metaTitle}</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="root">
        <HeaderApp />
        <main className="main">
          <h1>{t.title}</h1>
          <p className="intro">{t.intro}</p>
          {items.length === 0 ? <p className="empty">{t.empty}</p> : (
            <ul className="threads">
              {items.map(item => (
                <li key={item.id}>
                  <Link href={`/messages/${item.id}`} legacyBehavior passHref>
                    <a className={item.unread ? 'row unread' : 'row'}>
                      <span className="photo">
                        {item.listing?.photo ? <img src={item.listing.photo} alt="" loading="lazy" /> : <span aria-hidden="true">{item.kind === 'direct' ? '💬' : '📦'}</span>}
                      </span>
                      <span className="body">
                        <span className="top">
                          <span className="who">{item.other.name}</span>
                          <span className="when">{day(item.at)}</span>
                        </span>
                        <span className="listing">{item.kind === 'direct' ? t.direct : item.listing?.title ?? t.noListing}</span>
                        <span className="excerpt">{item.lastMine ? t.you : ''}{item.excerpt}</span>
                      </span>
                      {item.unread > 0 && <span className="dot" aria-label={t.unread}>{item.unread}</span>}
                    </a>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </main>
        <FooterTiroirWeb />
      </div>
      <style jsx>{`
        * { box-sizing: border-box; }
        .root { min-height: 100vh; background: var(--beige-2); font-family: var(--font-body); color: var(--ink); display: flex; flex-direction: column; }
        .main { flex: 1; width: 100%; max-width: 760px; margin: 0 auto; padding: 32px 16px 64px; }
        h1 { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; margin: 0 0 6px; }
        .intro { margin: 0 0 24px; font-size: 15px; color: var(--muted); line-height: 1.45; }
        .empty { margin: 0; padding: 24px; background: var(--white); border: 1px solid var(--border-light); border-radius: var(--radius); font-size: 15px; line-height: 1.5; color: var(--muted); }
        .threads { display: block; list-style: none; margin: 0; padding: 0; background: var(--white); border: 1px solid var(--border-light); border-radius: var(--radius); overflow: hidden; }
        li { display: block; }
        li + li { border-top: 1px solid var(--border-light); }
        .row { display: flex; align-items: center; gap: 14px; padding: 14px 16px; text-decoration: none; color: inherit; }
        .row:hover { background: var(--beige-2); }
        .photo { flex: none; width: 56px; height: 56px; border-radius: 10px; overflow: hidden; background: var(--beige); display: flex; align-items: center; justify-content: center; font-size: 24px; }
        .photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .top { display: flex; align-items: baseline; gap: 10px; }
        .who { font-size: 15px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .when { margin-left: auto; flex: none; font-size: 12px; color: var(--muted); }
        .listing { font-size: 13px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .excerpt { font-size: 14px; color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .unread .who { font-weight: 800; }
        .unread .excerpt { color: var(--ink); font-weight: 600; }
        .dot { flex: none; min-width: 22px; height: 22px; padding: 0 6px; border-radius: 999px; background: var(--orange); color: var(--white); font-size: 12px; font-weight: 700; line-height: 22px; text-align: center; }
        a:focus-visible { outline: 2px solid var(--orange); outline-offset: -2px; }
      `}</style>
    </>
  )
}
