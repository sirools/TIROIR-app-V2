// apps/next/pages/api/waitlist.ts
import type { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const service = process.env.SUPABASE_SERVICE_ROLE_KEY

// Utilise la service key si dispo ► bypass RLS pour l'insert
const clientKey = service || anon || ''
const supabase = url && clientKey
  ? createClient(url, clientKey, { auth: { persistSession: false } })
  : null

const USING_SERVICE = Boolean(service)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  try {
    const { email, marketingConsent, website } = req.body || {}

    // Honeypot bot
    if (typeof website === 'string' && website.trim().length > 0) {
      return res.status(200).json({ ok: true })
    }

    if (!email || typeof email !== 'string') {
      return res.status(400).json({ error: 'Email requis' })
    }
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    if (!ok) return res.status(400).json({ error: 'Email invalide' })

    // Contexte debug utile
    const debugCtx = {
      haveUrl: Boolean(url),
      haveAnon: Boolean(anon),
      haveService: Boolean(service),
      usingService: USING_SERVICE,
      nodeEnv: process.env.NODE_ENV,
      vercel: Boolean(process.env.VERCEL),
    }

    if (!supabase) {
      console.error('[waitlist][NO_DB_CLIENT]', debugCtx)
      // en dev, retourne une 500 explicite
      if (process.env.NODE_ENV !== 'production') {
        return res.status(500).json({ error: 'Supabase non configuré', debug: debugCtx })
      }
      // en prod, on évite d’exposer
      return res.status(200).json({ ok: true })
    }

    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      null
    const ua = req.headers['user-agent'] || null

    // On demande un "returning" pour forcer un body clair
    const { data, error, status } = await supabase
      .from('waitlist') // 👈 assure-toi que public.waitlist existe bien
      .insert({
        email,
        marketing_consent: !!marketingConsent, // 👈 colonne doit exister
        ip,
        ua,
        source: 'website',
      })
      .select('id')
      .single()

    if (error) {
      // imprime TOUT le contexte + error
      console.error('[waitlist][DB ERROR]', {
        status,
        error, // <-- contient souvent message, details, hint, code
        debugCtx,
        payload: { email, marketingConsent, ip, ua },
      })

      // En dev, renvoie l’erreur entière pour diagnostiquer vite
      const body =
        process.env.NODE_ENV === 'development'
          ? { error: error.message || 'DB error', code: (error as any)?.code, details: (error as any)?.details }
          : { error: 'DB error' }

      return res.status(500).json(body)
    }

    return res.status(200).json({ ok: true, id: data?.id ?? null })
  } catch (err: any) {
    console.error('[waitlist][UNEXPECTED]', err)
    const body =
      process.env.NODE_ENV === 'development'
        ? { error: String(err?.message || err) }
        : { error: 'Server error' }
    return res.status(500).json(body)
  }
}