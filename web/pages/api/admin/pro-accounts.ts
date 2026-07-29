// Attribution du palier Professionnel, vendu en direct sur facture.
//
// GET  ?q=<email ou nom>  → recherche de comptes (vide = liste des clients Pro)
// POST { user_id, action: 'grant' | 'revoke', ... } → bascule du palier
//
// La vérification is_admin porte sur la session de l'appelant ; les requêtes
// elles-mêmes passent par le service role (l'e-mail vit dans auth.users).
import type { NextApiRequest, NextApiResponse } from 'next'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { adminSupabase } from '../../../lib/supabase'

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
    const { data, error } = q.length >= 2
      ? await admin.rpc('admin_find_users', { p_query: q })
      : await admin.rpc('admin_list_pro_accounts')

    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ accounts: data ?? [] })
  }

  if (req.method === 'POST') {
    const { user_id, action, pro_expires_at, pro_invoice_ref, pro_company } = req.body ?? {}

    if (typeof user_id !== 'string' || !user_id) {
      return res.status(400).json({ error: 'user_id manquant' })
    }
    if (action !== 'grant' && action !== 'revoke') {
      return res.status(400).json({ error: 'action invalide' })
    }

    // Un compte admin ne peut pas se rétrograder par erreur en cliquant vite :
    // la révocation repasse en gratuit, jamais en premium (pas d'abonnement store).
    const patch = action === 'grant'
      ? {
          plan: 'pro',
          pro_since: new Date().toISOString().slice(0, 10),
          // Champs date/texte nullables : une chaîne vide casserait le cast Postgres.
          pro_expires_at: pro_expires_at || null,
          pro_invoice_ref: pro_invoice_ref || null,
          pro_company: pro_company || null,
          updated_at: new Date().toISOString(),
        }
      : {
          plan: 'free',
          pro_expires_at: new Date().toISOString().slice(0, 10),
          updated_at: new Date().toISOString(),
        }

    // Sur un renouvellement, on ne réécrit pas la date d'entrée dans le forfait.
    if (action === 'grant') {
      const { data: current } = await admin
        .from('profiles')
        .select('pro_since')
        .eq('id', user_id)
        .single()
      if (current?.pro_since) patch.pro_since = current.pro_since
    }

    const { error } = await admin.from('profiles').update(patch).eq('id', user_id)
    if (error) return res.status(500).json({ error: error.message })

    return res.status(200).json({ ok: true })
  }

  return res.status(405).end()
}
