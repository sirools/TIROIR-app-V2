// Gestion des paliers d'abonnement depuis le tableau de bord.
//
// GET  ?plan=free|premium|pro&q=<recherche>&page=0
//        → page de comptes + total + compteurs par palier
// POST { user_id, action: 'set_plan', plan, ... } → bascule du palier
//
// La vérification is_admin porte sur la session de l'appelant ; les requêtes
// elles-mêmes passent par le service role (l'e-mail vit dans auth.users).
import type { NextApiRequest, NextApiResponse } from 'next'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { adminSupabase } from '../../../lib/supabase'

const PAGE_SIZE = 25
const PLANS = ['free', 'premium', 'pro'] as const

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const supabase = createServerSupabaseClient({ req, res })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return res.status(401).json({ error: 'Non authentifié' })

  const admin = adminSupabase()
  const { data: me } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('id', session.user.id)
    .single()

  if (!me?.is_admin) return res.status(403).json({ error: 'Accès refusé' })

  if (req.method === 'GET') {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
    const page = Math.max(0, parseInt(String(req.query.page ?? '0'), 10) || 0)
    const planParam = typeof req.query.plan === 'string' ? req.query.plan : ''
    // Une recherche traverse les paliers : chercher quelqu'un sans savoir
    // dans quel forfait il est, c'est le cas le plus fréquent.
    const plan = q.length >= 2 ? null : (PLANS.includes(planParam as typeof PLANS[number]) ? planParam : null)

    const [{ data, error }, { data: counts }] = await Promise.all([
      admin.rpc('admin_list_accounts', {
        p_plan: plan,
        p_query: q || null,
        p_limit: PAGE_SIZE,
        p_offset: page * PAGE_SIZE,
      }),
      admin.rpc('admin_plan_counts'),
    ])

    if (error) return res.status(500).json({ error: error.message })

    const rows = (data ?? []) as { total_count: number }[]
    return res.status(200).json({
      accounts: rows,
      total: rows.length > 0 ? Number(rows[0].total_count) : 0,
      page,
      pageSize: PAGE_SIZE,
      counts: counts ?? {},
    })
  }

  if (req.method === 'POST') {
    const { user_id, action, plan, pro_expires_at, pro_invoice_ref, pro_company } = req.body ?? {}

    if (typeof user_id !== 'string' || !user_id) {
      return res.status(400).json({ error: 'user_id manquant' })
    }

    // `grant`/`revoke` restent acceptés : ils s'expriment simplement en
    // termes de palier cible, et l'ancien appel continue de fonctionner.
    const target: string | null =
      action === 'grant' ? 'pro'
      : action === 'revoke' ? 'free'
      : action === 'set_plan' && PLANS.includes(plan) ? plan
      : null

    if (!target) return res.status(400).json({ error: 'Palier cible invalide' })

    const now = new Date().toISOString()
    const today = now.slice(0, 10)

    const patch: Record<string, unknown> = { plan: target, updated_at: now }

    if (target === 'pro') {
      // Champs date/texte nullables : une chaîne vide casserait le cast Postgres.
      patch.pro_expires_at = pro_expires_at || null
      patch.pro_invoice_ref = pro_invoice_ref || null
      patch.pro_company = pro_company || null

      // Sur un renouvellement, on ne réécrit pas la date d'entrée dans le forfait.
      const { data: current } = await admin
        .from('profiles').select('pro_since').eq('id', user_id).single()
      patch.pro_since = current?.pro_since ?? today
    } else {
      // Quitter le palier Pro ferme sa période plutôt que d'effacer son
      // historique : on veut pouvoir dire quand le client l'a quitté.
      const { data: current } = await admin
        .from('profiles').select('plan, pro_expires_at').eq('id', user_id).single()
      if (current?.plan === 'pro' && !current.pro_expires_at) {
        patch.pro_expires_at = today
      }
    }

    const { error } = await admin.from('profiles').update(patch).eq('id', user_id)
    if (error) return res.status(500).json({ error: error.message })

    return res.status(200).json({ ok: true })
  }

  return res.status(405).end()
}
