// pages/ventes/[token].tsx — la salle d'une vente privée. Le lien suffit
// pour la voir (avec son mot de passe s'il en a un) ; il faut un compte
// Tiroir pour enchérir. Le vendeur y retrouve ses outils : le lien à
// envoyer, son prix de réserve, « Retirer » et « Marquer Remis ».
//
// Rien de ce qu'on écrit au vendeur n'apparaît sur cette page : « Contacter
// le vendeur », près du prix, ouvre une conversation PRIVÉE, avec ou sans
// compte (components/messaging/ContactSeller), lue dans /messages. L'ancien
// fil public sous la vente a été retiré.
//
// Sans paiement : à la fin, Tiroir affiche le meilleur enchérisseur,
// vendeur et acheteur s'arrangent. Ce que voit un invité est composé par
// lib/auctionServer.ts : ni emplacement, ni notes, ni prix de réserve.
import type { GetServerSidePropsContext } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState, type FormEvent } from 'react'
import HeaderApp from '../../components/layout/HeaderApp'
import HeaderTiroirWeb from '../../components/layout/HeaderTiroirWeb'
import FooterTiroirWeb from '../../components/layout/FooterTiroirWeb'
import ContactSeller from '../../components/messaging/ContactSeller'
import { adminSupabase, serverSupabase } from '../../lib/supabase'
import { hasSignedCookie } from '../../lib/shareCookieSignature'
import { auctionsEnabled, timeLeft } from '../../lib/auction'
import { auctionCookieKey, loadAuctionByToken, loadAuctionView, type AuctionView, type Person } from '../../lib/auctionServer'
import { messagingReady } from '../../lib/messagingServer'
import { fill, intlLocale, useCopy } from '../../locales'

type Props = { token: string; view: AuctionView | null; gated: boolean; loggedIn: boolean; canContact: boolean }

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  ctx.res.setHeader('X-Robots-Tag', 'noindex, nofollow')
  if (!auctionsEnabled()) return { notFound: true as const }
  const token = String(ctx.params?.token ?? '').trim()
  const admin = adminSupabase()
  const auction = await loadAuctionByToken(admin, token)
  if (!auction) return { notFound: true as const }

  let viewerId: string | null = null
  try {
    const { data } = await serverSupabase(ctx).auth.getUser()
    viewerId = data.user?.id ?? null
  } catch {
    viewerId = null
  }

  // Lien protégé : rien de la vente n'est chargé avant le mot de passe (le vendeur en est dispensé).
  const cookieKey = auctionCookieKey(token)
  if (viewerId !== auction.user_id && auction.password_hash && !hasSignedCookie(cookieKey, ctx.req, auction.password_hash)) {
    return { props: { token, view: null, gated: true, loggedIn: viewerId !== null, canContact: false } }
  }
  // Sans les tables de la messagerie en base, la vente s'affiche sans « Contacter le vendeur ».
  const [view, canContact] = await Promise.all([loadAuctionView(admin, auction, viewerId), messagingReady(admin)])
  return { props: { token, view, gated: false, loggedIn: viewerId !== null, canContact } }
}

function Avatar({ who }: { who: Person }) {
  return who.avatarUrl
    ? <img src={who.avatarUrl} alt="" width={28} height={28} style={{ borderRadius: 999, objectFit: 'cover', flexShrink: 0 }} />
    : (
      <span aria-hidden="true" style={{ width: 28, height: 28, borderRadius: 999, background: 'var(--beige)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
        {(who.firstName || '?').charAt(0).toUpperCase()}
      </span>
    )
}

export default function AuctionPage({ token, view, gated, loggedIn, canContact }: Props) {
  const router = useRouter()
  const { t: { inventory: { auction: t }, share, layout, messages: { contact: tm } }, locale } = useCopy()
  const [password, setPassword] = useState('')
  const [passwordWrong, setPasswordWrong] = useState(false)
  const [amount, setAmount] = useState('')
  const [bidError, setBidError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [manageFailed, setManageFailed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [photo, setPhoto] = useState(0)
  const [now, setNow] = useState<number | null>(null)

  const refresh = () => router.replace(router.asPath, undefined, { scroll: false })
  const open = view?.state === 'open'

  // L'heure tourne côté navigateur ; tant que la vente est ouverte et l'onglet
  // visible, les offres des autres arrivent toutes les vingt secondes.
  useEffect(() => {
    setNow(Date.now())
    if (!open) return
    const tick = setInterval(() => setNow(Date.now()), 30_000)
    const poll = setInterval(() => { if (document.visibilityState === 'visible') void refresh() }, 20_000)
    return () => { clearInterval(tick); clearInterval(poll) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function call(body: Record<string, unknown>) {
    const res = await fetch(`/api/auctions/${encodeURIComponent(token)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    return { ok: res.ok, error: (data.error as string | undefined) ?? null }
  }

  async function unlock(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy('password')
    setPasswordWrong(false)
    const r = await call({ action: 'verify', password }).catch(() => ({ ok: false, error: null }))
    setBusy(null)
    if (r.ok) void refresh()
    else setPasswordWrong(true)
  }

  async function bid(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy('bid')
    setBidError(null)
    const r = await call({ action: 'bid', amount }).catch(() => ({ ok: false, error: null }))
    setBusy(null)
    if (r.ok) setAmount('')
    else setBidError((t.bidErrors as Record<string, string>)[r.error ?? ''] ?? t.bidErrors.generic)
    // Réussie ou dépassée : dans les deux cas l'état de la vente a bougé.
    void refresh()
  }

  async function manage(action: 'cancel' | 'handed_over', confirmText: string) {
    if (busy || !window.confirm(confirmText)) return
    setBusy(action)
    setManageFailed(false)
    const r = await call({ action }).catch(() => ({ ok: false, error: null }))
    setBusy(null)
    if (r.ok) void refresh()
    else setManageFailed(true)
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href.split('?')[0])
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* le lien reste dans la barre d'adresse */ }
  }

  const Header = loggedIn ? HeaderApp : HeaderTiroirWeb
  const loginHref = `/login?next=${encodeURIComponent(`/ventes/${token}`)}`

  if (gated || !view) {
    return (
      <>
        <Head>
          <title>{`${t.passwordTitle} — Tiroir`}</title>
          <meta name="robots" content="noindex,nofollow" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
        <div className="root">
          <Header />
          <main className="gate">
            <form className="panel" onSubmit={unlock}>
              <h1>{t.passwordTitle}</h1>
              <p>{t.passwordPrompt}</p>
              <label htmlFor="auction-gate">{t.passwordField}</label>
              <input id="auction-gate" type="password" value={password} onChange={e => setPassword(e.target.value)} autoFocus />
              <div role="status" aria-live="polite">{passwordWrong && <p className="alert">{t.passwordWrong}</p>}</div>
              <button type="submit" className="primary" disabled={busy !== null || !password}>{t.passwordSubmit}</button>
            </form>
          </main>
          <FooterTiroirWeb />
        </div>
        <style jsx>{`
          * { box-sizing: border-box; }
          .root { min-height: 100vh; background: var(--beige-2); font-family: var(--font-body); color: var(--ink); display: flex; flex-direction: column; }
          .gate { flex: 1; display: flex; align-items: flex-start; justify-content: center; padding: 64px 16px; }
          .panel { width: 100%; max-width: 400px; background: var(--white); border: 1px solid var(--border-light); border-radius: var(--radius); padding: 24px; }
          h1 { font-size: 22px; margin: 0 0 8px; }
          p { margin: 0 0 16px; font-size: 14px; color: var(--muted); line-height: 1.45; }
          label { display: block; font-size: 13px; font-weight: 700; margin-bottom: 6px; }
          input { width: 100%; min-height: 44px; padding: 0 12px; border-radius: 10px; border: 1.5px solid var(--border); font: inherit; font-size: 16px; margin-bottom: 14px; }
          .alert { margin: 0 0 14px; padding: 10px 14px; border-radius: 10px; border: 1.5px solid var(--orange); color: var(--ink); }
          .primary { width: 100%; min-height: 46px; border-radius: 10px; border: 0; background: var(--orange); color: var(--white); font: inherit; font-size: 15px; font-weight: 700; cursor: pointer; }
          button:disabled { opacity: 0.5; cursor: default; }
          input:focus-visible, button:focus-visible { outline: 2px solid var(--orange); outline-offset: 2px; }
        `}</style>
      </>
    )
  }

  const money = (n: number) => n.toLocaleString(intlLocale(locale), { style: 'currency', currency: view.currency, maximumFractionDigits: n % 1 ? 2 : 0 })
  const day = (iso: string) => new Date(iso).toLocaleDateString(intlLocale(locale), { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
  const attrLabel = (key: string) => (share.attrs as Record<string, string>)[key] ?? key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')
  const left = now === null ? null : timeLeft(view.endsAt, now)
  const leftText = left
    ? [left.days ? fill(t.days, { n: left.days }) : '', left.days || left.hours ? fill(t.hours, { n: left.hours }) : '', left.days ? '' : fill(t.minutes, { n: left.minutes })].filter(Boolean).join(' ')
    : ''
  const top = view.bids.length ? Math.max(...view.bids.map(b => b.amount)) : null
  const photos = view.lots.flatMap(l => l.photos.map(src => ({ src, title: l.title })))
  const current = photos[photo] ?? null
  const isSeller = view.viewer === 'seller'
  const leading = view.bids.find(b => b.amount === top)?.mine ?? false
  const iBid = view.bids.some(b => b.mine)

  return (
    <>
      <Head>
        <title>{fill(t.metaTitle, { title: view.title })}</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="root">
        <Header />
        <main className="main">
          {isSeller && <Link href="/ventes" legacyBehavior passHref><a className="back-link">{t.back}</a></Link>}
          <p className="kicker">{t.privateSale} · {fill(t.soldBy, { name: view.seller.firstName })}</p>
          <h1 className="page-title">{view.title}</h1>

          <div className="layout">
            <div className="left">
              <div className="photo">
                {current ? <img src={current.src} alt={fill(t.photoAlt, { n: photo + 1, title: current.title })} /> : <span aria-hidden="true">📦</span>}
              </div>
              {photos.length > 1 && (
                <div className="thumbs">
                  {photos.map((p, i) => (
                    <button key={i} type="button" className={i === photo ? 'on' : ''} aria-pressed={i === photo} aria-label={fill(t.photoAlt, { n: i + 1, title: p.title })} onClick={() => setPhoto(i)}>
                      <img src={p.src} alt="" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}

              {view.lots.map(lot => (
                <div key={lot.id} className="block">
                  <h2>{lot.title}{lot.quantity > 1 ? ` ×${lot.quantity}` : ''}</h2>
                  {lot.description && <p className="text">{lot.description}</p>}
                  {Object.keys(lot.attributes).length > 0 && (
                    <dl className="attrs">
                      {Object.entries(lot.attributes).map(([k, v]) => <div key={k} className="row"><dt>{attrLabel(k)}</dt><dd>{v}</dd></div>)}
                    </dl>
                  )}
                </div>
              ))}
            </div>

            <div className="right">
              <div className="block price">
                <span className={`state state-${view.state}`}>{t.state[view.state]}</span>
                <p className="price-label">{top !== null ? t.currentPrice : t.startPrice}</p>
                <p className="amount">{money(top ?? view.startPrice)}</p>
                <p className="meta">
                  {view.bids.length === 0 ? t.noBid : fill(view.bids.length === 1 ? t.bidsOne : t.bidsOther, { n: view.bids.length })}
                  {open && leftText ? ` · ${fill(t.endsIn, { time: leftText })}` : ''}
                  {!open && view.state !== 'cancelled' ? ` · ${fill(t.endedOn, { date: day(view.endsAt) })}` : ''}
                </p>
                {view.hasReserve && view.bids.length > 0 && open && (
                  <p className={`reserve ${view.reserveMet ? 'met' : ''}`}>{view.reserveMet ? t.reserveMet : t.reserveNotMet}</p>
                )}
                {open && !isSeller && iBid && <p className={`standing ${leading ? 'lead' : ''}`}>{leading ? t.leading : t.outbid}</p>}

                {view.state === 'won' && view.winner && (
                  <div className="result">
                    <p>{view.winner.mine ? fill(t.youWon, { amount: money(view.winner.amount) }) : fill(t.wonBy, { name: view.winner.who.firstName, amount: money(view.winner.amount) })}</p>
                    {(view.winner.mine || isSeller) && <p className="hint">{t.wonHint}</p>}
                  </div>
                )}
                {view.state === 'handed' && <p className="result">{t.handedText}</p>}
                {view.state === 'unsold' && <p className="result">{t.unsoldText}</p>}
                {view.state === 'cancelled' && <p className="result">{t.cancelledText}</p>}

                {open && view.viewer === 'guest' && (
                  <form onSubmit={bid} className="bid">
                    <label htmlFor="auction-bid">{t.yourBid}</label>
                    <div className="bid-row">
                      <div className="money">
                        <input
                          id="auction-bid" type="text" inputMode="decimal" value={amount}
                          placeholder={String(view.nextBid)} aria-describedby="auction-bid-min"
                          onChange={e => setAmount(e.target.value.replace(/[^\d.,\s]/g, ''))}
                        />
                        <span aria-hidden="true">{view.currency === 'EUR' ? '€' : view.currency}</span>
                      </div>
                      <button type="submit" className="primary" disabled={busy !== null || !amount.trim()}>{busy === 'bid' ? t.bidding : t.bid}</button>
                    </div>
                    <p className="hint" id="auction-bid-min">{fill(t.minimum, { amount: money(view.nextBid) })}</p>
                    <div role="status" aria-live="polite">{bidError && <p className="alert">{bidError}</p>}</div>
                  </form>
                )}
                {open && view.viewer === 'anonymous' && (
                  <div className="signin">
                    <Link href={loginHref} legacyBehavior passHref><a className="primary link">{t.signInToBid}</a></Link>
                    <p className="hint">{t.signInHint} <Link href={`/inscription?next=${encodeURIComponent(`/ventes/${token}`)}`} legacyBehavior passHref><a>{t.createAccount}</a></Link></p>
                  </div>
                )}
                {canContact && !isSeller && view.state !== 'cancelled' && (
                  <ContactSeller token={token} sellerName={view.seller.firstName} loggedIn={loggedIn} />
                )}
              </div>

              {isSeller && (
                <div className="block">
                  <h2>{t.sellerTools}</h2>
                  <p className="hint">{view.reservePrice !== null ? fill(t.reserveIs, { amount: money(view.reservePrice) }) : t.noReserve}</p>
                  <div className="tools">
                    {view.state !== 'cancelled' && <button type="button" className="ghost" onClick={copyLink}>{copied ? t.copied : t.copyLink}</button>}
                    {view.state === 'won' && view.winner && (
                      <button type="button" className="primary" disabled={busy !== null} onClick={() => manage('handed_over', fill(t.markHandedConfirm, { name: view.winner?.who.firstName ?? '' }))}>
                        {t.markHanded}
                      </button>
                    )}
                    {open && view.bids.length === 0 && (
                      <button type="button" className="text-btn" disabled={busy !== null} onClick={() => manage('cancel', t.withdrawConfirm)}>{t.withdraw}</button>
                    )}
                    {view.state === 'unsold' && (
                      <button type="button" className="ghost" disabled={busy !== null} onClick={() => manage('cancel', t.withdrawUnsold)}>{t.withdrawUnsold}</button>
                    )}
                  </div>
                  <div role="status" aria-live="polite">{manageFailed && <p className="alert">{t.manageFailed}</p>}</div>
                </div>
              )}

              {isSeller && canContact && (
                <div className="block">
                  <h2>{layout.navMessages}</h2>
                  <p className="hint">{tm.sellerHint}</p>
                  <div className="tools">
                    <Link href="/messages" legacyBehavior passHref><a className="ghost link">{tm.sellerLink}</a></Link>
                  </div>
                </div>
              )}

              {view.bids.length > 0 && (
                <div className="block">
                  <h2>{t.bidsTitle}</h2>
                  <ol className="bids">
                    {view.bids.map(b => (
                      <li key={b.id}>
                        <Avatar who={b.who} />
                        <span className="who">{b.who.firstName}{b.mine ? ` (${t.you})` : ''}</span>
                        <span className="when">{day(b.at)}</span>
                        <span className="bid-amount">{money(b.amount)}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

            </div>
          </div>
        </main>
        <FooterTiroirWeb />
      </div>

      <style jsx>{`
        * { box-sizing: border-box; }
        .root { min-height: 100vh; background: var(--beige-2); font-family: var(--font-body); color: var(--ink); display: flex; flex-direction: column; }
        .main { flex: 1; width: 100%; max-width: 1120px; margin: 0 auto; padding: 32px 16px 64px; }
        .back-link { display: inline-block; font-size: 14px; color: var(--muted); text-decoration: none; font-weight: 600; margin-bottom: 16px; }
        .kicker { margin: 0 0 6px; font-size: 13px; font-weight: 600; color: var(--muted); }
        .page-title { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.2; margin: 0 0 24px; overflow-wrap: anywhere; }
        .layout { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 28px; align-items: start; }
        .photo { aspect-ratio: 4 / 3; background: var(--white); border: 1px solid var(--border-light); border-radius: var(--radius); overflow: hidden; display: flex; align-items: center; justify-content: center; font-size: 48px; margin-bottom: 10px; }
        .photo img { width: 100%; height: 100%; object-fit: contain; display: block; }
        .thumbs { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; margin-bottom: 14px; }
        .thumbs button { flex: none; width: 64px; height: 64px; padding: 0; border: 2px solid transparent; border-radius: 10px; overflow: hidden; background: var(--beige); cursor: pointer; }
        .thumbs button.on { border-color: var(--orange); }
        .thumbs img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .block { background: var(--white); border: 1px solid var(--border-light); border-radius: var(--radius); padding: 16px 18px; margin-bottom: 14px; }
        h2 { font-size: 15px; font-weight: 700; margin: 0 0 10px; }
        .text { margin: 0; font-size: 15px; line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere; }
        .attrs { margin: 12px 0 0; display: grid; grid-template-columns: auto 1fr; gap: 6px 16px; font-size: 14px; }
        .row { display: contents; }
        dt { color: var(--muted); }
        dd { margin: 0; text-align: right; overflow-wrap: anywhere; }
        .state { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; background: var(--beige); color: var(--ink); margin-bottom: 12px; }
        .state-open { background: #F0FDF4; color: #166534; }
        .state-won, .state-handed { background: #FFFBEB; color: #92400E; }
        .price-label { margin: 0; font-size: 13px; font-weight: 600; color: var(--muted); }
        .amount { margin: 2px 0 4px; font-size: 36px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.1; font-variant-numeric: tabular-nums; }
        .meta { margin: 0; font-size: 14px; color: var(--muted); }
        .reserve { margin: 8px 0 0; font-size: 13px; font-weight: 600; color: var(--muted); }
        .reserve.met { color: #166534; }
        .standing { margin: 8px 0 0; font-size: 14px; font-weight: 700; color: var(--orange-700); }
        .standing.lead { color: #166534; }
        .result { margin: 14px 0 0; font-size: 15px; font-weight: 600; line-height: 1.45; }
        .result p { margin: 0; }
        .hint { margin: 6px 0 0; font-size: 13px; font-weight: 400; line-height: 1.45; color: var(--muted); }
        .hint a { color: var(--orange-700); font-weight: 600; }
        .bid, .signin { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border-light); }
        label { display: block; font-size: 13px; font-weight: 700; margin-bottom: 6px; }
        .bid-row { display: flex; gap: 10px; }
        .money { flex: 1; display: flex; align-items: center; gap: 8px; min-width: 0; }
        .money span { font-weight: 700; }
        input[type='text'], textarea { width: 100%; min-width: 0; min-height: 46px; padding: 10px 12px; border-radius: 10px; border: 1.5px solid var(--border); background: var(--white); color: var(--ink); font: inherit; font-size: 16px; }
        textarea { resize: vertical; line-height: 1.4; }
        .primary { min-height: 46px; padding: 0 20px; border-radius: 10px; border: 0; background: var(--orange); color: var(--white); font: inherit; font-size: 15px; font-weight: 700; cursor: pointer; flex-shrink: 0; }
        .primary.link { display: flex; align-items: center; justify-content: center; text-decoration: none; }
        .ghost.link { display: inline-flex; align-items: center; text-decoration: none; }
        .ghost { min-height: 44px; padding: 0 16px; border-radius: 10px; border: 1.5px solid var(--orange); background: transparent; color: var(--orange-700); font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
        .text-btn { min-height: 44px; padding: 0 4px; border: 0; background: none; font: inherit; font-size: 14px; font-weight: 600; color: var(--muted); text-decoration: underline; cursor: pointer; }
        .tools { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
        .alert { margin: 10px 0 0; padding: 10px 14px; border-radius: 10px; border: 1.5px solid var(--orange); font-size: 14px; }
        .bids { display: block; list-style: none; margin: 0; padding: 0; }
        .bids li { display: flex; align-items: center; gap: 10px; padding: 7px 0; font-size: 14px; }
        .bids li + li { border-top: 1px solid var(--border-light); }
        .who { font-weight: 600; margin: 0; font-size: 14px; }
        .when { font-size: 12px; font-weight: 400; color: var(--muted); }
        .bids .when { margin-left: auto; }
        .bid-amount { font-weight: 700; font-variant-numeric: tabular-nums; min-width: 72px; text-align: right; }
        .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
        button:disabled { opacity: 0.5; cursor: default; }
        input:focus-visible, textarea:focus-visible, button:focus-visible, a:focus-visible { outline: 2px solid var(--orange); outline-offset: 2px; }
        @media (max-width: 820px) {
          .layout { grid-template-columns: minmax(0, 1fr); gap: 16px; }
          .page-title { font-size: 24px; margin-bottom: 16px; }
        }
      `}</style>
    </>
  )
}
