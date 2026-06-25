/* eslint-disable no-console */
import type { GetServerSidePropsContext, NextPageContext } from 'next'
import dynamic from 'next/dynamic'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'
import { hasValidCookie, makeCookieName, COOKIE_MAX_AGE_SEC } from '../../lib/shareAuth'

// --- server helper
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createSupabaseAdmin(url, key, { auth: { persistSession: false } })
}

export const getServerSideProps = async (ctx: GetServerSidePropsContext) => {
  console.log('✅ getServerSideProps CALLED on server')
  try {
    const rawSlug = ctx.params?.slug as string
    const slug = (rawSlug || '').trim()

    const cookieName = makeCookieName(slug)
    const cookieHeader = ctx.req.headers.cookie || ''
    const token = cookieHeader
      .split(';')
      .map((s) => s.trim())
      .find((c) => c.startsWith(cookieName + '='))?.split('=')[1]

    let weakAuthorized = false
    if (token) {
      const ts = token.split('.')[0]
      const fresh = ts ? Date.now() - Number(ts) < COOKIE_MAX_AGE_SEC * 1000 : false
      weakAuthorized = !!fresh
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { data: sharedLink, error: sharedLinkError } = await supabaseAdmin
      .from('shared_links')
      .select('id, slug, object_ids, visibility, user_id, expires_at')
      .eq('slug', slug)
      .single()

    if (sharedLinkError || !sharedLink) return { notFound: true }
    if (sharedLink.expires_at && new Date(sharedLink.expires_at).getTime() < Date.now()) {
      return { notFound: true }
    }

    const isPrivate = sharedLink.visibility === 'private' || sharedLink.visibility === 'privé'
    const strictAuthorized = hasValidCookie(slug, ctx as unknown as NextPageContext)
    const authorized = !isPrivate || strictAuthorized || weakAuthorized
    if (!authorized) return { props: { slug, gated: true } }

    let objetsPartages: any[] = []
    const { data: rpcData, error: rpcErr } = await supabaseAdmin
      .rpc('fetch_shared_objects', { slug_input: slug })

    if (!rpcErr && Array.isArray(rpcData) && rpcData.length > 0) {
      objetsPartages = rpcData
    } else {
      const ids = Array.isArray(sharedLink.object_ids) ? sharedLink.object_ids : []
      const table = process.env.OBJECTS_TABLE || 'objets'
      if (ids.length > 0) {
        const { data: objs, error: directErr } = await supabaseAdmin
          .from(table)
          .select('id, title, description, status, image_urls, created_at, characteristics')
          .in('id', ids)
        if (!directErr && Array.isArray(objs)) {
          const order = new Map(ids.map((id: string, i: number) => [id, i]))
          objetsPartages = objs
            .slice()
            .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
        }
      }
    }

    return { props: { sharedLink, objetsPartages, slug, gated: false } }
  } catch (err) {
    console.error('❌ getServerSideProps failed:', err)
    return { notFound: true }
  }
}

// ⚠️ aucun import Tamagui ici ; on charge la vue client dynamiquement
const ShareView = dynamic(() => import('../../components/share/ShareView'), {
  ssr: false,
})

export default function Page(props: any) {
  return <ShareView {...props} />
}








// // apps/next/pages/share/[slug].tsx
// /* eslint-disable no-console */
// import Head from 'next/head'
// import { YStack, XStack, Text, Separator } from 'tamagui'
// import type { GetServerSidePropsContext, NextPageContext } from 'next'
// import HeaderTiroirWeb from '../../components/layout/HeaderTiroirWeb'
// import dynamic from 'next/dynamic'
// import { useRouter } from 'next/router'
// import { hasValidCookie, makeCookieName, COOKIE_MAX_AGE_SEC } from '../../lib/shareAuth'
// import { useState, type ComponentType } from 'react'
// import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

// // ----------- Helpers (server only) -----------
// function getSupabaseAdmin() {
//   const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
//   const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
//   if (!url || !key) throw new Error('Missing Supabase env vars')
//   return createSupabaseAdmin(url, key, { auth: { persistSession: false } })
// }

// // ----------- ObjectCard (client only) -----------
// import type { ObjectCardProps } from '../../../../features/objects/components/ObjectCard'
// const ObjectCard = dynamic<ComponentType<ObjectCardProps>>(
//   async () => {
//     const mod = await import('../../../../features/objects/components/ObjectCard')
//     return (mod.ObjectCard ?? mod.default) as ComponentType<ObjectCardProps>
//   },
//   { ssr: false }
// )

// /** --------------------
//  *  Formulaire (client)
//  *  -------------------- */
// function PasswordForm({ slug }: { slug: string }) {
//   const [password, setPassword] = useState('')
//   const [error, setError] = useState<string | null>(null)
//   const [loading, setLoading] = useState(false)

//   const onSubmit = async (e?: React.FormEvent) => {
//     e?.preventDefault?.()
//     setLoading(true)
//     setError(null)
//     try {
//       const res = await fetch('/api/shares/verify', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ slug, password }),
//       })
//       if (res.ok) {
//         window.location.href = `/share/${slug}` // reload pour renvoyer le cookie signé
//         return
//       } else if (res.status === 401) setError('Mot de passe incorrect. Réessaie.')
//       else if (res.status === 404) setError('Ce lien de partage est introuvable.')
//       else if (res.status === 410) setError('Ce lien a expiré.')
//       else setError('Une erreur est survenue. Réessaie plus tard.')
//     } catch {
//       setError("Impossible d'atteindre le serveur.")
//     } finally {
//       setLoading(false)
//     }
//   }

//   return (
//     <form onSubmit={onSubmit}>
//       <YStack space="$3" maxWidth={420} mx="auto" my="$8">
//         <XStack gap="$2" ai="center">
//           <input
//             name="password"
//             type="password"
//             placeholder="Mot de passe"
//             value={password}
//             onChange={(e) => setPassword(e.target.value)}
//             style={{
//               flex: 1,
//               padding: '12px 14px',
//               borderRadius: 12,
//               border: '1px solid rgba(0,0,0,0.12)',
//             }}
//           />
//           <button
//             type="submit"
//             disabled={loading}
//             style={{
//               padding: '10px 14px',
//               borderRadius: 12,
//               background: 'var(--orange, #F26900)',
//               color: 'white',
//               border: 0,
//               fontWeight: 700,
//               cursor: 'pointer',
//               opacity: loading ? 0.7 : 1,
//             }}
//             onMouseOver={(e) => (e.currentTarget.style.background = '#E06100')}
//             onMouseOut={(e) => (e.currentTarget.style.background = 'var(--orange, #F26900)')}
//           >
//             {loading ? '...' : 'Valider'}
//           </button>
//         </XStack>
//         {error && <Text color="$red10" fontWeight="600">{error}</Text>}
//       </YStack>
//     </form>
//   )
// }

// /** --------------------
//  *  SSR (gate + data)
//  *  -------------------- */
// export const getServerSideProps = async (ctx: GetServerSidePropsContext) => {
//   console.log('✅ getServerSideProps CALLED on server')
//   try {
//     const rawSlug = ctx.params?.slug as string
//     const slug = (rawSlug || '').trim()

//     const cookieName = makeCookieName(slug)
//     const cookieHeader = ctx.req.headers.cookie || ''
//     const hasSecret = !!process.env.SHARE_LINK_SECRET
//     console.log('[SSR] secret present?', hasSecret)
//     console.log('[SSR] cookie header contains token name?', cookieHeader.includes(cookieName))

//     // fallback fraicheur si signature HMAC échoue en dev
//     const token = cookieHeader
//       .split(';')
//       .map((s) => s.trim())
//       .find((c) => c.startsWith(cookieName + '='))?.split('=')[1]

//     let weakAuthorized = false
//     if (token) {
//       const ts = token.split('.')[0]
//       const fresh = ts ? Date.now() - Number(ts) < COOKIE_MAX_AGE_SEC * 1000 : false
//       weakAuthorized = !!fresh
//     }

//     // 1) shared link (service role)
//     const supabaseAdmin = getSupabaseAdmin()
//     const { data: sharedLink, error: sharedLinkError } = await supabaseAdmin
//       .from('shared_links')
//       .select('id, slug, object_ids, visibility, user_id, expires_at')
//       .eq('slug', slug)
//       .single()

//     if (sharedLinkError || !sharedLink) return { notFound: true }
//     if (sharedLink.expires_at && new Date(sharedLink.expires_at).getTime() < Date.now()) {
//       return { notFound: true }
//     }

//     // 2) Gate
//     const isPrivate = sharedLink.visibility === 'private' || sharedLink.visibility === 'privé'
//     const strictAuthorized = hasValidCookie(slug, ctx as unknown as NextPageContext)
//     const authorized = !isPrivate || strictAuthorized || weakAuthorized
//     if (!authorized) return { props: { slug, gated: true } }

//     // 3) Données
//     let objetsPartages: any[] = []
//     const { data: rpcData, error: rpcErr } = await supabaseAdmin
//       .rpc('fetch_shared_objects', { slug_input: slug })

//     if (!rpcErr && Array.isArray(rpcData) && rpcData.length > 0) {
//       objetsPartages = rpcData
//     } else {
//       const ids = Array.isArray(sharedLink.object_ids) ? sharedLink.object_ids : []
//       const table = process.env.OBJECTS_TABLE || 'objets'
//       if (ids.length > 0) {
//         const { data: objs, error: directErr } = await supabaseAdmin
//           .from(table)
//           .select('id, title, description, status, image_urls, created_at, characteristics')
//           .in('id', ids)
//         if (!directErr && Array.isArray(objs)) {
//           const order = new Map(ids.map((id: string, i: number) => [id, i]))
//           objetsPartages = objs.slice().sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
//         }
//       }
//     }

//     return { props: { sharedLink, objetsPartages, slug, gated: false } }
//   } catch (err) {
//     console.error('❌ getServerSideProps failed:', err)
//     return { notFound: true }
//   }
// }

// /** --------------------
//  *  Page (client only)
//  *  -------------------- */
// function SharedLinkPageClient({
//   sharedLink,
//   objetsPartages = [],
//   slug,
//   gated,
// }: any) {
//   const router = useRouter()

//   if (gated) {
//     return (
//       <YStack minHeight="100vh" bg="$background">
//         <Head><meta name="robots" content="noindex,nofollow" /></Head>
//         <HeaderTiroirWeb />
//         <YStack px="$4" py="$6" width="100%" maxWidth={1440} marginHorizontal="auto">
//           <PasswordForm slug={slug} />
//         </YStack>
//       </YStack>
//     )
//   }

//   const totalValue = objetsPartages.reduce((sum: number, obj: any) => {
//     const rawValue = obj.characteristics?.['Valeur'] ?? ''
//     const numeric = parseFloat(rawValue.toString().replace(/[^\d.,]/g, '').replace(',', '.'))
//     return sum + (isNaN(numeric) ? 0 : numeric)
//   }, 0)

//   return (
//     <YStack minHeight="100vh" bg="$background">
//       <Head><meta name="robots" content="noindex,nofollow" /></Head>
//       <HeaderTiroirWeb />
//       <YStack px="$4" py="$6" width="100%" maxWidth={1440} marginHorizontal="auto" space="$6">
//         <XStack justifyContent="space-between" alignItems="center" flexWrap="wrap">
//           <Text fontSize="$6" fontWeight="700">Objets partagés</Text>
//           <Text fontSize="$6" fontWeight="600" color="$primary">
//             {totalValue.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}€ au total
//           </Text>
//         </XStack>

//         <Separator borderColor="$border" />

//         <XStack gap="$4" flexWrap="wrap">
//           {objetsPartages.map((obj: any) => (
//             <ObjectCard
//               key={obj.id}
//               title={obj.title}
//               imageUrl={obj.image_urls?.[0] ?? ''}
//               status={obj.status}
//               description={obj.description}
//               date={obj.created_at}
//               zoom="detailed"
//               style={{ width: 280 }}
//               onPress={() => router.push(`/share/o/${slug}/${obj.id}`)}
//               visibleFields={[
//                 'image',
//                 'title',
//                 'status',
//                 'description',
//                 'date',
//                 { characteristics: ['Valeur', 'Couleur', 'Marque'] },
//               ]}
//             />
//           ))}
//         </XStack>
//       </YStack>
//     </YStack>
//   )
// }

// // 👉 Export par défaut en **client-only** (évite “Missing theme” côté SSR)
// export default dynamic(() => Promise.resolve(SharedLinkPageClient), { ssr: false })