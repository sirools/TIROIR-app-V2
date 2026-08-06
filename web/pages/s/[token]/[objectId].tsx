// pages/s/[token]/[objectId].tsx — Fiche objet en lecture seule (partage public V2)
import type { GetServerSidePropsContext } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import HeaderTiroirWeb from '../../../components/layout/HeaderTiroirWeb'
import { hasValidCookie } from '../../../lib/shareAuth'
import { isLot, lotTotal } from '../../../lib/quantity'

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

interface Props {
  token: string
  object: ObjectDetail | null
  images: string[]
  documents: DocMeta[]
  insurances: Insurance[]
  error?: 'not_found' | 'expired'
  gated?: boolean
}

const STATUS_LABEL: Record<string, string> = {
  owned: 'Possédé', stored: 'En stockage', loaned: 'Prêté',
  sold: 'Vendu', given: 'Donné', lost: 'Perdu',
}
const STATUS_COLOR: Record<string, string> = {
  owned: '#22C55E', stored: '#38BDF8', loaned: '#E879F9',
  sold: '#FBBF24', given: '#FB7185', lost: '#9CA3AF',
}
const DOC_TYPE_LABEL: Record<string, string> = {
  facture: 'Facture', notice: 'Notice', assurance: 'Assurance', autre: 'Document',
}
const CONFIDENCE_LABEL: Record<string, string> = {
  low: 'Confiance faible', medium: 'Confiance moyenne', high: 'Confiance élevée',
}
const CONFIDENCE_COLOR: Record<string, string> = {
  low: '#A89F96', medium: '#EA580C', high: '#16A34A',
}
const BILLING_LABEL: Record<string, string> = {
  monthly: '/mois', yearly: '/an',
}

function normCurrency(raw: string | null | undefined): string {
  const c = raw ?? 'EUR'
  if (c === '€') return 'EUR'
  if (c === '$') return 'USD'
  if (c === '£') return 'GBP'
  if (c.length === 3) return c
  return 'EUR'
}

function money(amount: number, rawCurrency: string | null | undefined): string {
  return amount.toLocaleString('fr-FR', {
    style: 'currency', currency: normCurrency(rawCurrency), maximumFractionDigits: 0,
  })
}

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
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
    .select('object_ids, options, expires_at, is_archived')
    .eq('token', token)
    .single()

  if (linkErr || !link) return { props: { token, object: null, images: [], documents: [], insurances: [], error: 'not_found' } }
  if (link.is_archived || (link.expires_at && new Date(link.expires_at) < new Date())) {
    return { props: { token, object: null, images: [], documents: [], insurances: [], error: 'expired' } }
  }

  if (link.options?.password_protected && !hasValidCookie(token, ctx)) {
    return { props: { token, object: null, images: [], documents: [], insurances: [], gated: true } }
  }

  const ids: string[] = Array.isArray(link.object_ids) ? link.object_ids : []
  if (!ids.includes(objectId)) {
    return { props: { token, object: null, images: [], documents: [], insurances: [], error: 'not_found' } }
  }

  const { data: obj, error: objErr } = await supabase
    .from('objects')
    .select('id, title, description, status, location_note, attributes, market_value, user_value, value_currency, value_estimated_at, value_sources, purchase_price, purchase_currency, purchase_date, sale_price, sale_price_lot, deposit_amount, quantity, insured, insurance_type, insurance_coverage, insurance_policy_ref, insurance_provider, insurance_expires_at, created_at')
    .eq('id', objectId)
    .single()

  if (objErr || !obj) return { props: { token, object: null, images: [], documents: [], insurances: [], error: 'not_found' } }

  const { data: imgRows } = await supabase
    .from('object_images')
    .select('storage_path')
    .eq('object_id', objectId)
    .order('position')

  let images: string[] = []
  if (imgRows && imgRows.length) {
    const paths = imgRows.map(r => r.storage_path)
    const { data: signed } = await supabase.storage.from('object-images').createSignedUrls(paths, 3600)
    images = (signed ?? []).map(s => s.signedUrl).filter(Boolean) as string[]
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

  const { data: insRows } = await supabase
    .from('object_insurances')
    .select('id, label, price, billing_period, coverage, date')
    .eq('object_id', objectId)
    .order('position')

  const insurances: Insurance[] = (insRows ?? []).map(r => ({
    id: r.id,
    label: r.label,
    price: r.price != null ? Number(r.price) : null,
    billing_period: r.billing_period as Insurance['billing_period'],
    coverage: r.coverage != null ? Number(r.coverage) : null,
    date: r.date,
  }))

  return { props: { token, object: obj as ObjectDetail, images, documents, insurances } }
}

export default function SharedObjectDetailPage({ token, object, images, documents, insurances, error, gated }: Props) {
  const [activeImg, setActiveImg] = useState(0)
  const pageTitle = gated
    ? 'Partage protégé — TiROiR'
    : error || !object ? 'Objet introuvable — TiROiR' : `${object.title} — TiROiR`

  if (gated) {
    return (
      <>
        <Head><title>{pageTitle}</title><meta name="robots" content="noindex,nofollow" /></Head>
        <div className="root">
          <HeaderTiroirWeb />
          <main className="main">
            <div className="error-state">
              <div className="error-icon">🔒</div>
              <h1 className="error-title">Partage protégé</h1>
              <p className="error-sub">Retourne à la page du partage pour saisir le mot de passe.</p>
              <Link href={`/s/${token}`} legacyBehavior passHref><a className="cta-btn">Retour au partage</a></Link>
            </div>
          </main>
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
              <h1 className="error-title">{error === 'expired' ? 'Ce lien a expiré' : 'Objet introuvable'}</h1>
              <Link href="/" legacyBehavior passHref><a className="cta-btn">Découvrir TiROiR</a></Link>
            </div>
          </main>
          <style jsx>{`${styles}`}</style>
        </div>
      </>
    )
  }

  const attributes = Object.entries(object.attributes ?? {}).filter(([, v]) => v !== null && v !== '')
  const valCur = object.value_currency

  // Valeur mise en avant dans le hero
  const headlineIsUser = object.user_value != null
  const headlineValue = object.user_value ?? object.market_value
  const headlineLabel = headlineIsUser ? 'Votre estimation' : 'Valeur marchande estimée'

  // Écart estimation utilisateur vs valeur marchande IA
  const diffPct = (object.user_value != null && object.market_value != null && object.market_value > 0)
    ? Math.round(((object.user_value - object.market_value) / object.market_value) * 100)
    : null

  // Détail des valeurs (hors montant mis en avant, pour éviter les doublons)
  type ValueRow = { label: string; sub?: string | null; amount: string }
  const valueRows: ValueRow[] = []

  /** Les montants restent unitaires ; le total du lot les accompagne. */
  const lotSub = (unit: number | null, override?: number | null) => {
    if (!isLot(object.quantity)) return null
    const total = override ?? lotTotal(unit, object.quantity)
    return total == null ? null : `Total du lot : ${money(total, valCur)}`
  }

  if (object.market_value != null && headlineIsUser) {
    valueRows.push({ label: 'Valeur marchande (IA)', sub: lotSub(object.market_value), amount: money(object.market_value, valCur) })
  }
  if (object.purchase_price != null) {
    valueRows.push({
      label: "Prix d'achat",
      sub: [formatDate(object.purchase_date), lotSub(object.purchase_price)].filter(Boolean).join(' · ') || null,
      amount: money(object.purchase_price, object.purchase_currency ?? valCur),
    })
  }
  if (object.sale_price != null) {
    valueRows.push({ label: 'Prix de vente', sub: lotSub(object.sale_price, object.sale_price_lot), amount: money(object.sale_price, valCur) })
  }
  if (object.deposit_amount != null) {
    valueRows.push({ label: 'Caution', sub: lotSub(object.deposit_amount), amount: money(object.deposit_amount, valCur) })
  }

  const vs = object.value_sources
  const hasRange = !!vs && vs.value_min != null && vs.value_max != null
  const hasSources = !!vs && Array.isArray(vs.sources) && vs.sources.length > 0
  const showEstimationDetail = object.market_value != null && !!vs && (!!vs.summary || hasRange || hasSources || !!vs.confidence)
  const showValueCard = valueRows.length > 0 || showEstimationDetail

  // Assurance : legacy (mono) si pas de contrats en table
  const hasLegacyInsurance = insurances.length === 0 && (
    object.insured || object.insurance_provider || object.insurance_type ||
    object.insurance_coverage != null || object.insurance_policy_ref || object.insurance_expires_at
  )
  const showInsuranceCard = insurances.length > 0 || hasLegacyInsurance

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
            <a className="back-link">← Retour au partage</a>
          </Link>

          {/* ── Bento : Galerie + Infos ── */}
          <div className="hero-card">
            <div className="hero-gallery">
              <div className="gallery-main">
                {images.length > 0
                  ? <img src={images[activeImg]} alt={object.title} className="gallery-img" />
                  : <div className="gallery-placeholder">📦</div>
                }
              </div>
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
            </div>

            <div className="hero-info">
              <div className="detail-header">
                <h1 className="detail-title">{object.title}</h1>
                {object.status && (
                  <div className="status-row">
                    <span className="status-dot" style={{ background: STATUS_COLOR[object.status] ?? '#9CA3AF' }} />
                    <span className="status-label">{STATUS_LABEL[object.status] ?? object.status}</span>
                  </div>
                )}
              </div>

              {object.location_note && <p className="location">📍 {object.location_note}</p>}
              {object.description && <p className="description">{object.description}</p>}

              {headlineValue !== null && headlineValue !== undefined && (
                <div className="value-block">
                  <span className="value-label">{headlineLabel}</span>
                  <div className="value-amount-row">
                    <span className="value-amount">{money(headlineValue, valCur)}</span>
                    {isLot(object.quantity) && (
                      <span className="value-lot">
                        ×{object.quantity} · {money(lotTotal(headlineValue, object.quantity)!, valCur)}
                      </span>
                    )}
                    {diffPct !== null && (
                      <span className={`value-diff ${diffPct >= 0 ? 'up' : 'down'}`}>
                        {diffPct >= 0 ? '▲' : '▼'} {Math.abs(diffPct)}% vs IA
                      </span>
                    )}
                  </div>
                  {estimatedDate && <span className="value-meta">Estimé le {estimatedDate}</span>}
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
                  <h2 className="section-title">Valeurs &amp; prix</h2>
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

                  {showEstimationDetail && (
                    <div className="estimation-detail">
                      <div className="estimation-head">
                        <span className="estimation-title">Estimation IA</span>
                        {vs?.confidence && (
                          <span className="conf-badge" style={{ color: CONFIDENCE_COLOR[vs.confidence] ?? '#A89F96' }}>
                            {CONFIDENCE_LABEL[vs.confidence] ?? vs.confidence}
                          </span>
                        )}
                      </div>
                      {hasRange && (
                        <p className="estimation-range">
                          Fourchette : {money(vs!.value_min!, valCur)} – {money(vs!.value_max!, valCur)}
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

              {/* ── Caractéristiques ── */}
              {attributes.length > 0 && (
                <div className="bento-card">
                  <h2 className="section-title">Caractéristiques</h2>
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
                  <h2 className="section-title">Assurance{insurances.length > 1 ? 's' : ''}</h2>
                  {insurances.length > 0 ? (
                    <div className="ins-list">
                      {insurances.map((ins, i) => (
                        <div key={ins.id} className={`ins-item ${i > 0 ? 'sep' : ''}`}>
                          <div className="ins-head">
                            <span className="ins-label">{ins.label || 'Contrat d’assurance'}</span>
                            {ins.price != null && (
                              <span className="ins-price">
                                {money(ins.price, valCur)}
                                {ins.billing_period && <span className="ins-period"> {BILLING_LABEL[ins.billing_period] ?? ''}</span>}
                              </span>
                            )}
                          </div>
                          <div className="ins-meta">
                            {ins.coverage != null && <span className="ins-tag">Couverture {money(ins.coverage, valCur)}</span>}
                            {formatDate(ins.date) && <span className="ins-tag">Échéance {formatDate(ins.date)}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="attrs-list">
                      {object.insurance_provider && (
                        <div className="attr-row"><span className="attr-key">Assureur</span><span className="attr-val">{object.insurance_provider}</span></div>
                      )}
                      {object.insurance_type && (
                        <div className="attr-row sep"><span className="attr-key">Type</span><span className="attr-val">{object.insurance_type}</span></div>
                      )}
                      {object.insurance_coverage != null && (
                        <div className="attr-row sep"><span className="attr-key">Couverture</span><span className="attr-val strong">{money(object.insurance_coverage, valCur)}</span></div>
                      )}
                      {object.insurance_policy_ref && (
                        <div className="attr-row sep"><span className="attr-key">N° de contrat</span><span className="attr-val">{object.insurance_policy_ref}</span></div>
                      )}
                      {formatDate(object.insurance_expires_at) && (
                        <div className="attr-row sep"><span className="attr-key">Échéance</span><span className="attr-val">{formatDate(object.insurance_expires_at)}</span></div>
                      )}
                      {object.insured && !object.insurance_provider && !object.insurance_type && object.insurance_coverage == null && !object.insurance_policy_ref && !object.insurance_expires_at && (
                        <div className="attr-row"><span className="attr-key">Statut</span><span className="attr-val">Assuré</span></div>
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
                  <h2 className="section-title">Documents</h2>
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
                            {doc.doc_type === 'autre' && doc.doc_type_label ? doc.doc_type_label : (DOC_TYPE_LABEL[doc.doc_type] ?? 'Document')}
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
            <p className="page-meta">Ajouté le {addedDate}</p>
          )}
        </main>

        <footer className="footer">
          <Link href="/privacy" legacyBehavior passHref><a className="footer-link">Politique de confidentialité</a></Link>
          <span className="footer-sep">·</span>
          <span className="footer-copy">© 2026 TiROiR</span>
        </footer>
      </div>

      <style jsx>{`${styles}`}</style>
    </>
  )
}

const styles = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  .root {
    min-height: 100vh;
    background: #F7F3EE;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #1A1612;
    display: flex; flex-direction: column;
  }
  .back-link {
    display: inline-block; font-size: 14px; color: #6B6158; text-decoration: none;
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
    background: #F0EBE3; display: grid; place-items: center;
  }
  .gallery-img { width: 100%; height: 100%; object-fit: cover; }
  .gallery-placeholder { font-size: 64px; }
  .gallery-thumbs { display: flex; gap: 8px; overflow-x: auto; }
  .thumb {
    width: 56px; height: 56px; border-radius: 10px; overflow: hidden;
    border: 2px solid transparent; padding: 0; cursor: pointer; flex-shrink: 0;
    background: #F0EBE3;
  }
  .thumb.active { border-color: #F26900; }
  .thumb img { width: 100%; height: 100%; object-fit: cover; }

  .hero-info { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
  .detail-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .detail-title { font-size: 26px; font-weight: 800; line-height: 1.25; }
  .status-row { display: flex; align-items: center; gap: 6px; flex-shrink: 0; padding-top: 6px; }
  .status-dot { width: 8px; height: 8px; border-radius: 50%; }
  .status-label { font-size: 13px; color: #6B6158; font-weight: 600; }
  .location { font-size: 13px; color: #A89F96; }
  .description { font-size: 15px; color: #4A443E; line-height: 1.6; }

  .value-block {
    display: flex; flex-direction: column; gap: 4px;
    margin-top: 4px; padding-top: 18px; border-top: 1px solid #F0EBE3;
  }
  .value-label {
    font-size: 12px; font-weight: 700; color: #A89F96;
    text-transform: uppercase; letter-spacing: 0.6px;
  }
  .value-amount-row { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
  .value-amount { font-size: 28px; font-weight: 800; color: #F26900; }
  .value-diff { font-size: 13px; font-weight: 700; }
  .value-diff.up { color: #16A34A; }
  .value-diff.down { color: #DC2626; }
  .value-lot { font-size: 13px; font-weight: 600; color: #6B6158; }
  .value-meta { font-size: 12px; color: #A89F96; }

  /* ── Bento : cartes de détail ── */
  .bento-grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;
    margin-top: 20px;
    align-items: start;
  }
  .bento-card {
    background: #fff; border: 1px solid rgba(0,0,0,0.06); border-radius: 16px;
    box-shadow: 0 6px 20px rgba(0,0,0,0.06);
    padding: 24px;
  }
  .section-title {
    font-size: 12px; font-weight: 700; color: #A89F96;
    text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 14px;
  }

  .attrs-list, .docs-list { display: flex; flex-direction: column; }
  .attr-row { display: flex; justify-content: space-between; align-items: baseline; padding: 12px 0; gap: 12px; }
  .attr-row.sep { border-top: 1px solid #F0EBE3; }
  .attr-key-wrap { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .attr-key { font-size: 13px; color: #A89F96; font-weight: 600; }
  .attr-sub { font-size: 11px; color: #C4BBB1; }
  .attr-val { font-size: 14px; color: #1A1612; font-weight: 500; text-align: right; }
  .attr-val.strong { font-weight: 700; }

  /* ── Détail estimation IA ── */
  .estimation-detail {
    margin-top: 14px; padding-top: 16px; border-top: 1px solid #F0EBE3;
    display: flex; flex-direction: column; gap: 8px;
  }
  .estimation-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .estimation-title {
    font-size: 11px; font-weight: 700; color: #A89F96;
    text-transform: uppercase; letter-spacing: 0.5px;
  }
  .conf-badge { font-size: 12px; font-weight: 700; }
  .estimation-range { font-size: 13px; color: #4A443E; font-weight: 600; }
  .estimation-summary { font-size: 13px; color: #6B6158; line-height: 1.55; }
  .sources-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 2px; }
  .source-link { text-decoration: none; }
  .source-chip {
    display: inline-block; font-size: 12px; color: #6B6158; font-weight: 600;
    background: #F4EFE8; border-radius: 999px; padding: 4px 10px;
  }
  .source-link:hover .source-chip { background: #F26900; color: #fff; }

  /* ── Assurances ── */
  .ins-list { display: flex; flex-direction: column; }
  .ins-item { display: flex; flex-direction: column; gap: 6px; padding: 12px 0; }
  .ins-item.sep { border-top: 1px solid #F0EBE3; }
  .ins-head { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
  .ins-label { font-size: 14px; font-weight: 700; color: #1A1612; }
  .ins-price { font-size: 14px; font-weight: 700; color: #1A1612; white-space: nowrap; }
  .ins-period { font-size: 12px; font-weight: 600; color: #A89F96; }
  .ins-meta { display: flex; flex-wrap: wrap; gap: 6px; }
  .ins-tag {
    font-size: 12px; color: #6B6158; font-weight: 600;
    background: #F4EFE8; border-radius: 999px; padding: 3px 9px;
  }
  .ins-docs { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 14px; padding-top: 14px; border-top: 1px solid #F0EBE3; }
  .ins-doc-chip {
    font-size: 12px; color: #6B6158; font-weight: 600; text-decoration: none;
    background: #F4EFE8; border-radius: 999px; padding: 5px 11px;
  }
  .ins-doc-chip:hover { background: #F26900; color: #fff; }

  .page-meta { margin-top: 20px; text-align: center; font-size: 12px; color: #B5ACA2; }

  .doc-row {
    display: flex; align-items: center; gap: 12px; padding: 12px 0;
    text-decoration: none; color: inherit;
  }
  .doc-row.sep { border-top: 1px solid #F0EBE3; }
  .doc-row:hover .doc-name { color: #F26900; }
  .doc-icon { font-size: 22px; }
  .doc-info { display: flex; flex-direction: column; gap: 2px; }
  .doc-name { font-size: 14px; font-weight: 600; color: #1A1612; transition: color 0.15s; }
  .doc-type { font-size: 12px; color: #A89F96; }

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
    gap: 8px; padding: 20px; border-top: 1px solid #E8E2DA;
  }
  .footer-link { font-size: 12px; color: #A89F96; text-decoration: underline; }
  .footer-sep { font-size: 12px; color: #A89F96; }
  .footer-copy { font-size: 12px; color: #A89F96; }

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
