// apps/next/pages/share/o/[shareSlug]/[objectId].tsx
/* eslint-disable no-console */
import Head from 'next/head'
import type { GetServerSidePropsContext, NextPageContext } from 'next'
import { useRouter } from 'next/router'
import { Theme, Text, Button } from 'tamagui'

import LightboxGallery from '../../../../components/LightboxGallery'
import HeaderTiroirWeb from '../../../../components/layout/HeaderTiroirWeb'
import { hasValidCookie, makeCookieName, COOKIE_MAX_AGE_SEC } from '../../../../lib/shareAuth'
import { getStatusMeta } from '../../../../lib/statuses'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { hasSignedCookie } from '../../../../lib/shareCookieSignature'

type SharedObjectPageProps = {
  slug: string
  gated: boolean
  object: {
    id: string
    title: string
    image_urls?: string[]
    status?: string
    description?: string
    created_at?: string
    characteristics?: Record<string, string>
    memory_notes?: Array<{ date?: string; note?: string }>
  } | null
}

// ---- Supabase (server)
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createSupabaseAdmin(url, key, { auth: { persistSession: false } })
}

export const getServerSideProps = async (ctx: GetServerSidePropsContext) => {
  try {
    const shareSlug = String(ctx.params?.shareSlug || '').trim()
    const objectId = String(ctx.params?.objectId || '').trim()
    if (!shareSlug || !objectId) return { notFound: true }

    const supabase = getSupabaseAdmin()

    // shared link
    const { data: sharedLink, error: linkErr } = await supabase
      .from('shared_links')
      .select('id, slug, object_ids, visibility, expires_at')
      .eq('slug', shareSlug)
      .single()
    if (linkErr || !sharedLink) return { notFound: true }
    if (sharedLink.expires_at && new Date(sharedLink.expires_at).getTime() < Date.now()) {
      return { notFound: true }
    }
    if (!Array.isArray(sharedLink.object_ids) || !sharedLink.object_ids.includes(objectId)) {
      return { notFound: true }
    }

    const isPrivate = sharedLink.visibility === 'private' || sharedLink.visibility === 'privé'
    // Clé SIGNÉE exigée : l'ancienne « auth douce » (tout cookie frais)
    // laissait passer un cookie fabriqué.
    const authorized = !isPrivate || hasSignedCookie(shareSlug, ctx.req)
    if (!authorized) return { props: { slug: shareSlug, gated: true, object: null } }

    // objet
    let objectRow: any | null = null
    const { data: rpcData, error: rpcErr } = await supabase.rpc('get_shared_object_by_slug', {
      slug_input: shareSlug,
      object_id: objectId,
    })
    if (!rpcErr && Array.isArray(rpcData) && rpcData.length > 0) {
      objectRow = rpcData[0]
    } else {
      const table = process.env.OBJECTS_TABLE || 'objets'
      const { data, error } = await supabase
        .from(table)
        .select(
          'id, title, description, status, image_urls, created_at, characteristics, memory_notes'
        )
        .eq('id', objectId)
        .single()
      if (error || !data) return { notFound: true }
      objectRow = data
    }

    return { props: { slug: shareSlug, gated: false, object: objectRow } }
  } catch (e) {
    console.error('[detail] getServerSideProps failed', e)
    return { notFound: true }
  }
}

// ---- Page
export default function SharedObjectPage({ slug, gated, object }: SharedObjectPageProps) {
  const router = useRouter()

  if (gated) {
    return (
      <Theme name="light">
        <Head>
          <meta name="robots" content="noindex,nofollow" />
        </Head>
        <HeaderTiroirWeb />
        <div className="container">
          <div className="card" style={{ padding: 20 }}>
            <Text fontSize="$6" fontWeight="700">
              Ce partage est protégé.
            </Text>
            <Text fontSize="$3" color="$gray11">
              Retourne à la page du partage pour saisir le mot de passe.
            </Text>
            <div style={{ height: 12 }} />
            <Button onPress={() => router.push(`/share/${slug}`)} borderRadius="$4">
              Retour au partage
            </Button>
          </div>
        </div>
        <Styles />
      </Theme>
    )
  }

  if (!object) return null

  const statusMeta = object.status ? getStatusMeta(object.status) : null
  const images = (object.image_urls || []).map((src, i) => ({
    src,
    alt: `${object.title || 'Image objet'} ${i + 1}`,
  }))
  const formatDate = (iso?: string) =>
    iso
      ? new Date(iso).toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        })
      : ''

  return (
    <Theme name="light">
      <Head>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <HeaderTiroirWeb />

      <div className="container">
        {/* Bouton retour */}
        <button className="back" onClick={() => router.back()}>
          ← Retour
        </button>

        {/* HERO — layout constant */}
        <div className="card hero">
          <div className="hero-grid">
            <div className="hero-media">
              {/* Visionneuse + miniatures cliquables + lightbox plein écran */}
              {images.length > 0 ? (
                <LightboxGallery images={images} thumbnailSize={56} />
              ) : (
                <div className="media-empty">Aucune image</div>
              )}
            </div>

            <div className="hero-info">
              <h1 className="title">{object.title}</h1>

              {statusMeta && (
                <div className="status">
                  <span
                    className="dot"
                    style={{
                      background: `var(${
                        statusMeta.color?.startsWith('--') ? statusMeta.color : '--orange'
                      })`,
                    }}
                  />
                  <span>{statusMeta.label}</span>
                </div>
              )}

              {object.created_at && (
                <p className="muted">Ajouté le {formatDate(object.created_at)}</p>
              )}

              {object.description && (
                <>
                  <h3 className="section-h">Description</h3>
                  <p className="body">{object.description}</p>
                </>
              )}

              <button
                className="btn btn-primary"
                onClick={() =>
                  (window.location.href = `mailto:hello@tiroir.app?subject=${encodeURIComponent(
                    'Contact à propos de ' + (object.title || 'un objet')
                  )}`)
                }
              >
                Contacter le propriétaire
              </button>
            </div>
          </div>
        </div>

        {/* Caractéristiques */}
        <div className="card">
          <h2 className="block-title">Caractéristiques</h2>
          {object.characteristics && Object.keys(object.characteristics).length ? (
            <div className="kv">
              {Object.entries(object.characteristics).map(([k, v]) => (
                <div className="kv-row" key={k}>
                  <div className="kv-k">{k}</div>
                  <div className="kv-v">{String(v)}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">Aucune caractéristique renseignée.</p>
          )}
        </div>

        {/* Souvenirs */}
        <div className="card">
          <h2 className="block-title">Souvenirs</h2>
          {Array.isArray(object.memory_notes) && object.memory_notes.length ? (
            <div className="notes">
              {object.memory_notes.map((n, i) => (
                <div className="note" key={i}>
                  <div className="note-date">{n.date || ''}</div>
                  <div className="note-body">“{n.note}”</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="muted">Aucun souvenir rattaché.</p>
          )}
        </div>
      </div>

      <Styles />
    </Theme>
  )
}

/** —————————————————————————————————————————
 *  Styles (uniformes, responsive)
 *  ————————————————————————————————————————— */
function Styles() {
  return (
    <style jsx global>{`
      body {
        background-color: #f9f6f1;
      }
      .container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 16px;
      }
      .back {
        appearance: none;
        background: transparent;
        border: 0;
        font-weight: 600;
        cursor: pointer;
        margin: 8px 0 16px;
      }
      .card {
        background: #fff;
        border: 1px solid rgba(0, 0, 0, 0.08);
        border-radius: 16px;
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.06);
        padding: 20px;
        margin-bottom: 20px;
      }

      /* HERO */
      .hero {
        padding: 24px;
      }
      .hero-grid {
        display: grid;
        grid-template-columns: minmax(280px, 560px) 1fr;
        gap: 24px;
        align-items: start;
      }
      .hero-media {}
      .media-empty {
        display: grid;
        place-items: center;
        height: 280px;
        border-radius: 12px;
        background: #F9F6F1;
        color: #777;
      }

      .hero-info {
        min-width: 280px;
      }
      .title {
        font-size: 28px;
        line-height: 1.2;
        margin: 0 0 8px;
      }
      .status {
        display: inline-flex;
        gap: 8px;
        align-items: center;
        font-weight: 600;
        margin-bottom: 4px;
      }
      .dot {
        width: 10px;
        height: 10px;
        border-radius: 999px;
        display: inline-block;
        background: #0ea5e9;
      }
      .section-h {
        font-size: 16px;
        margin: 14px 0 6px;
      }
      .body {
        color: #555;
        line-height: 1.55;
      }
      .muted {
        color: #777;
      }

      .btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 12px 16px;
        border-radius: 12px;
        border: 0;
        cursor: pointer;
        font-weight: 700;
      }
      .btn-primary {
        background: var(--orange, #f26900);
        color: #fff;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.06);
        margin-top: 12px;
      }
      .btn-primary:hover {
        background: #d85e00;
      }

      /* Caractéristiques (tableau simple) */
      .block-title {
        font-size: 20px;
        margin: 0 0 12px;
      }
      .kv {
        display: grid;
      }
      .kv-row {
        display: grid;
        grid-template-columns: 200px 1fr;
        padding: 10px 0;
        border-top: 1px solid rgba(0, 0, 0, 0.06);
      }
      .kv-row:first-child {
        border-top: 0;
      }
      .kv-k {
        color: #666;
      }
      .kv-v {
        font-weight: 600;
      }

      /* Souvenirs */
      .notes {
        display: grid;
        gap: 10px;
      }
      .note {
        display: grid;
        grid-template-columns: 160px 1fr;
        gap: 16px;
        padding: 10px 0;
        border-top: 1px solid rgba(0, 0, 0, 0.06);
      }
      .note:first-child {
        border-top: 0;
      }
      .note-date {
        color: #666;
        font-weight: 600;
      }
      .note-body {
        color: #444;
      }

      /* Responsive */
      @media (max-width: 900px) {
        .hero-grid {
          grid-template-columns: 1fr;
        }
        .kv-row {
          grid-template-columns: 1fr;
          gap: 4px;
        }
        .note {
          grid-template-columns: 1fr;
        }
      }
    `}</style>
  )
}