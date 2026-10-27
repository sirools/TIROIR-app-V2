import { useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../lib/supabase'
import { acquisitionFrom, FIRST_TOUCH_KEY, parseAcquisition, type Acquisition } from '../lib/attribution'
import { accountLocale } from '../lib/accountLocale'

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
 * Compte tout juste créé sur le site (moins d'un jour), par Google ou
 * Apple, qui n'a ni source ni langue : on y rattache le premier passage
 * et la langue de la page. Les comptes anciens ne sont jamais modifiés :
 * ils ne viennent pas de cette visite.
 */
async function attachSignupInfo(pageLocale: string | undefined) {
  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (!user) return
  if (Date.now() - new Date(user.created_at).getTime() > 24 * 60 * 60 * 1000) return
  const updates: Record<string, unknown> = {}
  const acq = firstTouch()
  if (acq && !user.user_metadata?.acq) updates.acq = acq
  const locale = accountLocale(pageLocale)
  if (locale && !accountLocale(user.user_metadata?.locale)) updates.locale = locale
  if (Object.keys(updates).length) await supabase.auth.updateUser({ data: updates })
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
  // Langue de la page au moment de la connexion (retour Google ou Apple).
  const locale = useRef(router.locale)
  locale.current = router.locale

  useEffect(() => {
    rememberFirstTouch()
    const { data } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_IN') void attachSignupInfo(locale.current).catch(() => undefined)
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
