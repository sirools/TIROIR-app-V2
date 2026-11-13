// pages/mes-collections/objets/[id].tsx — la fiche d'un objet du
// propriétaire connecté : photos, valeur (la sienne, l'estimation et sa
// fourchette, le prix de vente), statut modifiable, caractéristiques, et
// « Mettre en vente sur Leboncoin » (Pro, Business). La fiche se modifie
// dans l'app ; ici, seul le statut change.
import type { GetServerSidePropsContext } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useState } from 'react'
import HeaderTiroirWeb from '../../../components/layout/HeaderTiroirWeb'
import FooterTiroirWeb from '../../../components/layout/FooterTiroirWeb'
import { NO_COLLECTION, normCurrency, STATUSES, STATUS_COLOR, type Status } from '../../../lib/inventory'
import { loadObject, requireOwner, type ObjectDetail } from '../../../lib/inventoryServer'
import { fill, intlLocale, useCopy } from '../../../locales'

type Props = { object: ObjectDetail; canList: boolean }

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const gate = await requireOwner(ctx)
  if ('redirect' in gate) return gate
  const object = await loadObject(gate.owner, String(ctx.params?.id ?? ''))
  if (!object) return { notFound: true as const }
  return { props: { object, canList: gate.owner.canList } }
}

/** Attributs de service (prêt), montrés ailleurs ou pas du tout. */
const HIDDEN_ATTRS = ['loaned_to', 'loan_return_date']

export default function InventoryObjectPage({ object: o, canList }: Props) {
  const { t: { inventory: ti, share }, locale } = useCopy()
  const t = ti.object
  const [status, setStatus] = useState<string | null>(o.status)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [photo, setPhoto] = useState(0)

  const qty = o.quantity ?? 1
  const currency = normCurrency(o.value_currency)
  const money = (n: number) =>
    n.toLocaleString(intlLocale(locale), { style: 'currency', currency, maximumFractionDigits: n % 1 ? 2 : 0 })
  const day = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(intlLocale(locale), { day: 'numeric', month: 'long', year: 'numeric' }) : ''
  const labelOf = (s: string | null) => (s ? (share.status as Record<string, string>)[s] ?? s : '')
  const attrLabel = (key: string) =>
    (share.attrs as Record<string, string>)[key] ?? key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')

  const back = `/mes-collections/${o.collection_id ?? NO_COLLECTION}`
  const salePrice = o.sale_price_lot ?? (o.sale_price !== null ? o.sale_price * qty : null)
  const attributes = Object.entries(o.attributes ?? {})
    .filter(([k, v]) => !HIDDEN_ATTRS.includes(k) && (typeof v === 'string' || typeof v === 'number') && String(v).trim())

  async function changeStatus(next: Status) {
    if (busy || next === status) return
    const before = status
    setBusy(true)
    setFailed(false)
    setStatus(next)
    try {
      const res = await fetch('/api/objects/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [o.id], status: next }),
      })
      if (!res.ok) throw new Error('status')
    } catch {
      setStatus(before)
      setFailed(true)
    }
    setBusy(false)
  }

  const current = o.photos[photo] ?? null

  return (
    <>
      <Head>
        <title>{`${o.title} — Tiroir`}</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="root">
        <HeaderTiroirWeb />
        <main className="main">
          <Link href={back} legacyBehavior passHref>
            <a className="back-link">← {o.collection_name ?? ti.noCollection}</a>
          </Link>

          <div className="layout">
            <div className="gallery">
              <div className="photo">
                {current ? (
                  <a href={current.full} target="_blank" rel="noopener noreferrer">
                    <img src={current.src} alt={fill(t.photoAlt, { n: photo + 1, title: o.title })} />
                  </a>
                ) : (
                  <span className="no-photo">{t.noPhoto}</span>
                )}
              </div>
              {o.photos.length > 1 && (
                <div className="thumbs">
                  {o.photos.map((p, i) => (
                    <button
                      key={i} type="button" className={i === photo ? 'on' : ''}
                      aria-label={fill(t.photoAlt, { n: i + 1, title: o.title })} aria-pressed={i === photo}
                      onClick={() => setPhoto(i)}
                    >
                      <img src={p.src} alt="" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="info">
              <h1 className="title">{o.title}</h1>
              <p className="sub">
                {qty > 1 && <span>{t.quantity} : {qty} · </span>}
                {fill(t.addedOn, { date: day(o.created_at) })}
              </p>

              <div className="block">
                <label htmlFor="object-status">{t.statusLabel}</label>
                <div className="status-row">
                  <span className="dot" style={{ background: STATUS_COLOR[status ?? ''] ?? '#9CA3AF' }} />
                  <select id="object-status" value={status ?? ''} disabled={busy} onChange={e => changeStatus(e.target.value as Status)}>
                    {status && !(STATUSES as readonly string[]).includes(status) && <option value={status}>{status}</option>}
                    {STATUSES.map(s => <option key={s} value={s}>{labelOf(s)}</option>)}
                  </select>
                </div>
                <div role="status" aria-live="polite">{failed && <p className="alert">{ti.statusFailed}</p>}</div>
                {status === 'for_sale' && o.listed_at && <p className="note">{fill(t.listedSince, { date: day(o.listed_at) })}</p>}
                {status === 'sold' && o.sold_at && (
                  <p className="note">
                    {fill(t.soldOn, { date: day(o.sold_at) })}
                    {o.sold_price !== null ? ` ${fill(t.soldFor, { price: money(o.sold_price) })}` : ''}
                  </p>
                )}
              </div>

              {(salePrice !== null || o.user_value !== null || o.market_value !== null) && (
                <div className="block">
                  <h2>{t.value}</h2>
                  <dl className="values">
                    {salePrice !== null && <><dt>{t.salePrice}</dt><dd className="strong">{money(salePrice)}</dd></>}
                    {o.user_value !== null && <><dt>{t.ownValue}</dt><dd>{money(o.user_value * qty)}</dd></>}
                    {o.market_value !== null && <><dt>{t.estimate}</dt><dd>{money(o.market_value * qty)}</dd></>}
                  </dl>
                  {o.range && (
                    <p className="note">{fill(t.estimateRange, { min: money(o.range.min * qty), max: money(o.range.max * qty) })}</p>
                  )}
                </div>
              )}

              {canList && (
                <Link
                  href={`/mes-collections/annonces?ids=${encodeURIComponent(o.id)}&from=${encodeURIComponent(`/mes-collections/objets/${o.id}`)}`}
                  legacyBehavior passHref
                >
                  <a className="primary-btn">{t.sell}</a>
                </Link>
              )}

              {o.description && (
                <div className="block">
                  <h2>{t.description}</h2>
                  <p className="text">{o.description}</p>
                </div>
              )}

              {(attributes.length > 0 || o.location_note) && (
                <div className="block">
                  <h2>{t.details}</h2>
                  <dl className="values">
                    {attributes.map(([k, v]) => <div key={k} className="pair"><dt>{attrLabel(k)}</dt><dd>{String(v)}</dd></div>)}
                    {o.location_note && <div className="pair"><dt>{t.location}</dt><dd>{o.location_note}</dd></div>}
                  </dl>
                </div>
              )}

              <p className="foot">{t.editInApp}</p>
            </div>
          </div>
        </main>
        <FooterTiroirWeb />
      </div>

      <style jsx>{`
        * { box-sizing: border-box; }
        .root { min-height: 100vh; background: var(--beige-2); font-family: var(--font-body); color: var(--ink); display: flex; flex-direction: column; }
        .main { flex: 1; width: 100%; max-width: 1120px; margin: 0 auto; padding: 32px 16px 64px; }
        .back-link { display: inline-block; font-size: 14px; color: var(--muted); text-decoration: none; font-weight: 600; margin-bottom: 20px; }
        .layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 32px; align-items: start; }
        .photo { aspect-ratio: 1; background: var(--white); border: 1px solid var(--border-light); border-radius: var(--radius); overflow: hidden; display: flex; align-items: center; justify-content: center; }
        .photo a { display: block; width: 100%; height: 100%; }
        .photo img { width: 100%; height: 100%; object-fit: contain; display: block; }
        .no-photo { color: var(--text-tertiary); font-size: 14px; }
        .thumbs { display: flex; gap: 8px; margin-top: 10px; overflow-x: auto; padding-bottom: 4px; }
        .thumbs button { flex: none; width: 68px; height: 68px; padding: 0; border: 2px solid transparent; border-radius: 10px; overflow: hidden; background: var(--beige); cursor: pointer; }
        .thumbs button.on { border-color: var(--orange); }
        .thumbs img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .title { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.2; margin: 0 0 6px; overflow-wrap: anywhere; }
        .sub { margin: 0 0 20px; font-size: 13px; color: var(--muted); }
        .block { background: var(--white); border: 1px solid var(--border-light); border-radius: var(--radius); padding: 16px 18px; margin-bottom: 14px; }
        h2, label { display: block; font-size: 13px; font-weight: 700; margin: 0 0 10px; }
        .status-row { display: flex; align-items: center; gap: 10px; }
        .dot { width: 10px; height: 10px; border-radius: 999px; flex-shrink: 0; }
        select { flex: 1; min-height: 44px; padding: 0 12px; border-radius: 10px; border: 1.5px solid var(--border); background: var(--white); color: var(--ink); font: inherit; font-size: 15px; }
        .note { margin: 10px 0 0; font-size: 13px; color: var(--muted); line-height: 1.45; }
        .alert { margin: 10px 0 0; padding: 10px 14px; border-radius: 10px; border: 1.5px solid var(--orange); font-size: 14px; }
        .values { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 8px 16px; font-size: 14px; }
        .pair { display: contents; }
        dt { color: var(--muted); }
        dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
        dd.strong { font-weight: 700; font-size: 16px; }
        .text { margin: 0; font-size: 15px; line-height: 1.55; white-space: pre-wrap; }
        .primary-btn { display: flex; align-items: center; justify-content: center; min-height: 48px; padding: 0 18px; margin-bottom: 14px; border-radius: 12px; background: var(--orange); color: var(--white); font-size: 15px; font-weight: 700; text-decoration: none; }
        .primary-btn:hover { background: var(--orange-700); }
        .foot { margin: 6px 0 0; font-size: 13px; color: var(--muted); }
        select:focus-visible, button:focus-visible, a:focus-visible { outline: 2px solid var(--orange); outline-offset: 2px; }
        @media (max-width: 760px) {
          .layout { grid-template-columns: minmax(0, 1fr); gap: 20px; }
          .title { font-size: 24px; }
        }
      `}</style>
    </>
  )
}
