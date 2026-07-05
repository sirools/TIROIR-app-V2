import { useEffect } from 'react'
import { useRouter } from 'next/router'

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
    trackPageview(router.asPath)
    router.events.on('routeChangeComplete', trackPageview)
    return () => router.events.off('routeChangeComplete', trackPageview)
  }, [router])

  return null
}
