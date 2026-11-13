// pages/mes-collections/annonces.tsx — « Mettre en vente sur Leboncoin »
// depuis l'inventaire : le même panneau que sur un lien de partage
// (components/listing/ListingPanel), pour des objets cochés dans une
// collection ou pour la fiche d'un objet.
//
// Réservé au propriétaire connecté, aux paliers Pro et Business
// (lib/listing.ts) ; seuls les objets de son compte sont chargés. Sans lien
// de partage, pas d'option « Fiche complète ».
import type { GetServerSidePropsContext } from 'next'
import ListingPanel from '../../components/listing/ListingPanel'
import { adminSupabase, serverSupabase } from '../../lib/supabase'
import { asLocale, localePrefix } from '../../lib/localeRouting'
import { canPrepareListing, parseIds } from '../../lib/listing'
import { loadListingItems, type ListingItem } from '../../lib/listingServer'
import { safeBack } from '../../lib/inventory'
import { useCopy } from '../../locales'

type Props = { items: ListingItem[]; saleReady: boolean; back: string }

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  ctx.res.setHeader('X-Robots-Tag', 'noindex, nofollow')
  const { data: { user } } = await serverSupabase(ctx).auth.getUser()
  if (!user) return { redirect: { destination: `${localePrefix(asLocale(ctx.locale))}/login`, permanent: false } }

  const admin = adminSupabase()
  const { data: profile } = await admin.from('profiles').select('plan, pro_expires_at').eq('id', user.id).single()
  if (!canPrepareListing(profile?.plan, profile?.pro_expires_at)) return { notFound: true as const }

  const { items, saleReady } = await loadListingItems(admin, user.id, parseIds(ctx.query.ids))
  return { props: { items, saleReady, back: safeBack(ctx.query.from) } }
}

export default function InventoryListingsPage({ items, saleReady, back }: Props) {
  const { t } = useCopy()
  return (
    <ListingPanel
      items={items}
      shareUrl={null}
      saleReady={saleReady}
      apiUrl="/api/objects/listing"
      backHref={back}
      backLabel={t.inventory.backToCollection}
    />
  )
}
