// pages/api/auctions/[token].ts — ce qu'on fait dans une vente, selon
// `action` :
//   verify       un invité saisit le mot de passe du lien (cookie signé) ;
//   bid          un invité connecté enchérit ;
//   cancel       le vendeur retire sa vente ;
//   handed_over  le vendeur déclare l'objet remis au gagnant.
//
// Écrire au vendeur ne passe plus par ici : c'est une conversation privée
// (pages/api/messages/contact.ts). L'ancien fil public a été retiré.
//
// Pour enchérir : une session vérifiée, et le mot de passe du
// lien s'il en a un (le vendeur en est dispensé). La règle de l'offre est
// appliquée en base, vente verrouillée (place_auction_bid).
import type { NextApiRequest, NextApiResponse } from 'next'
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { serialize } from 'cookie'
import { adminSupabase } from '../../../lib/supabase'
import { COOKIE_MAX_AGE_SEC, makeCookieName } from '../../../lib/shareAuth'
import { hasSignedCookie, signedCookieValue } from '../../../lib/shareCookieSignature'
import { auctionsEnabled, parseAmount } from '../../../lib/auction'
import { auctionCookieKey, hashPassword, loadAuctionByToken, manageAuction } from '../../../lib/auctionServer'

const BID_ERRORS: Record<string, number> = { AUCTION_NOT_FOUND: 404, AUCTION_CLOSED: 409, OWN_AUCTION: 403, BID_TOO_LOW: 409 }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
  }
  if (!auctionsEnabled()) return res.status(404).json({ error: 'NOT_FOUND' })

  const token = String(req.query.token ?? '').trim()
  const body = (req.body ?? {}) as Record<string, unknown>
  const action = String(body.action ?? '')
  const admin = adminSupabase()
  const auction = await loadAuctionByToken(admin, token)
  if (!auction) return res.status(404).json({ error: 'NOT_FOUND' })
  const cookieKey = auctionCookieKey(token)

  if (action === 'verify') {
    if (auction.password_hash && hashPassword(String(body.password ?? '')) !== auction.password_hash) {
      return res.status(401).json({ error: 'INVALID_PASSWORD' })
    }
    // Signé, et lié au mot de passe : en changer fermerait les sessions ouvertes.
    res.setHeader('Set-Cookie', serialize(makeCookieName(cookieKey), signedCookieValue(cookieKey, Date.now(), auction.password_hash ?? ''), {
      httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: COOKIE_MAX_AGE_SEC,
    }))
    return res.status(200).json({ ok: true })
  }

  // getUser() et non getSession() : le jeton est vérifié auprès de Supabase.
  const { data: { user } } = await createPagesServerClient({ req, res }).auth.getUser()
  if (!user) return res.status(401).json({ error: 'AUTH_REQUIRED' })
  const isSeller = user.id === auction.user_id

  if (action === 'cancel' || action === 'handed_over') {
    // Même réponse qu'un lien inconnu : rien à apprendre ici pour un invité.
    if (!isSeller) return res.status(404).json({ error: 'NOT_FOUND' })
    const result = await manageAuction(admin, auction, action)
    if (!result.ok) return res.status(result.error === 'DB' ? 500 : 409).json({ error: result.error })
    return res.status(200).json({ ok: true })
  }

  if (!isSeller && auction.password_hash && !hasSignedCookie(cookieKey, req, auction.password_hash)) {
    return res.status(403).json({ error: 'PASSWORD_REQUIRED' })
  }

  if (action === 'bid') {
    const amount = parseAmount(body.amount)
    if (amount === null) return res.status(400).json({ error: 'INVALID_AMOUNT' })
    const { error } = await admin.rpc('place_auction_bid', { p_token: token, p_bidder: user.id, p_amount: amount })
    if (error) {
      const known = Object.keys(BID_ERRORS).find(code => error.message.includes(code))
      if (known) return res.status(BID_ERRORS[known]).json({ error: known })
      console.error('place_auction_bid', error.message)
      return res.status(500).json({ error: 'INTERNAL_ERROR' })
    }
    return res.status(201).json({ ok: true })
  }

  return res.status(400).json({ error: 'INVALID_INPUT' })
}
