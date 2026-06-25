// apps/next/pages/api/shares/verify.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { serialize } from 'cookie'
import { makeCookieName, COOKIE_MAX_AGE_SEC } from '../../../lib/shareAuth'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).end('Method Not Allowed')
  }

  try {
    const { slug, password } = (req.body ?? {}) as { slug?: string; password?: string }
    if (!slug) return res.status(400).json({ error: 'Missing slug' })

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    if (!url || !serviceKey) {
      console.error('[verify] Missing Supabase env vars')
      return res.status(500).json({ error: 'Server misconfigured' })
    }
    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } })

    const { data: link, error } = await supabase
      .from('shared_links')
      .select('slug, password, visibility, expires_at')
      .eq('slug', slug)
      .single()

    if (error || !link) return res.status(404).json({ error: 'Not found' })
    if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
      return res.status(410).json({ error: 'Link expired' })
    }

    const isProd = process.env.NODE_ENV === 'production'
    const cookieName = makeCookieName(slug)

    // Helper: set one cookie header (append-safe)
    const setCookie = (name: string, value: string, opts: Parameters<typeof serialize>[2]) => {
      const existing = res.getHeader('Set-Cookie')
      const next = serialize(name, value, opts)
      if (!existing) res.setHeader('Set-Cookie', next)
      else if (Array.isArray(existing)) res.setHeader('Set-Cookie', [...existing, next])
      else res.setHeader('Set-Cookie', [existing.toString(), next])
    }

    // Public → pas de mot de passe requis
    if (link.visibility === 'public') {
      setCookie(cookieName, `${Date.now()}.ok`, {
        httpOnly: true,
        sameSite: 'lax',
        secure: isProd,
        path: '/',
        maxAge: COOKIE_MAX_AGE_SEC,
      })
      setCookie('share_debug', '1', {
        httpOnly: false,
        sameSite: 'lax',
        secure: isProd,
        path: '/',
        maxAge: 300,
      })
      return res.status(200).json({ ok: true })
    }

    // Privé → mot de passe requis
    if (!password) return res.status(400).json({ error: 'Missing password' })

    const stored = link.password ?? ''
    const isBcrypt = typeof stored === 'string' && /^\$2[aby]\$/.test(stored)

    let valid = false
    if (isBcrypt) {
      valid = await bcrypt.compare(password, stored)
      console.log('[verify] mode = bcrypt')
    } else {
      valid = String(password) === stored // transition plaintext
      console.log('[verify] mode = plaintext')
    }

    if (!valid) return res.status(401).json({ error: 'Invalid password' })

    // OK → on marque l’accès
    setCookie(cookieName, `${Date.now()}.ok`, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd,
      path: '/',
      maxAge: COOKIE_MAX_AGE_SEC,
    })
    setCookie('share_debug', '1', {
      httpOnly: false,
      sameSite: 'lax',
      secure: isProd,
      path: '/',
      maxAge: 300,
    })

    return res.status(200).json({ ok: true })
  } catch (e) {
    console.error('[verify] Unexpected error:', e)
    return res.status(500).json({ error: 'Server error' })
  }
}