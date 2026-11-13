// pages/ventes/index.tsx — l'onglet Ventes : les objets du compte déclarés
// « en vente » (annonces Leboncoin préparées sur le site, ou statut posé à
// la main) et ceux qui sont « vendus », avec la date et le prix connus.
// La salle des ventes (enchères privées) viendra s'y ajouter.
import type { GetServerSidePropsContext } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import HeaderApp from '../../components/layout/HeaderApp'
import FooterTiroirWeb from '../../components/layout/FooterTiroirWeb'
import { normCurrency } from '../../lib/inventory'
import { loadSales, requireOwner, type SaleRow } from '../../lib/inventoryServer'
import { fill, intlLocale, useCopy } from '../../locales'

type Props = { sales: SaleRow[] }

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const gate = await requireOwner(ctx)
  if ('redirect' in gate) return gate
  return { props: { sales: await loadSales(gate.owner) } }
}

export default function SalesPage({ sales }: Props) {
  const { t: { inventory: { sales: t } }, locale } = useCopy()
  const money = (n: number, o: SaleRow) =>
    n.toLocaleString(intlLocale(locale), { style: 'currency', currency: normCurrency(o.value_currency), maximumFractionDigits: n % 1 ? 2 : 0 })
  const day = (iso: string) => new Date(iso).toLocaleDateString(intlLocale(locale), { day: 'numeric', month: 'long', year: 'numeric' })
  const platform = (o: SaleRow) => (o.listing_platform === 'leboncoin' ? t.leboncoin : o.listing_platform)

  /** Ce qu'on sait d'une vente, en une ligne : date, plateforme, prix. */
  function facts(o: SaleRow): string {
    const out: string[] = []
    const where = platform(o)
    if (o.status === 'sold') {
      if (o.sold_at) out.push(fill(t.soldOn, { date: day(o.sold_at) }))
      if (o.sold_price !== null) out.push(fill(t.soldFor, { price: money(o.sold_price, o) }))
    } else {
      if (o.listed_at) out.push(`${fill(t.listedOn, { date: day(o.listed_at) })}${where ? ` ${fill(t.onPlatform, { platform: where })}` : ''}`)
      const asked = o.sale_price_lot ?? (o.sale_price !== null ? o.sale_price * (o.quantity ?? 1) : null)
      if (asked !== null) out.push(fill(t.asking, { price: money(asked, o) }))
    }
    return out.join(' · ')
  }

  const groups = [
    { key: 'for_sale', title: t.forSale, items: sales.filter(o => o.status === 'for_sale') },
    { key: 'sold', title: t.sold, items: sales.filter(o => o.status === 'sold') },
  ].filter(g => g.items.length > 0)

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
          <h1 className="page-title">{t.title}</h1>
          <p className="intro">{t.intro}</p>

          {sales.length === 0 && (
            <div className="empty">
              <p className="empty-title">{t.empty}</p>
              <p>{t.emptyHint}</p>
              <Link href="/mes-collections" legacyBehavior passHref><a className="ghost-btn">{t.goCollections}</a></Link>
            </div>
          )}

          {groups.map(g => (
            <div key={g.key} className="group">
              <h2>{g.title} <span>{g.items.length}</span></h2>
              <ul className="list">
                {g.items.map(o => (
                  <li key={o.id}>
                    <Link href={`/mes-collections/objets/${o.id}`} legacyBehavior passHref>
                      <a className="row">
                        <span className="thumb">
                          {o.thumb ? <img src={o.thumb} alt="" loading="lazy" /> : <span aria-hidden="true">📦</span>}
                        </span>
                        <span className="text">
                          <span className="title">{o.title}{(o.quantity ?? 1) > 1 ? ` ×${o.quantity}` : ''}</span>
                          <span className="facts">{facts(o)}</span>
                        </span>
                      </a>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </main>
        <FooterTiroirWeb />
      </div>
      <style jsx>{`
        * { box-sizing: border-box; }
        .root { min-height: 100vh; background: var(--beige-2); font-family: var(--font-body); color: var(--ink); display: flex; flex-direction: column; }
        .main { flex: 1; width: 100%; max-width: 860px; margin: 0 auto; padding: 40px 16px 64px; }
        .page-title { font-size: 32px; font-weight: 800; letter-spacing: -0.5px; line-height: 1.15; margin: 0 0 8px; }
        .intro { font-size: 15px; color: var(--muted); margin: 0 0 28px; }
        .empty { background: var(--white); border: 1px solid var(--border-light); border-radius: var(--radius); padding: 24px; font-size: 15px; line-height: 1.5; color: var(--muted); }
        .empty p { margin: 0 0 12px; max-width: 60ch; }
        .empty-title { color: var(--ink); font-weight: 700; }
        .ghost-btn { display: inline-flex; align-items: center; min-height: 44px; padding: 0 16px; border-radius: 10px; border: 1.5px solid var(--orange); color: var(--orange-700); font-size: 14px; font-weight: 700; text-decoration: none; }
        .group { margin-bottom: 28px; }
        h2 { font-size: 15px; font-weight: 700; margin: 0 0 12px; display: flex; align-items: baseline; gap: 8px; }
        h2 span { font-size: 13px; font-weight: 400; color: var(--muted); }
        .list { list-style: none; margin: 0; padding: 0; background: var(--white); border: 1px solid var(--border-light); border-radius: var(--radius); overflow: hidden; }
        .list li + li { border-top: 1px solid var(--border-light); }
        .row { display: flex; align-items: center; gap: 14px; padding: 10px 14px; text-decoration: none; color: inherit; }
        .row:hover { background: var(--surface-subtle); }
        .row:focus-visible, .ghost-btn:focus-visible { outline: 2px solid var(--orange); outline-offset: -2px; }
        .thumb { width: 56px; height: 56px; border-radius: 10px; overflow: hidden; background: var(--beige); flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 22px; }
        .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
        .title { font-size: 15px; font-weight: 600; overflow-wrap: anywhere; }
        .facts { font-size: 13px; color: var(--muted); }
      `}</style>
    </>
  )
}
