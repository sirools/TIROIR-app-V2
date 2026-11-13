// « Préparer l'annonce » : le panneau commun au lien de partage
// (/s/<jeton>/annonces) et à l'inventaire (/mes-collections/annonces).
// Titre, prix conseillé et fourchette, catégorie, description, photos à
// télécharger, puis déclaration « En vente » et « Vendu ». Une série se
// prépare en une annonce par objet ou en une seule pour le lot.
//
// Les pages qui l'affichent font les contrôles (propriétaire, palier) et
// chargent les objets : lib/listingServer.ts. Rien n'est publié ni envoyé
// à Leboncoin.
import Head from 'next/head'
import Link from 'next/link'
import { useState } from 'react'
import HeaderApp from '../layout/HeaderApp'
import FooterTiroirWeb from '../layout/FooterTiroirWeb'
import {
  buildListing, buildLotListing, listingText, parsePrice, slug, withPractical, TITLE_MAX,
  type Listing, type ListingDraft, type ListingLabels, type SaleAction,
} from '../../lib/listing'
import type { ListingItem as Item, ListingPhoto as Photo, ListingSale as Sale } from '../../lib/listingServer'
import { uniqueNames, zipStore, type ZipEntry } from '../../lib/zipStore'
import { fill, intlLocale, useCopy } from '../../locales'

export type ListingPanelProps = {
  items: Item[]
  /** Adresse publique du partage, pour « Fiche complète : » ; null hors d'un partage. */
  shareUrl: string | null
  /** Faux tant que la base n'a pas les colonnes de mise en vente : on prépare, sans déclarer. */
  saleReady: boolean
  /** Où déclarer « en vente », « vendu », « retiré ». */
  apiUrl: string
  backHref: string
  backLabel?: string
}

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic' }

/** Télécharge les photos dans le navigateur et les réunit dans une archive. */
async function downloadPhotos(groups: { folder: string; photos: Photo[] }[], fileName: string) {
  const names: string[] = []
  const blobs: Uint8Array[] = []
  for (const g of groups) {
    for (let i = 0; i < g.photos.length; i++) {
      const res = await fetch(g.photos[i].full)
      if (!res.ok) throw new Error(`photo ${res.status}`)
      const blob = await res.blob()
      // Numéro sur deux chiffres : l'ordre des photos tient au tri par nom.
      const file = `photo-${String(i + 1).padStart(2, '0')}.${EXT[blob.type] ?? 'jpg'}`
      names.push(groups.length > 1 ? `${g.folder}/${file}` : file)
      blobs.push(new Uint8Array(await blob.arrayBuffer()))
    }
  }
  const entries: ZipEntry[] = uniqueNames(names).map((name, i) => ({ name, data: blobs[i] }))
  const zip = zipStore(entries)
  const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: 'application/zip' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${fileName}.zip`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Navigateur sans presse-papiers asynchrone (ou page non sécurisée).
    const area = document.createElement('textarea')
    area.value = text
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    let ok = false
    try { ok = document.execCommand('copy') } catch { ok = false }
    area.remove()
    return ok
  }
}

const LEBONCOIN_NEW = 'https://www.leboncoin.fr/deposer-une-annonce'
const LOT = 'lot'

type Card = { key: string; objs: Item[]; listing: Listing }

export default function ListingPanel({ items, shareUrl, saleReady, apiUrl, backHref, backLabel }: ListingPanelProps) {
  const { t: { share: t }, locale } = useCopy()
  const tl = t.listing
  const labels: ListingLabels = { attrs: { ...t.attrs, accessories: tl.accessories }, quantity: tl.quantity, lot: tl.lot }

  const [listings] = useState<Listing[]>(() => items.map(o => buildListing(o, labels)))
  const [lotListing] = useState<Listing>(() => buildLotListing(listings, tl.lotTitle))
  const [mode, setMode] = useState<'each' | 'lot'>('each')
  const [shipping, setShipping] = useState(false)
  const [withLink, setWithLink] = useState(false)

  // Lignes pratiques en fin de description ; « Fiche complète » n'y est que sur demande.
  const practical = (key: string, ship: boolean, link: boolean) => [
    ship ? tl.handoverOrShipping : tl.handoverOnly,
    ...(link && shareUrl ? [`${tl.fullSheet} ${key === LOT ? shareUrl : `${shareUrl}/${key}`}`] : []),
  ]
  const applyPractical = (key: string, description: string, ship: boolean, link: boolean) =>
    withPractical(description, practical(key, ship, link), [tl.handoverOnly, tl.handoverOrShipping], [tl.fullSheet])

  const [drafts, setDrafts] = useState<Record<string, ListingDraft>>(() => {
    const draftOf = (key: string, l: Listing): ListingDraft => ({
      title: l.title,
      price: l.price === null ? '' : String(l.price),
      category: l.category ?? '',
      description: applyPractical(key, l.description, false, false),
    })
    return Object.fromEntries([...items.map((o, i) => [o.id, draftOf(o.id, listings[i])]), [LOT, draftOf(LOT, lotListing)]])
  })
  const [sales, setSales] = useState<Record<string, Sale | null>>(() => Object.fromEntries(items.map(o => [o.id, o.sale])))
  const [copied, setCopied] = useState<string | null>(null)
  const [copyFailed, setCopyFailed] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [downloadFailed, setDownloadFailed] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [soldForm, setSoldForm] = useState<string | null>(null)
  const [soldPrice, setSoldPrice] = useState('')

  const edit = (key: string, patch: Partial<ListingDraft>) =>
    setDrafts(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }))

  function setOptions(ship: boolean, link: boolean) {
    setShipping(ship)
    setWithLink(link)
    setDrafts(prev => Object.fromEntries(Object.entries(prev).map(([key, d]) =>
      [key, { ...d, description: applyPractical(key, d.description, ship, link) }])))
  }

  async function copy(key: string, text: string) {
    const ok = await copyText(text)
    setCopyFailed(!ok)
    if (!ok) return
    setCopied(key)
    setTimeout(() => setCopied(c => (c === key ? null : c)), 1800)
  }

  async function download(key: string, groups: { folder: string; photos: Photo[] }[], fileName: string) {
    if (busy) return
    setBusy(key)
    setDownloadFailed(false)
    try {
      await downloadPhotos(groups, fileName)
    } catch {
      setDownloadFailed(true)
    }
    setBusy(null)
  }

  /** Déclare les objets d'une annonce en vente, vendus, ou les retire de la vente. */
  async function declare(action: SaleAction, card: Card, priceText: string) {
    if (saving) return
    if (priceText.trim() && parsePrice(priceText) === null) {
      setSaveError(tl.priceInvalid)
      return
    }
    setSaving(card.key)
    setSaveError(null)
    try {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ids: card.objs.map(o => o.id), price: priceText.trim() || null, platform: 'leboncoin' }),
      })
      const data = await res.json().catch(() => ({}))
      const rows = (data.objects ?? []) as (Sale & { id: string })[]
      if (rows.length) setSales(prev => ({ ...prev, ...Object.fromEntries(rows.map(({ id, ...sale }) => [id, sale])) }))
      if (!res.ok) setSaveError(tl.saveFailed)
      else setSoldForm(null)
    } catch {
      setSaveError(tl.saveFailed)
    }
    setSaving(null)
  }

  const fieldNames = { title: tl.fieldTitle, price: tl.fieldPrice, description: tl.fieldDescription }
  const symbol = (currency: string) => (currency === 'EUR' ? '€' : currency)
  const money = (n: number, currency: string) =>
    n.toLocaleString(intlLocale(locale), { style: 'currency', currency, maximumFractionDigits: n % 1 ? 2 : 0 })
  const day = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(intlLocale(locale), { day: 'numeric', month: 'long', year: 'numeric' }) : ''
  const groupOf = (o: Item, i: number) => ({ folder: slug(drafts[o.id]?.title || o.title, `objet-${i + 1}`), photos: o.photos })
  const allPhotos = items.reduce((n, o) => n + o.photos.length, 0)
  const lotMode = mode === 'lot' && items.length > 1
  const cards: Card[] = lotMode
    ? [{ key: LOT, objs: items, listing: lotListing }]
    : items.map((o, i) => ({ key: o.id, objs: [o], listing: listings[i] }))
  const heading = cards.length > 1 ? fill(tl.titleOther, { n: cards.length }) : tl.titleOne

  const copyButton = (key: string, text: string, label = tl.copy) => (
    <button type="button" className="copy-btn" disabled={!text.trim()} onClick={() => copy(key, text)}>
      {copied === key ? tl.copied : label}
    </button>
  )

  return (
    <>
      <Head>
        <title>{tl.metaTitle}</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="root">
        <HeaderApp />
        <main className="main">
          <Link href={backHref} legacyBehavior passHref>
            <a className="back-link">{backLabel ?? tl.back}</a>
          </Link>
          <h1 className="page-title">{heading}</h1>
          <p className="intro">{tl.intro}</p>

          {items.length > 0 && (
            <div className="options">
              {items.length > 1 && (
                <fieldset>
                  <legend>{tl.modeLabel}</legend>
                  <label className="choice">
                    <input type="radio" name="mode" checked={!lotMode} onChange={() => setMode('each')} />
                    {tl.modeEach}
                  </label>
                  <label className="choice">
                    <input type="radio" name="mode" checked={lotMode} onChange={() => setMode('lot')} />
                    {tl.modeLot}
                  </label>
                </fieldset>
              )}
              <fieldset>
                <legend>{tl.optionsLabel}</legend>
                <label className="choice">
                  <input type="checkbox" checked={shipping} onChange={e => setOptions(e.target.checked, withLink)} />
                  {tl.optShipping}
                </label>
                {shareUrl && (
                  <label className="choice">
                    <input type="checkbox" checked={withLink} onChange={e => setOptions(shipping, e.target.checked)} />
                    {tl.optLink}
                  </label>
                )}
              </fieldset>
            </div>
          )}

          {!lotMode && items.length > 1 && allPhotos > 0 && (
            <div className="top-actions">
              <button
                type="button"
                className="ghost-btn"
                disabled={busy !== null}
                onClick={() => download('all', items.map(groupOf), 'annonces-tiroir')}
              >
                {busy === 'all' ? tl.downloading : fill(tl.downloadAll, { n: allPhotos })}
              </button>
            </div>
          )}

          <div role="status" aria-live="polite">
            {copyFailed && <p className="alert">{tl.copyFailed}</p>}
            {downloadFailed && <p className="alert">{tl.downloadFailed}</p>}
            {saveError && <p className="alert">{saveError}</p>}
          </div>

          {items.length === 0 && <p className="empty">{tl.empty}</p>}

          {cards.map(card => {
            const { key, objs, listing: l } = card
            const d = drafts[key]
            const single = objs.length === 1 ? objs[0] : null
            const priceText = d.price.trim() ? `${d.price.trim()} ${symbol(l.currency)}` : ''
            const priceHint = l.priceOrigin === 'seller' ? tl.priceSeller : l.priceOrigin === 'estimate' ? tl.priceEstimate : tl.priceNone
            const lot = single?.quantity && single.quantity > 1 ? single.quantity : null
            const missing = l.missing.map(k =>
              k === 'price' ? tl.fieldPrice : k === 'description' ? tl.fieldDescription : labels.attrs[k] ?? k)
            const photos = objs.flatMap(o => o.photos.map(p => ({ ...p, title: o.title })))
            const groups = objs.map(o => groupOf(o, items.indexOf(o)))
            const zipName = single ? `${groups[0].folder}-photos` : 'lot-tiroir-photos'

            const states = objs.map(o => sales[o.id])
            const allSold = states.every(s => s?.status === 'sold')
            const allListed = states.every(s => s?.status === 'for_sale')
            const first = states[0]
            const asked = single && first ? first.sale_price_lot ?? (first.sale_price !== null ? first.sale_price * (single.quantity ?? 1) : null) : null

            return (
              <section key={key} className="card" aria-label={d.title}>
                {!saleReady && single?.status === 'sold' && <p className="sold">{tl.sold}</p>}

                <div className="field">
                  <div className="label-row">
                    <label htmlFor={`title-${key}`}>{tl.fieldTitle}</label>
                    <span className="count">{fill(tl.titleCount, { n: d.title.length, max: TITLE_MAX })}</span>
                  </div>
                  <div className="row">
                    <input
                      id={`title-${key}`} type="text" maxLength={TITLE_MAX} value={d.title}
                      onChange={e => edit(key, { title: e.target.value })}
                    />
                    {copyButton(`title-${key}`, d.title)}
                  </div>
                </div>

                <div className="field">
                  <label htmlFor={`price-${key}`}>{tl.fieldPrice}</label>
                  <div className="row">
                    <div className="price-input">
                      <input
                        id={`price-${key}`} type="text" inputMode="decimal" value={d.price}
                        onChange={e => edit(key, { price: e.target.value.replace(/[^\d.,\s]/g, '') })}
                      />
                      <span aria-hidden="true">{symbol(l.currency)}</span>
                    </div>
                    {copyButton(`price-${key}`, priceText)}
                  </div>
                  <p className="hint">
                    {priceHint}
                    {l.range ? ` ${fill(tl.priceRange, { min: money(l.range.min, l.currency), max: money(l.range.max, l.currency) })}` : ''}
                    {lot ? ` ${fill(tl.priceLot, { n: lot })}` : ''}
                    {!single && l.price !== null ? ` ${tl.lotPriceHint}` : ''}
                  </p>
                </div>

                <div className="field">
                  <label htmlFor={`category-${key}`}>{tl.fieldCategory}</label>
                  <div className="row">
                    <input
                      id={`category-${key}`} type="text" value={d.category} placeholder={tl.categoryNone}
                      onChange={e => edit(key, { category: e.target.value })}
                    />
                    {copyButton(`category-${key}`, d.category)}
                  </div>
                  <p className="hint">{tl.categoryHint}</p>
                </div>

                <div className="field">
                  <label htmlFor={`description-${key}`}>{tl.fieldDescription}</label>
                  <div className="row top">
                    <textarea
                      id={`description-${key}`} rows={Math.min(18, Math.max(5, d.description.split('\n').length + 1))}
                      value={d.description} onChange={e => edit(key, { description: e.target.value })}
                    />
                    {copyButton(`description-${key}`, d.description)}
                  </div>
                  {missing.length > 0 && <p className="hint warn">{fill(tl.missing, { fields: missing.join(', ') })}</p>}
                </div>

                <div className="field">
                  <span className="label">{tl.photos}</span>
                  {photos.length === 0 ? (
                    <p className="hint">{tl.noPhoto}</p>
                  ) : (
                    <div className="thumbs">
                      {photos.map((p, n) => (
                        <a key={n} href={p.full} target="_blank" rel="noopener noreferrer">
                          <img src={p.thumb} alt={fill(tl.photoAlt, { n: n + 1, title: p.title })} loading="lazy" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                <div className="card-actions">
                  <button
                    type="button" className="primary-btn"
                    onClick={() => copy(`all-${key}`, listingText(d, fieldNames, l.currency))}
                  >
                    {copied === `all-${key}` ? tl.copied : tl.copyAll}
                  </button>
                  {photos.length > 0 && (
                    <button
                      type="button" className="ghost-btn" disabled={busy !== null}
                      onClick={() => download(key, groups, zipName)}
                    >
                      {busy === key ? tl.downloading : fill(tl.downloadPhotos, { n: photos.length })}
                    </button>
                  )}
                  <a className="ghost-btn" href={LEBONCOIN_NEW} target="_blank" rel="noopener noreferrer">{tl.openLeboncoin}</a>
                </div>

                {saleReady && (
                  <div className="sale">
                    {allSold ? (
                      <p className="sale-state">
                        {fill(tl.soldOn, { date: day(first?.sold_at ?? null) })}
                        {single && first?.sold_price != null ? ` ${fill(tl.soldFor, { price: money(first.sold_price, l.currency) })}` : ''}
                      </p>
                    ) : allListed ? (
                      <>
                        <p className="sale-state">
                          {fill(tl.listedSince, { date: day(first?.listed_at ?? null) })}
                          {asked !== null ? ` ${fill(tl.listedPrice, { price: money(asked, l.currency) })}` : ''}
                        </p>
                        {soldForm === key ? (
                          <>
                            {single && (
                              <div className="field sale-form">
                                <label htmlFor={`sold-${key}`}>{tl.soldPriceLabel}</label>
                                <div className="price-input">
                                  <input
                                    id={`sold-${key}`} type="text" inputMode="decimal" value={soldPrice}
                                    onChange={e => setSoldPrice(e.target.value.replace(/[^\d.,\s]/g, ''))}
                                  />
                                  <span aria-hidden="true">{symbol(l.currency)}</span>
                                </div>
                              </div>
                            )}
                            <div className="card-actions">
                              <button
                                type="button" className="primary-btn" disabled={saving !== null}
                                onClick={() => declare('sold', card, single ? soldPrice : '')}
                              >
                                {saving === key ? tl.saving : tl.confirmSold}
                              </button>
                              <button type="button" className="text-btn" onClick={() => setSoldForm(null)}>{t.common.cancel}</button>
                            </div>
                          </>
                        ) : (
                          <div className="card-actions">
                            <button
                              type="button" className="ghost-btn" disabled={saving !== null}
                              onClick={() => { setSoldPrice(asked !== null ? String(asked) : d.price); setSoldForm(key); setSaveError(null) }}
                            >
                              {tl.markSold}
                            </button>
                            <button type="button" className="text-btn" disabled={saving !== null} onClick={() => declare('unlist', card, '')}>
                              {saving === key ? tl.saving : tl.unlist}
                            </button>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="hint">{tl.saleHint}{!single ? ` ${tl.lotPriceNotStored}` : ''}</p>
                        <div className="card-actions">
                          <button
                            type="button" className="ghost-btn" disabled={saving !== null}
                            onClick={() => declare('list', card, d.price)}
                          >
                            {saving === key ? tl.saving : tl.markListed}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </section>
            )
          })}
        </main>
        <FooterTiroirWeb />
      </div>

      <style jsx>{`
        * { box-sizing: border-box; }
        .root { min-height: 100vh; background: var(--beige-2); font-family: var(--font-body); color: var(--ink); display: flex; flex-direction: column; }
        .main { flex: 1; width: 100%; max-width: 760px; margin: 0 auto; padding: 32px 16px 64px; }
        .back-link { display: inline-block; font-size: 14px; color: var(--muted); text-decoration: none; font-weight: 600; margin-bottom: 20px; }
        .page-title { font-family: var(--font-display, var(--font-body)); font-size: 28px; line-height: 1.2; margin: 0 0 8px; text-wrap: balance; }
        .intro { font-size: 15px; line-height: 1.5; color: var(--muted); margin: 0 0 20px; max-width: 60ch; }
        .top-actions { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; }
        .alert { margin: 0 0 16px; padding: 10px 14px; border-radius: 10px; background: var(--white); border: 1.5px solid var(--orange); font-size: 14px; }
        .empty { color: var(--muted); font-size: 15px; }
        .card { background: var(--white); border-radius: var(--radius, 16px); padding: 20px; margin-bottom: 20px; box-shadow: var(--shadow); }
        .sold { margin: 0 0 14px; font-size: 13px; font-weight: 700; color: var(--orange-700, var(--orange)); }
        .options { background: var(--white); border-radius: var(--radius, 16px); padding: 16px 20px; margin-bottom: 20px; box-shadow: var(--shadow); display: flex; flex-wrap: wrap; gap: 16px 40px; }
        fieldset { border: 0; padding: 0; margin: 0; min-width: 0; }
        legend { font-size: 13px; font-weight: 700; margin-bottom: 8px; padding: 0; }
        .choice { display: flex; align-items: center; gap: 10px; min-height: 36px; font-size: 15px; font-weight: 400; margin: 0; cursor: pointer; }
        /* Cases dessinées ici : la remise à zéro du site efface leur dessin natif. */
        .choice input { flex: none; width: 18px; height: 18px; margin: 0; padding: 0; appearance: none; -webkit-appearance: none; border: 1.5px solid var(--muted); border-radius: 5px; background: var(--white); cursor: pointer; }
        .choice input[type='radio'] { border-radius: 999px; }
        .choice input:checked { border-color: var(--orange); background: var(--orange); box-shadow: inset 0 0 0 3px var(--white); }
        .label-row { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
        .count { font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
        .sale { margin-top: 16px; padding-top: 16px; border-top: 1.5px solid var(--beige); }
        .sale-state { margin: 0 0 10px; font-size: 14px; font-weight: 700; }
        .sale-form { margin-bottom: 12px; max-width: 280px; }
        .text-btn { min-height: 44px; padding: 0 8px; border: 0; background: none; cursor: pointer; font: inherit; font-size: 14px; font-weight: 600; color: var(--muted); text-decoration: underline; }
        .field { margin-bottom: 16px; }
        label, .label { display: block; font-size: 13px; font-weight: 700; margin-bottom: 6px; }
        .row { display: flex; gap: 8px; align-items: center; }
        .row.top { align-items: flex-start; }
        /* Champs de texte seulement : les cases et boutons radio gardent leur dessin natif. */
        input[type='text'], textarea {
          flex: 1; min-width: 0; width: 100%; padding: 10px 12px; border-radius: 10px;
          border: 1.5px solid var(--beige); background: var(--white); color: var(--ink);
          font: inherit; font-size: 16px; line-height: 1.45;
        }
        textarea { resize: vertical; }
        input:focus-visible, textarea:focus-visible, button:focus-visible, a:focus-visible { outline: 2px solid var(--orange); outline-offset: 2px; }
        .price-input { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; }
        .price-input span { font-weight: 700; }
        .hint { margin: 6px 0 0; font-size: 13px; line-height: 1.4; color: var(--muted); }
        .hint.warn { color: var(--ink); }
        /* :global — le bouton Copier est rendu par une fonction, hors de la portée de styled-jsx. */
        .main :global(.copy-btn), .ghost-btn, .primary-btn {
          flex-shrink: 0; min-height: 44px; padding: 0 16px; border-radius: 10px; cursor: pointer;
          font: inherit; font-size: 14px; font-weight: 700; text-decoration: none;
          display: inline-flex; align-items: center; justify-content: center;
        }
        .main :global(.copy-btn) { min-width: 84px; border: 1.5px solid var(--beige); background: var(--beige-2); color: var(--ink); }
        .ghost-btn { border: 1.5px solid var(--orange); background: transparent; color: var(--orange-700, var(--orange)); }
        .primary-btn { border: 1.5px solid var(--orange); background: var(--orange); color: var(--white); }
        button:disabled { opacity: 0.45; cursor: default; }
        .thumbs { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; }
        .thumbs img { width: 84px; height: 84px; object-fit: cover; border-radius: 10px; display: block; background: var(--beige); }
        .card-actions { display: flex; flex-wrap: wrap; gap: 12px; padding-top: 4px; }
        @media (max-width: 520px) {
          .card-actions > :global(button) { flex: 1 1 100%; }
        }
      `}</style>
    </>
  )
}
