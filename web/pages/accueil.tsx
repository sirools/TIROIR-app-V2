// pages/accueil.tsx — l'accueil de l'espace connecté, où l'on arrive après
// la connexion. Pour l'instant : un salut et les trois portes de l'espace
// (collections, partages, ventes). Les statistiques personnelles, les
// dernières collections et l'historique des partages arrivent à l'étape
// suivante.
import type { GetServerSidePropsContext } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import HeaderApp from '../components/layout/HeaderApp'
import FooterTiroirWeb from '../components/layout/FooterTiroirWeb'
import { loadDisplayName, requireOwner } from '../lib/inventoryServer'
import { fill, useCopy } from '../locales'

type Props = { name: string | null }

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const gate = await requireOwner(ctx)
  if ('redirect' in gate) return gate
  return { props: { name: await loadDisplayName(gate.owner) } }
}

export default function HomePage({ name }: Props) {
  const { t: { inventory: { home: t } } } = useCopy()
  const doors = [
    { href: '/mes-collections', icon: '🗂️', title: t.goCollections, text: t.goCollectionsText },
    { href: '/mes-partages', icon: '🔗', title: t.goShares, text: t.goSharesText },
    { href: '/ventes', icon: '🏷️', title: t.goSales, text: t.goSalesText },
  ]
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
          <ul className="doors">
            {doors.map(d => (
              <li key={d.href}>
                <Link href={d.href} legacyBehavior passHref>
                  <a className="door">
                    <span className="icon" aria-hidden="true">{d.icon}</span>
                    <span className="door-title">{d.title}</span>
                    <span className="door-text">{d.text}</span>
                  </a>
                </Link>
              </li>
            ))}
          </ul>
        </main>
        <FooterTiroirWeb />
      </div>
      <style jsx>{`
        * { box-sizing: border-box; }
        .root { min-height: 100vh; background: var(--beige-2); font-family: var(--font-body); color: var(--ink); display: flex; flex-direction: column; }
        .main { flex: 1; width: 100%; max-width: 1120px; margin: 0 auto; padding: 40px 16px 64px; }
        .page-title { font-size: 32px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.15; margin: 0 0 8px; overflow-wrap: anywhere; }
        .intro { font-size: 15px; color: var(--muted); margin: 0 0 28px; }
        .doors { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; }
        .door { display: flex; flex-direction: column; gap: 6px; height: 100%; padding: 20px; background: var(--white); border: 1px solid var(--border-light); border-radius: var(--radius); text-decoration: none; color: inherit; }
        .door:hover { box-shadow: var(--shadow); }
        .door:focus-visible { outline: 2px solid var(--orange); outline-offset: 2px; }
        .icon { font-size: 28px; line-height: 1; margin-bottom: 6px; }
        .door-title { font-size: 17px; font-weight: 700; }
        .door-text { font-size: 14px; line-height: 1.45; color: var(--muted); }
      `}</style>
    </>
  )
}
