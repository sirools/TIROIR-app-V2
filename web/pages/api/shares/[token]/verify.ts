// pages/api/shares/[token]/verify.ts — vérifie le mot de passe d'un partage V2 (share_links)
import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { serialize } from 'cookie'
import { createHash } from 'crypto'
import { makeCookieName, COOKIE_MAX_AGE_SEC } from '../../../../lib/shareAuth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end('Method Not Allowed')
  }

  const token = (req.query.token as string || '').trim()
  const { password } = (req.body ?? {}) as { password?: string }
  if (!token) return res.status(400).json({ error: 'Missing token' })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!url || !serviceKey) return res.status(500).json({ error: 'Server misconfigured' })
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })

  const { data: link, error } = await supabase
    .from('share_links')
    .select('options, expires_at, is_archived')
    .eq('token', token)
    .single()

  if (error || !link) return res.status(404).json({ error: 'Not found' })
  if (link.is_archived || (link.expires_at && new Date(link.expires_at).getTime() < Date.now())) {
    return res.status(410).json({ error: 'Link expired' })
  }

  const isProd = process.env.NODE_ENV === 'production'
  const cookieName = makeCookieName(token)
  const setAuthCookie = () => {
    res.setHeader('Set-Cookie', serialize(cookieName, `${Date.now()}.ok`, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      path: '/',
      maxAge: COOKIE_MAX_AGE_SEC,
    }))
  }

  // Pas de protection sur ce lien → pas de mot de passe requis
  if (!link.options?.password_protected) {
    setAuthCookie()
    return res.status(200).json({ ok: true })
  }

  if (!password) return res.status(400).json({ error: 'Missing password' })

  const submittedHash = createHash('sha256').update(password).digest('hex')
  const validHash = link.options?.password_hash ?? ''
  if (!validHash || submittedHash !== validHash) {
    return res.status(401).json({ error: 'Invalid password' })
  }

  setAuthCookie()
  return res.status(200).json({ ok: true })
}
