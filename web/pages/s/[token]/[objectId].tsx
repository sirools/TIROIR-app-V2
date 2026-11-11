// pages/s/[token]/[objectId].tsx — Fiche objet en lecture seule (partage public V2)
import type { GetServerSidePropsContext } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useState } from 'react'
import { ZoomIn } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'
import HeaderTiroirWeb from '../../../components/layout/HeaderTiroirWeb'
import FooterTiroirWeb from '../../../components/layout/FooterTiroirWeb'
import PhotoZoomViewer from '../../../components/share/PhotoZoomViewer'
import { hasPhotoZoom, zoomPaths, zoomUrls } from '../../../lib/photoZoom'
import { hasSignedCookie } from '../../../lib/shareCookieSignature'
import { serverSupabase } from '../../../lib/supabase'
import { isLot, lotTotal } from '../../../lib/quantity'
import type { Locale } from '../../../lib/localeRouting'
import { fill, intlLocale, useCopy } from '../../../locales'

interface ValueSource {
  site: string
  price: number
  url?: string | null
  title?: string
}

interface ValueSources {
  sources?: ValueSource[]
  confidence?: 'low' | 'medium' | 'high'
  value_min?: number
  value_max?: number
  summary?: string
  ai_value?: number
}

interface ObjectDetail {
  id: string
  title: string
  description: string | null
  status: string | null
  location_note: string | null
  attributes: Record<string, string> | null
  // Valeur marchande
  market_value: number | null
  user_value: number | null
  value_currency: string | null
  value_estimated_at: string | null
  value_sources: ValueSources | null
  // Prix
  purchase_price: number | null
  purchase_currency: string | null
  purchase_date: string | null
  sale_price: number | null
  sale_price_lot: number | null
  deposit_amount: number | null
  quantity: number | null
  // Assurance (legacy, mono)
  insured: boolean | null
  insurance_type: string | null
  insurance_coverage: number | null
  insurance_policy_ref: string | null
  insurance_provider: string | null
  insurance_expires_at: string | null
  created_at: string
}

interface Insurance {
  id: string
  label: string | null
  price: number | null
  billing_period: 'monthly' | 'yearly' | null
  coverage: number | null
  date: string | null
}

interface DocMeta {
  id: string
  file_name: string
  doc_type: string
  doc_type_label: string | null
  mime_type: string
  signed_url: string
}

/** Blocs masquables par le partage. Absent = tout est visible. */
interface ShareFields {
  values: boolean
  location: boolean
  attributes: boolean
  description: boolean
  insurance: boolean
}

const ALL_FIELDS: ShareFields = {
  values: true, location: true, attributes: true, description: true, insurance: true,
}

interface Props {
  token: string
  object: ObjectDetail | null
  images: string[]
  /** Présent si le propriétaire est abonné : c'est ce qui ouvre le zoom. */
  zoomImages?: string[] | null
  documents: DocMeta[]
  insurances: Insurance[]
  fields?: ShareFields
  error?: 'not_found' | 'expired'
  gated?: boolean
  /** Le propriétaire regarde son propre partage : lien vers l'aperçu de vente. */
  isOwner?: boolean
}

// Libellés (statuts, types de document, confiance, périodicité) :
// web/locales/share (status, object.docTypes, object.confidence, object.billing).
const STATUS_COLOR: Record<string, string> = {
  owned: '#22C55E', stored: '#38BDF8', loaned: '#E879F9',
  sold: '#FBBF24', given: '#FB7185', lost: '#9CA3AF',
}
const CONFIDENCE_COLOR: Record<string, string> = {
  low: 'var(--text-tertiary)', medium: '#EA580C', high: '#16A34A',
}
/** Libellé traduit d'une clé, `undefined` si inconnue. */
function pick(map: object, key: string): string | undefined {
  return (map as Record<string, string>)[key]
}

function normCurrency(raw: string | null | undefined): string {
  const c = raw ?? 'EUR'
  if (c === '€') return 'EUR'
  if (c === '$') return 'USD'
  if (c === '£') return 'GBP'
  if (c.length === 3) return c
  return 'EUR'
}

function formatMoney(locale: Locale, amount: number, rawCurrency: string | null | undefined): string {
  return amount.toLocaleString(intlLocale(locale), {
    style: 'currency', currency: normCurrency(rawCurrency), maximumFractionDigits: 0,
  })
}

function formatLongDate(locale: Locale, iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString(intlLocale(locale), { day: 'numeric', month: 'long', year: 'numeric' })
}

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const token = (ctx.params?.token as string || '').trim()
  const objectId = (ctx.params?.objectId as string || '').trim()
  const supabase = getAdmin()

  const { data: link, error: linkErr } = await supabase
    .from('share_links')
    .select('user_id, object_ids, options, expires_at, is_archived')
    .eq('token', token)
    .single()

  if (linkErr || !link) return { props: { token, object: null, images: [], documents: [], insurances: [], error: 'not_found' } }
  if (link.is_archived || (link.expires_at && new Date(link.expires_at) < new Date())) {
    return { props: { token, object: null, images: [], documents: [], insurances: [], error: 'expired' } }
  }

  if (link.options?.password_protected && !hasSignedCookie(token, ctx.req, link.options?.password_hash)) {
    return { props: { token, object: null, images: [], documents: [], insurances: [], gated: true } }
  }

  const ids: string[] = Array.isArray(link.object_ids) ? link.object_ids : []
  if (!ids.includes(objectId)) {
    return { props: { token, object: null, images: [], documents: [], insurances: [], error: 'not_found' } }
  }

  const fields: ShareFields = { ...ALL_FIELDS, ...(link.options?.fields ?? {}) }

  /**
   * Ce qu'un partage masque n'est PAS chargé — voir la page de liste : les
   * props d'une page Next voyagent en clair dans le HTML, filtrer au rendu
   * laisserait la donnée lisible dans le code source.
   */
  const columns = [
    'id', 'title', 'status', 'quantity', 'created_at',
    ...(fields.description ? ['description'] : []),
    ...(fields.location ? ['location_note'] : []),
    ...(fields.attributes ? ['attributes'] : []),
    ...(fields.values ? [
      'market_value', 'user_value', 'value_currency', 'value_estimated_at', 'value_sources',
      'purchase_price', 'purchase_currency', 'purchase_date',
      'sale_price', 'sale_price_lot', 'deposit_amount',
    ] : []),
    ...(fields.insurance ? [
      'insured', 'insurance_type', 'insurance_coverage',
      'insurance_policy_ref', 'insurance_provider', 'insurance_expires_at',
    ] : []),
  ].join(', ')

  const { data: objRow, error: objErr } = await supabase
    .from('objects')
    .select(columns)
    .eq('id', objectId)
    .single()

  const obj = objRow as Record<string, unknown> | null

  if (objErr || !obj) return { props: { token, object: null, images: [], documents: [], insurances: [], error: 'not_found' } }

  const { data: imgRows } = await supabase
    .from('object_images')
    .select('storage_path, zoom_path')
    .eq('object_id', objectId)
    .order('position')

  const { data: owner } = await supabase
    .from('profiles')
    .select('plan, pro_expires_at')
    .eq('id', link.user_id)
    .single()
  const canZoom = hasPhotoZoom(owner?.plan, owner?.pro_expires_at)

  let images: string[] = []
  let zoomImages: string[] | null = null
  if (imgRows && imgRows.length) {
    const paths = imgRows.map(r => r.storage_path)
    const { data: signed } = await supabase.storage.from('object-images')
      .createSignedUrls(canZoom ? [...paths, ...zoomPaths(imgRows)] : paths, 3600)
    images = zoomUrls(imgRows.map(r => ({ storage_path: r.storage_path })), signed ?? [])
    if (canZoom) zoomImages = zoomUrls(imgRows, signed ?? [])
  }

  let documents: DocMeta[] = []

  if (link.options?.include_documents) {
    const { data: docRows } = await supabase
      .from('object_documents')
      .select('id, file_name, doc_type, doc_type_label, mime_type, storage_path')
      .eq('object_id', objectId)
      .order('position')

    if (docRows && docRows.length) {
      const paths = docRows.map(d => d.storage_path)
      const { data: signed } = await supabase.storage.from('object-documents').createSignedUrls(paths, 3600)
      const urlByPath: Record<string, string> = {}
      for (const s of signed ?? []) { if (s.signedUrl && s.path) urlByPath[s.path] = s.signedUrl }
      documents = docRows.map(d => ({
        id: d.id, file_name: d.file_name, doc_type: d.doc_type,
        doc_type_label: d.doc_type_label, mime_type: d.mime_type,
        signed_url: urlByPath[d.storage_path] ?? '',
      })).filter(d => d.signed_url)
    }
  }

  const { data: insRows } = fields.insurance
    ? await supabase
        .from('object_insurances')
        .select('id, label, price, billing_period, coverage, date')
        .eq('object_id', objectId)
        .order('position')
    : { data: null }

  const insurances: Insurance[] = (insRows ?? []).map(r => ({
    id: r.id,
    label: r.label,
    price: r.price != null ? Number(r.price) : null,
    billing_period: r.billing_period as Insurance['billing_period'],
    coverage: r.coverage != null ? Number(r.coverage) : null,
    date: r.date,
  }))

  // Les colonnes non demandées arrivent à `null`, comme un champ vide.
  const object = {
    description: null, location_note: null, attributes: null,
    market_value: null, user_value: null, value_currency: null,
    value_estimated_at: null, value_sources: null,
    purchase_price: null, purchase_currency: null, purchase_date: null,
    sale_price: null, sale_price_lot: null, deposit_amount: null,
    insured: null, insurance_type: null, insurance_coverage: null,
    insurance_policy_ref: null, insurance_provider: null, insurance_expires_at: null,
    ...obj,
  } as unknown as ObjectDetail

  // Prototype de vente (v4/docs/vente.md) : proposé à son seul propriétaire.
  let isOwner = false
  try {
    const { data } = await serverSupabase(ctx).auth.getUser()
    isOwner = !!data.user && data.user.id === link.user_id
  } catch {
    isOwner = false
  }

  return { props: { token, object, images, zoomImages, documents, insurances, fields, isOwner } }
}

export default function SharedObjectDetailPage({ token, object, images, zoomImages, documents, insurances, fields = ALL_FIELDS, error, gated, isOwner = false }: Props) {
  const { t: { share: t }, locale } = useCopy()
  const to = t.object
  const money = (amount: number, rawCurrency: string | null | undefined) => formatMoney(locale, amount, rawCurrency)
  const formatDate = (iso: string | null | undefined) => formatLongDate(locale, iso)
  const [activeImg, setActiveImg] = useState(0)
  const [viewerOpen, setViewerOpen] = useState(false)
  // Brief V4 : le détail de la valeur se replie, et s'ouvre dans le flux.
  const [valueOpen, setValueOpen] = useState(false)
  const pageTitle = gated
    ? t.meta.protected
    : error || !object ? t.meta.objectNotFound : fill(t.meta.pageTitle, { title: object.title })

  if (gated) {
    return (
      <>
        <Head><title>{pageTitle}</title><meta name="robots" content="noindex,nofollow" /></Head>
        <div className="root">
          <HeaderTiroirWeb />
          <main className="main">
            <div className="error-state">
              <div className="error-icon">🔒</div>
              <h1 className="error-title">{t.common.protectedTitle}</h1>
              <p className="error-sub">{t.common.protectedSub}</p>
              <Link href={`/s/${token}`} legacyBehavior passHref><a className="cta-btn">{t.common.backToShare}</a></Link>
            </div>
          </main>
          <FooterTiroirWeb />
          <style jsx>{`${styles}`}</style>
        </div>
      </>
    )
  }

  if (error || !object) {
    return (
      <>
        <Head><title>{pageTitle}</title><meta name="robots" content="noindex,nofollow" /></Head>
        <div className="root">
          <HeaderTiroirWeb />
          <main className="main">
            <div className="error-state">
              <div className="error-icon">{error === 'expired' ? '⏱' : '🔍'}</div>
              <h1 className="error-title">{error === 'expired' ? t.common.linkExpired : to.notFound}</h1>
              <Link href="/" legacyBehavior passHref><a className="cta-btn">{t.common.discover}</a></Link>
            </div>
          </main>
          <FooterTiroirWeb />
          <style jsx>{`${styles}`}</style>
        </div>
      </>
    )
  }

  const attributes = Object.entries(object.attributes ?? {}).filter(([, v]) => v !== null && v !== '')
  const valCur = object.value_currency

  // Brief V4 : le prix de vente définitif passe en premier. Sans prix de
  // vente, on garde l'estimation (la sienne, sinon celle de l'IA).
  const saleHeadline = fields.values && object.sale_price != null
  const headlineIsUser = !saleHeadline && object.user_value != null
  const headlineValue = saleHeadline ? object.sale_price : (object.user_value ?? object.market_value)
  const headlineLabel = saleHeadline ? to.salePrice : headlineIsUser ? to.yourEstimate : to.estimatedMarketValue
  // Total du lot affiché sous le prix : remise de lot comprise pour la vente.
  const headlineLot = saleHeadline
    ? (object.sale_price_lot ?? lotTotal(object.sale_price, object.quantity))
    : lotTotal(headlineValue, object.quantity)

  // Écart estimation utilisateur vs valeur marchande IA
  const diffPct = (headlineIsUser && object.user_value != null && object.market_value != null && object.market_value > 0)
    ? Math.round(((object.user_value - object.market_value) / object.market_value) * 100)
    : null

  type ValueRow = { label: string; sub?: string | null; amount: string }
  /** Toujours visibles dans la carte (hors montant mis en avant). */
  const valueRows: ValueRow[] = []
  /** Détail de la valeur, replié : estimation, valeur marchande, achat. */
  const detailRows: ValueRow[] = []

  /** Les montants restent unitaires ; le total du lot les accompagne. */
  const lotSub = (unit: number | null, override?: number | null) => {
    if (!isLot(object.quantity)) return null
    const total = override ?? lotTotal(unit, object.quantity)
    return total == null ? null : fill(to.lotTotal, { amount: money(total, valCur) })
  }

  if (fields.values && saleHeadline && object.user_value != null) {
    detailRows.push({ label: to.ownerEstimate, sub: lotSub(object.user_value), amount: money(object.user_value, valCur) })
  }
  if (fields.values && object.market_value != null && (headlineIsUser || saleHeadline)) {
    detailRows.push({ label: to.marketValueAi, sub: lotSub(object.market_value), amount: money(object.market_value, valCur) })
  }
  if (fields.values && object.purchase_price != null) {
    detailRows.push({
      label: to.purchasePrice,
      sub: [formatDate(object.purchase_date), lotSub(object.purchase_price)].filter(Boolean).join(' · ') || null,
      amount: money(object.purchase_price, object.purchase_currency ?? valCur),
    })
  }
  if (fields.values && object.deposit_amount != null) {
    valueRows.push({ label: to.deposit, sub: lotSub(object.deposit_amount), amount: money(object.deposit_amount, valCur) })
  }

  const vs = object.value_sources
  const hasRange = !!vs && vs.value_min != null && vs.value_max != null
  const hasSources = !!vs && Array.isArray(vs.sources) && vs.sources.length > 0
  const showEstimationDetail = fields.values && object.market_value != null && !!vs && (!!vs.summary || hasRange || hasSources || !!vs.confidence)
  const hasValueDetail = detailRows.length > 0 || showEstimationDetail
  const showValueCard = valueRows.length > 0 || hasValueDetail

  // Assurance : legacy (mono) si pas de contrats en table
  const hasLegacyInsurance = insurances.length === 0 && (
    object.insured || object.insurance_provider || object.insurance_type ||
    object.insurance_coverage != null || object.insurance_policy_ref || object.insurance_expires_at
  )
  const showInsuranceCard = fields.insurance && (insurances.length > 0 || hasLegacyInsurance)

  // Documents hors assurance vs justificatifs d'assurance
  const insuranceDocs = documents.filter(d => d.doc_type === 'assurance')
  const otherDocs = documents.filter(d => d.doc_type !== 'assurance')

  const addedDate = formatDate(object.created_at)
  const estimatedDate = formatDate(object.value_estimated_at)

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="root">
        <HeaderTiroirWeb />

        <main className="main">
          <Link href={`/s/${token}`} legacyBehavior passHref>
            <a className="back-link">← {t.common.backToShare}</a>
          </Link>

          {isOwner && (
            <Link href={`/s/${token}/${object.id}/vente`} legacyBehavior passHref>
              <a className="sale-preview">{to.salePreview}</a>
            </Link>
          )}

          {/* ── Bento : Galerie + Infos ── */}
          <div className="hero-card">
            <div className="hero-gallery">
              {images.length > 0 && !zoomImages && (
                <div className="gallery-main">
                  <img src={images[activeImg]} alt={object.title} className="gallery-img" />
                </div>
              )}
              {images.length > 0 && zoomImages
                ? (
                  <button type="button" className="gallery-main gallery-open" aria-label={to.viewer.open} onClick={() => setViewerOpen(true)}>
                    <img src={images[activeImg]} alt={object.title} className="gallery-img" />
                    <span className="gallery-zoom-hint" aria-hidden="true"><ZoomIn size={16} /></span>
                  </button>
                )
                : images.length === 0 && <div className="gallery-main"><div className="gallery-placeholder">📦</div></div>
              }
              {images.length > 1 && (
                <div className="gallery-thumbs">
                  {images.map((src, i) => (
                    <button
                      key={i}
                      className={`thumb ${i === activeImg ? 'active' : ''}`}
                      onClick={() => setActiveImg(i)}
                    >
                      <img src={src} alt="" />
                    </button>
                  ))}
                </div>
              )}
              {viewerOpen && zoomImages && (
                <PhotoZoomViewer
                  images={zoomImages}
                  alt={object.title}
                  startIndex={activeImg}
                  onClose={i => { setActiveImg(i); setViewerOpen(false) }}
                />
              )}
            </div>

            <div className="hero-info">
              <div className="detail-header">
                <h1 className="detail-title">{object.title}</h1>
                {object.status && (
                  <div className="status-row">
                    <span className="status-dot" style={{ background: STATUS_COLOR[object.status] ?? '#9CA3AF' }} />
                    <span className="status-label">{pick(t.status, object.status) ?? object.status}</span>
                  </div>
                )}
              </div>

              {fields.location && object.location_note && <p className="location">📍 {object.location_note}</p>}
              {fields.description && object.description && <p className="description">{object.description}</p>}

              {fields.values && headlineValue !== null && headlineValue !== undefined && (
                <div className="value-block">
                  <span className="value-label">{headlineLabel}</span>
                  <div className="value-amount-row">
                    <span className="value-amount">{money(headlineValue, valCur)}</span>
                    {isLot(object.quantity) && (
                      <span className="value-lot">
                        ×{object.quantity} · {money(headlineLot!, valCur)}
                      </span>
                    )}
                    {diffPct !== null && (
                      <span className={`value-diff ${diffPct >= 0 ? 'up' : 'down'}`}>
                        {diffPct >= 0 ? '▲' : '▼'} {fill(to.vsAi, { pct: Math.abs(diffPct) })}
                      </span>
                    )}
                  </div>
                  {!saleHeadline && estimatedDate && <span className="value-meta">{fill(to.estimatedOn, { date: estimatedDate })}</span>}
                </div>
              )}
            </div>
          </div>

          {/* ── Bento : cartes de détail (valeurs, caractéristiques, assurances, documents) ── */}
          {(showValueCard || attributes.length > 0 || showInsuranceCard || documents.length > 0) && (
            <div className="bento-grid">
              {/* ── Valeurs & prix ── */}
              {showValueCard && (
                <div className="bento-card">
                  <h2 className="section-title">{to.valuesTitle}</h2>
                  {valueRows.length > 0 && (
                  <div className="attrs-list">
                    {valueRows.map((row, i) => (
                      <div key={row.label} className={`attr-row ${i > 0 ? 'sep' : ''}`}>
                        <div className="attr-key-wrap">
                          <span className="attr-key">{row.label}</span>
                          {row.sub && <span className="attr-sub">{row.sub}</span>}
                        </div>
                        <span className="attr-val strong">{row.amount}</span>
                      </div>
                    ))}
                  </div>
                  )}

                  {hasValueDetail && (
                    <>
                      {/* Replié par défaut ; s'ouvre dans le flux et pousse la
                          suite vers le bas, sans panneau par-dessus. */}
                      <button
                        type="button"
                        className="value-toggle"
                        aria-expanded={valueOpen}
                        aria-controls="value-detail"
                        onClick={() => setValueOpen(o => !o)}
                      >
                        <span>{to.valueDetail}</span>
                        <span className="value-toggle-chevron" aria-hidden="true">{valueOpen ? '▴' : '▾'}</span>
                      </button>
                      {valueOpen && (
                        <div id="value-detail" className="value-detail">
                          {detailRows.length > 0 && (
                      <div className="attrs-list">
                        {detailRows.map((row, i) => (
                          <div key={row.label} className={`attr-row ${i > 0 ? 'sep' : ''}`}>
                            <div className="attr-key-wrap">
                              <span className="attr-key">{row.label}</span>
                              {row.sub && <span className="attr-sub">{row.sub}</span>}
                            </div>
                            <span className="attr-val strong">{row.amount}</span>
                          </div>
                        ))}
                      </div>
                          )}
                      {showEstimationDetail && (
                        <div className="estimation-detail">
                          <div className="estimation-head">
                            <span className="estimation-title">{to.aiEstimate}</span>
                            {vs?.confidence && (
                              <span className="conf-badge" style={{ color: CONFIDENCE_COLOR[vs.confidence] ?? 'var(--text-tertiary)' }}>
                                {pick(to.confidence, vs.confidence) ?? vs.confidence}
                              </span>
                            )}
                          </div>
                          {hasRange && (
                            <p className="estimation-range">
                              {fill(to.range, { min: money(vs!.value_min!, valCur), max: money(vs!.value_max!, valCur) })}
                            </p>
                          )}
                          {vs?.summary && <p className="estimation-summary">{vs.summary}</p>}
                          {hasSources && (
                            <div className="sources-row">
                              {vs!.sources!.slice(0, 4).map((src, i) => {
                                const chip = (
                                  <span className="source-chip">
                                    {src.site} · {money(src.price, valCur)}
                                  </span>
                                )
                                return src.url
                                  ? <a key={i} href={src.url} target="_blank" rel="noopener noreferrer" className="source-link">{chip}</a>
                                  : <span key={i}>{chip}</span>
                              })}
                            </div>
                          )}
                        </div>
                      )}

                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ── Caractéristiques ── */}
              {fields.attributes && attributes.length > 0 && (
                <div className="bento-card">
                  <h2 className="section-title">{t.common.characteristics}</h2>
                  <div className="attrs-list">
                    {attributes.map(([key, val], i) => (
                      <div key={key} className={`attr-row ${i > 0 ? 'sep' : ''}`}>
                        <span className="attr-key">{key}</span>
                        <span className="attr-val">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Assurances ── */}
              {showInsuranceCard && (
                <div className="bento-card">
                  <h2 className="section-title">{insurances.length > 1 ? to.insuranceOther : to.insuranceOne}</h2>
                  {insurances.length > 0 ? (
                    <div className="ins-list">
                      {insurances.map((ins, i) => (
                        <div key={ins.id} className={`ins-item ${i > 0 ? 'sep' : ''}`}>
                          <div className="ins-head">
                            <span className="ins-label">{ins.label || to.insuranceContract}</span>
                            {ins.price != null && (
                              <span className="ins-price">
                                {money(ins.price, valCur)}
                                {ins.billing_period && <span className="ins-period"> {pick(to.billing, ins.billing_period) ?? ''}</span>}
                              </span>
                            )}
                          </div>
                          <div className="ins-meta">
                            {ins.coverage != null && <span className="ins-tag">{fill(to.coverageTag, { amount: money(ins.coverage, valCur) })}</span>}
                            {formatDate(ins.date) && <span className="ins-tag">{fill(to.dueTag, { date: formatDate(ins.date)! })}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="attrs-list">
                      {object.insurance_provider && (
                        <div className="attr-row"><span className="attr-key">{to.insurer}</span><span className="attr-val">{object.insurance_provider}</span></div>
                      )}
                      {object.insurance_type && (
                        <div className="attr-row sep"><span className="attr-key">{to.type}</span><span className="attr-val">{object.insurance_type}</span></div>
                      )}
                      {object.insurance_coverage != null && (
                        <div className="attr-row sep"><span className="attr-key">{to.coverage}</span><span className="attr-val strong">{money(object.insurance_coverage, valCur)}</span></div>
                      )}
                      {object.insurance_policy_ref && (
                        <div className="attr-row sep"><span className="attr-key">{to.policyRef}</span><span className="attr-val">{object.insurance_policy_ref}</span></div>
                      )}
                      {formatDate(object.insurance_expires_at) && (
                        <div className="attr-row sep"><span className="attr-key">{to.due}</span><span className="attr-val">{formatDate(object.insurance_expires_at)}</span></div>
                      )}
                      {object.insured && !object.insurance_provider && !object.insurance_type && object.insurance_coverage == null && !object.insurance_policy_ref && !object.insurance_expires_at && (
                        <div className="attr-row"><span className="attr-key">{to.statusLabel}</span><span className="attr-val">{to.insured}</span></div>
                      )}
                    </div>
                  )}
                  {insuranceDocs.length > 0 && (
                    <div className="ins-docs">
                      {insuranceDocs.map(doc => (
                        <a key={doc.id} href={doc.signed_url} target="_blank" rel="noopener noreferrer" className="ins-doc-chip">
                          📄 {doc.file_name}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Documents (hors assurance) ── */}
              {otherDocs.length > 0 && (
                <div className="bento-card">
                  <h2 className="section-title">{to.documents}</h2>
                  <div className="docs-list">
                    {otherDocs.map((doc, i) => (
                      <a
                        key={doc.id}
                        href={doc.signed_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`doc-row ${i > 0 ? 'sep' : ''}`}
                      >
                        <span className="doc-icon">📄</span>
                        <div className="doc-info">
                          <span className="doc-name">{doc.file_name}</span>
                          <span className="doc-type">
                            {doc.doc_type === 'autre' && doc.doc_type_label ? doc.doc_type_label : (pick(to.docTypes, doc.doc_type) ?? to.docTypes.autre)}
                          </span>
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {addedDate && (
            <p className="page-meta">{fill(t.common.addedOn, { date: addedDate })}</p>
          )}
        </main>
        <FooterTiroirWeb />

        <footer className="footer">
          <Link href="/privacy" legacyBehavior passHref><a className="footer-link">{t.common.privacy}</a></Link>
          <span className="footer-sep">·</span>
          <span className="footer-copy">{t.common.copyright}</span>
        </footer>
      </div>

      <style jsx>{`${styles}`}</style>
    </>
  )
}

const styles = `
  .value-toggle { width: 100%; display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-top: 12px; padding: 12px 0 4px; border: 0; border-top: 1px solid var(--border-light); background: none; font: inherit; font-size: 14px; font-weight: 600; color: var(--ink); cursor: pointer; text-align: left; }
  .value-toggle:focus-visible { outline: 2px solid var(--orange); outline-offset: 2px; }
  .value-toggle-chevron { color: var(--muted); }
  .value-detail { display: flex; flex-direction: column; gap: 12px; padding-top: 8px; }

  .sale-preview { display: inline-block; margin: 0 0 16px 12px; padding: 6px 12px; border-radius: 999px; background: var(--orange); color: var(--white); font-size: 13px; font-weight: 700; text-decoration: none; }

  * { box-sizing: border-box; margin: 0; padding: 0; }
  .root {
    min-height: 100vh;
    background: var(--beige-2);
    font-family: var(--font-body);
    color: var(--ink);
    display: flex; flex-direction: column;
  }
  .back-link {
    display: inline-block; font-size: 14px; color: var(--muted); text-decoration: none;
    font-weight: 600; margin-bottom: 20px;
  }
  .back-link:hover { color: #F26900; }

  .main { flex: 1; max-width: 1200px; margin: 0 auto; padding: 32px 24px 56px; width: 100%; box-sizing: border-box; }

  /* ── Bento : Hero (galerie + infos) ── */
  .hero-card {
    background: #fff; border: 1px solid rgba(0,0,0,0.06); border-radius: 16px;
    box-shadow: 0 6px 20px rgba(0,0,0,0.06);
    padding: 28px;
    display: grid; grid-template-columns: minmax(280px, 460px) 1fr; gap: 32px;
    align-items: start;
  }

  .hero-gallery { display: flex; flex-direction: column; gap: 10px; }
  .gallery-main {
    width: 100%; aspect-ratio: 4/3; border-radius: 14px; overflow: hidden;
    background: var(--border-light); display: grid; place-items: center;
  }
  .gallery-img { width: 100%; height: 100%; object-fit: cover; }
  .gallery-open { position: relative; padding: 0; border: 0; cursor: zoom-in; }
  .gallery-zoom-hint {
    position: absolute; right: 10px; bottom: 10px; width: 32px; height: 32px;
    display: grid; place-items: center; border-radius: 50%; color: var(--white);
    background: color-mix(in srgb, var(--ink) 55%, transparent);
    -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px);
  }
  .gallery-placeholder { font-size: 64px; }
  .gallery-thumbs { display: flex; gap: 8px; overflow-x: auto; }
  .thumb {
    width: 56px; height: 56px; border-radius: 10px; overflow: hidden;
    border: 2px solid transparent; padding: 0; cursor: pointer; flex-shrink: 0;
    background: var(--border-light);
  }
  .thumb.active { border-color: #F26900; }
  .thumb img { width: 100%; height: 100%; object-fit: cover; }

  .hero-info { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
  .detail-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .detail-title { font-size: 26px; font-weight: 800; line-height: 1.25; }
  .status-row { display: flex; align-items: center; gap: 6px; flex-shrink: 0; padding-top: 6px; }
  .status-dot { width: 8px; height: 8px; border-radius: 50%; }
  .status-label { font-size: 13px; color: var(--muted); font-weight: 600; }
  .location { font-size: 13px; color: var(--text-tertiary); }
  .description { font-size: 15px; color: #4A443E; line-height: 1.6; }

  .value-block {
    display: flex; flex-direction: column; gap: 4px;
    margin-top: 4px; padding-top: 18px; border-top: 1px solid var(--border-light);
  }
  .value-label {
    font-size: 12px; font-weight: 700; color: var(--text-tertiary);
    text-transform: uppercase; letter-spacing: 0.6px;
  }
  .value-amount-row { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
  .value-amount { font-size: 28px; font-weight: 800; color: #F26900; }
  .value-diff { font-size: 13px; font-weight: 700; }
  .value-diff.up { color: #16A34A; }
  .value-diff.down { color: #DC2626; }
  .value-lot { font-size: 13px; font-weight: 600; color: var(--muted); }
  .value-meta { font-size: 12px; color: var(--text-tertiary); }

  /* ── Bento : cartes de détail ── */
  .bento-grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;
    margin-top: 20px;
    /* Cartes d'une même rangée à la même hauteur : une ligne nette. */
    align-items: stretch;
  }
  .bento-card {
    background: #fff; border: 1px solid rgba(0,0,0,0.06); border-radius: 16px;
    box-shadow: 0 6px 20px rgba(0,0,0,0.06);
    padding: 24px;
  }
  .section-title {
    font-size: 12px; font-weight: 700; color: var(--text-tertiary);
    text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 14px;
  }

  .attrs-list, .docs-list { display: flex; flex-direction: column; }
  .attr-row { display: flex; justify-content: space-between; align-items: baseline; padding: 12px 0; gap: 12px; }
  .attr-row.sep { border-top: 1px solid var(--border-light); }
  .attr-key-wrap { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .attr-key { font-size: 13px; color: var(--text-tertiary); font-weight: 600; }
  .attr-sub { font-size: 11px; color: #C4BBB1; }
  .attr-val { font-size: 14px; color: var(--ink); font-weight: 500; text-align: right; }
  .attr-val.strong { font-weight: 700; }

  /* ── Détail estimation IA ── */
  .estimation-detail {
    margin-top: 14px; padding-top: 16px; border-top: 1px solid var(--border-light);
    display: flex; flex-direction: column; gap: 8px;
  }
  .estimation-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .estimation-title {
    font-size: 11px; font-weight: 700; color: var(--text-tertiary);
    text-transform: uppercase; letter-spacing: 0.5px;
  }
  .conf-badge { font-size: 12px; font-weight: 700; }
  .estimation-range { font-size: 13px; color: #4A443E; font-weight: 600; }
  .estimation-summary { font-size: 13px; color: var(--muted); line-height: 1.55; }
  .sources-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 2px; }
  .source-link { text-decoration: none; }
  .source-chip {
    display: inline-block; font-size: 12px; color: var(--muted); font-weight: 600;
    background: #F4EFE8; border-radius: 999px; padding: 4px 10px;
  }
  .source-link:hover .source-chip { background: #F26900; color: #fff; }

  /* ── Assurances ── */
  .ins-list { display: flex; flex-direction: column; }
  .ins-item { display: flex; flex-direction: column; gap: 6px; padding: 12px 0; }
  .ins-item.sep { border-top: 1px solid var(--border-light); }
  .ins-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
  .ins-label { font-size: 14px; font-weight: 700; color: var(--ink); }
  .ins-price { font-size: 14px; font-weight: 700; color: var(--ink); white-space: nowrap; }
  .ins-period { font-size: 12px; font-weight: 600; color: var(--text-tertiary); }
  .ins-meta { display: flex; flex-wrap: wrap; gap: 6px; }
  .ins-tag {
    font-size: 12px; color: var(--muted); font-weight: 600;
    background: #F4EFE8; border-radius: 999px; padding: 3px 9px;
  }
  .ins-docs { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border-light); }
  .ins-doc-chip {
    font-size: 12px; color: var(--muted); font-weight: 600; text-decoration: none;
    background: #F4EFE8; border-radius: 999px; padding: 5px 11px;
  }
  .ins-doc-chip:hover { background: #F26900; color: #fff; }

  .page-meta { margin-top: 20px; text-align: center; font-size: 12px; color: #B5ACA2; }

  .doc-row {
    display: flex; align-items: center; gap: 12px; padding: 12px 0;
    text-decoration: none; color: inherit;
  }
  .doc-row.sep { border-top: 1px solid var(--border-light); }
  .doc-row:hover .doc-name { color: #F26900; }
  .doc-icon { font-size: 22px; }
  .doc-info { display: flex; flex-direction: column; gap: 2px; }
  .doc-name { font-size: 14px; font-weight: 600; color: var(--ink); transition: color 0.15s; }
  .doc-type { font-size: 12px; color: var(--text-tertiary); }

  .error-state {
    display: flex; flex-direction: column; align-items: center;
    gap: 16px; padding: 80px 24px; text-align: center;
  }
  .error-icon { font-size: 56px; }
  .error-title { font-size: 26px; font-weight: 800; }
  .cta-btn {
    display: inline-block; background: #F26900; color: white;
    padding: 14px 28px; border-radius: 999px; font-weight: 700;
    font-size: 15px; text-decoration: none;
  }

  .footer {
    display: flex; align-items: center; justify-content: center;
    gap: 8px; padding: 20px; border-top: 1px solid var(--border);
  }
  .footer-link { font-size: 12px; color: var(--text-tertiary); text-decoration: underline; }
  .footer-sep { font-size: 12px; color: var(--text-tertiary); }
  .footer-copy { font-size: 12px; color: var(--text-tertiary); }

  @media (max-width: 800px) {
    .hero-card { grid-template-columns: 1fr; padding: 20px; gap: 20px; }
    .bento-grid { grid-template-columns: 1fr; }
  }
  @media (min-width: 801px) and (max-width: 1080px) {
    .bento-grid { grid-template-columns: repeat(2, 1fr); }
  }

  @media (max-width: 600px) {
    .detail-title { font-size: 21px; }
    .detail-header { flex-direction: column; align-items: flex-start; gap: 6px; }
    .bento-card { padding: 20px; }
  }
`
