// pages/api/messages/contact.ts — « Contacter le vendeur » depuis une
// vente (/ventes/<jeton>) : crée ou rouvre la conversation privée de ce
// visiteur avec le vendeur (lib/messagingServer.ts).
//
//   connecté      le message part aussitôt, sans ressaisir ses coordonnées ;
//   sans compte   prénom, adresse, message : le message attend que le
//                 visiteur ouvre le lien reçu par e-mail.
//
// Garde-fous : mot de passe du lien s'il en a un, piège à robots (champ
// caché `website`), débit par IP et par adresse, vendeur exclu de sa
// propre vente. L'adresse saisie n'est jamais renvoyée ni montrée.
import type { NextApiRequest, NextApiResponse } from 'next'
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { adminSupabase } from '../../../lib/supabase'
import { hasSignedCookie } from '../../../lib/shareCookieSignature'
import { auctionsEnabled } from '../../../lib/auction'
import { auctionCookieKey, loadAuctionByToken } from '../../../lib/auctionServer'
import { asLocale } from '../../../lib/localeRouting'
import { parseBody, parseEmail, parseGuestName } from '../../../lib/messaging'
import { clientIp, contactSeller, originOf } from '../../../lib/messagingServer'

const STATUS = { OWN_LISTING: 403, RATE_LIMITED: 429, DB: 500 } as const

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
  }
  if (!auctionsEnabled()) return res.status(404).json({ error: 'NOT_FOUND' })

  const body = (req.body ?? {}) as Record<string, unknown>
  const admin = adminSupabase()
  const auction = await loadAuctionByToken(admin, String(body.token ?? '').trim())
  if (!auction) return res.status(404).json({ error: 'NOT_FOUND' })
  if (auction.cancelled_at) return res.status(409).json({ error: 'CLOSED' })

  // getUser() et non getSession() : le jeton est vérifié auprès de Supabase.
  const { data: { user } } = await createPagesServerClient({ req, res }).auth.getUser()
  if (user?.id !== auction.user_id && auction.password_hash && !hasSignedCookie(auctionCookieKey(auction.token), req, auction.password_hash)) {
    return res.status(403).json({ error: 'PASSWORD_REQUIRED' })
  }

  // Piège à robots : un humain ne voit pas ce champ. Même réponse qu'un envoi réussi.
  if (typeof body.website === 'string' && body.website.trim()) return res.status(200).json({ ok: true, pending: true })

  const text = parseBody(body.body)
  if (!text) return res.status(400).json({ error: 'INVALID_MESSAGE' })

  let buyer: { userId: string } | { name: string; email: string }
  if (user) buyer = { userId: user.id }
  else {
    const name = parseGuestName(body.name)
    if (!name) return res.status(400).json({ error: 'INVALID_NAME' })
    const email = parseEmail(body.email)
    if (!email) return res.status(400).json({ error: 'INVALID_EMAIL' })
    buyer = { name, email }
  }

  const result = await contactSeller(admin, {
    auction, buyer, text, locale: asLocale(typeof body.locale === 'string' ? body.locale : null), ip: clientIp(req), origin: originOf(req),
  })
  if (!result.ok) return res.status(STATUS[result.error]).json({ error: result.error })
  // L'identifiant du fil ne part qu'à un compte : un invité y entre par le lien de son e-mail.
  return res.status(201).json(result.pending ? { ok: true, pending: true } : { ok: true, pending: false, threadId: result.threadId })
}
