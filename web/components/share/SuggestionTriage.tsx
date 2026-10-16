// components/share/SuggestionTriage.tsx — tri des suggestions par le
// propriétaire, une carte à la fois.
//
//   glisser à droite / bouton « Garder »  / flèche →  : devient une idée
//   glisser à gauche / bouton « Écarter » / flèche ←  : écartée
//   « Annuler » / Ctrl+Z                               : défait le dernier choix
import { useEffect, useRef, useState } from 'react'
import { linkHost, type TriageDecision, type Wish } from '../../lib/suggestions'
import AuthorAvatar from './AuthorAvatar'

/** Distance (px) au-delà de laquelle un glissé vaut décision. */
const SWIPE_THRESHOLD = 110

interface Props {
  pending: Wish[]
  canUndo: boolean
  busy: boolean
  error: string | null
  onDecide: (id: string, decision: TriageDecision) => void
  onUndo: () => void
}

function formatPrice(w: Wish): string | null {
  if (w.price === null) return null
  try {
    return w.price.toLocaleString('fr-FR', { style: 'currency', currency: w.currency, maximumFractionDigits: w.price % 1 ? 2 : 0 })
  } catch {
    return `${w.price} ${w.currency}`
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

export default function SuggestionTriage({ pending, canUndo, busy, error, onDecide, onUndo }: Props) {
  const current = pending[0] ?? null
  const next = pending[1] ?? null
  const [dx, setDx] = useState(0)
  const [leaving, setLeaving] = useState<TriageDecision | null>(null)
  const drag = useRef<{ startX: number; pointerId: number } | null>(null)

  // Nouvelle carte au sommet : on repart du centre.
  useEffect(() => { setDx(0); setLeaving(null) }, [current?.id])

  function decide(decision: TriageDecision) {
    if (!current || busy || leaving) return
    setLeaving(decision)
    setDx(decision === 'keep' ? 600 : -600)
    // Laisse la carte sortir avant de passer à la suivante.
    window.setTimeout(() => onDecide(current.id, decision), 180)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      if (e.key === 'ArrowRight') decide('keep')
      else if (e.key === 'ArrowLeft') decide('dismiss')
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && canUndo && !busy) { e.preventDefault(); onUndo() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (busy || leaving) return
    drag.current = { startX: e.clientX, pointerId: e.pointerId }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current || drag.current.pointerId !== e.pointerId) return
    setDx(e.clientX - drag.current.startX)
  }
  function onPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current || drag.current.pointerId !== e.pointerId) return
    drag.current = null
    if (dx > SWIPE_THRESHOLD) decide('keep')
    else if (dx < -SWIPE_THRESHOLD) decide('dismiss')
    else setDx(0)
  }

  const intent = dx > SWIPE_THRESHOLD / 2 ? 'keep' : dx < -SWIPE_THRESHOLD / 2 ? 'dismiss' : null
  const dragging = drag.current !== null

  return (
    <section className="triage" aria-label="Suggestions à trier">
      <div className="head">
        <h2 className="heading">
          {pending.length > 0
            ? <>Suggestions à trier <span className="count">{pending.length}</span></>
            : 'Tout est trié'}
        </h2>
        <button type="button" className="undo" onClick={onUndo} disabled={!canUndo || busy}>
          ↶ Annuler le dernier choix
        </button>
      </div>

      {current ? (
        <>
          <div className="stack">
            {next && <div className="card behind" aria-hidden />}
            <div
              key={current.id}
              className={`card top ${dragging ? 'dragging' : ''}`}
              style={{ transform: `translateX(${dx}px) rotate(${dx / 20}deg)`, opacity: leaving ? 0 : 1 }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <span className={`stamp stamp-keep ${intent === 'keep' ? 'on' : ''}`}>GARDER</span>
              <span className={`stamp stamp-dismiss ${intent === 'dismiss' ? 'on' : ''}`}>ÉCARTER</span>
              <div className="card-icon" aria-hidden>🎁</div>
              <h3 className="card-title">{current.title}</h3>
              <p className="card-meta">
                {formatPrice(current) && <strong className="price">{formatPrice(current)}</strong>}
                {current.url && (
                  <a href={current.url} target="_blank" rel="noopener noreferrer nofollow" onPointerDown={e => e.stopPropagation()}>
                    {linkHost(current.url) ?? 'Voir le lien'} ↗
                  </a>
                )}
              </p>
              {current.author && (
                <p className="card-author">
                  <AuthorAvatar author={current.author} size={28} />
                  <span>
                    <strong>{current.author.firstName}</strong>
                    {current.author.displayName && current.author.displayName !== current.author.firstName && (
                      <span className="muted"> · {current.author.displayName}</span>
                    )}
                    <span className="muted"> · {formatDate(current.createdAt)}</span>
                  </span>
                </p>
              )}
            </div>
          </div>

          <div className="actions">
            <button type="button" className="btn btn-dismiss" onClick={() => decide('dismiss')} disabled={busy || !!leaving}>
              ✕ Écarter
            </button>
            <button type="button" className="btn btn-keep" onClick={() => decide('keep')} disabled={busy || !!leaving}>
              ♥ Garder
            </button>
          </div>
          <p className="help">Glisse la carte, ou utilise les flèches ← → du clavier.</p>
        </>
      ) : (
        <p className="done">Les idées gardées restent dans la collection, en pointillé.</p>
      )}
      {error && <p className="error" role="alert">{error}</p>}

      <style jsx>{`
        .triage {
          background: #fff; border: 1px solid var(--border); border-radius: 20px;
          padding: 20px; margin-bottom: 28px;
        }
        .head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
        .heading { font-size: 18px; font-weight: 800; color: var(--ink); margin: 0; display: flex; align-items: center; gap: 8px; }
        .count {
          display: inline-grid; place-items: center; min-width: 24px; height: 24px; padding: 0 7px;
          border-radius: 999px; background: #F26900; color: #fff; font-size: 13px;
        }
        .undo {
          background: none; border: 1px solid var(--border); border-radius: 999px;
          padding: 7px 14px; font-size: 13px; font-weight: 600; color: var(--ink); cursor: pointer;
        }
        .undo:disabled { opacity: 0.4; cursor: default; }
        .stack { position: relative; height: 260px; max-width: 360px; margin: 0 auto; }
        .card {
          position: absolute; inset: 0;
          background: #FFFBF7; border: 1.5px dashed #F2A766; border-radius: 18px;
          padding: 24px 20px; display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 10px; text-align: center;
        }
        .behind { transform: scale(0.95) translateY(10px); opacity: 0.6; }
        .top {
          cursor: grab; touch-action: pan-y; user-select: none;
          box-shadow: 0 8px 30px rgba(0,0,0,0.08);
          transition: transform 0.18s ease-out, opacity 0.18s;
        }
        .top.dragging { cursor: grabbing; transition: none; }
        .stamp {
          position: absolute; top: 16px; padding: 4px 10px; border-radius: 8px;
          font-size: 13px; font-weight: 800; letter-spacing: 1px; opacity: 0; transition: opacity 0.1s;
        }
        .stamp.on { opacity: 1; }
        .stamp-keep { left: 16px; color: #15803D; border: 2px solid #15803D; transform: rotate(-10deg); }
        .stamp-dismiss { right: 16px; color: #B91C1C; border: 2px solid #B91C1C; transform: rotate(10deg); }
        .card-icon { font-size: 40px; }
        .card-title { font-size: 20px; font-weight: 800; color: var(--ink); margin: 0; line-height: 1.25; }
        .card-meta { display: flex; gap: 10px; align-items: center; font-size: 14px; margin: 0; flex-wrap: wrap; justify-content: center; }
        .card-meta a { color: var(--muted); }
        .price { color: #F26900; }
        .card-author { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--ink); margin: 4px 0 0; }
        .muted { color: var(--text-tertiary); }
        .actions { display: flex; justify-content: center; gap: 16px; margin-top: 20px; }
        .btn {
          min-width: 130px; padding: 12px 20px; border-radius: 999px;
          font-size: 15px; font-weight: 700; cursor: pointer; border: 2px solid;
          background: #fff;
        }
        .btn:disabled { opacity: 0.5; cursor: default; }
        .btn-dismiss { border-color: var(--border); color: var(--muted); }
        .btn-dismiss:hover:not(:disabled) { border-color: #B91C1C; color: #B91C1C; }
        .btn-keep { border-color: #F26900; background: #F26900; color: #fff; }
        .btn-keep:hover:not(:disabled) { background: #D85E00; border-color: #D85E00; }
        .help { text-align: center; font-size: 12px; color: var(--text-tertiary); margin: 10px 0 0; }
        .done { font-size: 14px; color: var(--muted); margin: 0; }
        .error { color: #C0392B; font-size: 13px; font-weight: 600; margin: 12px 0 0; text-align: center; }
      `}</style>
    </section>
  )
}
