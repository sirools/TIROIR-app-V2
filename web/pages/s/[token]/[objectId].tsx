// pages/s/[token]/[objectId].tsx — Fiche objet en lecture seule (partage public V2)
import type { GetServerSidePropsContext } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

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
    .select('object_ids, options, expires_at')
    .eq('token', token)
    .single()

  if (linkErr || !link) return { props: { token, object: null, images: [], documents: [], error: 'not_found' } }
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return { props: { token, object: null, images: [], documents: [], error: 'expired' } }
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

export default function SharedObjectDetailPage({ token, object, images, documents, error }: Props) {
  const [activeImg, setActiveImg] = useState(0)
  const pageTitle = error || !object ? 'Objet introuvable — TiROiR' : `${object.title} — TiROiR`

  if (error || !object) {
    return (
      <>
        <Head><title>{pageTitle}</title><meta name="robots" content="noindex,nofollow" /></Head>
        <div className="root">
          <header className="header">
            <div className="header-inner">
              <Link href="/" legacyBehavior passHref>
                <a className="logo">
                  <div className="logo-box">T</div>
                  <strong className="logo-text">TiROiR</strong>
                </a>
              </Link>
            </div>
          </header>
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
  const currency = object.value_currency ?? 'EUR'

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="root">
        <header className="header">
          <div className="header-inner">
            <Link href="/" legacyBehavior passHref>
              <a className="logo">
                <div className="logo-box">T</div>
                <strong className="logo-text">TiROiR</strong>
              </a>
            </Link>
            <Link href={`/s/${token}`} legacyBehavior passHref>
              <a className="back-link">← Retour au partage</a>
            </Link>
          </div>
        </header>

        <main className="main">
          {/* Galerie */}
          <div className="gallery">
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

          {/* Titre + statut */}
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

          {/* Valeur */}
          {value !== null && value !== undefined && (
            <div className="section">
              <h2 className="section-title">Valeur estimée</h2>
              <div className="value-box">
                {value.toLocaleString('fr-FR', { style: 'currency', currency, maximumFractionDigits: 0 })}
              </div>
            </div>
          )}

          {/* Caractéristiques */}
          {attributes.length > 0 && (
            <div className="section">
              <h2 className="section-title">Caractéristiques</h2>
              <div className="attrs-card">
                {attributes.map(([key, val], i) => (
                  <div key={key} className={`attr-row ${i > 0 ? 'sep' : ''}`}>
                    <span className="attr-key">{key}</span>
                    <span className="attr-val">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Documents */}
          {documents.length > 0 && (
            <div className="section">
              <h2 className="section-title">Documents</h2>
              <div className="docs-card">
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
  .header {
    background: #fff;
    border-bottom: 1px solid #E8E2DA;
    position: sticky; top: 0; z-index: 10;
  }
  .header-inner {
    max-width: 900px; margin: 0 auto;
    padding: 0 20px; height: 60px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .logo { display: flex; align-items: center; gap: 8px; text-decoration: none; }
  .logo-box {
    width: 30px; height: 30px; border-radius: 8px;
    background: #F26900; color: white;
    display: grid; place-items: center; font-weight: 800;
  }
  .logo-text { font-weight: 800; font-size: 18px; color: #1A1612; }
  .back-link { font-size: 14px; color: #6B6158; text-decoration: none; font-weight: 600; }
  .back-link:hover { color: #F26900; }

  .main { flex: 1; max-width: 900px; margin: 0 auto; padding: 24px 20px 48px; width: 100%; }

  /* Galerie */
  .gallery { margin-bottom: 20px; }
  .gallery-main {
    width: 100%; aspect-ratio: 4/3; border-radius: 16px; overflow: hidden;
    background: #F0EBE3; display: grid; place-items: center;
  }
  .gallery-img { width: 100%; height: 100%; object-fit: cover; }
  .gallery-placeholder { font-size: 64px; }
  .gallery-thumbs { display: flex; gap: 8px; margin-top: 8px; overflow-x: auto; }
  .thumb {
    width: 56px; height: 56px; border-radius: 10px; overflow: hidden;
    border: 2px solid transparent; padding: 0; cursor: pointer; flex-shrink: 0;
    background: #F0EBE3;
  }
  .thumb.active { border-color: #F26900; }
  .thumb img { width: 100%; height: 100%; object-fit: cover; }

  /* Détail */
  .detail-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 8px; }
  .detail-title { font-size: 26px; font-weight: 800; line-height: 1.25; }
  .status-row { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
  .status-dot { width: 8px; height: 8px; border-radius: 50%; }
  .status-label { font-size: 13px; color: #6B6158; font-weight: 600; }
  .location { font-size: 13px; color: #A89F96; margin-top: 8px; }
  .description { font-size: 15px; color: #4A443E; line-height: 1.6; margin-top: 12px; }

  .section { margin-top: 28px; }
  .section-title {
    font-size: 12px; font-weight: 700; color: #A89F96;
    text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 10px;
  }

  .value-box {
    background: #fff; border: 1px solid #E8E2DA; border-radius: 16px;
    padding: 20px; font-size: 28px; font-weight: 800; color: #F26900;
  }

  .attrs-card, .docs-card {
    background: #fff; border: 1px solid #E8E2DA; border-radius: 16px; overflow: hidden;
  }
  .attr-row { display: flex; justify-content: space-between; padding: 14px 16px; gap: 12px; }
  .attr-row.sep { border-top: 1px solid #F0EBE3; }
  .attr-key { font-size: 13px; color: #A89F96; font-weight: 600; }
  .attr-val { font-size: 14px; color: #1A1612; font-weight: 500; text-align: right; }

  .doc-row {
    display: flex; align-items: center; gap: 12px; padding: 14px 16px;
    text-decoration: none; color: inherit;
  }
  .doc-row.sep { border-top: 1px solid #F0EBE3; }
  .doc-row:hover { background: #FDF9F5; }
  .doc-icon { font-size: 22px; }
  .doc-info { display: flex; flex-direction: column; gap: 2px; }
  .doc-name { font-size: 14px; font-weight: 600; color: #1A1612; }
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

  @media (max-width: 600px) {
    .detail-title { font-size: 21px; }
    .detail-header { flex-direction: column; align-items: flex-start; gap: 6px; }
  }
`
