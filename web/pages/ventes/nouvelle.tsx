// pages/ventes/nouvelle.tsx — « Mettre aux enchères » : le propriétaire
// ouvre une vente privée sur un objet ou un lot coché dans une collection.
// Prix de départ, prix de réserve facultatif, durée, mot de passe
// facultatif ; à la création, il reçoit le lien à envoyer à ses invités.
import type { GetServerSidePropsContext } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState, type FormEvent } from 'react'
import HeaderApp from '../../components/layout/HeaderApp'
import FooterTiroirWeb from '../../components/layout/FooterTiroirWeb'
import { auctionsEnabled, DURATIONS, MAX_LOT, parseNewAuction, TITLE_MAX } from '../../lib/auction'
import { safeBack } from '../../lib/inventory'
import { parseIds } from '../../lib/listing'
import { requireOwner } from '../../lib/inventoryServer'
import { fill, useCopy } from '../../locales'

type Lot = { id: string; title: string; thumb: string | null }
type Props = { lots: Lot[]; back: string }

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  if (!auctionsEnabled()) return { notFound: true as const }
  const gate = await requireOwner(ctx)
  if ('redirect' in gate) return gate
  const { admin, userId } = gate.owner
  const ids = parseIds(ctx.query.ids).slice(0, MAX_LOT)
  if (ids.length === 0) return { redirect: { destination: '/ventes', permanent: false } }

  const [{ data: rows }, { data: images }] = await Promise.all([
    admin.from('objects').select('id, title, status').in('id', ids).eq('user_id', userId),
    admin.from('object_images').select('object_id, storage_path').in('object_id', ids).eq('user_id', userId).eq('is_cover', true),
  ])
  const paths = (images ?? []).map(i => i.storage_path as string)
  const signed = new Map<string, string>()
  if (paths.length) {
    const { data } = await admin.storage.from('object-images').createSignedUrls(paths, 3600)
    for (const s of data ?? []) if (s.path && s.signedUrl) signed.set(s.path, s.signedUrl)
  }
  const byId = new Map((rows ?? []).map(o => [o.id as string, o]))
  const lots: Lot[] = ids.flatMap(id => {
    const o = byId.get(id)
    if (!o) return []
    const path = (images ?? []).find(i => i.object_id === id)?.storage_path as string | undefined
    return [{ id, title: o.title as string, thumb: (path && signed.get(path)) || null }]
  })
  return { props: { lots, back: safeBack(ctx.query.from) } }
}

export default function NewAuctionPage({ lots, back }: Props) {
  const router = useRouter()
  const { t: { inventory: { auction: t } } } = useCopy()
  const [title, setTitle] = useState(() => lots.map(l => l.title).join(', ').slice(0, TITLE_MAX))
  const [startPrice, setStartPrice] = useState('')
  const [reservePrice, setReservePrice] = useState('')
  const [days, setDays] = useState<number>(7)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const digits = (v: string) => v.replace(/[^\d.,\s]/g, '')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    const body = { ids: lots.map(l => l.id), title, startPrice, reservePrice, days, password }
    const parsed = parseNewAuction(body)
    if (!parsed.ok) {
      setError(t.errors[parsed.error])
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/auctions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.token) {
        router.push(`/ventes/${data.token}`)
        return
      }
      const known = (t.errors as Record<string, string>)[data.field ?? data.error]
      setError(known ?? t.errors.generic)
    } catch {
      setError(t.errors.generic)
    }
    setBusy(false)
  }

  return (
    <>
      <Head>
        <title>{`${t.newTitle} — Tiroir`}</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="root">
        <HeaderApp />
        <main className="main">
          <Link href={back} legacyBehavior passHref><a className="back-link">{t.back}</a></Link>
          <h1 className="page-title">{t.newTitle}</h1>
          <p className="intro">{t.newIntro}</p>

          <form className="card" onSubmit={submit} noValidate>
            <div className="field">
              <span className="label">{t.lotLabel}</span>
              <ul className="lots">
                {lots.map(l => (
                  <li key={l.id}>
                    <span className="thumb">{l.thumb ? <img src={l.thumb} alt="" /> : <span aria-hidden="true">📦</span>}</span>
                    <span>{l.title}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="field">
              <label htmlFor="auction-title">{t.titleLabel}</label>
              <input id="auction-title" type="text" maxLength={TITLE_MAX} value={title} onChange={e => setTitle(e.target.value)} />
            </div>

            <div className="pair">
              <div className="field">
                <label htmlFor="auction-start">{t.startLabel}</label>
                <div className="money">
                  <input id="auction-start" type="text" inputMode="decimal" value={startPrice} onChange={e => setStartPrice(digits(e.target.value))} />
                  <span aria-hidden="true">€</span>
                </div>
              </div>
              <div className="field">
                <label htmlFor="auction-reserve">{t.reserveLabel} <span className="opt">({t.optional})</span></label>
                <div className="money">
                  <input id="auction-reserve" type="text" inputMode="decimal" value={reservePrice} onChange={e => setReservePrice(digits(e.target.value))} aria-describedby="auction-reserve-hint" />
                  <span aria-hidden="true">€</span>
                </div>
              </div>
            </div>
            <p className="hint" id="auction-reserve-hint">{t.reserveHint}</p>

            <fieldset className="field">
              <legend>{t.durationLabel}</legend>
              <div className="segmented">
                {DURATIONS.map(d => (
                  <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)}>
                    {fill(d === 1 ? t.durationDay : t.durationDays, { n: d })}
                  </button>
                ))}
              </div>
            </fieldset>

            <div className="field">
              <label htmlFor="auction-password">{t.passwordLabel} <span className="opt">({t.optional})</span></label>
              <input id="auction-password" type="text" autoComplete="off" maxLength={100} value={password} onChange={e => setPassword(e.target.value)} aria-describedby="auction-password-hint" />
              <p className="hint" id="auction-password-hint">{t.passwordHint}</p>
            </div>

            <div role="status" aria-live="polite">{error && <p className="alert">{error}</p>}</div>
            <button type="submit" className="primary" disabled={busy || lots.length === 0}>{busy ? t.creating : t.create}</button>
          </form>
        </main>
        <FooterTiroirWeb />
      </div>
      <style jsx>{`
        * { box-sizing: border-box; }
        .root { min-height: 100vh; background: var(--beige-2); font-family: var(--font-body); color: var(--ink); display: flex; flex-direction: column; }
        .main { flex: 1; width: 100%; max-width: 680px; margin: 0 auto; padding: 32px 16px 64px; }
        .back-link { display: inline-block; font-size: 14px; color: var(--muted); text-decoration: none; font-weight: 600; margin-bottom: 20px; }
        .page-title { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.2; margin: 0 0 8px; }
        .intro { font-size: 15px; line-height: 1.5; color: var(--muted); margin: 0 0 20px; max-width: 60ch; }
        .card { background: var(--white); border: 1px solid var(--border-light); border-radius: var(--radius); padding: 20px; }
        .field { margin: 0 0 16px; padding: 0; border: 0; min-width: 0; }
        label, .label, legend { display: block; font-size: 13px; font-weight: 700; margin-bottom: 6px; padding: 0; }
        .opt { font-weight: 400; color: var(--muted); }
        input[type='text'] { width: 100%; min-height: 44px; padding: 0 12px; border-radius: 10px; border: 1.5px solid var(--border); background: var(--white); color: var(--ink); font: inherit; font-size: 16px; }
        .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .money { display: flex; align-items: center; gap: 8px; }
        .money span { font-weight: 700; }
        .hint { margin: -8px 0 16px; font-size: 13px; line-height: 1.45; color: var(--muted); }
        .field .hint { margin: 6px 0 0; }
        .lots { display: block; list-style: none; margin: 0; padding: 0; }
        .lots li { display: flex; align-items: center; gap: 10px; padding: 6px 0; font-size: 15px; }
        .thumb { width: 40px; height: 40px; border-radius: 8px; overflow: hidden; background: var(--beige); flex-shrink: 0; display: flex; align-items: center; justify-content: center; }
        .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .segmented { display: inline-flex; flex-wrap: wrap; border: 1.5px solid var(--border); border-radius: 10px; overflow: hidden; }
        .segmented button { min-height: 42px; padding: 0 14px; border: 0; background: var(--white); font: inherit; font-size: 14px; font-weight: 600; color: var(--muted); cursor: pointer; }
        .segmented button[aria-pressed='true'] { background: var(--beige); color: var(--ink); }
        .alert { margin: 0 0 14px; padding: 10px 14px; border-radius: 10px; border: 1.5px solid var(--orange); font-size: 14px; }
        .primary { min-height: 48px; padding: 0 22px; border-radius: 12px; border: 0; background: var(--orange); color: var(--white); font: inherit; font-size: 15px; font-weight: 700; cursor: pointer; }
        button:disabled { opacity: 0.5; cursor: default; }
        input:focus-visible, button:focus-visible, a:focus-visible { outline: 2px solid var(--orange); outline-offset: 2px; }
        @media (max-width: 520px) { .pair { grid-template-columns: 1fr; gap: 0; } .primary { width: 100%; } }
      `}</style>
    </>
  )
}
