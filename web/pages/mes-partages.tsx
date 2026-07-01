import type { GetServerSideProps } from 'next'
import Head from 'next/head'
import { useState } from 'react'
import { serverSupabase, adminSupabase } from '../lib/supabase'
import HeaderTiroirWeb from '../components/layout/HeaderTiroirWeb'

interface ShareLinkCard {
  token: string
  title: string
  objectCount: number
  createdAt: string
  expiresAt: string | null
  passwordProtected: boolean
}

interface Props {
  shares: ShareLinkCard[]
}

export default function MesPartages({ shares }: Props) {
  const now = Date.now()
  const [sortAsc, setSortAsc] = useState(false)

  const sorted = [...shares].sort((a, b) => {
    const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    return sortAsc ? diff : -diff
  })

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
              return (
                <a
                  key={share.token}
                  href={`/s/${share.token}`}
                  className={`card ${isExpired ? 'expired' : ''}`}
                >
                  <div className="card-icon">🔗</div>
                  <div className="card-body">
                    <h2 className="card-title">{share.title}</h2>
                    <p className="card-meta">
                      {share.objectCount} objet{share.objectCount !== 1 ? 's' : ''}
                      {share.passwordProtected && ' · 🔒 Protégé'}
                    </p>
                    <p className="card-date">
                      Créé le {new Date(share.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                    {isExpired && <span className="badge-expired">Expiré</span>}
                  </div>
                </a>
              )
            })}
          </div>
        )}
      </main>

      <style jsx>{`
        .main { max-width: 1300px; width: 100%; margin: 0 auto; padding: 32px 20px 56px; box-sizing: border-box; }

        .page-hero {
          display: flex; align-items: flex-end; justify-content: space-between;
          flex-wrap: wrap; gap: 12px; margin-bottom: 28px;
        }
        .page-title { font-size: 28px; font-weight: 800; color: #1A1612; line-height: 1.2; }
        .page-sub { font-size: 14px; color: #A89F96; margin-top: 6px; }

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
        .card-body { min-width: 0; flex: 1; }
        .card-title {
          font-size: 15px; font-weight: 700; color: #1A1612;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .card-meta { font-size: 13px; color: #6B6158; margin-top: 4px; }
        .card-date { font-size: 12px; color: #A89F96; margin-top: 8px; }
        .badge-expired {
          display: inline-block; margin-top: 8px;
          background: #FDECEA; color: #C0392B;
          font-size: 11px; font-weight: 700; text-transform: uppercase;
          padding: 3px 8px; border-radius: 999px;
        }

        .empty-state {
          display: flex; flex-direction: column; align-items: center;
          gap: 12px; padding: 80px 24px; text-align: center;
        }
        .empty-icon { font-size: 56px; }
        .empty-title { font-size: 20px; font-weight: 800; color: #1A1612; }
        .empty-sub { font-size: 14px; color: #6B6158; }
      `}</style>
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const supabase = serverSupabase(ctx)
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return { redirect: { destination: '/login', permanent: false } }
  }

  const admin = adminSupabase()
  const { data: links } = await admin
    .from('share_links')
    .select('token, title, object_ids, options, created_at, expires_at')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })

  const shares: ShareLinkCard[] = (links ?? []).map(l => ({
    token: l.token,
    title: l.title ?? 'Partage sans titre',
    objectCount: Array.isArray(l.object_ids) ? l.object_ids.length : 0,
    createdAt: l.created_at,
    expiresAt: l.expires_at,
    passwordProtected: !!l.options?.password_protected,
  }))

  return { props: { shares } }
}
