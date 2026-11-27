// pages/api/messages/[id].ts — dans une conversation, selon `action` :
//   send          répondre ;
//   report        signaler la conversation à l'équipe (e-mail à hello@tiroir.app) ;
//   clear         supprimer la conversation de sa messagerie ;
//   revoke_links  (invité) bloquer tous ses liens et en recevoir un neuf.
//
// Qui appelle : le compte connecté, ou l'invité dont le cookie de ce fil
// porte un lien signé. Le contrôle est fait pour chaque appel, côté
// serveur (viewerParticipant) : sans place dans le fil, la réponse est la
// même que pour un fil inconnu.
import type { NextApiRequest, NextApiResponse } from 'next'
import { serialize } from 'cookie'
import { createPagesServerClient } from '@supabase/auth-helpers-nextjs'
import { adminSupabase } from '../../../lib/supabase'
import { parseBody } from '../../../lib/messaging'
import { guestCookieName } from '../../../lib/messagingCrypto'
import { clearThread, clientIp, guestFromCookie, originOf, reply, report, revokeGuestLinks } from '../../../lib/messagingServer'

const STATUS = { NOT_FOUND: 404, RATE_LIMITED: 429, DB: 500 } as const

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'METHOD_NOT_ALLOWED' })
  }
  const threadId = String(req.query.id ?? '').trim()
  const body = (req.body ?? {}) as Record<string, unknown>
  const { data: { user } } = await createPagesServerClient({ req, res }).auth.getUser()
  const viewer = { userId: user?.id ?? null, guest: guestFromCookie(req, threadId) }
  if (!viewer.userId && !viewer.guest) return res.status(401).json({ error: 'AUTH_REQUIRED' })
  const admin = adminSupabase()

  if (body.action === 'send') {
    const text = parseBody(body.body)
    if (!text) return res.status(400).json({ error: 'INVALID_MESSAGE' })
    const result = await reply(admin, { threadId, viewer, text, ip: clientIp(req), origin: originOf(req) })
    if (!result.ok) return res.status(STATUS[result.error]).json({ error: result.error })
    return res.status(201).json({ ok: true })
  }

  if (body.action === 'report') {
    if (!(await report(admin, { threadId, viewer }))) return res.status(404).json({ error: 'NOT_FOUND' })
    return res.status(200).json({ ok: true })
  }

  if (body.action === 'clear') {
    if (!(await clearThread(admin, { threadId, viewer }))) return res.status(404).json({ error: 'NOT_FOUND' })
    // L'invité n'a plus rien à voir ici : son accès sur cet appareil est retiré.
    if (!viewer.userId) res.setHeader('Set-Cookie', serialize(guestCookieName(threadId), '', { path: '/', maxAge: 0 }))
    return res.status(200).json({ ok: true })
  }

  if (body.action === 'revoke_links') {
    if (!(await revokeGuestLinks(admin, { threadId, viewer, origin: originOf(req) }))) return res.status(404).json({ error: 'NOT_FOUND' })
    // Le cookie portait un lien de l'ancienne époque : il ne vaut plus rien.
    res.setHeader('Set-Cookie', serialize(guestCookieName(threadId), '', { path: '/', maxAge: 0 }))
    return res.status(200).json({ ok: true })
  }

  return res.status(400).json({ error: 'INVALID_INPUT' })
}
