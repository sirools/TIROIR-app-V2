import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

type Body = {
  email?: string
  marketingConsent?: boolean
  // honeypot anti-bot (champ caché côté client)
  website?: string
}

const supabaseAdmin = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!url || !key) {
    throw new Error('Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)')
  }
  return createClient(url, key, { auth: { persistSession: false } })
})()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { email, marketingConsent = false, website } = (req.body || {}) as Body

    // Honeypot: si rempli → bot
    if (website && website.trim().length > 0) {
      return res.status(204).end()
    }

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email requis' })
    }

    // Validation simple
    const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    if (!isValid) {
      return res.status(400).json({ error: 'Email invalide' })
    }

    // Métadonnées utiles
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      null
    const userAgent = req.headers['user-agent'] || null
    const referrer = (req.headers['referer'] as string) || null

    // Insert avec déduplication (unicité email)
    const { error } = await supabaseAdmin
      .from('beta_signups')
      .insert({
        email,
        marketing_consent: !!marketingConsent,
        ip,
        user_agent: userAgent,
        referrer,
      })
      .select('id') // force le retour pour détecter l’upsert si on change la stratégie plus tard

    if (error) {
      // Si l’unicité email remonte une erreur, on renvoie 200 quand même (idempotent)
      const isUniqueViolation =
        typeof error.message === 'string' &&
        /duplicate key|unique constraint/i.test(error.message)
      if (!isUniqueViolation) {
        console.error('[subscribe] insert error:', error)
        return res.status(500).json({ error: 'Insertion failed' })
      }
    }

    return res.status(200).json({ ok: true })
  } catch (err) {
    console.error('[subscribe] fatal:', err)
    return res.status(500).json({ error: 'Server error' })
  }
}