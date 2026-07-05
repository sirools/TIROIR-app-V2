import type { NextApiRequest, NextApiResponse } from 'next'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

type Body = {
  path?: string
  referrer?: string
  visitorId?: string
}

const supabaseAdmin = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false } })
})()

const IGNORED_PREFIXES = ['/api', '/admin']

function hashIp(ip: string | null) {
  if (!ip) return null
  const salt = process.env.ANALYTICS_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || 'tiroir'
  return crypto.createHash('sha256').update(`${salt}:${ip}`).digest('hex')
}

function cleanPath(rawPath: unknown) {
  if (typeof rawPath !== 'string') return '/'
  const path = rawPath.trim().slice(0, 500)
  if (!path.startsWith('/')) return '/'
  return path
}

function cleanOptionalText(value: unknown, max = 1000) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null
}

function getSource(referrer: string | null) {
  if (!referrer) return 'direct'
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '')
    if (host.includes('producthunt.com')) return 'producthunt'
    if (host.includes('linkedin.com')) return 'linkedin'
    if (host.includes('google.')) return 'google'
    if (host.includes('instagram.com')) return 'instagram'
    if (host.includes('tiktok.com')) return 'tiktok'
    return host
  } catch {
    return 'unknown'
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!supabaseAdmin) {
    return res.status(204).end()
  }

  const body = (req.body || {}) as Body
  const path = cleanPath(body.path)
  if (IGNORED_PREFIXES.some(prefix => path === prefix || path.startsWith(`${prefix}/`))) {
    return res.status(204).end()
  }

  const userAgent = cleanOptionalText(req.headers['user-agent'])
  const isBot = userAgent ? /bot|crawler|spider|preview|facebookexternalhit|slackbot|discordbot/i.test(userAgent) : false
  if (isBot) return res.status(204).end()

  const ip =
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.socket.remoteAddress ||
    null
  const referrer = cleanOptionalText(body.referrer || req.headers.referer)
  const visitorId = cleanOptionalText(body.visitorId, 80)

  const { error } = await supabaseAdmin.from('site_pageviews').insert({
    path,
    referrer,
    user_agent: userAgent,
    ip_hash: hashIp(ip),
    visitor_id: visitorId,
    source: getSource(referrer),
  })

  if (error) {
    console.error('[track] insert error:', error)
  }

  return res.status(204).end()
}
