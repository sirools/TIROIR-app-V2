// pages/s/[token]/annonces.tsx — « Mettre en vente sur Leboncoin » depuis
// un lien de partage : le panneau components/listing/ListingPanel.
//
// Réservé au propriétaire du partage, aux paliers Pro et Business
// (lib/listing.ts) : pour tout autre visiteur, la page n'existe pas (404),
// que le lien soit protégé par mot de passe ou non. Jamais l'emplacement ni
// les notes privées dans l'annonce. Rien n'est publié ni envoyé à Leboncoin.
import type { GetServerSidePropsContext } from 'next'
import ListingPanel from '../../../components/listing/ListingPanel'
import { adminSupabase, serverSupabase } from '../../../lib/supabase'
import { canPrepareListing, parseIds } from '../../../lib/listing'
import { loadListingItems, type ListingItem } from '../../../lib/listingServer'

type Props = { token: string; items: ListingItem[]; shareUrl: string; saleReady: boolean }

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  ctx.res.setHeader('X-Robots-Tag', 'noindex, nofollow')
  const token = String(ctx.params?.token ?? '').trim()
  const wanted = parseIds(ctx.query.ids)

  let viewerId: string | null = null
  try {
    const { data } = await serverSupabase(ctx).auth.getUser()
    viewerId = data.user?.id ?? null
  } catch {
    viewerId = null
  }
  if (!viewerId) return { notFound: true as const }

  const admin = adminSupabase()
  const { data: link } = await admin
    .from('share_links')
    .select('user_id, object_ids, expires_at, is_archived')
    .eq('token', token)
    .single()
  if (!link || link.user_id !== viewerId) return { notFound: true as const }
  if (link.is_archived || (link.expires_at && new Date(link.expires_at) < new Date())) return { notFound: true as const }

  const { data: profile } = await admin.from('profiles').select('plan, pro_expires_at').eq('id', viewerId).single()
  if (!canPrepareListing(profile?.plan, profile?.pro_expires_at)) return { notFound: true as const }

  const host = String(ctx.req.headers.host ?? 'tiroir.app')
  const shareUrl = `${/^(localhost|127\.|\[::1\])/.test(host) ? 'http' : 'https'}://${host}/s/${encodeURIComponent(token)}`

  const shared = new Set<string>(Array.isArray(link.object_ids) ? link.object_ids : [])
  const { items, saleReady } = await loadListingItems(admin, viewerId, wanted.filter(id => shared.has(id)))
  return { props: { token, items, shareUrl, saleReady } }
}

export default function ShareListingsPage({ token, items, shareUrl, saleReady }: Props) {
  return (
    <ListingPanel
      items={items}
      shareUrl={shareUrl}
      saleReady={saleReady}
      apiUrl={`/api/shares/${encodeURIComponent(token)}/listing`}
      backHref={`/s/${token}`}
    />
  )
}
