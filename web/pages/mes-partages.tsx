import type { GetServerSideProps } from 'next'
import Head from 'next/head'
import { useState } from 'react'
import { supabase, serverSupabase, adminSupabase } from '../lib/supabase'
import HeaderTiroirWeb from '../components/layout/HeaderTiroirWeb'
import FooterTiroirWeb from '../components/layout/FooterTiroirWeb'

interface ShareOptions {
  password_protected?: boolean
  password_hash?: string | null
  allow_download?: boolean
  include_documents?: boolean
  contact_name?: string | null
  contact_email?: string | null
  contact_phone?: string | null
}

interface ShareLinkCard {
  id: string
  token: string
  title: string
  objectCount: number
  createdAt: string
  expiresAt: string | null
  options: ShareOptions
  isArchived: boolean
}

interface Props {
  shares: ShareLinkCard[]
}

async function sha256Hex(value: string) {
  const encoded = new TextEncoder().encode(value)
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── Modale de paramètres ────────────────────────────────────────────────────────

function ShareSettingsModal({
  share,
  onClose,
  onSaved,
}: {
  share: ShareLinkCard
  onClose: () => void
  onSaved: (updated: { isArchived: boolean; options: ShareOptions }) => void
}) {
  const [isPrivate, setIsPrivate] = useState(!!share.options.password_protected)
  const [isArchived, setIsArchived] = useState(share.isArchived)
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSave() {
    setError(null)

    const wasPrivate = !!share.options.password_protected
    const trimmed = password.trim()

    if (isPrivate && !wasPrivate && trimmed.length < 4) {
      setError('Renseigne un mot de passe (4 caractères minimum) pour passer en privé.')
      return
    }

    setSaving(true)
    try {
      const nextOptions: ShareOptions = { ...share.options, password_protected: isPrivate }
      if (isPrivate && trimmed.length >= 4) {
        nextOptions.password_hash = await sha256Hex(trimmed)
      }

      const { error: updateError } = await supabase
        .from('share_links')
        .update({ options: nextOptions, is_archived: isArchived })
        .eq('id', share.id)

      if (updateError) {
        setError("Impossible d'enregistrer les modifications. Réessaie.")
        return
      }

      onSaved({ isArchived, options: nextOptions })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2 className="modal-title">Paramètres du partage</h2>
        <p className="modal-sub">{share.title}</p>

        <div className="field">
          <span className="field-label">Visibilité</span>
          <div className="segmented">
            <button
              type="button"
              className={`segment ${!isPrivate ? 'active' : ''}`}
              onClick={() => setIsPrivate(false)}
            >
              Public
            </button>
            <button
              type="button"
              className={`segment ${isPrivate ? 'active' : ''}`}
              onClick={() => setIsPrivate(true)}
            >
              🔒 Privé
            </button>
          </div>
          {isPrivate && (
            <input
              type="password"
              className="password-input"
              placeholder={share.options.password_protected ? 'Laisser vide pour garder le mot de passe actuel' : 'Mot de passe (min. 4 car.)'}
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          )}
        </div>

        <div className="field">
          <span className="field-label">Statut</span>
          <div className="segmented">
            <button
              type="button"
              className={`segment ${!isArchived ? 'active' : ''}`}
              onClick={() => setIsArchived(false)}
            >
              Actif
            </button>
            <button
              type="button"
              className={`segment ${isArchived ? 'active' : ''}`}
              onClick={() => setIsArchived(true)}
            >
              Archivé
            </button>
          </div>
          {isArchived && (
            <p className="field-hint">Le lien cessera de fonctionner pour toute personne qui l&apos;a déjà.</p>
          )}
        </div>

        {error && <p className="modal-error">{error}</p>}

        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>Annuler</button>
          <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed; inset: 0; background: rgba(26, 22, 18, 0.45);
          display: flex; align-items: center; justify-content: center;
          padding: 20px; z-index: 100;
        }
        .modal {
          background: #fff; border-radius: 20px; padding: 28px;
          width: 100%; max-width: 380px; box-shadow: 0 20px 60px rgba(0,0,0,0.2);
        }
        .modal-title { font-size: 19px; font-weight: 800; color: var(--ink); }
        .modal-sub { font-size: 13px; color: var(--text-tertiary); margin-top: 4px; margin-bottom: 20px; }
        .field { margin-bottom: 20px; }
        .field-label {
          display: block; font-size: 12px; font-weight: 700; color: var(--muted);
          text-transform: uppercase; letter-spacing: 0.4px; margin-bottom: 8px;
        }
        .segmented { display: flex; gap: 4px; padding: 4px; background: var(--border-light); border-radius: 12px; }
        .segment {
          flex: 1; padding: 9px 12px; border-radius: 9px; border: 0; background: transparent;
          color: var(--muted); font-size: 13px; font-weight: 600; cursor: pointer;
          transition: background 0.15s, color 0.15s;
        }
        .segment.active { background: #fff; color: var(--ink); box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
        .password-input {
          width: 100%; margin-top: 10px; padding: 11px 14px; border-radius: 12px;
          border: 1px solid rgba(0,0,0,0.12); font-size: 14px; box-sizing: border-box;
        }
        .field-hint { font-size: 12px; color: #C0392B; margin-top: 8px; line-height: 1.4; }
        .modal-error { font-size: 13px; color: #C0392B; font-weight: 600; margin-bottom: 12px; }
        .modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px; }
        .btn-ghost {
          padding: 10px 16px; border-radius: 12px; border: 1px solid rgba(0,0,0,0.12);
          background: transparent; color: var(--muted); font-size: 14px; font-weight: 600; cursor: pointer;
        }
        .btn-primary {
          padding: 10px 18px; border-radius: 12px; border: 0;
          background: #F26900; color: #fff; font-size: 14px; font-weight: 700; cursor: pointer;
        }
        .btn-primary:disabled, .btn-ghost:disabled { opacity: 0.6; cursor: default; }
      `}</style>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function MesPartages({ shares: initialShares }: Props) {
  const now = Date.now()
  const [sortAsc, setSortAsc] = useState(false)
  const [shares, setShares] = useState(initialShares)
  const [editingToken, setEditingToken] = useState<string | null>(null)

  const sorted = [...shares].sort((a, b) => {
    const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    return sortAsc ? diff : -diff
  })

  const editingShare = shares.find(s => s.token === editingToken) ?? null

  return (
    <>
      <Head>
        <title>Mes partages — TiROiR</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <HeaderTiroirWeb />

      <main className="main">
        <div className="page-hero">
          <div>
            <h1 className="page-title">Mes partages</h1>
            <p className="page-sub">
              {shares.length} partage{shares.length !== 1 ? 's' : ''} actif{shares.length !== 1 ? 's' : ''}
            </p>
          </div>
          {shares.length > 1 && (
            <button className="sort-btn" onClick={() => setSortAsc(v => !v)} type="button">
              <span className="sort-arrow">{sortAsc ? '↑' : '↓'}</span>
              {sortAsc ? 'Plus anciens d’abord' : 'Plus récents d’abord'}
            </button>
          )}
        </div>

        {shares.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔗</div>
            <h2 className="empty-title">Aucun partage pour le moment</h2>
            <p className="empty-sub">Crée un partage depuis l&apos;app TiROiR pour le retrouver ici.</p>
          </div>
        ) : (
          <div className="grid">
            {sorted.map(share => {
              const isExpired = share.expiresAt ? new Date(share.expiresAt).getTime() < now : false
              const isUnavailable = isExpired || share.isArchived
              return (
                <a
                  key={share.token}
                  href={`/s/${share.token}`}
                  className={`card ${isUnavailable ? 'expired' : ''}`}
                >
                  <div className="card-icon">🔗</div>
                  <div className="card-body">
                    <h2 className="card-title">{share.title}</h2>
                    <p className="card-meta">
                      {share.objectCount} objet{share.objectCount !== 1 ? 's' : ''}
                      {share.options.password_protected && ' · 🔒 Privé'}
                    </p>
                    <p className="card-date">
                      Créé le {new Date(share.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    {(share.options.contact_name || share.options.contact_email) && (
                      <p className="card-contact">
                        👤 {[share.options.contact_name, share.options.contact_email].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    {share.isArchived
                      ? <span className="badge-expired">Archivé</span>
                      : isExpired && <span className="badge-expired">Expiré</span>
                    }
                  </div>
                  <button
                    type="button"
                    className="settings-btn"
                    aria-label="Paramètres du partage"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditingToken(share.token) }}
                  >
                    ⚙️
                  </button>
                </a>
              )
            })}
          </div>
        )}
      </main>
      <FooterTiroirWeb />

      {editingShare && (
        <ShareSettingsModal
          share={editingShare}
          onClose={() => setEditingToken(null)}
          onSaved={({ isArchived, options }) => {
            setShares(prev => prev.map(s => s.token === editingShare.token ? { ...s, isArchived, options } : s))
            setEditingToken(null)
          }}
        />
      )}

      <style jsx>{`
        .main { max-width: 1200px; width: 100%; margin: 0 auto; padding: 32px 24px 56px; box-sizing: border-box; }

        .page-hero {
          display: flex; align-items: flex-end; justify-content: space-between;
          flex-wrap: wrap; gap: 12px; margin-bottom: 28px;
        }
        .page-title { font-size: 28px; font-weight: 800; color: var(--ink); line-height: 1.2; }
        .page-sub { font-size: 14px; color: var(--text-tertiary); margin-top: 6px; }

        .sort-btn {
          display: inline-flex; align-items: center; gap: 6px;
          background: #fff; border: 1px solid rgba(0,0,0,0.1); border-radius: 999px;
          padding: 9px 16px; font-size: 13px; font-weight: 600; color: #4A443E;
          cursor: pointer; transition: border-color 0.15s, color 0.15s;
        }
        .sort-btn:hover { border-color: #F26900; color: #F26900; }
        .sort-arrow { font-size: 14px; }

        .grid {
          display: grid;
          width: 100%;
          grid-template-columns: 1fr;
          gap: 20px;
        }
        @media (min-width: 640px) {
          .grid { grid-template-columns: 1fr 1fr; }
        }
        @media (min-width: 980px) {
          .grid { grid-template-columns: 1fr 1fr 1fr; }
        }
        @media (min-width: 1240px) {
          .grid { grid-template-columns: 1fr 1fr 1fr 1fr; }
        }

        .card {
          position: relative;
          display: flex; align-items: flex-start; gap: 14px;
          background: #fff; border: 1px solid rgba(0,0,0,0.06); border-radius: 16px;
          box-shadow: 0 6px 20px rgba(0,0,0,0.06);
          padding: 20px;
          text-decoration: none; color: inherit;
          transition: box-shadow 0.15s, transform 0.15s;
          min-width: 0;
        }
        .card:hover { box-shadow: 0 10px 28px rgba(0,0,0,0.1); transform: translateY(-2px); }
        .card.expired { opacity: 0.55; }

        .card-icon {
          width: 40px; height: 40px; border-radius: 10px;
          background: #FFF4E6; display: grid; place-items: center;
          font-size: 18px; flex-shrink: 0;
        }
        .card-body { min-width: 0; flex: 1; padding-right: 24px; }
        .card-title {
          font-size: 15px; font-weight: 700; color: var(--ink);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .card-meta { font-size: 13px; color: var(--muted); margin-top: 4px; }
        .card-date { font-size: 12px; color: var(--text-tertiary); margin-top: 8px; }
        .card-contact {
          font-size: 12px; color: var(--muted); margin-top: 6px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .badge-expired {
          display: inline-block; margin-top: 8px;
          background: #FDECEA; color: #C0392B;
          font-size: 11px; font-weight: 700; text-transform: uppercase;
          padding: 3px 8px; border-radius: 999px;
        }

        .settings-btn {
          position: absolute; top: 14px; right: 14px;
          width: 30px; height: 30px; border-radius: 9px; border: 0;
          background: var(--beige-2); font-size: 14px; cursor: pointer;
          display: grid; place-items: center; flex-shrink: 0;
          transition: background 0.15s;
        }
        .settings-btn:hover { background: var(--border-light); }

        .empty-state {
          display: flex; flex-direction: column; align-items: center;
          gap: 12px; padding: 80px 24px; text-align: center;
        }
        .empty-icon { font-size: 56px; }
        .empty-title { font-size: 20px; font-weight: 800; color: var(--ink); }
        .empty-sub { font-size: 14px; color: var(--muted); }
      `}</style>
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const supabase = serverSupabase(ctx)
  // getUser() et non getSession() : getSession() lit le cookie sans vérifier
  // sa signature ; un cookie fabriqué passerait. getUser() fait valider le
  // jeton par Supabase avant toute lecture avec la clé service.
  const { data: { user: verifiedUser } } = await supabase.auth.getUser()
  const session = verifiedUser ? { user: verifiedUser } : null

  if (!session) {
    return { redirect: { destination: '/login', permanent: false } }
  }

  const admin = adminSupabase()
  const { data: links } = await admin
    .from('share_links')
    .select('id, token, title, object_ids, options, created_at, expires_at, is_archived')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })

  const shares: ShareLinkCard[] = (links ?? []).map(l => ({
    id: l.id,
    token: l.token,
    title: l.title ?? 'Partage sans titre',
    objectCount: Array.isArray(l.object_ids) ? l.object_ids.length : 0,
    createdAt: l.created_at,
    expiresAt: l.expires_at,
    options: l.options ?? {},
    isArchived: !!l.is_archived,
  }))

  return { props: { shares } }
}
