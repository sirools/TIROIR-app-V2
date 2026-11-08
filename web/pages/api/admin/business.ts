// Clients Business, depuis le back-office (/admin/facturation).
//
// POST { action: 'create', name, billing_email, owner_email, legal_name?, siren?, vat_number?,
//        address_line1?, address_line2?, postal_code?, city?, country? }
//        → crée l'organisation et son owner (compte Tiroir existant)
// POST { action: 'subscribe', org_id }    → client + abonnement Stripe (sur facture)
// POST { action: 'resync_seats', org_id } → réaligne les sièges Stripe sur les membres
//
// Réservé aux admins (is_admin relu avec la clé service).
import type { NextApiRequest, NextApiResponse } from 'next'
import { createServerSupabaseClient } from '@supabase/auth-helpers-nextjs'
import { adminSupabase } from '../../../lib/supabase'
import { stripeEnv } from '../../../lib/stripeConfig'
import { stripeClient } from '../../../lib/stripe/api'
import { createSeatSubscription, ensureCustomer } from '../../../lib/stripe/orgBilling'
import { ORG_COLUMNS, findAccountIdByEmail, pushSeats, type OrgRecord } from '../../../lib/businessServer'

const text = (v: unknown, max = 200): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store')
  const { data: { user } } = await createServerSupabaseClient({ req, res }).auth.getUser()
  if (!user) return res.status(401).json({ error: 'Non authentifié' })
  const db = adminSupabase()
  const { data: me } = await db.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!me?.is_admin) return res.status(403).json({ error: 'Accès refusé' })
  if (req.method !== 'POST') return res.status(405).end()

  const action = req.body?.action
  if (action === 'create') {
    const name = text(req.body.name, 120)
    const billingEmail = text(req.body.billing_email)
    const ownerEmail = text(req.body.owner_email)
    if (!name || !billingEmail || !ownerEmail) return res.status(400).json({ error: 'Nom, e-mail de facturation et owner obligatoires' })
    const ownerId = await findAccountIdByEmail(db, ownerEmail)
    if (!ownerId) return res.status(404).json({ error: `Aucun compte Tiroir pour ${ownerEmail} : la personne crée d'abord son compte.` })

    const { data: org, error } = await db.from('organizations').insert({
      name, billing_email: billingEmail, created_by: user.id,
      legal_name: text(req.body.legal_name), siren: text(req.body.siren, 20), vat_number: text(req.body.vat_number, 20),
      address_line1: text(req.body.address_line1), address_line2: text(req.body.address_line2),
      postal_code: text(req.body.postal_code, 12), city: text(req.body.city, 80), country: text(req.body.country, 2)?.toUpperCase() ?? 'FR',
    }).select('id').single()
    if (error || !org) return res.status(500).json({ error: error?.message ?? 'Création impossible' })

    const { data: added, error: addError } = await db.rpc('org_add_member', { p_org_id: org.id, p_user_id: ownerId, p_role: 'owner', p_by: user.id })
    const status = (added as { status?: string } | null)?.status
    if (addError || status !== 'OK') {
      await db.from('organizations').delete().eq('id', org.id)
      return res.status(409).json({ error: status === 'IN_OTHER_ORG' ? 'Ce compte est déjà membre d’une autre organisation.' : (addError?.message ?? status) })
    }
    return res.status(200).json({ ok: true, org_id: org.id })
  }

  const orgId = text(req.body?.org_id, 40)
  if (!orgId) return res.status(400).json({ error: 'org_id manquant' })
  const { data: org } = await db.from('organizations').select(ORG_COLUMNS).eq('id', orgId).single()
  if (!org) return res.status(404).json({ error: 'Organisation inconnue' })
  const { data: seats } = await db.rpc('org_seat_count', { p_org_id: orgId })

  if (action === 'subscribe') {
    const env = stripeEnv()
    if (!env) return res.status(503).json({ error: 'Stripe n’est pas configuré (STRIPE_SECRET_KEY, STRIPE_MODE).' })
    const record = org as unknown as OrgRecord
    if (record.stripe_subscription_id && !['canceled', 'incomplete_expired'].includes(record.subscription_status ?? '')) {
      return res.status(409).json({ error: 'Abonnement déjà en place.' })
    }
    try {
      const stripe = stripeClient(env)
      const customerId = await ensureCustomer(stripe, record)
      await db.from('organizations').update({ stripe_customer_id: customerId }).eq('id', orgId)
      const sub = await createSeatSubscription(stripe, customerId, record, Number(seats) || 1)
      await db.from('organizations').update({ stripe_subscription_id: sub.id, livemode: env.mode === 'live' }).eq('id', orgId)
      return res.status(200).json({ ok: true, subscription: sub.id })
    } catch (e) {
      return res.status(502).json({ error: (e as Error).message })
    }
  }

  if (action === 'resync_seats') {
    const ok = await pushSeats(db, orgId, Number(seats) || 1)
    return ok ? res.status(200).json({ ok: true, seats }) : res.status(502).json({ error: 'Stripe n’a pas pu être mis à jour.' })
  }

  return res.status(400).json({ error: 'Action inconnue' })
}
