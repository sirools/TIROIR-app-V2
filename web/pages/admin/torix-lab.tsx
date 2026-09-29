// Torix Lab — laboratoire interne, réservé aux administrateurs.
//
// V0 : prototype de présence. Aucun modèle de langage derrière : Torix
// répond depuis ses fiches de connaissance sur Tiroir
// (components/torix/knowledge.ts) et connaît les quatre points cardinaux
// (directions.ts). Zéro token ; rien n'est envoyé au serveur ni conservé.
//
// Voix (voice.ts) : le micro fait écouter Torix ; une question posée à
// voix haute reçoit sa réponse à voix haute. Reconnaissance et synthèse du
// navigateur, sans modèle. Absent si le navigateur ne sait pas faire.
//
// Boussole : une fois activée (geste obligatoire sur iOS), la flamme de
// Torix pointe vers le nord — en haut face au nord, en bas face au sud — et
// prend la couleur de la direction où pointe le téléphone : nord bleu, est
// vert, sud petit feu jaune, ouest violet. Elle s'élance face à chaque
// point cardinal. Sans capteur (ordinateur, accès refusé) ou avec ?sim, un
// curseur simule le cap. ?debug (ou un échec du capteur) affiche ce que le
// capteur envoie réellement.
//
// Pensé d'abord pour Safari iOS : hauteur calée sur le viewport visible
// (clavier compris), safe areas, champ à 16 px pour éviter le zoom.
import type { GetServerSideProps } from 'next'
import Head from 'next/head'
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react'
import { ArrowUp, Compass, Mic } from 'lucide-react'
import TorixOrb, { type TorixState } from '../../components/torix/TorixOrb'
import { isRestTime } from '../../components/torix/commandments'
import {
  answerQuestion,
  REGISTER_LABELS,
  SUGGESTIONS,
  UNKNOWN,
  type Register,
} from '../../components/torix/knowledge'
import { compassPoint, facingCardinal, type Cardinal } from '../../components/torix/heading'
import { PALETTES } from '../../components/torix/palette'
import {
  useCompass,
  type CompassDebug,
  type CompassStatus,
} from '../../components/torix/useCompass'
import { canListen, canSpeak, listenOnce, speak, unlockSpeech } from '../../components/torix/voice'
import { requireTorixPage } from '../../lib/adminAuth'

const INTRO = 'Demande-moi une direction, ou parle-moi de Tiroir.'
// Commandement 4 : repos obligatoire de 21 h 30 à 7 h.
const REST_LINE = "C'est l'heure du repos. Je reviens à 7 h."
const BG = '#03060d'

// Rythme d'une réponse : Torix écoute, « réfléchit », puis parle.
const THINK_MIN_MS = 400
const THINK_MAX_MS = 700
const SPEAK_MS = 1300

const SEEK_LINE = 'Tourne-toi doucement. Chaque direction a sa couleur.'
const FACING_LINES: Record<Cardinal, string> = {
  N: 'Tu fais face au nord.',
  E: "Tu fais face à l'est.",
  S: 'Tu fais face au sud.',
  W: "Tu fais face à l'ouest.",
}
const DIAL: { id: Cardinal; label: string; deg: number }[] = [
  { id: 'N', label: 'N', deg: 0 },
  { id: 'E', label: 'E', deg: 90 },
  { id: 'S', label: 'S', deg: 180 },
  { id: 'W', label: 'O', deg: 270 },
]
const DENIED_LINE = "Je n'ai pas accès à la boussole. Ferme et rouvre l'onglet pour réessayer."
const UNSUPPORTED_LINE = 'Pas de boussole ici. Fais tourner le cap à la main.'
const VOICE_LINES = {
  denied: "Je n'ai pas accès au micro. Autorise-le dans Réglages › Safari › Micro.",
  silence: "Je n'ai rien entendu. Touche le micro et parle-moi.",
  failed: "Je n'ai pas compris. Réessaie, ou écris-moi.",
}

type Line = { id: number; text: string; register?: Register; source?: string }

export default function TorixLab() {
  const [state, setState] = useState<TorixState>('idle')
  const [question, setQuestion] = useState('')
  const [line, setLine] = useState<Line>({ id: 0, text: INTRO })
  const timers = useRef<number[]>([])
  const busy = state !== 'idle'
  const viewport = useVisualViewport()
  const [micReady, setMicReady] = useState(false)
  // Coupe l'écoute ou la parole en cours.
  const stopVoice = useRef<() => void>(() => {})

  const compass = useCompass()
  const [simForced, setSimForced] = useState(false)
  const [debugForced, setDebugForced] = useState(false)
  const [simHeading, setSimHeading] = useState(140)
  const [facing, setFacing] = useState<Cardinal | null>(null)
  const sim = simForced || compass.status === 'denied' || compass.status === 'unsupported'
  const heading = compass.status === 'active' ? compass.heading : sim ? simHeading : null
  const compassOn = compass.status === 'starting' || compass.status === 'active'
  const showDebug = debugForced || compass.status === 'denied' || compass.status === 'unsupported'

  useEffect(() => () => {
    timers.current.forEach(t => window.clearTimeout(t))
    stopVoice.current()
  }, [])
  useEffect(() => setMicReady(canListen()), [])
  useDarkThemeColor(BG)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setSimForced(params.has('sim'))
    setDebugForced(params.has('debug'))
  }, [])

  function later(ms: number, fn: () => void) {
    timers.current.push(window.setTimeout(fn, ms))
  }

  // Au repos, Torix ne dit rien d'autre que l'heure du repos.
  useEffect(() => {
    if (isRestTime(new Date())) setLine(prev => ({ id: prev.id + 1, text: REST_LINE }))
  }, [])

  function say(text: string, speak = false) {
    if (isRestTime(new Date())) return
    setLine(prev => ({ id: prev.id + 1, text }))
    if (speak) {
      setState('speaking')
      later(SPEAK_MS, () => setState('idle'))
    }
  }

  // Ce que Torix dit quand la boussole change d'état.
  useEffect(() => {
    if (compass.status === 'active') say(SEEK_LINE)
    else if (compass.status === 'denied') say(DENIED_LINE)
    else if (compass.status === 'unsupported') say(UNSUPPORTED_LINE)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compass.status])

  // Point cardinal atteint / quitté, avec hystérésis (cf. heading.ts).
  useEffect(() => {
    if (heading === null) {
      setFacing(null)
      return
    }
    const next = facingCardinal(heading, facing)
    if (next === facing) return
    setFacing(next)
    if (next) say(FACING_LINES[next], state === 'idle')
    else say(SEEK_LINE)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heading])

  function toggleCompass() {
    if (compassOn) {
      compass.stop()
      setFacing(null)
      say(INTRO)
    } else {
      compass.start()
    }
  }

  function ask(e: FormEvent) {
    e.preventDefault()
    submit(question)
  }

  function submit(raw: string) {
    const q = raw.trim()
    if (!q || busy) return

    setQuestion('')
    // Au repos : ni écoute ni réponse, seulement le rappel.
    if (isRestTime(new Date())) {
      setLine(prev => ({ id: prev.id + 1, text: REST_LINE }))
      return
    }
    respond(q, false)
  }

  /** Torix « réfléchit », puis répond — à voix haute si on lui a parlé. */
  function respond(q: string, aloud: boolean) {
    setState('listening')
    const think = THINK_MIN_MS + Math.random() * (THINK_MAX_MS - THINK_MIN_MS)
    later(think, () => {
      const a = answerQuestion(q)
      setLine(prev => ({ id: prev.id + 1, text: a.text, register: a.register, source: a.source }))
      setState('speaking')
      if (!aloud || !canSpeak()) {
        later(SPEAK_MS, () => setState('idle'))
        return
      }
      // Filet : Safari oublie parfois de signaler la fin de la parole.
      const guard = window.setTimeout(() => stopVoice.current(), Math.min(60_000, 2_000 + a.text.length * 90))
      timers.current.push(guard)
      stopVoice.current = speak(a.text, () => {
        window.clearTimeout(guard)
        stopVoice.current = () => {}
        setState('idle')
      })
    })
  }

  function toggleMic() {
    // Pendant qu'il parle, toucher le micro le fait taire.
    if (state === 'speaking') {
      stopVoice.current()
      return
    }
    if (busy) return
    if (isRestTime(new Date())) {
      setLine(prev => ({ id: prev.id + 1, text: REST_LINE }))
      return
    }
    // Dans le geste : sans quoi Safari iOS refusera de parler ensuite.
    unlockSpeech()
    setState('listening')
    let heard = false
    stopVoice.current = listenOnce({
      onResult: text => {
        heard = true
        setLine(prev => ({ id: prev.id + 1, text: `« ${text} »` }))
        respond(text, true)
      },
      onError: reason => setLine(prev => ({ id: prev.id + 1, text: VOICE_LINES[reason] })),
      onEnd: () => {
        if (!heard) {
          stopVoice.current = () => {}
          setState('idle')
        }
      },
    })
  }

  return (
    <main className="lab" style={viewport}>
      <Head>
        <title>Torix Lab</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta
          name="viewport"
          key="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
      </Head>

      <header className="top">
        <a className="back" href="/admin" aria-label="Retour à l’admin">Admin</a>
        <span className="mark">Torix <span className="mark__lab">Lab</span></span>
        <button
          className={`compass-btn${compassOn ? ' compass-btn--on' : ''}`}
          type="button"
          onClick={toggleCompass}
          aria-pressed={compassOn}
          aria-label={compassOn ? 'Couper la boussole' : 'Activer la boussole'}
        >
          <Compass size={18} strokeWidth={1.75} />
        </button>
      </header>

      <section className="stage">
        {heading !== null && (
          // Cadran : tourne à l'inverse du cap, pour que la lettre du haut
          // soit toujours la direction où pointe la flamme.
          <div className="dial" style={{ transform: `rotate(${-heading}deg)` }} aria-hidden="true">
            {DIAL.map(c => (
              <span
                key={c.id}
                className={`dial__mark${facing === c.id ? ' dial__mark--on' : ''}`}
                style={{
                  transform: `rotate(${c.deg}deg) translateY(calc(var(--torix-core) * -1.42)) rotate(${heading - c.deg}deg)`,
                  color: `rgb(${PALETTES[c.id].slots[0].mid.join(', ')})`,
                }}
              >
                {c.label}
              </span>
            ))}
          </div>
        )}
        <TorixOrb state={state} heading={heading} facing={facing} />
        {heading !== null && (
          <div className="readout" aria-live="off">
            <span className={`readout__cap${facing ? ' readout__cap--found' : ''}`}>
              {`${Math.round(heading) % 360}° ${compassPoint(heading)}`}
            </span>
            {compass.uncalibrated && compass.status === 'active' && (
              <span className="readout__hint">Boussole imprécise : dessine un 8 avec le téléphone.</span>
            )}
          </div>
        )}
      </section>

      {showDebug && <CompassDebugPanel status={compass.status} heading={heading} debug={compass.debug} />}

      {sim && (
        <label className="sim">
          <span className="sim__label">Cap simulé</span>
          <input
            className="sim__range"
            type="range"
            min={0}
            max={359}
            value={simHeading}
            onChange={e => setSimHeading(Number(e.target.value))}
          />
          <span className="sim__value">{simHeading}°</span>
        </label>
      )}

      <section className="dialog">
        <div key={line.id} className="answer" aria-live="polite">
          {/* Registre et source : Torix ne fait jamais passer une
              estimation ou un principe pour un fait (memory.ts). */}
          {line.register && (
            <p className="answer__tag">
              {REGISTER_LABELS[line.register]}
              {line.source ? ` · ${line.source}` : ''}
            </p>
          )}
          <p
            className={`line${line.id === 0 ? ' line--intro' : ''}${line.text.length > 90 ? ' line--long' : ''}`}
          >
            {line.text}
          </p>
        </div>

        {!busy && (line.id === 0 || line.text === UNKNOWN) && (
          <div className="chips">
            {SUGGESTIONS.map(s => (
              <button key={s} type="button" className="chip" onClick={() => submit(s)}>
                {s}
              </button>
            ))}
          </div>
        )}

        <form className="ask" onSubmit={ask}>
          <input
            className="ask__input"
            type="text"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder="Pose-moi une question"
            aria-label="Ta question à Torix"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="send"
            maxLength={200}
          />
          {micReady && (
            <button
              className={`ask__mic${state === 'listening' ? ' ask__mic--on' : ''}`}
              type="button"
              onClick={toggleMic}
              aria-label={state === 'speaking' ? 'Faire taire Torix' : 'Parler à Torix'}
              disabled={state === 'listening'}
            >
              <Mic size={18} strokeWidth={2} />
            </button>
          )}
          <button
            className="ask__send"
            type="submit"
            aria-label="Envoyer"
            disabled={!question.trim() || busy}
          >
            <ArrowUp size={18} strokeWidth={2.25} />
          </button>
        </form>
      </section>

      <style jsx global>{`
        html, body { background: ${BG}; overscroll-behavior: none; }
      `}</style>

      <style jsx>{`
        .lab {
          --app-h: 100vh;
          position: fixed;
          left: 0;
          top: 0;
          width: 100%;
          height: 100vh;
          height: var(--app-h);
          transform: translateY(var(--app-top, 0px));
          display: grid;
          grid-template-rows: auto minmax(0, 1fr) auto auto;
          /* Sans quoi la colonne prend la largeur intrinsèque de l’orbe et
             déborde sur les écrans de 320 px. */
          grid-template-columns: minmax(0, 1fr);
          overflow: hidden;
          padding:
            max(14px, env(safe-area-inset-top))
            max(20px, env(safe-area-inset-right))
            max(18px, env(safe-area-inset-bottom))
            max(20px, env(safe-area-inset-left));
          box-sizing: border-box;
          color: #e8efff;
          font-family: var(--font-body);
          color-scheme: dark;
          -webkit-font-smoothing: antialiased;
          background:
            radial-gradient(ellipse 70% 55% at 50% 42%, rgba(16, 38, 92, 0.55) 0%, rgba(7, 16, 40, 0.35) 45%, rgba(3, 6, 13, 0) 75%),
            radial-gradient(ellipse 120% 90% at 50% 110%, #050c1c 0%, ${BG} 60%);
          /* Diamètre du cœur : borné par la largeur et par la hauteur
             visible, pour que le clavier iOS ne pousse rien hors champ. */
          --torix-core: clamp(56px, min(30vw, calc(var(--app-h) * 0.165)), 140px);
        }
        @supports (height: 100dvh) {
          .lab { --app-h: 100dvh; }
        }

        .top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(170, 195, 240, 0.45);
        }
        .back {
          color: inherit;
          text-decoration: none;
          padding: 10px 10px 10px 0;
          min-width: 44px;
        }
        .back::before { content: '← '; }
        .back:hover, .back:focus-visible { color: rgba(200, 220, 255, 0.8); }
        .mark { color: rgba(215, 228, 255, 0.72); font-weight: 600; }
        .mark__lab { font-weight: 400; color: rgba(170, 195, 240, 0.5); }
        .compass-btn {
          width: 44px;
          height: 44px;
          margin-right: -10px;
          display: grid;
          place-items: center;
          border: 0;
          border-radius: 50%;
          background: transparent;
          color: rgba(170, 195, 240, 0.55);
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          transition: color 300ms ease, background 300ms ease;
        }
        .compass-btn--on {
          color: #9fdcff;
          background: rgba(120, 190, 255, 0.1);
        }
        .compass-btn:focus-visible { outline: 2px solid #8fd0ff; outline-offset: 2px; }

        .stage {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 0;
        }
        .dial {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 0;
          height: 0;
          pointer-events: none;
        }
        .dial__mark {
          position: absolute;
          left: -0.6em;
          top: -0.6em;
          width: 1.2em;
          height: 1.2em;
          display: grid;
          place-items: center;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.04em;
          opacity: 0.45;
          transition: opacity 500ms ease, text-shadow 500ms ease;
        }
        .dial__mark--on {
          opacity: 1;
          text-shadow: 0 0 12px currentColor;
        }
        .readout {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 4px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          text-align: center;
          pointer-events: none;
        }
        .readout__cap {
          font-size: 12px;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          font-variant-numeric: tabular-nums;
          color: rgba(170, 195, 240, 0.5);
          transition: color 500ms ease;
        }
        .readout__cap--found { color: #aee2ff; }
        .readout__hint {
          font-size: 13px;
          color: rgba(190, 208, 240, 0.55);
        }

        .sim {
          width: 100%;
          max-width: 460px;
          margin: 0 auto 14px;
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 12px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: rgba(170, 195, 240, 0.5);
        }
        .sim__range {
          flex: 1;
          min-width: 0;
          accent-color: #8fd0ff;
        }
        .sim__value {
          min-width: 3.2em;
          text-align: right;
          font-variant-numeric: tabular-nums;
        }

        .dialog {
          width: 100%;
          max-width: 460px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: clamp(16px, 3.2vh, 28px);
        }
        .answer {
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-height: 0;
        }
        .answer__tag {
          margin: 0;
          text-align: center;
          font-size: 11px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(160, 200, 255, 0.55);
          animation: appear 700ms cubic-bezier(0.2, 0.7, 0.2, 1) both;
        }
        .line {
          margin: 0;
          white-space: pre-line;
          min-height: 2.7em;
          display: flex;
          align-items: flex-end;
          justify-content: center;
          text-align: center;
          font-size: clamp(18px, 5vw, 22px);
          line-height: 1.35;
          font-weight: 400;
          letter-spacing: -0.01em;
          color: rgba(236, 243, 255, 0.94);
          text-wrap: balance;
          animation: appear 700ms cubic-bezier(0.2, 0.7, 0.2, 1) both;
        }
        .line--intro { color: rgba(190, 208, 240, 0.6); }
        /* Réponses de connaissance : plusieurs lignes, lues plutôt que
           contemplées — plus petites, alignées à gauche, défilables. */
        .line--long {
          display: block;
          text-align: left;
          font-size: 16px;
          line-height: 1.5;
          max-height: 34vh;
          max-height: 34dvh;
          overflow-y: auto;
          -webkit-overflow-scrolling: touch;
          text-wrap: pretty;
        }

        .chips {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          margin: 0 -4px;
          padding: 2px 4px;
          scrollbar-width: none;
        }
        .chips::-webkit-scrollbar { display: none; }
        .chip {
          flex: none;
          padding: 9px 14px;
          border-radius: 999px;
          border: 1px solid rgba(150, 185, 255, 0.18);
          background: rgba(140, 175, 255, 0.05);
          color: rgba(215, 228, 255, 0.8);
          font: inherit;
          font-size: 14px;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
        }
        .chip:active { background: rgba(140, 175, 255, 0.12); }

        .ask {
          position: relative;
          display: flex;
          align-items: center;
          height: 54px;
          border-radius: 27px;
          background: rgba(140, 175, 255, 0.05);
          border: 1px solid rgba(150, 185, 255, 0.14);
          transition: border-color 300ms ease, background 300ms ease;
        }
        .ask:focus-within {
          border-color: rgba(120, 190, 255, 0.4);
          background: rgba(140, 175, 255, 0.08);
        }
        .ask__input {
          flex: 1;
          min-width: 0;
          height: 100%;
          padding: 0 8px 0 22px;
          border: 0;
          outline: none;
          background: transparent;
          color: #f1f5ff;
          caret-color: #8fd0ff;
          /* 16 px minimum : en dessous, Safari iOS zoome sur le champ. */
          font-size: 17px;
          font-family: inherit;
          -webkit-appearance: none;
          appearance: none;
          border-radius: 27px;
        }
        .ask__input::placeholder { color: rgba(170, 190, 225, 0.4); }
        .ask__send {
          flex: none;
          width: 44px;
          height: 44px;
          margin-right: 5px;
          display: grid;
          place-items: center;
          border: 0;
          border-radius: 50%;
          background: #eaf3ff;
          color: #06101f;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          transition: opacity 250ms ease, transform 250ms ease, background 250ms ease;
        }
        .ask__send:active:not(:disabled) { transform: scale(0.94); }
        .ask__send:disabled {
          opacity: 0.18;
          cursor: default;
        }
        .ask__send:focus-visible { outline: 2px solid #8fd0ff; outline-offset: 2px; }
        .ask__mic {
          flex: none;
          width: 44px;
          height: 44px;
          margin-right: 4px;
          display: grid;
          place-items: center;
          border: 0;
          border-radius: 50%;
          background: transparent;
          color: #cfe0ff;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          transition: color 250ms ease, background 250ms ease, transform 250ms ease;
        }
        .ask__mic:active:not(:disabled) { transform: scale(0.94); }
        .ask__mic--on {
          color: #06101f;
          background: #8fd0ff;
          animation: listen 1.2s ease-in-out infinite;
        }
        .ask__mic:disabled { cursor: default; }
        .ask__mic:focus-visible { outline: 2px solid #8fd0ff; outline-offset: 2px; }
        @keyframes listen {
          0%, 100% { box-shadow: 0 0 0 0 rgba(143, 208, 255, 0.45); }
          50% { box-shadow: 0 0 0 8px rgba(143, 208, 255, 0); }
        }

        @keyframes appear {
          from { opacity: 0; transform: translateY(6px); filter: blur(4px); }
          to { opacity: 1; transform: none; filter: blur(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .line { animation-duration: 1ms; }
          .ask__mic--on { animation: none; }
        }
        @media (min-width: 768px) {
          .lab { --torix-core: clamp(96px, calc(var(--app-h) * 0.17), 150px); }
        }
      `}</style>
    </main>
  )
}

/**
 * Suit le viewport visible (Safari iOS le rétrécit quand le clavier
 * s'ouvre, et le décale s'il fait défiler la page) et l'expose en variables
 * CSS : la page tient toujours dans ce qui est réellement visible.
 */
function useVisualViewport(): CSSProperties | undefined {
  const [style, setStyle] = useState<CSSProperties>()

  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => {
      setStyle({
        '--app-h': `${Math.round(vv.height)}px`,
        '--app-top': `${Math.round(vv.offsetTop)}px`,
      } as CSSProperties)
    }
    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])

  return style
}

/** Barre Safari assortie au fond le temps de la visite, rétablie ensuite. */
function useDarkThemeColor(color: string) {
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    if (!meta) return
    const previous = meta.content
    meta.content = color
    return () => { meta.content = previous }
  }, [color])
}

const fmt = (v: number | null, digits = 0) => (v === null ? '—' : v.toFixed(digits))

/** Diagnostic du capteur : ce que le navigateur envoie vraiment. */
function CompassDebugPanel({
  status,
  heading,
  debug,
}: {
  status: CompassStatus
  heading: number | null
  debug: CompassDebug
}) {
  let hint: string | null = null
  if (status === 'denied') {
    hint = "Accès refusé : ferme l'onglet, rouvre la page et accepte « Mouvement et orientation »."
  } else if (status === 'unsupported' && debug.events === 0) {
    hint = "Aucun événement d'orientation reçu. Sur iPhone : pas en navigation privée, et l'accès doit avoir été accepté."
  } else if (debug.events > 0 && debug.compassHeading === null && !debug.absolute) {
    hint = "Le capteur répond, mais sans cap. Sur iPhone : Réglages › Confidentialité et sécurité › Service de localisation (activé) › Services système › Calibrage de la boussole."
  }

  return (
    <div className="dbg">
      <div className="dbg__grid">
        <span>état</span><b>{status}</b>
        <span>permission</span><b>{debug.permission}</b>
        <span>événements</span><b>{debug.events}{debug.source ? ` · ${debug.source}` : ''}</b>
        <span>cap iOS</span><b>{fmt(debug.compassHeading)} ± {fmt(debug.compassAccuracy)}</b>
        <span>α β γ</span><b>{fmt(debug.alpha)} · {fmt(debug.beta)} · {fmt(debug.gamma)}</b>
        <span>absolu</span><b>{debug.absolute === null ? '—' : String(debug.absolute)}</b>
        <span>cap retenu</span><b>{fmt(heading)}</b>
      </div>
      {hint && <p className="dbg__hint">{hint}</p>}

      <style jsx>{`
        .dbg {
          width: 100%;
          max-width: 460px;
          margin: 0 auto 12px;
          padding: 10px 14px;
          box-sizing: border-box;
          border-radius: 12px;
          background: rgba(140, 175, 255, 0.06);
          border: 1px solid rgba(150, 185, 255, 0.12);
          font: 11px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace;
          color: rgba(190, 208, 240, 0.7);
        }
        .dbg__grid {
          display: grid;
          grid-template-columns: auto 1fr;
          column-gap: 12px;
        }
        .dbg__grid b {
          font-weight: 500;
          color: #e8efff;
          overflow-wrap: anywhere;
        }
        .dbg__hint {
          margin: 8px 0 0;
          font-family: var(--font-body);
          font-size: 12px;
          color: #ffd98a;
        }
      `}</style>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  // Ouvert à tous les admins de Tiroir ; Gratuit, Premium et Pro : 404.
  const guard = await requireTorixPage(ctx)
  if (!guard.ok) return guard.result
  // Rien à transmettre au client : l'accès suffit.
  return { props: {} }
}
