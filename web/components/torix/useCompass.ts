// Boussole du téléphone pour le Torix Lab.
//
// start() doit être appelé directement depuis un geste (clic/toucher) :
// Safari iOS n'accorde l'orientation qu'à requestPermission() lancé dans
// ce contexte. Rien n'est lu avant ce geste.
//
// Le cap brut est lissé dans une boucle requestAnimationFrame (filtre
// circulaire, indépendant du nombre d'images par seconde) : le capteur
// tremble et arrive à une cadence irrégulière.
import { useCallback, useEffect, useRef, useState } from 'react'
import { angleDelta, headingFromEvent, smoothHeading } from './heading'

export type CompassStatus = 'off' | 'starting' | 'active' | 'denied' | 'unsupported'

type OrientationEventLike = DeviceOrientationEvent & {
  webkitCompassHeading?: number
  webkitCompassAccuracy?: number
}

type PermissionApi = { requestPermission?: () => Promise<'granted' | 'denied'> }

// Sans événement porteur de cap dans ce délai, on considère qu'il n'y a
// pas de boussole (cas des ordinateurs, qui exposent l'API sans capteur).
const FIRST_EVENT_TIMEOUT_MS = 2000
// Part de l'écart rattrapée en 1/60 s : plus bas = plus doux mais plus lent.
const SMOOTHING_PER_FRAME = 0.16
// Précision iOS en degrés au-delà de laquelle on suggère de calibrer
// (-1 = non calibrée).
const POOR_ACCURACY_DEG = 30

function screenAngle(): number {
  if (typeof window === 'undefined') return 0
  const angle = window.screen?.orientation?.angle
  if (typeof angle === 'number') return angle
  const legacy = (window as unknown as { orientation?: number }).orientation
  return typeof legacy === 'number' ? legacy : 0
}

export function useCompass() {
  const [status, setStatus] = useState<CompassStatus>('off')
  const [heading, setHeading] = useState<number | null>(null)
  const [uncalibrated, setUncalibrated] = useState(false)
  const cleanup = useRef<(() => void) | null>(null)

  const stop = useCallback(() => {
    cleanup.current?.()
    cleanup.current = null
    setHeading(null)
    setUncalibrated(false)
    setStatus('off')
  }, [])

  const listen = useCallback(() => {
    let raw: number | null = null
    let smoothed: number | null = null
    let published: number | null = null
    let last = 0
    let frame = 0
    let poor = false

    const eventName =
      'ondeviceorientationabsolute' in window ? 'deviceorientationabsolute' : 'deviceorientation'

    const onOrientation = (event: Event) => {
      const e = event as OrientationEventLike
      const h = headingFromEvent(e, screenAngle())
      if (h === null) return
      if (raw === null) setStatus('active')
      raw = h
      const acc = e.webkitCompassAccuracy
      const isPoor = typeof acc === 'number' && (acc < 0 || acc > POOR_ACCURACY_DEG)
      if (isPoor !== poor) { poor = isPoor; setUncalibrated(isPoor) }
    }

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick)
      if (raw === null) return
      const dt = last ? Math.min(now - last, 100) : 16.7
      last = now
      const factor = 1 - Math.pow(1 - SMOOTHING_PER_FRAME, dt / 16.7)
      smoothed = smoothHeading(smoothed, raw, factor)
      // Pas de rendu React pour des variations invisibles.
      if (published === null || Math.abs(angleDelta(published, smoothed)) > 0.25) {
        published = smoothed
        setHeading(smoothed)
      }
    }

    window.addEventListener(eventName, onOrientation)
    frame = requestAnimationFrame(tick)
    const timeout = window.setTimeout(() => {
      if (raw !== null) return
      cleanup.current?.()
      cleanup.current = null
      setStatus('unsupported')
    }, FIRST_EVENT_TIMEOUT_MS)

    cleanup.current = () => {
      window.removeEventListener(eventName, onOrientation)
      cancelAnimationFrame(frame)
      window.clearTimeout(timeout)
    }
  }, [])

  const start = useCallback(() => {
    if (cleanup.current) return
    if (typeof window === 'undefined' || typeof window.DeviceOrientationEvent === 'undefined') {
      setStatus('unsupported')
      return
    }
    setStatus('starting')

    const api = window.DeviceOrientationEvent as unknown as PermissionApi
    if (typeof api.requestPermission !== 'function') {
      listen()
      return
    }
    // Appel synchrone dans le geste : aucun await avant requestPermission.
    api.requestPermission()
      .then(result => {
        if (result === 'granted') listen()
        else setStatus('denied')
      })
      .catch(() => setStatus('denied'))
  }, [listen])

  useEffect(() => () => cleanup.current?.(), [])

  return { status, heading, uncalibrated, start, stop }
}
