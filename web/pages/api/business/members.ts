// Équipe Business, pour ses membres (page /equipe).
//
// GET                         → l'organisation du compte, ses membres, ses factures (owner et admins)
// POST   { email, role? }     → ajoute un compte Tiroir existant (owner et admins)
// DELETE { user_id }          → retire un membre (owner et admins ; jamais l'owner)
//
// Chaque ajout ou retrait change le nombre de sièges : la quantité de
// l'abonnement Stripe suit (prorata : lib/stripeConfig.ts). Le compte est
// vérifié par Supabase (getUser), le reste passe par la clé service.
import type { NextApiRequest, NextApiResponse } from 'next'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { adminSupabase } from '../../../lib/supabase'
import { ORG_COLUMNS, findAccountIdByEmail, listMembers, pushSeats } from '../../../lib/businessServer'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store')
  const { data: { user } } = await createServerSupabaseClient({ req, res }).auth.getUser()
  if (!user) return res.status(401).json({ error: 'AUTH' })

  const db = adminSupabase()
  const { data: me } = await db.from('org_members')
    .select('org_id, role').eq('user_id', user.id).eq('status', 'active').maybeSingle()
  if (!me) return res.status(200).json({ org: null })
  const manager = me.role === 'owner' || me.role === 'admin'

  if (req.method === 'GET') {
    const [{ data: org }, members, { data: invoices }] = await Promise.all([
      db.from('organizations').select(ORG_COLUMNS).eq('id', me.org_id).single(),
      listMembers(db, me.org_id),
      manager
        ? db.from('billing_invoices')
          .select('stripe_invoice_id, number, status, amount_due, amount_paid, due_date, paid_at, payment_method, hosted_invoice_url, invoice_pdf, created_at')
          .eq('org_id', me.org_id).neq('status', 'draft').order('created_at', { ascending: false }).limit(24)
        : Promise.resolve({ data: [] }),
    ])
    // Un membre simple ne voit pas les adresses de ses collègues.
    const visible = manager ? members : members.map(m => (m.user_id === user.id ? m : { ...m, email: null }))
    return res.status(200).json({ org, role: me.role, members: visible, invoices: invoices ?? [] })
  }

  if (!manager) return res.status(403).json({ error: 'ROLE' })

  if (req.method === 'POST') {
    const email = typeof req.body?.email === 'string' ? req.body.email : ''
    // Seul l'owner nomme des admins.
    const role = req.body?.role === 'admin' && me.role === 'owner' ? 'admin' : 'member'
    const target = await findAccountIdByEmail(db, email)
    if (!target) return res.status(404).json({ error: 'NO_ACCOUNT' })
    const { data, error } = await db.rpc('org_add_member', { p_org_id: me.org_id, p_user_id: target, p_role: role, p_by: user.id })
    if (error) return res.status(500).json({ error: 'DB' })
    const r = data as { status: string; seats: number }
    if (r.status !== 'OK') return res.status(409).json({ error: r.status })
    const billed = await pushSeats(db, me.org_id, r.seats)
    return res.status(200).json({ ok: true, seats: r.seats, billingPending: !billed })
  }

  if (req.method === 'DELETE') {
    const target = typeof req.body?.user_id === 'string' ? req.body.user_id : ''
    if (!target) return res.status(400).json({ error: 'USER' })
    const { data, error } = await db.rpc('org_remove_member', { p_org_id: me.org_id, p_user_id: target })
    if (error) return res.status(500).json({ error: 'DB' })
    const r = data as { status: string; seats: number }
    if (r.status !== 'OK') return res.status(409).json({ error: r.status })
    const billed = await pushSeats(db, me.org_id, r.seats)
    return res.status(200).json({ ok: true, seats: r.seats, billingPending: !billed })
  }

  return res.status(405).end()
}
