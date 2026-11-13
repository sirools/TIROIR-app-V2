// pages/mes-collections/index.tsx — « Mes collections » : l'inventaire du
// propriétaire connecté, comme l'accueil de l'app (grille de collections,
// couverture ou emoji, nombre d'objets, épinglées en tête, mêmes tris).
// Lecture seule ici : on crée et on range depuis l'app.
import type { GetServerSidePropsContext } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import HeaderTiroirWeb from '../../components/layout/HeaderTiroirWeb'
import FooterTiroirWeb from '../../components/layout/FooterTiroirWeb'
import { COLLECTION_SORTS, NO_COLLECTION, sortCollections, type CollectionSort } from '../../lib/inventory'
import { loadCollections, requireOwner, type CollectionCard } from '../../lib/inventoryServer'
import { fill, useCopy } from '../../locales'

type Props = { collections: CollectionCard[]; unfiled: number }

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const gate = await requireOwner(ctx)
  if ('redirect' in gate) return gate
  return { props: await loadCollections(gate.owner) }
}

const SORT_KEY = 'tiroir.collections.sort'

export default function MyCollectionsPage({ collections, unfiled }: Props) {
  const { t: { inventory: t } } = useCopy()
  const [sort, setSort] = useState<CollectionSort>('created_asc')

  // Le tri choisi est gardé sur l'appareil, comme dans l'app.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SORT_KEY) as CollectionSort | null
      if (saved && COLLECTION_SORTS.includes(saved)) setSort(saved)
    } catch { /* stockage indisponible : tri par défaut */ }
  }, [])
  function chooseSort(next: CollectionSort) {
    setSort(next)
    try { window.localStorage.setItem(SORT_KEY, next) } catch { /* idem */ }
  }

  const count = (n: number) => fill(n === 1 ? t.objectsOne : t.objectsOther, { n })
  const sorted = sortCollections(collections, sort)

  return (
    <>
      <Head>
        <title>{t.metaTitle}</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="root">
        <HeaderTiroirWeb />
        <main className="main">
          <div className="head">
            <div>
              <h1 className="page-title">{t.title}</h1>
              <p className="intro">{t.intro}</p>
            </div>
            {collections.length > 1 && (
              <label className="sort">
                <span>{t.sortLabel}</span>
                <select value={sort} onChange={e => chooseSort(e.target.value as CollectionSort)}>
                  {COLLECTION_SORTS.map(key => <option key={key} value={key}>{t.collectionSort[key]}</option>)}
                </select>
              </label>
            )}
          </div>

          {collections.length === 0 && unfiled === 0 && <p className="empty">{t.empty}</p>}

          <ul className="grid">
            {sorted.map(c => (
              <li key={c.id}>
                <Link href={`/mes-collections/${c.id}`} legacyBehavior passHref>
                  <a className="card">
                    <span className="cover" style={c.cover ? undefined : { background: c.icon_color ?? '#E8F0E0' }}>
                      {c.cover
                        ? <img src={c.cover} alt="" loading="lazy" />
                        : <span className="emoji" aria-hidden="true">{c.emoji ?? '📦'}</span>}
                      {c.pinned_at && <span className="pin" title={t.pinned} aria-label={t.pinned}>📌</span>}
                    </span>
                    <span className="name">{c.name}</span>
                    <span className="count">{count(c.object_count)}</span>
                  </a>
                </Link>
              </li>
            ))}
            {unfiled > 0 && (
              <li>
                <Link href={`/mes-collections/${NO_COLLECTION}`} legacyBehavior passHref>
                  <a className="card">
                    <span className="cover unfiled"><span className="emoji" aria-hidden="true">🗂️</span></span>
                    <span className="name">{t.noCollection}</span>
                    <span className="count">{count(unfiled)}</span>
                  </a>
                </Link>
              </li>
            )}
          </ul>
        </main>
        <FooterTiroirWeb />
      </div>

      <style jsx>{`
        * { box-sizing: border-box; }
        .root { min-height: 100vh; background: var(--beige-2); font-family: var(--font-body); color: var(--ink); display: flex; flex-direction: column; }
        .main { flex: 1; width: 100%; max-width: 1120px; margin: 0 auto; padding: 32px 16px 64px; }
        .head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 16px; margin-bottom: 24px; }
        .page-title { font-size: 32px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.15; margin: 0 0 8px; }
        .intro { font-size: 15px; line-height: 1.5; color: var(--muted); margin: 0; max-width: 60ch; }
        .sort { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--muted); }
        select { min-height: 40px; padding: 0 12px; border-radius: 10px; border: 1.5px solid var(--border); background: var(--white); color: var(--ink); font: inherit; font-size: 14px; }
        .empty { color: var(--muted); font-size: 15px; }
        .grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 16px; }
        .card { display: flex; flex-direction: column; gap: 4px; padding: 10px 10px 14px; background: var(--white); border: 1px solid var(--border-light); border-radius: var(--radius); text-decoration: none; color: inherit; transition: box-shadow 0.15s, transform 0.15s; }
        .card:hover { box-shadow: var(--shadow); transform: translateY(-1px); }
        .card:focus-visible, select:focus-visible { outline: 2px solid var(--orange); outline-offset: 2px; }
        .cover { position: relative; display: flex; align-items: center; justify-content: center; aspect-ratio: 4 / 3; border-radius: 10px; overflow: hidden; margin-bottom: 8px; }
        .cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .cover.unfiled { background: var(--beige); }
        .emoji { font-size: 44px; line-height: 1; }
        .pin { position: absolute; top: 8px; right: 8px; font-size: 14px; background: var(--white); border-radius: 999px; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; }
        .name { font-size: 17px; font-weight: 600; line-height: 1.25; padding: 0 4px; overflow-wrap: anywhere; }
        .count { font-size: 13px; color: var(--muted); padding: 0 4px; }
        @media (max-width: 520px) {
          .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
          .emoji { font-size: 34px; }
        }
        @media (prefers-reduced-motion: reduce) { .card { transition: none; } .card:hover { transform: none; } }
      `}</style>
    </>
  )
}
