// pages/accueil.tsx — le tableau de bord de l'espace connecté, où l'on
// arrive après la connexion. Des chiffres personnels seulement, jamais
// ceux du service :
//   1. trois ou quatre cartes, choisies par lib/dashboard.ts selon l'offre
//      (et, plus tard, le profil choisi à l'inscription) ;
//   2. les trois dernières collections ;
//   3. les derniers partages envoyés, avec une action pour les révoquer ;
//   4. un raccourci vers les ventes en cours, s'il y en a.
import type { GetServerSidePropsContext } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import HeaderApp from '../components/layout/HeaderApp'
import FooterTiroirWeb from '../components/layout/FooterTiroirWeb'
import { supabase } from '../lib/supabase'
import { cardsFor, STAT_CARDS, type StatCard, type Stats } from '../lib/dashboard'
import {
  loadCollections, loadDashboard, loadProfile, requireOwner, type CollectionCard, type ShareSummary,
} from '../lib/inventoryServer'
import PersonaSelect from '../components/account/PersonaSelect'
import { isPersona } from '../lib/personas'
import { fill, intlLocale, useCopy } from '../locales'

type Props = {
  userId: string
  name: string | null
  /** null : pas encore choisi — l'accueil le demande, sans insister. */
  persona: string | null
  cards: StatCard[]
  stats: Stats
  collections: CollectionCard[]
  collectionCount: number
  shares: ShareSummary[]
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const gate = await requireOwner(ctx)
  if ('redirect' in gate) return gate
  const { owner } = gate
  const [profile, dashboard, { collections }] = await Promise.all([
    loadProfile(owner), loadDashboard(owner), loadCollections(owner),
  ])
  // Les trois collections où il s'est passé quelque chose en dernier.
  const latest = [...collections]
    .sort((a, b) => (b.last_activity_at ?? b.created_at).localeCompare(a.last_activity_at ?? a.created_at))
    .slice(0, 3)
  return {
    props: {
      userId: owner.userId, name: profile.name, persona: profile.persona,
      cards: cardsFor({ plan: owner.plan, profile: profile.persona }), stats: dashboard.stats,
      collections: latest, collectionCount: collections.length, shares: dashboard.shares,
    },
  }
}

const LATER_KEY = 'tiroir.persona.later'

export default function HomePage({ userId, name, persona, cards, stats, collections, collectionCount, shares: initialShares }: Props) {
  const router = useRouter()
  const { t: { inventory: ti }, locale } = useCopy()
  const t = ti.home
  const tp = ti.persona
  const [choice, setChoice] = useState('')
  const [asking, setAsking] = useState(false)
  const [savingPersona, setSavingPersona] = useState(false)
  const [personaFailed, setPersonaFailed] = useState(false)

  // « Plus tard » vaut pour la visite : la question revient à la prochaine connexion.
  useEffect(() => {
    if (persona) return
    try { setAsking(window.sessionStorage.getItem(LATER_KEY) !== '1') } catch { setAsking(true) }
  }, [persona])

  function later() {
    setAsking(false)
    try { window.sessionStorage.setItem(LATER_KEY, '1') } catch { /* stockage indisponible */ }
  }

  async function savePersona() {
    if (!isPersona(choice) || savingPersona) return
    setSavingPersona(true)
    setPersonaFailed(false)
    const { error } = await supabase.from('profiles').update({ persona: choice }).eq('id', userId)
    setSavingPersona(false)
    if (error) {
      setPersonaFailed(true)
      return
    }
    // Les cartes dépendent du profil : la page se recharge avec les bonnes.
    router.replace(router.asPath)
  }
  const [shares, setShares] = useState(initialShares)
  const [busy, setBusy] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  const number = (n: number) => n.toLocaleString(intlLocale(locale))
  const money = (n: number) => n.toLocaleString(intlLocale(locale), { style: 'currency', currency: stats.currency, maximumFractionDigits: 0 })
  const day = (iso: string) => new Date(iso).toLocaleDateString(intlLocale(locale), { day: 'numeric', month: 'long', year: 'numeric' })
  const count = (n: number) => fill(n === 1 ? ti.objectsOne : ti.objectsOther, { n })

  /** Révoquer : le lien est archivé, comme depuis « Mes partages » — il ne s'ouvre plus. */
  async function revoke(share: ShareSummary) {
    if (busy) return
    const title = share.title ?? t.shareUntitled
    if (!window.confirm(fill(t.revokeConfirm, { title }))) return
    setBusy(share.id)
    setFailed(false)
    const { error } = await supabase.from('share_links').update({ is_archived: true }).eq('id', share.id)
    setBusy(null)
    if (error) setFailed(true)
    else setShares(prev => prev.filter(s => s.id !== share.id))
  }

  return (
    <>
      <Head>
        <title>{t.metaTitle}</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="root">
        <HeaderApp />
        <main className="main">
          <h1 className="page-title">{name ? fill(t.hello, { name }) : t.helloNoName}</h1>
          <p className="intro">{t.intro}</p>

          {!persona && asking && (
            <div className="ask">
              <h2>{tp.promptTitle}</h2>
              <p>{tp.promptText}</p>
              <label className="sr-only" htmlFor="home-persona">{tp.label}</label>
              <div className="ask-row">
                <PersonaSelect id="home-persona" value={choice} onChange={setChoice} className="ask-select" />
              </div>
              <div role="status" aria-live="polite">{personaFailed && <p className="alert">{tp.saveFailed}</p>}</div>
              <div className="ask-actions">
                <button type="button" className="ask-save" disabled={!isPersona(choice) || savingPersona} onClick={savePersona}>
                  {savingPersona ? tp.saving : tp.save}
                </button>
                <button type="button" className="ask-later" onClick={later}>{tp.later}</button>
              </div>
            </div>
          )}

          <div className="block" role="region" aria-label={t.statsTitle}>
            <dl className="stats">
              {cards.map(key => (
                <div key={key} className="stat">
                  <dt>{t.stats[key]}</dt>
                  <dd>{STAT_CARDS[key].money ? money(stats[key]) : number(stats[key])}</dd>
                  {key === 'value' && <p className="stat-hint">{t.stats.valueHint}</p>}
                </div>
              ))}
            </dl>
          </div>

          {stats.forSale > 0 && (
            <Link href="/ventes" legacyBehavior passHref>
              <a className="sales">
                <span className="sales-title">{t.salesTitle}</span>
                <span className="sales-count">{fill(stats.forSale === 1 ? t.salesOne : t.salesOther, { n: stats.forSale })}</span>
                <span className="sales-go">{t.seeSales} →</span>
              </a>
            </Link>
          )}

          <div className="block">
            <div className="block-head">
              <h2>{t.latestCollections}</h2>
              {collectionCount > 0 && (
                <Link href="/mes-collections" legacyBehavior passHref><a className="see-all">{t.seeAll}</a></Link>
              )}
            </div>
            {collections.length === 0 ? (
              <p className="empty">{t.noCollections}</p>
            ) : (
              <ul className="collections">
                {collections.map(c => (
                  <li key={c.id}>
                    <Link href={`/mes-collections/${c.id}`} legacyBehavior passHref>
                      <a className="collection">
                        <span className="cover" style={c.cover ? undefined : { background: c.icon_color ?? '#E8F0E0' }}>
                          {c.cover ? <img src={c.cover} alt="" loading="lazy" /> : <span aria-hidden="true">{c.emoji ?? '📦'}</span>}
                        </span>
                        <span className="collection-name">{c.name}</span>
                        <span className="collection-count">{count(c.object_count)}</span>
                      </a>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="block">
            <div className="block-head">
              <h2>{t.latestShares}</h2>
              {stats.shares > 0 && (
                <Link href="/mes-partages" legacyBehavior passHref><a className="see-all">{t.seeAll}</a></Link>
              )}
            </div>
            <div role="status" aria-live="polite">{failed && <p className="alert">{t.revokeFailed}</p>}</div>
            {shares.length === 0 ? (
              <p className="empty">{t.noShares}</p>
            ) : (
              <ul className="shares">
                {shares.map(s => (
                  <li key={s.id} className="share">
                    <div className="share-text">
                      <a className="share-title" href={`/s/${s.token}`} target="_blank" rel="noopener noreferrer">
                        {s.title ?? t.shareUntitled}
                      </a>
                      <span className="share-meta">
                        {[
                          s.recipient ? fill(t.shareTo, { name: s.recipient }) : null,
                          count(s.objectCount),
                          day(s.createdAt),
                          s.passwordProtected ? t.protectedYes : t.protectedNo,
                          fill(s.views === 1 ? t.opensOne : t.opensOther, { n: s.views }),
                          s.expired ? t.expired : null,
                        ].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                    <button type="button" className="revoke" disabled={busy !== null} onClick={() => revoke(s)}>
                      {busy === s.id ? t.revoking : t.revoke}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </main>
        <FooterTiroirWeb />
      </div>
      <style jsx>{`
        * { box-sizing: border-box; }
        .root { min-height: 100vh; background: var(--beige-2); font-family: var(--font-body); color: var(--ink); display: flex; flex-direction: column; }
        .main { flex: 1; width: 100%; max-width: 1120px; margin: 0 auto; padding: 40px 16px 64px; }
        .page-title { font-size: 32px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.15; margin: 0 0 8px; overflow-wrap: anywhere; }
        .intro { font-size: 15px; color: var(--muted); margin: 0 0 28px; }
        .ask { margin-bottom: 32px; padding: 20px; background: var(--white); border: 1.5px solid var(--orange); border-radius: var(--radius); }
        .ask p { margin: 6px 0 14px; font-size: 14px; line-height: 1.45; color: var(--muted); max-width: 60ch; }
        .ask-row { max-width: 360px; }
        .ask :global(.ask-select) { width: 100%; min-height: 44px; padding: 0 12px; border-radius: 10px; border: 1.5px solid var(--border); background: var(--white); color: var(--ink); font: inherit; font-size: 15px; }
        .ask-actions { display: flex; align-items: center; gap: 16px; margin-top: 14px; }
        .ask-save { min-height: 44px; padding: 0 18px; border-radius: 10px; border: 0; background: var(--orange); color: var(--white); font: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
        .ask-later { min-height: 44px; padding: 0 4px; border: 0; background: none; font: inherit; font-size: 14px; font-weight: 600; color: var(--muted); cursor: pointer; }
        .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
        .block { margin-bottom: 32px; }
        .block-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
        h2 { font-size: 17px; font-weight: 700; margin: 0; }
        .see-all { font-size: 14px; font-weight: 600; color: var(--orange-700); text-decoration: none; }
        .see-all:hover { text-decoration: underline; }
        .stats { margin: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
        .stat { background: var(--white); border: 1px solid var(--border-light); border-radius: var(--radius); padding: 18px 20px; }
        dt { font-size: 13px; font-weight: 600; color: var(--muted); margin-bottom: 6px; }
        dd { margin: 0; font-size: 30px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.1; font-variant-numeric: tabular-nums; }
        .stat-hint { margin: 8px 0 0; font-size: 12px; line-height: 1.4; color: var(--muted); }
        .sales { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 14px; margin-bottom: 32px; padding: 16px 20px; background: var(--beige); border: 1px solid var(--border); border-radius: var(--radius); text-decoration: none; color: inherit; }
        .sales:hover { box-shadow: var(--shadow); }
        .sales-title { font-size: 13px; font-weight: 700; color: var(--muted); flex-basis: 100%; }
        .sales-count { font-size: 17px; font-weight: 700; }
        .sales-go { margin-left: auto; font-size: 14px; font-weight: 700; color: var(--orange-700); }
        .empty { margin: 0; padding: 20px; background: var(--white); border: 1px solid var(--border-light); border-radius: var(--radius); font-size: 15px; color: var(--muted); }
        .collections { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
        .collection { display: flex; flex-direction: column; gap: 4px; padding: 10px 10px 14px; background: var(--white); border: 1px solid var(--border-light); border-radius: var(--radius); text-decoration: none; color: inherit; }
        .collection:hover { box-shadow: var(--shadow); }
        .cover { display: flex; align-items: center; justify-content: center; aspect-ratio: 16 / 9; border-radius: 10px; overflow: hidden; margin-bottom: 8px; font-size: 40px; }
        .cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .collection-name { font-size: 16px; font-weight: 600; padding: 0 4px; overflow-wrap: anywhere; }
        .collection-count { font-size: 13px; color: var(--muted); padding: 0 4px; }
        .alert { margin: 0 0 12px; padding: 10px 14px; border-radius: 10px; background: var(--white); border: 1.5px solid var(--orange); font-size: 14px; }
        /* display : la remise à zéro du site met les listes en ligne. */
        .shares { display: block; list-style: none; margin: 0; padding: 0; background: var(--white); border: 1px solid var(--border-light); border-radius: var(--radius); overflow: hidden; }
        .share { display: flex; align-items: center; gap: 16px; padding: 12px 16px; }
        .share + .share { border-top: 1px solid var(--border-light); }
        .share-text { display: flex; flex-direction: column; gap: 3px; min-width: 0; flex: 1; }
        .share-title { font-size: 15px; font-weight: 600; color: inherit; text-decoration: none; overflow-wrap: anywhere; }
        .share-title:hover { text-decoration: underline; }
        .share-meta { font-size: 13px; line-height: 1.4; color: var(--muted); }
        .revoke { flex-shrink: 0; min-height: 40px; padding: 0 14px; border-radius: 10px; border: 1.5px solid var(--border); background: var(--white); color: var(--error); font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; }
        .revoke:hover { border-color: var(--error); }
        button:disabled { opacity: 0.5; cursor: default; }
        a:focus-visible, button:focus-visible { outline: 2px solid var(--orange); outline-offset: 2px; }
        @media (max-width: 640px) {
          .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
          dd { font-size: 24px; }
          .collections { grid-template-columns: minmax(0, 1fr); gap: 10px; }
          .collection { flex-direction: row; align-items: center; gap: 12px; padding: 10px; }
          .cover { width: 64px; aspect-ratio: 1; margin: 0; font-size: 26px; flex-shrink: 0; }
          .collection-count { margin-left: auto; white-space: nowrap; }
          .share { align-items: flex-start; }
        }
      `}</style>
    </>
  )
}
