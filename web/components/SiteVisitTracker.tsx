import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import { acquisitionFrom, FIRST_TOUCH_KEY, parseAcquisition, type Acquisition } from '../lib/attribution'

const VISITOR_STORAGE_KEY = 'tiroir_visitor_id'

function getVisitorId() {
  try {
    const existing = window.localStorage.getItem(VISITOR_STORAGE_KEY)
    if (existing) return existing
    const id = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    window.localStorage.setItem(VISITOR_STORAGE_KEY, id)
    return id
  } catch {
    return null
  }
}

/** Premier passage sur le site : sa source est gardée, une seule fois. */
function rememberFirstTouch() {
  try {
    if (window.localStorage.getItem(FIRST_TOUCH_KEY)) return
    const acq: Acquisition = {
      ...acquisitionFrom(window.location.search, document.referrer || null, window.location.hostname.replace(/^www\./, '')),
      landing: window.location.pathname.slice(0, 200),
      at: new Date().toISOString(),
    }
    window.localStorage.setItem(FIRST_TOUCH_KEY, JSON.stringify(acq))
  } catch {
    // Stockage refusé : la source restera inconnue.
  }
}

export function firstTouch(): Acquisition | null {
  try {
    return parseAcquisition(window.localStorage.getItem(FIRST_TOUCH_KEY))
  } catch {
    return null
  }
}

/**
 * Compte tout juste créé sur le site (moins d'un jour) et sans source :
 * on y rattache le premier passage. Les comptes anciens ne sont jamais
 * réattribués : ils ne viennent pas de cette visite.
 */
async function attachAcquisition() {
  const acq = firstTouch()
  if (!acq) return
  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (!user || user.user_metadata?.acq) return
  if (Date.now() - new Date(user.created_at).getTime() > 24 * 60 * 60 * 1000) return
  await supabase.auth.updateUser({ data: { acq } })
}

function trackPageview(path: string) {
  if (path.startsWith('/admin') || path.startsWith('/api')) return

  const payload = JSON.stringify({
    path,
    referrer: document.referrer || null,
    visitorId: getVisitorId(),
  })

  if (navigator.sendBeacon) {
    const blob = new Blob([payload], { type: 'application/json' })
    navigator.sendBeacon('/api/track', blob)
    return
  }

  fetch('/api/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true,
  }).catch(() => undefined)
}

export default function SiteVisitTracker() {
  const router = useRouter()

  useEffect(() => {
    rememberFirstTouch()
    const { data } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_IN') void attachAcquisition().catch(() => undefined)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    trackPageview(router.asPath)
    router.events.on('routeChangeComplete', trackPageview)
    return () => router.events.off('routeChangeComplete', trackPageview)
  }, [router])

  return null
}
