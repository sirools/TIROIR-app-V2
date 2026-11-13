// pages/mes-collections/[id].tsx — une collection du propriétaire connecté,
// comme dans l'app : grille ou liste d'objets (photo, nom, marque, valeur,
// statut), groupes, recherche, tri, filtre par statut. « Sélectionner »
// ouvre les cases à cocher (clic, Maj + clic pour une plage, Échap pour
// quitter) et une barre d'actions flottante : mettre en vente sur
// Leboncoin (Pro, Business), partager, changer le statut.
//
// `sans-collection` est la pseudo-collection des objets non rangés.
import type { GetServerSidePropsContext } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import HeaderApp from '../../components/layout/HeaderApp'
import FooterTiroirWeb from '../../components/layout/FooterTiroirWeb'
import ShareDialog from '../../components/inventory/ShareDialog'
import { MAX_LISTINGS } from '../../lib/listing'
import {
  attr, filterObjects, normCurrency, objectValue, sortObjects, toggleSelection,
  OBJECT_SORTS, STATUSES, STATUS_COLOR, type ObjectSort, type Status,
} from '../../lib/inventory'
import { loadCollection, requireOwner, type CollectionView, type ObjectCard } from '../../lib/inventoryServer'
import { fill, intlLocale, useCopy } from '../../locales'

type Props = { view: CollectionView; routeId: string; canList: boolean }

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const gate = await requireOwner(ctx)
  if ('redirect' in gate) return gate
  const routeId = String(ctx.params?.id ?? '')
  const view = await loadCollection(gate.owner, routeId)
  if (!view) return { notFound: true as const }
  return { props: { view, routeId, canList: gate.owner.canList } }
}

/** Statuts mis en avant par un badge sur la vignette. */
const BADGED = ['for_sale', 'sold']

export default function CollectionPage({ view, routeId, canList }: Props) {
  const router = useRouter()
  const { t: { inventory: t, share: { status: statusLabels } }, locale } = useCopy()
  const labelOf = (status: string | null) => (status ? (statusLabels as Record<string, string>)[status] ?? status : '')

  const [objects, setObjects] = useState<ObjectCard[]>(view.objects)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')
  const [sort, setSort] = useState<ObjectSort>('recent')
  const [layout, setLayout] = useState<'grid' | 'list'>('grid')
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const anchor = useRef<string | null>(null)
  const [statusMenu, setStatusMenu] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const name = view.collection?.name ?? t.noCollection
  const visible = useMemo(() => sortObjects(filterObjects(objects, { query, status }), sort), [objects, query, status, sort])

  // Groupes de la collection, puis « Hors groupes » ; sans groupe, une seule section sans titre.
  const sections = useMemo(() => {
    if (view.groups.length === 0) return [{ id: 'all', title: null as string | null, items: visible }]
    const known = new Set(view.groups.map(g => g.id))
    return [
      ...view.groups.map(g => ({ id: g.id, title: g.name as string | null, items: visible.filter(o => o.group_id === g.id) })),
      { id: 'ungrouped', title: t.ungrouped as string | null, items: visible.filter(o => !o.group_id || !known.has(o.group_id)) },
    ].filter(s => s.items.length > 0)
  }, [view.groups, visible, t.ungrouped])
  const order = useMemo(() => sections.flatMap(s => s.items.map(o => o.id)), [sections])

  function leaveSelection() {
    setSelecting(false)
    setSelected(new Set())
    setStatusMenu(false)
    anchor.current = null
  }

  // Échap : ferme d'abord le menu ouvert, puis quitte la sélection.
  useEffect(() => {
    if (!selecting) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || sharing) return
      if (statusMenu) setStatusMenu(false)
      else leaveSelection()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selecting, statusMenu, sharing])

  function pick(id: string, e: MouseEvent) {
    // L'ancre est lue maintenant : la mise à jour d'état, elle, s'exécute plus tard.
    const opts = { shift: e.shiftKey, anchor: anchor.current }
    setSelected(prev => toggleSelection(prev, order, id, opts))
    anchor.current = id
  }

  const allVisible = order.length > 0 && order.every(id => selected.has(id))
  const picked = objects.filter(o => selected.has(o.id))

  function sell() {
    if (picked.length === 0 || picked.length > MAX_LISTINGS) return
    router.push(`/mes-collections/annonces?ids=${encodeURIComponent(picked.map(o => o.id).join(','))}&from=${encodeURIComponent(`/mes-collections/${routeId}`)}`)
  }

  async function changeStatus(next: Status) {
    if (busy) return
    setBusy(true)
    setError(null)
    setStatusMenu(false)
    try {
      const res = await fetch('/api/objects/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: picked.map(o => o.id), status: next }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error('status')
      const done = new Map<string, string>(((data.objects ?? []) as { id: string; status: string }[]).map(o => [o.id, o.status]))
      setObjects(prev => prev.map(o => (done.has(o.id) ? { ...o, status: done.get(o.id) as string } : o)))
    } catch {
      setError(t.statusFailed)
    }
    setBusy(false)
  }

  const money = (o: ObjectCard) => {
    const v = objectValue(o)
    return v === null ? '' : v.toLocaleString(intlLocale(locale), {
      style: 'currency', currency: normCurrency(o.value_currency), maximumFractionDigits: v % 1 ? 2 : 0,
    })
  }
  const count = (n: number) => fill(n === 1 ? t.objectsOne : t.objectsOther, { n })

  /** Une vignette : lien vers la fiche, ou case à cocher en mode sélection. */
  function card(o: ObjectCard) {
    const isOn = selected.has(o.id)
    const brand = attr(o, 'brand')
    const value = money(o)
    const inner = (
      <>
        <span className="thumb">
          {o.thumb ? <img src={o.thumb} alt="" loading="lazy" /> : <span className="no-photo" aria-hidden="true">📦</span>}
          {o.status && BADGED.includes(o.status) && <span className={`badge badge-${o.status}`}>{labelOf(o.status)}</span>}
          {(o.quantity ?? 1) > 1 && <span className="qty">×{o.quantity}</span>}
          {selecting && <span className={`check ${isOn ? 'on' : ''}`} aria-hidden="true">{isOn ? '✓' : ''}</span>}
        </span>
        <span className="card-title">{o.title}</span>
        <span className="card-meta">{[brand, value].filter(Boolean).join(' · ')}</span>
        {o.status && !BADGED.includes(o.status) && (
          <span className="card-status">
            <span className="dot" style={{ background: STATUS_COLOR[o.status] ?? '#9CA3AF' }} />
            {labelOf(o.status)}
          </span>
        )}
      </>
    )
    return selecting ? (
      <button
        key={o.id} type="button" role="checkbox" aria-checked={isOn} aria-label={fill(t.selectItem, { title: o.title })}
        className={`card ${isOn ? 'selected' : ''}`} onClick={e => pick(o.id, e)}
      >
        {inner}
      </button>
    ) : (
      <Link key={o.id} href={`/mes-collections/objets/${o.id}`} legacyBehavior passHref>
        <a className="card">{inner}</a>
      </Link>
    )
  }

  return (
    <>
      <Head>
        <title>{`${name} — Tiroir`}</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="root">
        <HeaderApp />
        <main className={`main ${selecting && selected.size > 0 ? 'with-bar' : ''}`}>
          <Link href="/mes-collections" legacyBehavior passHref>
            <a className="back-link">{t.backToCollections}</a>
          </Link>

          <div className="head">
            <span className="cover" style={view.collection?.cover ? undefined : { background: view.collection?.icon_color ?? 'var(--beige)' }}>
              {view.collection?.cover
                ? <img src={view.collection.cover} alt="" />
                : <span aria-hidden="true">{view.collection ? view.collection.emoji ?? '📦' : '🗂️'}</span>}
            </span>
            <h1 className="page-title">{name}</h1>
            <span className="total">{count(objects.length)}</span>
          </div>

          {objects.length === 0 ? (
            <p className="empty">{t.emptyCollection}</p>
          ) : (
            <>
              <div className="toolbar">
                <input
                  type="search" className="search" value={query} placeholder={t.searchPlaceholder}
                  aria-label={t.searchLabel} onChange={e => setQuery(e.target.value)}
                />
                <select aria-label={t.statusFilter} value={status} onChange={e => setStatus(e.target.value)}>
                  <option value="">{t.allStatuses}</option>
                  {STATUSES.map(s => <option key={s} value={s}>{labelOf(s)}</option>)}
                </select>
                <select aria-label={t.sortLabel} value={sort} onChange={e => setSort(e.target.value as ObjectSort)}>
                  {OBJECT_SORTS.map(s => <option key={s} value={s}>{t.objectSort[s]}</option>)}
                </select>
                <div className="segmented" role="group" aria-label={t.viewLabel}>
                  <button type="button" aria-pressed={layout === 'grid'} onClick={() => setLayout('grid')}>{t.viewGrid}</button>
                  <button type="button" aria-pressed={layout === 'list'} onClick={() => setLayout('list')}>{t.viewList}</button>
                </div>
                {!selecting && (
                  <button type="button" className="ghost-btn" onClick={() => setSelecting(true)}>{t.select}</button>
                )}
              </div>

              {selecting && (
                <div className="select-row">
                  <button
                    type="button" className="text-btn"
                    onClick={() => setSelected(prev => {
                      const next = new Set(prev)
                      for (const id of order) allVisible ? next.delete(id) : next.add(id)
                      return next
                    })}
                  >
                    {allVisible ? t.deselectAll : t.selectAll}
                  </button>
                  <span className="select-count" role="status" aria-live="polite">
                    {fill(selected.size === 1 ? t.selectedOne : t.selectedOther, { n: selected.size })}
                  </span>
                  <span className="select-hint">{t.selectHint}</span>
                  <button type="button" className="text-btn" onClick={leaveSelection}>{t.cancelSelect}</button>
                </div>
              )}

              <div role="status" aria-live="polite">{error && <p className="alert">{error}</p>}</div>

              {visible.length === 0 && <p className="empty">{t.noResult}</p>}

              {sections.map(section => (
                <section key={section.id} className="section" aria-label={section.title ?? name}>
                  {section.title && <h2 className="section-title">{section.title} <span>{section.items.length}</span></h2>}
                  {layout === 'grid' ? (
                    <div className="grid">
                      {section.items.map(card)}
                    </div>
                  ) : (
                    <div className="table-wrap">
                      <table className="table">
                        <thead>
                          <tr>
                            {selecting && <th className="col-check" />}
                            <th className="col-photo" />
                            <th>{t.columns.name}</th>
                            <th>{t.columns.brand}</th>
                            <th className="num">{t.columns.value}</th>
                            <th>{t.columns.status}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {section.items.map(o => {
                            const isOn = selected.has(o.id)
                            return (
                              <tr
                                key={o.id} className={isOn ? 'selected' : ''}
                                onClick={e => (selecting ? pick(o.id, e) : router.push(`/mes-collections/objets/${o.id}`))}
                              >
                                {selecting && (
                                  <td className="col-check">
                                    <input
                                      type="checkbox" checked={isOn} readOnly
                                      aria-label={fill(t.selectItem, { title: o.title })}
                                    />
                                  </td>
                                )}
                                <td className="col-photo">
                                  {o.thumb ? <img src={o.thumb} alt="" loading="lazy" /> : <span aria-hidden="true">📦</span>}
                                </td>
                                <td className="cell-title">
                                  {selecting ? o.title : (
                                    <Link href={`/mes-collections/objets/${o.id}`} legacyBehavior passHref>
                                      <a onClick={e => e.stopPropagation()}>{o.title}</a>
                                    </Link>
                                  )}
                                  {(o.quantity ?? 1) > 1 && <span className="qty-inline"> ×{o.quantity}</span>}
                                </td>
                                <td>{attr(o, 'brand')}</td>
                                <td className="num">{money(o)}</td>
                                <td>
                                  {o.status && (
                                    <span className="card-status">
                                      <span className="dot" style={{ background: STATUS_COLOR[o.status] ?? '#9CA3AF' }} />
                                      {labelOf(o.status)}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              ))}
            </>
          )}
        </main>
        <FooterTiroirWeb />
      </div>

      {selecting && selected.size > 0 && (
        <div className="action-bar" role="toolbar" aria-label={t.actionsLabel}>
          <span className="bar-count">{fill(selected.size === 1 ? t.selectedOne : t.selectedOther, { n: selected.size })}</span>
          {canList && (
            <button type="button" className="bar-primary" disabled={picked.length > MAX_LISTINGS} onClick={sell}>
              {t.actionSell}
            </button>
          )}
          <button type="button" className="bar-btn" onClick={() => { setStatusMenu(false); setSharing(true) }}>{t.actionShare}</button>
          <div className="status-wrap">
            <button
              type="button" className="bar-btn" disabled={busy}
              aria-haspopup="menu" aria-expanded={statusMenu} onClick={() => setStatusMenu(v => !v)}
            >
              {t.actionStatus}
            </button>
            {statusMenu && (
              <ul className="status-menu" role="menu">
                {STATUSES.map(s => (
                  <li key={s} role="none">
                    <button type="button" role="menuitem" onClick={() => changeStatus(s)}>
                      <span className="dot" style={{ background: STATUS_COLOR[s] }} />
                      {labelOf(s)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {canList && picked.length > MAX_LISTINGS && <span className="bar-note">{fill(t.tooMany, { max: MAX_LISTINGS })}</span>}
        </div>
      )}

      {sharing && (
        <ShareDialog objectIds={picked.map(o => o.id)} defaultTitle={name} onClose={() => setSharing(false)} />
      )}

      <style jsx>{`
        * { box-sizing: border-box; }
        .root { min-height: 100vh; background: var(--beige-2); font-family: var(--font-body); color: var(--ink); display: flex; flex-direction: column; }
        .main { flex: 1; width: 100%; max-width: 1120px; margin: 0 auto; padding: 32px 16px 64px; }
        .main.with-bar { padding-bottom: 140px; }
        .back-link { display: inline-block; font-size: 14px; color: var(--muted); text-decoration: none; font-weight: 600; margin-bottom: 20px; }
        .head { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; flex-wrap: wrap; }
        .cover { width: 48px; height: 48px; border-radius: 12px; overflow: hidden; display: flex; align-items: center; justify-content: center; font-size: 24px; flex-shrink: 0; }
        .cover img { width: 100%; height: 100%; object-fit: cover; }
        .page-title { font-size: 28px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.2; margin: 0; overflow-wrap: anywhere; }
        .total { font-size: 14px; color: var(--muted); }
        .toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 16px; }
        .search { flex: 1 1 220px; min-width: 0; }
        input.search, select { min-height: 44px; padding: 0 12px; border-radius: 10px; border: 1.5px solid var(--border); background: var(--white); color: var(--ink); font: inherit; font-size: 15px; }
        .segmented { display: inline-flex; border: 1.5px solid var(--border); border-radius: 10px; overflow: hidden; background: var(--white); }
        .segmented button { min-height: 41px; padding: 0 14px; border: 0; background: none; font: inherit; font-size: 14px; font-weight: 600; color: var(--muted); cursor: pointer; }
        .segmented button[aria-pressed='true'] { background: var(--beige); color: var(--ink); }
        .ghost-btn { min-height: 44px; padding: 0 16px; border-radius: 10px; border: 1.5px solid var(--orange); background: transparent; color: var(--orange-700); font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
        .select-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 16px; margin-bottom: 16px; padding: 6px 12px; background: var(--white); border: 1px solid var(--border-light); border-radius: 12px; }
        .text-btn { min-height: 40px; padding: 0 4px; border: 0; background: none; font: inherit; font-size: 14px; font-weight: 700; color: var(--orange-700); cursor: pointer; }
        .select-count { font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; }
        .select-hint { font-size: 13px; color: var(--muted); margin-right: auto; }
        .alert { margin: 0 0 16px; padding: 10px 14px; border-radius: 10px; background: var(--white); border: 1.5px solid var(--orange); font-size: 14px; }
        .empty { color: var(--muted); font-size: 15px; }
        /* padding : le site donne 64 px à toute <section> (landing.css). */
        .section { margin-bottom: 28px; padding: 0; }
        .section-title { font-size: 15px; font-weight: 700; margin: 0 0 12px; display: flex; align-items: baseline; gap: 8px; }
        .section-title span { font-size: 13px; font-weight: 400; color: var(--muted); }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 12px; }
        /* :global — les vignettes sont rendues par une fonction, hors de la portée de styled-jsx. */
        .grid :global(.card) { position: relative; display: flex; flex-direction: column; gap: 2px; padding: 0 0 10px; text-align: left; background: var(--white); border: 1px solid var(--border-light); border-radius: 12px; overflow: hidden; text-decoration: none; color: inherit; font: inherit; cursor: pointer; }
        .grid :global(.card:hover) { box-shadow: var(--shadow); }
        .grid :global(.card.selected) { outline: 2px solid var(--orange); outline-offset: -2px; }
        .grid :global(.card:focus-visible) { outline: 2px solid var(--orange); outline-offset: 2px; }
        .grid :global(.thumb) { position: relative; display: flex; align-items: center; justify-content: center; aspect-ratio: 1; background: var(--beige); margin-bottom: 8px; }
        .grid :global(.thumb img) { width: 100%; height: 100%; object-fit: cover; display: block; }
        .grid :global(.no-photo) { font-size: 36px; opacity: 0.7; }
        .grid :global(.card.selected .thumb::after) { content: ''; position: absolute; inset: 0; background: rgba(242, 105, 0, 0.18); }
        .grid :global(.badge) { position: absolute; left: 8px; bottom: 8px; padding: 3px 9px; border-radius: 999px; font-size: 12px; font-weight: 700; line-height: 1.4; }
        .grid :global(.badge-for_sale) { background: #FFF7ED; color: #C2410C; border: 1px solid #F97316; }
        .grid :global(.badge-sold) { background: #FFFBEB; color: #92400E; border: 1px solid #FBBF24; }
        .grid :global(.qty) { position: absolute; top: 8px; right: 8px; padding: 2px 8px; border-radius: 999px; background: rgba(26, 22, 18, 0.72); color: #fff; font-size: 11px; font-weight: 700; }
        .grid :global(.check) { position: absolute; top: 8px; left: 8px; z-index: 1; width: 24px; height: 24px; border-radius: 999px; border: 2px solid var(--white); background: rgba(26, 22, 18, 0.35); color: var(--white); font-size: 14px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
        .grid :global(.check.on) { background: var(--orange); }
        .grid :global(.card-title) { padding: 0 10px; font-size: 14px; font-weight: 600; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .grid :global(.card-meta) { padding: 0 10px; font-size: 12px; color: var(--muted); min-height: 1em; }
        :global(.card-status) { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: var(--muted); }
        .grid :global(.card-status) { padding: 2px 10px 0; }
        :global(.dot) { width: 9px; height: 9px; border-radius: 999px; flex-shrink: 0; display: inline-block; }
        .table-wrap { overflow-x: auto; background: var(--white); border: 1px solid var(--border-light); border-radius: 12px; }
        .table { width: 100%; border-collapse: collapse; font-size: 14px; }
        th { text-align: left; font-size: 12px; font-weight: 700; color: var(--muted); padding: 10px 12px; border-bottom: 1px solid var(--border-light); white-space: nowrap; }
        td { padding: 8px 12px; border-bottom: 1px solid var(--border-light); vertical-align: middle; }
        tbody tr { cursor: pointer; }
        tbody tr:hover { background: var(--surface-subtle); }
        tbody tr.selected { background: var(--beige); }
        tbody tr:last-child td { border-bottom: 0; }
        .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .col-check { width: 36px; }
        .col-check input { flex: none; width: 18px; height: 18px; margin: 0; padding: 0; appearance: none; -webkit-appearance: none; border: 1.5px solid var(--muted); border-radius: 5px; background: var(--white); cursor: pointer; }
        .col-check input[type='radio'] { border-radius: 999px; }
        .col-check input:checked { border-color: var(--orange); background: var(--orange); box-shadow: inset 0 0 0 3px var(--white); }
        .col-photo { width: 60px; }
        .col-photo img { width: 44px; height: 44px; object-fit: cover; border-radius: 8px; display: block; }
        .cell-title { font-weight: 600; min-width: 160px; }
        .cell-title a { color: inherit; text-decoration: none; }
        .cell-title a:hover { text-decoration: underline; }
        .qty-inline { font-weight: 400; color: var(--muted); }
        .action-bar { position: fixed; left: 50%; bottom: 20px; transform: translateX(-50%); z-index: 40; display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px; max-width: calc(100vw - 24px); padding: 10px 12px 10px 18px; background: var(--ink); color: var(--white); border-radius: 16px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25); font-family: var(--font-body); }
        .bar-count { font-size: 14px; font-weight: 700; margin-right: 6px; font-variant-numeric: tabular-nums; }
        .bar-primary, .bar-btn { min-height: 44px; padding: 0 16px; border-radius: 10px; font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
        .bar-primary { border: 0; background: var(--orange); color: var(--white); }
        .bar-btn { border: 1.5px solid rgba(255, 255, 255, 0.35); background: transparent; color: var(--white); }
        .bar-note { flex-basis: 100%; text-align: center; font-size: 13px; }
        button:disabled { opacity: 0.45; cursor: default; }
        .status-wrap { position: relative; }
        .status-menu { position: absolute; right: 0; bottom: calc(100% + 10px); min-width: 200px; margin: 0; padding: 6px; list-style: none; background: var(--white); color: var(--ink); border-radius: 12px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2); }
        .status-menu button { width: 100%; min-height: 40px; display: flex; align-items: center; gap: 10px; padding: 0 10px; border: 0; border-radius: 8px; background: none; font: inherit; font-size: 14px; text-align: left; cursor: pointer; }
        .status-menu button:hover { background: var(--beige); }
        input:focus-visible, select:focus-visible, button:focus-visible, a:focus-visible { outline: 2px solid var(--orange); outline-offset: 2px; }
        .action-bar button:focus-visible { outline-color: var(--white); }
        @media (max-width: 640px) {
          .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
          .select-hint { display: none; }
          .action-bar { left: 12px; right: 12px; bottom: 12px; transform: none; }
          .bar-count { flex-basis: 100%; text-align: center; margin: 0; }
          .bar-primary { flex: 1 1 100%; }
          .bar-btn, .status-wrap { flex: 1; }
          .status-wrap .bar-btn { width: 100%; }
        }
      `}</style>
    </>
  )
}
