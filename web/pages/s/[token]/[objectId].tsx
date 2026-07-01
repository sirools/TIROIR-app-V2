// pages/s/[token]/[objectId].tsx — Fiche objet en lecture seule (partage public V2)
import type { GetServerSidePropsContext } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import HeaderTiroirWeb from '../../../components/layout/HeaderTiroirWeb'
import { hasValidCookie } from '../../../lib/shareAuth'

interface ObjectDetail {
  id: string
  title: string
  description: string | null
  status: string | null
  location_note: string | null
  attributes: Record<string, string> | null
  market_value: number | null
  user_value: number | null
  value_currency: string | null
  created_at: string
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

  if (linkErr || !link) return { props: { token, object: null, images: [], documents: [], error: 'not_found' } }
  if (link.is_archived || (link.expires_at && new Date(link.expires_at) < new Date())) {
    return { props: { token, object: null, images: [], documents: [], error: 'expired' } }
  }

  if (link.options?.password_protected && !hasValidCookie(token, ctx)) {
    return { props: { token, object: null, images: [], documents: [], gated: true } }
  }

  const ids: string[] = Array.isArray(link.object_ids) ? link.object_ids : []
  if (!ids.includes(objectId)) {
    return { props: { token, object: null, images: [], documents: [], error: 'not_found' } }
  }

  const { data: obj, error: objErr } = await supabase
    .from('objects')
    .select('id, title, description, status, location_note, attributes, market_value, user_value, value_currency, created_at')
    .eq('id', objectId)
    .single()

  if (objErr || !obj) return { props: { token, object: null, images: [], documents: [], error: 'not_found' } }

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

  return { props: { token, object: obj as ObjectDetail, images, documents } }
}

export default function SharedObjectDetailPage({ token, object, images, documents, error, gated }: Props) {
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
  const value = object.user_value ?? object.market_value
  const rawCurrency = object.value_currency ?? 'EUR'
  const currency = rawCurrency === '€' ? 'EUR'
    : rawCurrency === '$' ? 'USD'
    : rawCurrency === '£' ? 'GBP'
    : rawCurrency.length === 3 ? rawCurrency
    : 'EUR'

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

              {value !== null && value !== undefined && (
                <div className="value-block">
                  <span className="value-label">Valeur estimée</span>
                  <span className="value-amount">
                    {value.toLocaleString('fr-FR', { style: 'currency', currency, maximumFractionDigits: 0 })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── Bento : Caractéristiques + Documents côte à côte ── */}
          {(attributes.length > 0 || documents.length > 0) && (
            <div className="bento-grid">
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

              {documents.length > 0 && (
                <div className="bento-card">
                  <h2 className="section-title">Documents</h2>
                  <div className="docs-list">
                    {documents.map((doc, i) => (
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
  .value-amount { font-size: 28px; font-weight: 800; color: #F26900; }

  /* ── Bento : Caractéristiques + Documents ── */
  .bento-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 20px;
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
  .attr-row { display: flex; justify-content: space-between; padding: 12px 0; gap: 12px; }
  .attr-row.sep { border-top: 1px solid #F0EBE3; }
  .attr-key { font-size: 13px; color: #A89F96; font-weight: 600; }
  .attr-val { font-size: 14px; color: #1A1612; font-weight: 500; text-align: right; }

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

  @media (max-width: 600px) {
    .detail-title { font-size: 21px; }
    .detail-header { flex-direction: column; align-items: flex-start; gap: 6px; }
    .bento-card { padding: 20px; }
  }
`
