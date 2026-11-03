// Photo en grand sur les liens de partage : molette (zoom sous le curseur),
// pincement, double-clic, boutons + et −, et une loupe à déplacer sur la photo.
import { useCallback, useEffect, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import { ChevronLeft, ChevronRight, Search, X, ZoomIn, ZoomOut } from 'lucide-react'
import { useCopy } from '../../locales'
import {
  type Bounds,
  type View,
  DOUBLE_TAP_SCALE,
  IDENTITY,
  MAX_SCALE,
  clampView,
  fitSize,
  lensBackground,
  zoomAt,
} from '../../lib/photoZoom'

const LENS_SIZE = 190
const BUTTON_STEP = 1.6
const SMOOTHING_MS = 70
const TAP_MS = 280
const SWIPE_DISMISS = 120

type Frame = View & { ox: number; oy: number }
type Point = { x: number; y: number }
type Drag = {
  mode: 'none' | 'idle' | 'pan' | 'swipe' | 'dismiss' | 'pinch'
  start: Point
  view: View
  moved: boolean
  at: number
  touch: boolean
  pinchDistance: number
}

export default function PhotoZoomViewer({ images, alt, startIndex, onClose }: {
  images: string[]
  alt: string
  startIndex: number
  onClose: (index: number) => void
}) {
  const v = useCopy().t.share.object.viewer
  const [index, setIndex] = useState(startIndex)
  const [percent, setPercent] = useState(100)
  const [loaded, setLoaded] = useState(false)
  const [loupe, setLoupe] = useState(false)

  const rootRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const lensRef = useRef<HTMLDivElement>(null)

  const current = useRef<Frame>({ ...IDENTITY, ox: 0, oy: 0 })
  const target = useRef<Frame>({ ...IDENTITY, ox: 0, oy: 0 })
  const bounds = useRef<Bounds>({ stageW: 1, stageH: 1, fitW: 1, fitH: 1 })
  const raf = useRef(0)
  const lastFrame = useRef(0)
  const lens = useRef<Point>({ x: 0, y: 0 })
  const pointers = useRef(new Map<number, Point>())
  const drag = useRef<Drag | null>(null)
  const lastTap = useRef<{ at: number; x: number; y: number } | null>(null)
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const indexRef = useRef(startIndex)
  indexRef.current = index

  const src = images[index]
  const close = useCallback(() => onClose(indexRef.current), [onClose])

  const paint = useCallback(() => {
    const f = current.current
    if (imgRef.current) {
      imgRef.current.style.transform = `translate(${f.x + f.ox}px, ${f.y + f.oy}px) scale(${f.s})`
    }
    if (backdropRef.current) {
      backdropRef.current.style.opacity = String(Math.max(0.25, 1 - f.oy / 600))
    }
    if (lensRef.current) {
      const { stageW, stageH } = bounds.current
      const bg = lensBackground(f, bounds.current, lens.current.x, lens.current.y, LENS_SIZE / 2)
      const el = lensRef.current
      el.style.transform = `translate(${stageW / 2 + lens.current.x - LENS_SIZE / 2}px, ${stageH / 2 + lens.current.y - LENS_SIZE / 2}px)`
      el.style.backgroundSize = `${bg.width}px ${bg.height}px`
      el.style.backgroundPosition = `${bg.left}px ${bg.top}px`
    }
    setPercent(Math.round(f.s * 100))
  }, [])

  const tick = useCallback((now: number) => {
    const dt = Math.min(64, now - (lastFrame.current || now - 16))
    lastFrame.current = now
    const k = 1 - Math.exp(-dt / SMOOTHING_MS)
    const c = current.current
    const t = target.current
    let settled = true
    for (const key of ['s', 'x', 'y', 'ox', 'oy'] as const) {
      const gap = t[key] - c[key]
      if (Math.abs(gap) < (key === 's' ? 0.001 : 0.1)) c[key] = t[key]
      else { c[key] += gap * k; settled = false }
    }
    paint()
    if (settled) { raf.current = 0; lastFrame.current = 0 }
    else raf.current = requestAnimationFrame(tick)
  }, [paint])

  /** Vers une vue : glissée (molette, boutons) ou immédiate (quand un doigt la tient). */
  const moveTo = useCallback((next: Partial<Frame>, immediate = false) => {
    target.current = { ...target.current, ...next }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (immediate || reduced) {
      current.current = { ...target.current }
      if (raf.current) { cancelAnimationFrame(raf.current); raf.current = 0; lastFrame.current = 0 }
      paint()
    } else if (!raf.current) {
      raf.current = requestAnimationFrame(tick)
    }
  }, [paint, tick])

  const measure = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return
    const { width, height } = stage.getBoundingClientRect()
    const img = imgRef.current
    const fit = fitSize(img?.naturalWidth ?? 0, img?.naturalHeight ?? 0, width, height)
    bounds.current = { stageW: width, stageH: height, ...fit }
    const f = target.current
    moveTo(clampView(f, bounds.current), true)
  }, [moveTo])

  const go = useCallback((next: number) => {
    if (next < 0 || next >= images.length) return
    if (next !== indexRef.current) setLoaded(false)
    setIndex(next)
    moveTo({ ...IDENTITY, ox: 0, oy: 0 }, true)
  }, [images.length, moveTo])

  const zoomBy = useCallback((factor: number) => {
    moveTo(zoomAt(target.current, target.current.s * factor, 0, 0, bounds.current))
  }, [moveTo])

  const moveLens = useCallback((x: number, y: number) => {
    const { stageW, stageH } = bounds.current
    lens.current = {
      x: Math.min(stageW / 2, Math.max(-stageW / 2, x)),
      y: Math.min(stageH / 2, Math.max(-stageH / 2, y)),
    }
    paint()
  }, [paint])

  // Corps figé, focus dans la fenêtre, puis rendu à ce qui l'avait.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    rootRef.current?.focus()
    return () => {
      document.body.style.overflow = overflow
      previous?.focus?.()
      if (raf.current) cancelAnimationFrame(raf.current)
      if (tapTimer.current) clearTimeout(tapTimer.current)
    }
  }, [])

  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  // La loupe apparaît au centre, puis reste là où on l'a laissée.
  useEffect(() => { if (loupe) paint() }, [loupe, paint, loaded])

  // Écouteur natif : React déclare la molette en passif, et la page défilerait.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const { stageW, stageH } = bounds.current
      const fx = e.clientX - stageW / 2
      const fy = e.clientY - stageH / 2
      // Pincement au pavé tactile : ctrlKey, avec des valeurs bien plus petites.
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0028))
      moveTo(zoomAt(target.current, target.current.s * factor, fx, fy, bounds.current))
    }
    root.addEventListener('wheel', onWheel, { passive: false })
    return () => root.removeEventListener('wheel', onWheel)
  }, [moveTo])

  useEffect(() => {
    const neighbours = [images[index + 1], images[index - 1]].filter(Boolean)
    neighbours.forEach(url => { new window.Image().src = url })
  }, [images, index])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') close()
    else if (e.key === 'ArrowRight' && e.target !== lensRef.current) go(index + 1)
    else if (e.key === 'ArrowLeft' && e.target !== lensRef.current) go(index - 1)
    else if (e.key === '+' || e.key === '=') zoomBy(BUTTON_STEP)
    else if (e.key === '-') zoomBy(1 / BUTTON_STEP)
    else if (e.key === '0') moveTo(IDENTITY)
    else if (e.key === 'Tab') {
      const items = rootRef.current?.querySelectorAll<HTMLElement>('button, [tabindex="0"]')
      if (!items?.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && (document.activeElement === first || document.activeElement === rootRef.current)) {
        e.preventDefault(); last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus()
      }
    }
  }

  function onLensKey(e: React.KeyboardEvent) {
    const step = e.shiftKey ? 40 : 12
    const moves: Record<string, Point> = {
      ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step },
    }
    const d = moves[e.key]
    if (!d) return
    e.preventDefault()
    moveLens(lens.current.x + d.x, lens.current.y + d.y)
  }

  function onTap(x: number, y: number) {
    const { stageW, stageH, fitW, fitH } = bounds.current
    const now = performance.now()
    const previous = lastTap.current
    if (previous && now - previous.at < TAP_MS && Math.hypot(x - previous.x, y - previous.y) < 30) {
      if (tapTimer.current) clearTimeout(tapTimer.current)
      lastTap.current = null
      const t = target.current
      if (t.s > 1.01) moveTo(IDENTITY)
      else moveTo(zoomAt(t, DOUBLE_TAP_SCALE, x - stageW / 2, y - stageH / 2, bounds.current))
      return
    }
    lastTap.current = { at: now, x, y }
    // Un seul clic à côté de la photo ferme, une fois écarté le double-clic.
    const outside = Math.abs(x - stageW / 2) > fitW / 2 || Math.abs(y - stageH / 2) > fitH / 2
    if (outside && target.current.s <= 1.01) {
      tapTimer.current = setTimeout(close, TAP_MS)
    }
  }

  function startPinch() {
    const [a, b] = Array.from(pointers.current.values())
    drag.current = {
      mode: 'pinch',
      start: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      view: { s: target.current.s, x: target.current.x, y: target.current.y },
      moved: true,
      at: 0,
      touch: true,
      pinchDistance: Math.hypot(a.x - b.x, a.y - b.y) || 1,
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size >= 2) { startPinch(); return }
    drag.current = {
      mode: 'none',
      start: { x: e.clientX, y: e.clientY },
      view: { s: target.current.s, x: target.current.x, y: target.current.y },
      moved: false,
      at: performance.now(),
      touch: e.pointerType !== 'mouse',
      pinchDistance: 0,
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const d = drag.current
    if (!d) return
    const { stageW, stageH } = bounds.current

    if (d.mode === 'pinch') {
      if (pointers.current.size < 2) return
      const [a, b] = Array.from(pointers.current.values())
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const s = Math.min(MAX_SCALE, Math.max(1, d.view.s * (Math.hypot(a.x - b.x, a.y - b.y) / d.pinchDistance)))
      const ratio = s / d.view.s
      moveTo(clampView({
        s,
        x: mid.x - stageW / 2 - ratio * (d.start.x - stageW / 2 - d.view.x),
        y: mid.y - stageH / 2 - ratio * (d.start.y - stageH / 2 - d.view.y),
      }, bounds.current), true)
      return
    }

    const dx = e.clientX - d.start.x
    const dy = e.clientY - d.start.y
    if (d.mode === 'none') {
      if (Math.hypot(dx, dy) < 6) return
      d.moved = true
      if (target.current.s > 1.01) d.mode = 'pan'
      else if (!d.touch) d.mode = 'idle'
      else if (Math.abs(dx) > Math.abs(dy)) d.mode = 'swipe'
      else d.mode = dy > 0 ? 'dismiss' : 'idle'
    }
    if (d.mode === 'pan') {
      moveTo(clampView({ s: d.view.s, x: d.view.x + dx, y: d.view.y + dy }, bounds.current), true)
    } else if (d.mode === 'swipe') {
      const atEdge = (index === 0 && dx > 0) || (index === images.length - 1 && dx < 0)
      moveTo({ ox: dx * (atEdge ? 0.3 : 1) }, true)
    } else if (d.mode === 'dismiss') {
      moveTo({ oy: Math.max(0, dy) }, true)
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    if (!pointers.current.delete(e.pointerId)) return
    const d = drag.current
    if (!d) return
    if (pointers.current.size === 1) {
      // Un doigt reste après le pincement : il continue à déplacer la photo.
      const [rest] = Array.from(pointers.current.values())
      drag.current = {
        ...d,
        mode: 'pan',
        start: rest,
        view: { s: target.current.s, x: target.current.x, y: target.current.y },
      }
      return
    }
    if (pointers.current.size > 1) return
    drag.current = null

    const dx = e.clientX - d.start.x
    const dy = e.clientY - d.start.y
    if (!d.moved) {
      if (performance.now() - d.at < 400) onTap(e.clientX, e.clientY)
    } else if (d.mode === 'swipe') {
      const distance = bounds.current.stageW / 5
      if (dx < -distance && index < images.length - 1) go(index + 1)
      else if (dx > distance && index > 0) go(index - 1)
      else moveTo({ ox: 0 })
    } else if (d.mode === 'dismiss') {
      if (dy > SWIPE_DISMISS) close()
      else moveTo({ oy: 0 })
    }
  }

  function onLensDown(e: React.PointerEvent) {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    const { stageW, stageH } = bounds.current
    lensGrab.current = {
      x: e.clientX - stageW / 2 - lens.current.x,
      y: e.clientY - stageH / 2 - lens.current.y,
    }
  }
  const lensGrab = useRef<Point | null>(null)
  function onLensMove(e: React.PointerEvent) {
    if (!lensGrab.current) return
    const { stageW, stageH } = bounds.current
    moveLens(e.clientX - stageW / 2 - lensGrab.current.x, e.clientY - stageH / 2 - lensGrab.current.y)
  }
  function onLensUp(e: React.PointerEvent) {
    e.stopPropagation()
    lensGrab.current = null
  }

  const zoomed = percent > 101

  return ReactDOM.createPortal(
    <div
      ref={rootRef}
      className="pzv-root"
      role="dialog"
      aria-modal="true"
      aria-label={v.dialog}
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      <div ref={backdropRef} className="pzv-backdrop" />
      <div
        ref={stageRef}
        className={`pzv-stage ${zoomed ? 'is-zoomed' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {!loaded && <div className="pzv-spinner" aria-hidden="true" />}
        <img
          key={src}
          ref={imgRef}
          src={src}
          alt={alt}
          className="pzv-img"
          draggable={false}
          onLoad={() => { setLoaded(true); measure() }}
        />
      </div>

      {loupe && loaded && (
        <div
          ref={lensRef}
          className="pzv-lens"
          role="slider"
          tabIndex={0}
          aria-label={v.loupeHandle}
          aria-valuetext={`${percent} %`}
          aria-valuenow={percent}
          style={{ backgroundImage: `url("${src.replace(/"/g, '%22')}")`, width: LENS_SIZE, height: LENS_SIZE }}
          onPointerDown={onLensDown}
          onPointerMove={onLensMove}
          onPointerUp={onLensUp}
          onPointerCancel={onLensUp}
          onKeyDown={onLensKey}
        />
      )}

      <button type="button" className="pzv-glass pzv-close" aria-label={v.close} onClick={close}>
        <X size={20} />
      </button>

      {images.length > 1 && index > 0 && (
        <button type="button" className="pzv-glass pzv-nav pzv-prev" aria-label={v.prev} onClick={() => go(index - 1)}>
          <ChevronLeft size={24} />
        </button>
      )}
      {images.length > 1 && index < images.length - 1 && (
        <button type="button" className="pzv-glass pzv-nav pzv-next" aria-label={v.next} onClick={() => go(index + 1)}>
          <ChevronRight size={24} />
        </button>
      )}

      <div className="pzv-glass pzv-bar">
        {images.length > 1 && <span className="pzv-count">{index + 1} / {images.length}</span>}
        <button type="button" aria-label={v.zoomOut} disabled={!zoomed} onClick={() => zoomBy(1 / BUTTON_STEP)}>
          <ZoomOut size={20} />
        </button>
        <button type="button" className="pzv-percent" aria-label={v.reset} disabled={!zoomed} onClick={() => moveTo(IDENTITY)}>
          {percent} %
        </button>
        <button type="button" aria-label={v.zoomIn} disabled={percent >= MAX_SCALE * 100} onClick={() => zoomBy(BUTTON_STEP)}>
          <ZoomIn size={20} />
        </button>
        <span className="pzv-sep" aria-hidden="true" />
        <button
          type="button"
          className={`pzv-toggle ${loupe ? 'is-on' : ''}`}
          aria-label={v.loupe}
          aria-pressed={loupe}
          onClick={() => setLoupe(on => !on)}
        >
          <Search size={18} />
          <span className="pzv-track"><span className="pzv-thumb" /></span>
        </button>
      </div>

      <style jsx global>{`
        .pzv-root {
          position: fixed; inset: 0; z-index: 9999; outline: none;
          color: var(--white); overscroll-behavior: contain;
          animation: pzv-in 220ms cubic-bezier(.2,.8,.2,1);
        }
        @keyframes pzv-in {
          from { opacity: 0; transform: scale(.97); }
          to { opacity: 1; transform: none; }
        }
        .pzv-backdrop {
          position: absolute; inset: 0;
          background: color-mix(in srgb, var(--ink) 96%, transparent);
        }
        .pzv-stage {
          position: absolute; inset: 0; overflow: hidden;
          display: grid; place-items: center;
          touch-action: none; user-select: none; -webkit-user-select: none;
          cursor: zoom-in;
        }
        .pzv-stage.is-zoomed { cursor: grab; }
        .pzv-stage.is-zoomed:active { cursor: grabbing; }
        .pzv-img {
          position: absolute; inset: 0; width: 100%; height: 100%;
          object-fit: contain; transform-origin: center center;
          -webkit-user-drag: none;
        }
        .pzv-spinner {
          width: 28px; height: 28px; border-radius: 50%;
          border: 2px solid color-mix(in srgb, var(--white) 25%, transparent);
          border-top-color: var(--white);
          animation: pzv-spin .8s linear infinite;
        }
        @keyframes pzv-spin { to { transform: rotate(360deg); } }
        .pzv-glass {
          color: var(--white);
          background: color-mix(in srgb, var(--white) 14%, transparent);
          -webkit-backdrop-filter: blur(18px) saturate(1.6);
          backdrop-filter: blur(18px) saturate(1.6);
          border: 1px solid color-mix(in srgb, var(--white) 22%, transparent);
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--white) 35%, transparent),
            0 8px 28px color-mix(in srgb, var(--ink) 45%, transparent);
        }
        .pzv-root button { cursor: pointer; font: inherit; color: inherit; }
        .pzv-root button:focus-visible, .pzv-lens:focus-visible {
          outline: 2px solid var(--orange); outline-offset: 2px;
        }
        .pzv-close, .pzv-nav {
          position: absolute; display: grid; place-items: center;
          width: 44px; height: 44px; border-radius: 50%; padding: 0;
        }
        .pzv-close { top: 16px; right: 16px; }
        .pzv-nav { top: 50%; margin-top: -22px; }
        .pzv-prev { left: 16px; }
        .pzv-next { right: 16px; }
        .pzv-bar {
          position: absolute; left: 50%; bottom: max(20px, env(safe-area-inset-bottom));
          transform: translateX(-50%);
          display: flex; align-items: center; gap: 2px;
          padding: 4px 8px; border-radius: 999px; white-space: nowrap;
        }
        .pzv-bar button {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          min-width: 40px; height: 40px; padding: 0 8px;
          background: transparent; border: 0; border-radius: 999px;
        }
        .pzv-bar button:hover:not(:disabled) {
          background: color-mix(in srgb, var(--white) 14%, transparent);
        }
        .pzv-bar button:disabled { opacity: .4; cursor: default; }
        .pzv-percent { min-width: 62px; font-size: 13px; font-variant-numeric: tabular-nums; }
        .pzv-count { padding: 0 8px; font-size: 13px; opacity: .75; font-variant-numeric: tabular-nums; }
        .pzv-sep {
          width: 1px; height: 20px; margin: 0 4px;
          background: color-mix(in srgb, var(--white) 25%, transparent);
        }
        .pzv-track {
          position: relative; display: block; width: 32px; height: 20px; border-radius: 999px;
          background: color-mix(in srgb, var(--white) 22%, transparent);
          transition: background 180ms ease;
        }
        .pzv-thumb {
          position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%;
          background: var(--white);
          transition: transform 180ms cubic-bezier(.2,.8,.2,1);
        }
        .pzv-toggle.is-on .pzv-track { background: var(--orange); }
        .pzv-toggle.is-on .pzv-thumb { transform: translateX(12px); }
        .pzv-lens {
          position: absolute; top: 0; left: 0; border-radius: 50%;
          background-repeat: no-repeat; background-color: var(--ink);
          cursor: grab; touch-action: none; outline-offset: 4px;
          border: 1px solid color-mix(in srgb, var(--white) 55%, transparent);
          box-shadow:
            inset 0 2px 3px color-mix(in srgb, var(--white) 70%, transparent),
            inset 0 -3px 6px color-mix(in srgb, var(--white) 22%, transparent),
            inset 0 0 22px color-mix(in srgb, var(--ink) 30%, transparent),
            0 14px 40px color-mix(in srgb, var(--ink) 55%, transparent);
          animation: pzv-lens-in 200ms cubic-bezier(.2,.8,.2,1);
        }
        .pzv-lens:active { cursor: grabbing; }
        @keyframes pzv-lens-in { from { opacity: 0; } to { opacity: 1; } }
        @media (max-width: 640px) {
          .pzv-nav { display: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .pzv-root, .pzv-lens { animation: none; }
          .pzv-thumb, .pzv-track { transition: none; }
        }
      `}</style>
    </div>,
    document.body,
  )
}
