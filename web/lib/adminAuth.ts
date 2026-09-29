// Garde serveur des pages réservées aux administrateurs.
//
// Deux différences volontaires avec la vérification historique de
// pages/admin.tsx :
//   - getUser() plutôt que getSession() : getSession() se contente de lire
//     le cookie, getUser() fait revalider le jeton par Supabase Auth ;
//   - un non-admin reçoit un 404, pas un 403 : la page n'a pas à révéler
//     qu'elle existe.
//
// is_admin est relu avec la clé service, qui ne quitte jamais le serveur.
// Le drapeau lui-même n'est pas modifiable par son propriétaire (cf.
// migration 20260926140000_profiles_update_columns.sql).
import type { GetServerSidePropsContext, GetServerSidePropsResult, NextApiRequest, NextApiResponse } from 'next'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import type { User } from '@supabase/supabase-js'
import { serverSupabase, adminSupabase } from './supabase'
import { isTorixOwner } from './torixOwner'
import { isMarketingMember } from './marketingAccess'

export type AdminPageGuard =
  | { ok: true; user: User }
  | { ok: false; result: GetServerSidePropsResult<never> }

/**
 * À appeler en tête de getServerSideProps. Pose aussi les en-têtes
 * anti-cache et anti-indexation, quelle que soit l'issue : même un 404
 * ou une redirection ne doivent pas être mis en cache ni indexés.
 */
export async function requireAdminPage(
  ctx: GetServerSidePropsContext,
): Promise<AdminPageGuard> {
  ctx.res.setHeader('Cache-Control', 'private, no-store')
  ctx.res.setHeader('X-Robots-Tag', 'noindex, nofollow')

  const supabase = serverSupabase(ctx)
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    // resolvedUrl ne porte pas le préfixe de locale : /login le rajoutera
    // de lui-même s'il y a lieu.
    const next = encodeURIComponent(ctx.resolvedUrl)
    return {
      ok: false,
      result: { redirect: { destination: `/login?next=${next}`, permanent: false } },
    }
  }

  const { data: profile } = await adminSupabase()
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) return { ok: false, result: { notFound: true } }

  return { ok: true, user }
}

/**
 * Pages de Torix : admin de Tiroir ET propriétaire de Torix (cf.
 * torixOwner.ts). Un admin qui n'est pas le propriétaire — un collègue qui
 * gère le back-office — reçoit un 404, comme un inconnu. Sans
 * TORIX_OWNER_EMAIL, Torix est fermé à tous.
 */
export async function requireTorixOwnerPage(
  ctx: GetServerSidePropsContext,
): Promise<AdminPageGuard> {
  const guard = await requireAdminPage(ctx)
  if (!guard.ok) return guard
  if (!isTorixOwner(guard.user)) return { ok: false, result: { notFound: true } }
  return guard
}

/**
 * Même garde que requireTorixOwnerPage, pour les routes API de Torix. Tout
 * autre appelant — inconnu, non admin, admin non propriétaire — reçoit un
 * 404, sans indice sur ce qui existe. Renvoie l'utilisateur, ou null si la
 * réponse est déjà envoyée.
 */
export async function requireTorixOwnerApi(req: NextApiRequest, res: NextApiResponse): Promise<User | null> {
  res.setHeader('Cache-Control', 'private, no-store')
  res.setHeader('X-Robots-Tag', 'noindex, nofollow')
  const supabase = createServerSupabaseClient({ req, res })
  const { data: { user } } = await supabase.auth.getUser()
  if (user && isTorixOwner(user)) {
    const { data: profile } = await adminSupabase()
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()
    if (profile?.is_admin) return user
  }
  res.status(404).end()
  return null
}

/**
 * Page Marketing : les admins, et les adresses de MARKETING_EMAILS
 * (marketingAccess.ts) — qui n'ont accès à rien d'autre du back-office.
 * Tout autre compte reçoit un 404.
 */
export async function requireMarketingPage(
  ctx: GetServerSidePropsContext,
): Promise<AdminPageGuard> {
  ctx.res.setHeader('Cache-Control', 'private, no-store')
  ctx.res.setHeader('X-Robots-Tag', 'noindex, nofollow')

  const { data: { user } } = await serverSupabase(ctx).auth.getUser()
  if (!user) {
    const next = encodeURIComponent(ctx.resolvedUrl)
    return { ok: false, result: { redirect: { destination: `/login?next=${next}`, permanent: false } } }
  }
  if (isMarketingMember(user)) return { ok: true, user }

  const { data: profile } = await adminSupabase()
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (profile?.is_admin) return { ok: true, user }
  return { ok: false, result: { notFound: true } }
}
