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
import type { GetServerSidePropsContext, GetServerSidePropsResult } from 'next'
import type { User } from '@supabase/supabase-js'
import { serverSupabase, adminSupabase } from './supabase'

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
