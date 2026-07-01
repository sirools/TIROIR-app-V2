// pages/s/[token].tsx — Page publique V2 (share_links table)
import type { GetServerSidePropsContext } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { createClient } from '@supabase/supabase-js'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SharedObject {
  id: string
  title: string
  description: string | null
  status: string | null
  location_note: string | null
  cover_url: string | null
}

interface Props {
  token: string
  title: string
  objects: SharedObject[]
  allowDownload: boolean
  error?: 'not_found' | 'expired'
}

// ── Status helpers ─────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  owned: 'Possédé', stored: 'En stockage', loaned: 'Prêté',
  sold: 'Vendu', given: 'Donné', lost: 'Perdu',
}
const STATUS_COLOR: Record<string, string> = {
  owned: '#22C55E', stored: '#38BDF8', loaned: '#E879F9',
  sold: '#FBBF24', given: '#FB7185', lost: '#9CA3AF',
}

// ── SSR ───────────────────────────────────────────────────────────────────────

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const token = (ctx.params?.token as string || '').trim()
  const supabase = getAdmin()

  const { data: link, error: linkErr } = await supabase
    .from('share_links')
    .select('title, object_ids, options, expires_at')
    .eq('token', token)
    .single()

  if (linkErr || !link) return { props: { error: 'not_found', title: '', objects: [], allowDownload: false } }
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return { props: { error: 'expired', title: '', objects: [], allowDownload: false } }
  }

  const ids: string[] = Array.isArray(link.object_ids) ? link.object_ids : []

  const { data: objData } = await supabase
    .from('objects')
    .select('id, title, description, status, location_note')
    .in('id', ids)

  // Covers
  const { data: imgData } = await supabase
    .from('object_images')
    .select('object_id, storage_path')
    .in('object_id', ids)
    .eq('is_cover', true)

  const coverPaths: Record<string, string> = {}
  if (imgData) for (const img of imgData) coverPaths[img.object_id] = img.storage_path

  const paths = Object.values(coverPaths)
  const coverUrls: Record<string, string> = {}
  if (paths.length) {
    const { data: signed } = await supabase.storage
      .from('object-images')
      .createSignedUrls(paths, 3600)
    if (signed) {
      for (const s of signed) {
        const objId = Object.entries(coverPaths).find(([, p]) => p === s.path)?.[0]
        if (objId && s.signedUrl) coverUrls[objId] = s.signedUrl
      }
    }
  }

  const objects: SharedObject[] = (objData ?? []).map((o: any) => ({
    ...o,
    cover_url: coverUrls[o.id] ?? null,
  }))

  return {
    props: {
      token,
      title: link.title ?? 'Partage TiROiR',
      objects,
      allowDownload: link.options?.allow_download ?? false,
    },
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ShareV2Page({ token, title, objects, allowDownload, error }: Props) {
  const router = useRouter()
  const pageTitle = error ? 'Lien introuvable — TiROiR' : `${title} — TiROiR`

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="root">
        {/* Header */}
        <header className="header">
          <div className="header-inner">
            <Link href="/" legacyBehavior passHref>
              <a className="logo">
                <div className="logo-box">T</div>
                <strong className="logo-text">TiROiR</strong>
              </a>
            </Link>
            <span className="count">
              {!error && `${objects.length} objet${objects.length !== 1 ? 's' : ''}`}
            </span>
          </div>
        </header>

        <main className="main">
          {error ? (
            <div className="error-state">
              <div className="error-icon">{error === 'expired' ? '⏱' : '🔍'}</div>
              <h1 className="error-title">
                {error === 'expired' ? 'Ce lien a expiré' : 'Lien introuvable'}
              </h1>
              <p className="error-sub">
                {error === 'expired'
                  ? 'Demandez un nouveau lien au propriétaire.'
                  : 'Vérifiez l\'adresse ou demandez un nouveau lien.'}
              </p>
              <Link href="/" legacyBehavior passHref>
                <a className="cta-btn">Découvrir TiROiR</a>
              </Link>
            </div>
          ) : (
            <>
              <div className="page-hero">
                <h1 className="page-title">{title}</h1>
                <p className="page-sub">Partagé via TiROiR · {objects.length} objet{objects.length !== 1 ? 's' : ''}</p>
              </div>

              <div className="grid">
                {objects.map(obj => (
                  <div
                    key={obj.id}
                    className="card"
                    onClick={() => router.push(`/s/${token}/${obj.id}`)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="card-cover">
                      {obj.cover_url
                        ? <img src={obj.cover_url} alt={obj.title} className="cover-img" />
                        : <div className="cover-placeholder">📦</div>
                      }
                    </div>
                    <div className="card-body">
                      <h2 className="card-title">{obj.title}</h2>
                      {obj.status && (
                        <div className="status-row">
                          <span
                            className="status-dot"
                            style={{ background: STATUS_COLOR[obj.status] ?? '#9CA3AF' }}
                          />
                          <span className="status-label">
                            {STATUS_LABEL[obj.status] ?? obj.status}
                          </span>
                        </div>
                      )}
                      {obj.location_note && (
                        <p className="location">📍 {obj.location_note}</p>
                      )}
                      {obj.description && (
                        <p className="description">{obj.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {allowDownload && (
                <div className="download-row">
                  <button className="download-btn" disabled>
                    ↓ Télécharger (.PDF / .CSV)
                  </button>
                </div>
              )}

              <div className="app-cta">
                <h2 className="app-cta-title">Créez votre inventaire personnel</h2>
                <p className="app-cta-sub">TiROiR — photographiez, cataloguez, retrouvez.</p>
                <Link href="/" legacyBehavior passHref>
                  <a className="cta-btn">Découvrir TiROiR →</a>
                </Link>
              </div>
            </>
          )}
        </main>

        <footer className="footer">
          <Link href="/privacy" legacyBehavior passHref>
            <a className="footer-link">Politique de confidentialité</a>
          </Link>
          <span className="footer-sep">·</span>
          <span className="footer-copy">© 2026 TiROiR</span>
        </footer>
      </div>

      <style jsx>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .root {
          min-height: 100vh;
          background: #F7F3EE;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          color: #1A1612;
          display: flex; flex-direction: column;
        }

        /* Header */
        .header {
          background: #fff;
          border-bottom: 1px solid #E8E2DA;
          position: sticky; top: 0; z-index: 10;
        }
        .header-inner {
          max-width: 1200px; margin: 0 auto;
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
        .count { font-size: 13px; color: #A89F96; }

        /* Main */
        .main { flex: 1; max-width: 1200px; margin: 0 auto; padding: 32px 20px; width: 100%; }

        /* Page hero */
        .page-hero { margin-bottom: 28px; }
        .page-title { font-size: 28px; font-weight: 800; color: #1A1612; line-height: 1.2; }
        .page-sub { font-size: 14px; color: #A89F96; margin-top: 6px; }

        /* Grid */
        .grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 20px;
          margin-bottom: 32px;
        }

        /* Card */
        .card {
          background: #fff;
          border-radius: 16px;
          border: 1px solid #E8E2DA;
          overflow: hidden;
          cursor: pointer;
          transition: box-shadow 0.15s, transform 0.15s;
        }
        .card:hover {
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
          transform: translateY(-2px);
        }
        .card-cover { aspect-ratio: 1; overflow: hidden; background: #F0EBE3; }
        .cover-img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .cover-placeholder {
          width: 100%; height: 100%;
          display: grid; place-items: center;
          font-size: 48px;
        }
        .card-body { padding: 16px; display: flex; flex-direction: column; gap: 6px; }
        .card-title { font-size: 15px; font-weight: 600; color: #1A1612; line-height: 1.3; }
        .status-row { display: flex; align-items: center; gap: 6px; }
        .status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .status-label { font-size: 12px; color: #6B6158; }
        .location { font-size: 12px; color: #A89F96; }
        .description { font-size: 13px; color: #6B6158; line-height: 1.5;
          display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
          overflow: hidden; }

        /* Download */
        .download-row { display: flex; justify-content: center; margin-bottom: 32px; }
        .download-btn {
          padding: 12px 24px; border-radius: 12px;
          border: 1.5px solid #F26900; background: transparent;
          color: #F26900; font-weight: 600; font-size: 15px;
          cursor: pointer; opacity: 0.5;
        }

        /* App CTA */
        .app-cta {
          background: #fff; border-radius: 20px; border: 1px solid #E8E2DA;
          padding: 40px 24px; text-align: center; margin-bottom: 32px;
        }
        .app-cta-title { font-size: 22px; font-weight: 800; color: #1A1612; }
        .app-cta-sub { font-size: 14px; color: #6B6158; margin: 8px 0 20px; }
        .cta-btn {
          display: inline-block;
          background: #F26900; color: white;
          padding: 14px 28px; border-radius: 999px;
          font-weight: 700; font-size: 15px; text-decoration: none;
          transition: background 0.15s;
        }
        .cta-btn:hover { background: #D85E00; }

        /* Error state */
        .error-state {
          display: flex; flex-direction: column; align-items: center;
          gap: 16px; padding: 80px 24px; text-align: center;
        }
        .error-icon { font-size: 56px; }
        .error-title { font-size: 26px; font-weight: 800; color: #1A1612; }
        .error-sub { font-size: 15px; color: #6B6158; max-width: 340px; line-height: 1.5; }

        /* Footer */
        .footer {
          display: flex; align-items: center; justify-content: center;
          gap: 8px; padding: 20px;
          border-top: 1px solid #E8E2DA;
        }
        .footer-link { font-size: 12px; color: #A89F96; text-decoration: underline; }
        .footer-sep { font-size: 12px; color: #A89F96; }
        .footer-copy { font-size: 12px; color: #A89F96; }

        @media (max-width: 600px) {
          .grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
          .page-title { font-size: 22px; }
        }
      `}</style>
    </>
  )
}
