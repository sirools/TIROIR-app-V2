// Boussole du téléphone pour le Torix Lab.
//
// start() doit être appelé directement depuis un geste (clic/toucher) :
// Safari iOS n'accorde l'orientation qu'à requestPermission() lancé dans
// ce contexte. Rien n'est lu avant ce geste.
//
// On écoute `deviceorientation` ET `deviceorientationabsolute` : le cap
// iOS (webkitCompassHeading) n'arrive que par le premier, celui d'Android
// par le second, et un navigateur peut exposer l'un sans jamais le
// déclencher. Le premier événement porteur d'un cap l'emporte.
//
// Le cap brut est lissé dans une boucle requestAnimationFrame (filtre
// circulaire, indépendant du nombre d'images par seconde) : le capteur
// tremble et arrive à une cadence irrégulière.
import { useCallback, useEffect, useRef, useState } from 'react'
import { angleDelta, headingFromEvent, smoothHeading } from './heading'

export type CompassStatus = 'off' | 'starting' | 'active' | 'denied' | 'unsupported'

/** Ce que le capteur envoie réellement — affiché par le panneau ?debug. */
export type CompassDebug = {
  permission: string
  events: number
  source: string | null
  alpha: number | null
  beta: number | null
  gamma: number | null
  absolute: boolean | null
  compassHeading: number | null
  compassAccuracy: number | null
}

type OrientationEventLike = DeviceOrientationEvent & {
  webkitCompassHeading?: number
  webkitCompassAccuracy?: number
}

type PermissionApi = { requestPermission?: () => Promise<'granted' | 'denied'> }

const EVENTS = ['deviceorientation', 'deviceorientationabsolute'] as const

// Sans événement porteur de cap dans ce délai, on considère qu'il n'y a
// pas de boussole (cas des ordinateurs, qui exposent l'API sans capteur).
const FIRST_EVENT_TIMEOUT_MS = 3000
// Part de l'écart rattrapée en 1/60 s : plus bas = plus doux mais plus lent.
const SMOOTHING_PER_FRAME = 0.16
// Précision iOS en degrés au-delà de laquelle on suggère de calibrer
// (-1 = non calibrée).
const POOR_ACCURACY_DEG = 30
const DEBUG_REFRESH_MS = 200

const EMPTY_DEBUG: CompassDebug = {
  permission: '—',
  events: 0,
  source: null,
  alpha: null,
  beta: null,
  gamma: null,
  absolute: null,
  compassHeading: null,
  compassAccuracy: null,
}

function screenAngle(): number {
  if (typeof window === 'undefined') return 0
  const angle = window.screen?.orientation?.angle
  if (typeof angle === 'number') return angle
  const legacy = (window as unknown as { orientation?: number }).orientation
  return typeof legacy === 'number' ? legacy : 0
}

const num = (v: unknown) => (typeof v === 'number' && !Number.isNaN(v) ? v : null)

export function useCompass() {
  const [status, setStatus] = useState<CompassStatus>('off')
  const [heading, setHeading] = useState<number | null>(null)
  const [uncalibrated, setUncalibrated] = useState(false)
  const [debug, setDebug] = useState<CompassDebug>(EMPTY_DEBUG)
  const snapshot = useRef<CompassDebug>(EMPTY_DEBUG)
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
    let lastDebug = 0
    let frame = 0
    let poor = false

    const onOrientation = (event: Event) => {
      const e = event as OrientationEventLike
      snapshot.current = {
        ...snapshot.current,
        events: snapshot.current.events + 1,
        source: event.type,
        alpha: num(e.alpha),
        beta: num(e.beta),
        gamma: num(e.gamma),
        absolute: typeof e.absolute === 'boolean' ? e.absolute : null,
        compassHeading: num(e.webkitCompassHeading),
        compassAccuracy: num(e.webkitCompassAccuracy),
      }

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
      if (now - lastDebug > DEBUG_REFRESH_MS) {
        lastDebug = now
        setDebug(snapshot.current)
      }
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

    EVENTS.forEach(name => window.addEventListener(name, onOrientation))
    frame = requestAnimationFrame(tick)
    const timeout = window.setTimeout(() => {
      if (raw !== null) return
      // Pas de cap : on arrête d'écouter, mais on laisse le diagnostic
      // montrer ce qui est arrivé (ou non).
      cleanup.current?.()
      cleanup.current = null
      setDebug(snapshot.current)
      setStatus('unsupported')
    }, FIRST_EVENT_TIMEOUT_MS)

    cleanup.current = () => {
      EVENTS.forEach(name => window.removeEventListener(name, onOrientation))
      cancelAnimationFrame(frame)
      window.clearTimeout(timeout)
    }
  }, [])

  const start = useCallback(() => {
    if (cleanup.current) return
    snapshot.current = { ...EMPTY_DEBUG }
    if (typeof window === 'undefined' || typeof window.DeviceOrientationEvent === 'undefined') {
      snapshot.current = { ...EMPTY_DEBUG, permission: 'API absente' }
      setDebug(snapshot.current)
      setStatus('unsupported')
      return
    }
    setStatus('starting')

    const api = window.DeviceOrientationEvent as unknown as PermissionApi
    if (typeof api.requestPermission !== 'function') {
      snapshot.current = { ...snapshot.current, permission: 'non requise' }
      listen()
      return
    }
    // Appel synchrone dans le geste : aucun await avant requestPermission.
    api.requestPermission()
      .then(result => {
        snapshot.current = { ...snapshot.current, permission: result }
        setDebug(snapshot.current)
        if (result === 'granted') listen()
        else setStatus('denied')
      })
      .catch((err: unknown) => {
        snapshot.current = {
          ...snapshot.current,
          permission: `erreur : ${err instanceof Error ? err.message : String(err)}`,
        }
        setDebug(snapshot.current)
        setStatus('denied')
      })
  }, [listen])

  useEffect(() => () => cleanup.current?.(), [])

  return { status, heading, uncalibrated, debug, start, stop }
}
