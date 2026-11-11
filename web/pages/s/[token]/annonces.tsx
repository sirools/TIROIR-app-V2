// pages/s/[token]/annonces.tsx — « Préparer une annonce » : le texte d'une
// ou de plusieurs annonces de vente (titre, description, prix, catégorie),
// à copier dans Leboncoin, et les photos à télécharger en lot.
//
// Réservé au propriétaire du partage, aux paliers Pro et Business
// (lib/listing.ts) : pour tout autre visiteur, la page n'existe pas (404).
// Rien n'est publié ni envoyé à Leboncoin.
import type { GetServerSidePropsContext } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import HeaderTiroirWeb from '../../../components/layout/HeaderTiroirWeb'
import FooterTiroirWeb from '../../../components/layout/FooterTiroirWeb'
import { serverSupabase } from '../../../lib/supabase'
import {
  buildListing, canPrepareListing, listingText, parseIds, slug,
  type Listing, type ListingDraft, type ListingInput, type ListingLabels,
} from '../../../lib/listing'
import { uniqueNames, zipStore, type ZipEntry } from '../../../lib/zipStore'
import { fill, useCopy } from '../../../locales'

type Photo = { thumb: string; full: string }
type Item = ListingInput & { id: string; status: string | null; photos: Photo[] }
type Props = { token: string; items: Item[] }

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  ctx.res.setHeader('X-Robots-Tag', 'noindex, nofollow')
  const token = String(ctx.params?.token ?? '').trim()
  const wanted = parseIds(ctx.query.ids)

  let viewerId: string | null = null
  try {
    const { data } = await serverSupabase(ctx).auth.getUser()
    viewerId = data.user?.id ?? null
  } catch {
    viewerId = null
  }
  if (!viewerId) return { notFound: true as const }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  })
  const { data: link } = await admin
    .from('share_links')
    .select('user_id, object_ids, expires_at, is_archived')
    .eq('token', token)
    .single()
  if (!link || link.user_id !== viewerId) return { notFound: true as const }
  if (link.is_archived || (link.expires_at && new Date(link.expires_at) < new Date())) return { notFound: true as const }

  const { data: profile } = await admin.from('profiles').select('plan, pro_expires_at').eq('id', viewerId).single()
  if (!canPrepareListing(profile?.plan, profile?.pro_expires_at)) return { notFound: true as const }

  const shared = new Set<string>(Array.isArray(link.object_ids) ? link.object_ids : [])
  const ids = wanted.filter(id => shared.has(id))
  if (ids.length === 0) return { props: { token, items: [] } }

  const [{ data: rows }, { data: imgRows }] = await Promise.all([
    admin.from('objects')
      .select('id, title, description, status, attributes, quantity, sale_price, sale_price_lot, user_value, market_value, value_currency')
      .in('id', ids)
      .eq('user_id', viewerId),
    admin.from('object_images').select('object_id, storage_path, zoom_path').in('object_id', ids).order('position'),
  ])

  // La copie haute définition, quand elle existe, est celle qu'on télécharge.
  const images = (imgRows ?? []) as { object_id: string; storage_path: string; zoom_path: string | null }[]
  const paths = Array.from(new Set(images.flatMap(r => (r.zoom_path ? [r.storage_path, r.zoom_path] : [r.storage_path]))))
  const urlByPath = new Map<string, string>()
  if (paths.length) {
    const { data: signed } = await admin.storage.from('object-images').createSignedUrls(paths, 3600)
    for (const s of signed ?? []) if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl)
  }

  const byId = new Map(((rows ?? []) as unknown as (Omit<Item, 'photos'>)[]).map(r => [r.id, r]))
  const items: Item[] = ids.flatMap(id => {
    const row = byId.get(id)
    if (!row) return []
    const photos = images.filter(r => r.object_id === id).flatMap(r => {
      const thumb = urlByPath.get(r.storage_path)
      if (!thumb) return []
      return [{ thumb, full: (r.zoom_path && urlByPath.get(r.zoom_path)) || thumb }]
    })
    return [{ ...row, photos }]
  })

  return { props: { token, items } }
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
      const file = `photo-${i + 1}.${EXT[blob.type] ?? 'jpg'}`
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

export default function PrepareListingsPage({ token, items }: Props) {
  const { t: { share: t } } = useCopy()
  const tl = t.listing
  const labels: ListingLabels = { attrs: { ...t.attrs, accessories: tl.accessories }, quantity: tl.quantity, lot: tl.lot }

  const [listings] = useState<Listing[]>(() => items.map(o => buildListing(o, labels)))
  const [drafts, setDrafts] = useState<ListingDraft[]>(() => listings.map(l => ({
    title: l.title,
    price: l.price === null ? '' : String(l.price),
    category: l.category ?? '',
    description: l.description,
  })))
  const [copied, setCopied] = useState<string | null>(null)
  const [copyFailed, setCopyFailed] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [downloadFailed, setDownloadFailed] = useState(false)

  const edit = (i: number, patch: Partial<ListingDraft>) =>
    setDrafts(prev => prev.map((d, j) => (j === i ? { ...d, ...patch } : d)))

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

  const fieldNames = { title: tl.fieldTitle, price: tl.fieldPrice, category: tl.fieldCategory, description: tl.fieldDescription }
  const symbol = (currency: string) => (currency === 'EUR' ? '€' : currency)
  const groupOf = (o: Item, i: number) => ({ folder: slug(drafts[i]?.title || o.title, `objet-${i + 1}`), photos: o.photos })
  const allPhotos = items.reduce((n, o) => n + o.photos.length, 0)
  const heading = items.length > 1 ? fill(tl.titleOther, { n: items.length }) : tl.titleOne

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
        <HeaderTiroirWeb />
        <main className="main">
          <Link href={`/s/${token}`} legacyBehavior passHref>
            <a className="back-link">{tl.back}</a>
          </Link>
          <h1 className="page-title">{heading}</h1>
          <p className="intro">{tl.intro}</p>

          <div className="top-actions">
            <a className="ghost-btn" href={LEBONCOIN_NEW} target="_blank" rel="noopener noreferrer">{tl.openLeboncoin}</a>
            {items.length > 1 && allPhotos > 0 && (
              <button
                type="button"
                className="ghost-btn"
                disabled={busy !== null}
                onClick={() => download('all', items.map(groupOf), 'annonces-tiroir')}
              >
                {busy === 'all' ? tl.downloading : fill(tl.downloadAll, { n: allPhotos })}
              </button>
            )}
          </div>

          <div role="status" aria-live="polite">
            {copyFailed && <p className="alert">{tl.copyFailed}</p>}
            {downloadFailed && <p className="alert">{tl.downloadFailed}</p>}
          </div>

          {items.length === 0 && <p className="empty">{tl.empty}</p>}

          {items.map((o, i) => {
            const l = listings[i]
            const d = drafts[i]
            const priceText = d.price.trim() ? `${d.price.trim()} ${symbol(l.currency)}` : ''
            const priceHint = l.priceOrigin === 'seller' ? tl.priceSeller : l.priceOrigin === 'estimate' ? tl.priceEstimate : tl.priceNone
            const lot = o.quantity && o.quantity > 1 ? o.quantity : null
            const missing = l.missing.map(k =>
              k === 'price' ? tl.fieldPrice : k === 'description' ? tl.fieldDescription : labels.attrs[k] ?? k)
            return (
              <section key={o.id} className="card" aria-label={o.title}>
                {o.status === 'sold' && <p className="sold">{tl.sold}</p>}

                <div className="field">
                  <label htmlFor={`title-${o.id}`}>{tl.fieldTitle}</label>
                  <div className="row">
                    <input id={`title-${o.id}`} type="text" value={d.title} onChange={e => edit(i, { title: e.target.value })} />
                    {copyButton(`title-${o.id}`, d.title)}
                  </div>
                </div>

                <div className="field">
                  <label htmlFor={`price-${o.id}`}>{tl.fieldPrice}</label>
                  <div className="row">
                    <div className="price-input">
                      <input
                        id={`price-${o.id}`} type="text" inputMode="decimal" value={d.price}
                        onChange={e => edit(i, { price: e.target.value.replace(/[^\d.,\s]/g, '') })}
                      />
                      <span aria-hidden="true">{symbol(l.currency)}</span>
                    </div>
                    {copyButton(`price-${o.id}`, priceText)}
                  </div>
                  <p className="hint">{priceHint}{lot ? ` ${fill(tl.priceLot, { n: lot })}` : ''}</p>
                </div>

                <div className="field">
                  <label htmlFor={`category-${o.id}`}>{tl.fieldCategory}</label>
                  <div className="row">
                    <input
                      id={`category-${o.id}`} type="text" value={d.category} placeholder={tl.categoryNone}
                      onChange={e => edit(i, { category: e.target.value })}
                    />
                    {copyButton(`category-${o.id}`, d.category)}
                  </div>
                  <p className="hint">{tl.categoryHint}</p>
                </div>

                <div className="field">
                  <label htmlFor={`description-${o.id}`}>{tl.fieldDescription}</label>
                  <div className="row top">
                    <textarea
                      id={`description-${o.id}`} rows={Math.min(14, Math.max(5, d.description.split('\n').length + 1))}
                      value={d.description} onChange={e => edit(i, { description: e.target.value })}
                    />
                    {copyButton(`description-${o.id}`, d.description)}
                  </div>
                  {missing.length > 0 && <p className="hint warn">{fill(tl.missing, { fields: missing.join(', ') })}</p>}
                </div>

                <div className="field">
                  <span className="label">{tl.photos}</span>
                  {o.photos.length === 0 ? (
                    <p className="hint">{tl.noPhoto}</p>
                  ) : (
                    <div className="thumbs">
                      {o.photos.map((p, n) => (
                        <a key={n} href={p.full} target="_blank" rel="noopener noreferrer">
                          <img src={p.thumb} alt={fill(tl.photoAlt, { n: n + 1, title: o.title })} loading="lazy" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                <div className="card-actions">
                  <button
                    type="button" className="primary-btn"
                    onClick={() => copy(`all-${o.id}`, listingText(d, fieldNames, l.currency))}
                  >
                    {copied === `all-${o.id}` ? tl.copied : tl.copyAll}
                  </button>
                  {o.photos.length > 0 && (
                    <button
                      type="button" className="ghost-btn" disabled={busy !== null}
                      onClick={() => download(o.id, [groupOf(o, i)], `${groupOf(o, i).folder}-photos`)}
                    >
                      {busy === o.id ? tl.downloading : fill(tl.downloadPhotos, { n: o.photos.length })}
                    </button>
                  )}
                </div>
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
        .field { margin-bottom: 16px; }
        label, .label { display: block; font-size: 13px; font-weight: 700; margin-bottom: 6px; }
        .row { display: flex; gap: 8px; align-items: center; }
        .row.top { align-items: flex-start; }
        input, textarea {
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
