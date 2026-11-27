// pages/messages/[id].tsx — une conversation privée : le rappel de la vente
// en tête (photo, titre, prix), le fil dans l'ordre, le champ de réponse.
//
// Qui peut l'ouvrir : un participant, et lui seul.
//   · un compte connecté qui a sa place dans le fil ;
//   · un invité, par le lien signé de son e-mail (?k=…) : le lien confirme
//     son adresse, remet ses messages en attente, puis reste dans un
//     cookie propre à ce fil — l'adresse de la page redevient nue.
// Pour tout autre visiteur, même avec l'adresse exacte : 404 s'il est
// connecté, écran « lien plus valable » sinon. Rien du fil n'est chargé.
//
// Les textes sont affichés comme du texte (React échappe) ; aucune adresse
// e-mail n'arrive dans la page.
import type { GetServerSidePropsContext } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { serialize } from 'cookie'
import HeaderApp from '../../components/layout/HeaderApp'
import HeaderTiroirWeb from '../../components/layout/HeaderTiroirWeb'
import FooterTiroirWeb from '../../components/layout/FooterTiroirWeb'
import { adminSupabase, serverSupabase } from '../../lib/supabase'
import { asLocale, localePrefix } from '../../lib/localeRouting'
import { BODY_MAX, viewerParticipant } from '../../lib/messaging'
import { GUEST_LINK_TTL_MS, guestCookieName, readGuestToken } from '../../lib/messagingCrypto'
import { deliverPending, guestFromCookie, loadThread, loadThreadView, originOf, type ThreadView } from '../../lib/messagingServer'
import { fill, intlLocale, useCopy } from '../../locales'

type Props = { view: ThreadView | null; loggedIn: boolean; justSent: boolean; loginHref: string }

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  ctx.res.setHeader('X-Robots-Tag', 'noindex, nofollow')
  ctx.res.setHeader('Cache-Control', 'private, no-store')
  // Le lien d'un invité ne doit pas partir vers un autre site dans l'en-tête Referer.
  ctx.res.setHeader('Referrer-Policy', 'no-referrer')
  const threadId = String(ctx.params?.id ?? '').trim()
  const prefix = localePrefix(asLocale(ctx.locale))
  const path = `/messages/${threadId}`
  const admin = adminSupabase()

  let userId: string | null = null
  try {
    const { data } = await serverSupabase(ctx).auth.getUser()
    userId = data.user?.id ?? null
  } catch {
    userId = null
  }

  // Arrivée par le lien d'un e-mail : confirmer, remettre, poser le cookie, nettoyer l'adresse.
  const key = typeof ctx.query.k === 'string' ? ctx.query.k : null
  if (key) {
    const participantId = readGuestToken(threadId, key)
    const loaded = participantId ? await loadThread(admin, threadId) : null
    const guest = loaded && viewerParticipant(loaded.participants, { userId: null, guestParticipantId: participantId })
    if (loaded && guest) {
      const delivered = await deliverPending(admin, originOf(ctx.req), loaded.thread, loaded.participants, guest)
      ctx.res.setHeader('Set-Cookie', serialize(guestCookieName(threadId), key, {
        httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: Math.floor(GUEST_LINK_TTL_MS / 1000),
      }))
      return { redirect: { destination: `${prefix}${path}${delivered ? '?envoye=1' : ''}`, permanent: false } }
    }
  }

  const viewer = { userId, guestParticipantId: guestFromCookie(ctx.req, threadId) }
  const view = viewer.userId || viewer.guestParticipantId ? await loadThreadView(admin, threadId, viewer) : null
  // Connecté mais pas participant : le fil n'existe pas pour lui.
  if (!view && userId) return { notFound: true as const }
  return {
    props: {
      view, loggedIn: userId !== null, justSent: ctx.query.envoye === '1',
      loginHref: `/login?next=${encodeURIComponent(path)}`,
    },
  }
}

export default function ThreadPage({ view, loggedIn, justSent, loginHref }: Props) {
  const router = useRouter()
  const { t: { messages: { thread: t, contact: tc } }, locale } = useCopy()
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reported, setReported] = useState(view?.reported ?? false)
  const end = useRef<HTMLDivElement>(null)
  const count = view?.messages.length ?? 0

  const refresh = () => router.replace(`/messages/${view?.id ?? ''}`, undefined, { scroll: false })

  // Pas de temps réel : le fil se relit toutes les quinze secondes, onglet visible.
  useEffect(() => {
    if (!view) return
    const poll = setInterval(() => { if (document.visibilityState === 'visible') void refresh() }, 15_000)
    return () => clearInterval(poll)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view?.id])

  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }) }, [count])

  const Header = loggedIn ? HeaderApp : HeaderTiroirWeb

  if (!view) {
    return (
      <>
        <Head>
          <title>{`${t.expiredTitle} — Tiroir`}</title>
          <meta name="robots" content="noindex,nofollow" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
        <div className="root">
          <Header />
          <main className="gate">
            <div className="panel">
              <h1>{t.expiredTitle}</h1>
              <p>{t.expiredText}</p>
              <Link href={loginHref} legacyBehavior passHref><a className="primary">{t.signIn}</a></Link>
            </div>
          </main>
          <FooterTiroirWeb />
        </div>
        <style jsx>{`
          * { box-sizing: border-box; }
          .root { min-height: 100vh; background: var(--beige-2); font-family: var(--font-body); color: var(--ink); display: flex; flex-direction: column; }
          .gate { flex: 1; display: flex; align-items: flex-start; justify-content: center; padding: 64px 16px; }
          .panel { width: 100%; max-width: 420px; background: var(--white); border: 1px solid var(--border-light); border-radius: var(--radius); padding: 24px; }
          h1 { font-size: 22px; margin: 0 0 8px; }
          p { margin: 0 0 16px; font-size: 15px; color: var(--muted); line-height: 1.45; }
          .primary { display: inline-flex; align-items: center; min-height: 46px; padding: 0 20px; border-radius: 10px; background: var(--orange); color: var(--white); font-size: 15px; font-weight: 700; text-decoration: none; }
          a:focus-visible { outline: 2px solid var(--orange); outline-offset: 2px; }
        `}</style>
      </>
    )
  }

  async function call(payload: Record<string, unknown>) {
    const res = await fetch(`/api/messages/${encodeURIComponent(view!.id)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    return { ok: res.ok, error: (data.error as string | undefined) ?? null }
  }

  async function send(e: FormEvent) {
    e.preventDefault()
    if (busy || !body.trim()) return
    setBusy(true)
    setError(null)
    const r = await call({ action: 'send', body }).catch(() => ({ ok: false, error: null }))
    setBusy(false)
    if (r.ok) {
      setBody('')
      void refresh()
    } else setError(r.error === 'RATE_LIMITED' ? t.rateLimited : t.failed)
  }

  async function reportThread() {
    if (busy || !window.confirm(t.reportConfirm)) return
    const r = await call({ action: 'report' }).catch(() => ({ ok: false, error: null }))
    if (r.ok) setReported(true)
    else setError(t.failed)
  }

  const day = (iso: string) => new Date(iso).toLocaleDateString(intlLocale(locale), { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
  const listing = view.listing
  const money = (n: number, currency: string) => n.toLocaleString(intlLocale(locale), { style: 'currency', currency, maximumFractionDigits: n % 1 ? 2 : 0 })

  return (
    <>
      <Head>
        <title>{fill(t.metaTitle, { name: view.other.name })}</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="referrer" content="no-referrer" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="root">
        <Header />
        <main className="main">
          {loggedIn && <Link href="/messages" legacyBehavior passHref><a className="back-link">{t.back}</a></Link>}
          <h1>{fill(t.with, { name: view.other.name })}</h1>

          {listing && (
            <Link href={`/ventes/${listing.token}`} legacyBehavior passHref>
              <a className="listing">
                <span className="photo">{listing.photo ? <img src={listing.photo} alt="" /> : <span aria-hidden="true">📦</span>}</span>
                <span className="listing-body">
                  <span className="listing-title">{listing.title}</span>
                  <span className="listing-price">{t.price} · {money(listing.price, listing.currency)}</span>
                </span>
                <span className="listing-link">{t.viewListing}</span>
              </a>
            </Link>
          )}

          <div role="status" aria-live="polite">
            {justSent && <p className="notice">{tc.sent}</p>}
            {reported && <p className="notice">{t.reported}</p>}
          </div>

          <div className="thread">
            {view.messages.length === 0 ? <p className="hint">{t.empty}</p> : (
              <ol>
                {view.messages.map(m => (
                  <li key={m.id} className={m.mine ? 'mine' : 'theirs'}>
                    <div className="bubble">
                      <p className="text">{m.body ?? <em>{t.unreadable}</em>}</p>
                      <p className="when">{m.mine ? '' : `${view.other.name} · `}{day(m.at)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <div ref={end} />
          </div>

          <form onSubmit={send} className="reply">
            <label htmlFor="thread-reply">{t.label}</label>
            <textarea id="thread-reply" rows={3} maxLength={BODY_MAX} value={body} placeholder={t.placeholder} onChange={e => setBody(e.target.value)} />
            <div role="status" aria-live="polite">{error && <p className="alert">{error}</p>}</div>
            <div className="actions">
              <button type="submit" className="primary" disabled={busy || !body.trim()}>{busy ? t.sending : t.send}</button>
              {!reported && <button type="button" className="text-btn" onClick={reportThread}>{t.report}</button>}
            </div>
            {view.me.isGuest && <p className="hint">{fill(t.guestNote, { name: view.me.name })}</p>}
            <p className="hint">{t.private}</p>
          </form>
        </main>
        <FooterTiroirWeb />
      </div>
      <style jsx>{`
        * { box-sizing: border-box; }
        .root { min-height: 100vh; background: var(--beige-2); font-family: var(--font-body); color: var(--ink); display: flex; flex-direction: column; }
        .main { flex: 1; width: 100%; max-width: 720px; margin: 0 auto; padding: 32px 16px 64px; }
        .back-link { display: inline-block; font-size: 14px; color: var(--muted); text-decoration: none; font-weight: 600; margin-bottom: 16px; }
        h1 { font-size: 24px; font-weight: 800; letter-spacing: -0.5px; margin: 0 0 16px; overflow-wrap: anywhere; }
        .listing { display: flex; align-items: center; gap: 14px; padding: 12px 14px; margin-bottom: 14px; background: var(--white); border: 1px solid var(--border-light); border-radius: var(--radius); text-decoration: none; color: inherit; }
        .photo { flex: none; width: 64px; height: 64px; border-radius: 10px; overflow: hidden; background: var(--beige); display: flex; align-items: center; justify-content: center; font-size: 26px; }
        .photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .listing-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .listing-title { font-size: 15px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .listing-price { font-size: 14px; color: var(--muted); font-variant-numeric: tabular-nums; }
        .listing-link { flex: none; font-size: 14px; font-weight: 700; color: var(--orange-700); }
        .notice { margin: 0 0 14px; padding: 12px 14px; border-radius: 10px; background: var(--white); border: 1.5px solid var(--orange); font-size: 15px; font-weight: 600; line-height: 1.45; }
        .thread { background: var(--white); border: 1px solid var(--border-light); border-radius: var(--radius); padding: 16px; margin-bottom: 14px; }
        ol { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
        li { display: flex; }
        li.mine { justify-content: flex-end; }
        .bubble { max-width: 85%; padding: 10px 14px; border-radius: 14px; background: var(--beige); }
        .mine .bubble { background: var(--beige-2); border: 1px solid var(--border-light); }
        .text { margin: 0; font-size: 15px; line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; }
        .when { margin: 4px 0 0; font-size: 12px; color: var(--muted); }
        .reply { background: var(--white); border: 1px solid var(--border-light); border-radius: var(--radius); padding: 16px; }
        label { display: block; font-size: 13px; font-weight: 700; margin-bottom: 6px; }
        textarea { width: 100%; min-height: 46px; padding: 10px 12px; border-radius: 10px; border: 1.5px solid var(--border); background: var(--white); color: var(--ink); font: inherit; font-size: 16px; line-height: 1.4; resize: vertical; }
        .actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 12px; }
        .primary { min-height: 46px; padding: 0 20px; border-radius: 10px; border: 0; background: var(--orange); color: var(--white); font: inherit; font-size: 15px; font-weight: 700; cursor: pointer; }
        .text-btn { min-height: 44px; padding: 0 4px; border: 0; background: none; font: inherit; font-size: 14px; font-weight: 600; color: var(--muted); text-decoration: underline; cursor: pointer; }
        .hint { margin: 10px 0 0; font-size: 13px; line-height: 1.45; color: var(--muted); }
        .alert { margin: 10px 0 0; padding: 10px 14px; border-radius: 10px; border: 1.5px solid var(--orange); font-size: 14px; }
        button:disabled { opacity: 0.5; cursor: default; }
        textarea:focus-visible, button:focus-visible, a:focus-visible { outline: 2px solid var(--orange); outline-offset: 2px; }
        @media (max-width: 520px) { .listing-link { display: none; } }
      `}</style>
    </>
  )
}
