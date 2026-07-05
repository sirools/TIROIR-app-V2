import { useEffect, useState } from 'react'

const SURVEY_URL =
  'https://docs.google.com/forms/d/e/1FAIpQLSfgJ6WTAkgl0yWfqbfVHU-Dkc5nFLEZNXp0FGETQDV0t_5Mew/viewform'

const DISMISS_KEY = 'tiroir_survey_dismissed_at'
// Ne pas reproposer avant ce délai après une fermeture (7 jours)
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000
// Scroll minimum avant apparition (~un écran)
const SCROLL_TRIGGER = 600

export default function SurveyInvite() {
  // 'hidden' tant que non déclenché, puis 'visible', puis 'leaving' pendant la sortie
  const [state, setState] = useState<'hidden' | 'visible' | 'leaving'>('hidden')

  useEffect(() => {
    // Respecte une fermeture récente
    try {
      const dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY) || 0)
      if (dismissedAt && Date.now() - dismissedAt < SNOOZE_MS) return
    } catch {
      /* localStorage indisponible : on affiche quand même */
    }

    let shown = false
    const onScroll = () => {
      if (!shown && window.scrollY > SCROLL_TRIGGER) {
        shown = true
        setState('visible')
        window.removeEventListener('scroll', onScroll)
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll() // au cas où la page est déjà scrollée
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function dismiss() {
    setState('leaving')
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      /* sans conséquence */
    }
    // laisse l'animation de sortie se jouer avant de démonter
    window.setTimeout(() => setState('hidden'), 300)
  }

  if (state === 'hidden') return null

  return (
    <div className={`survey-invite ${state === 'leaving' ? 'leaving' : ''}`} role="dialog" aria-label="Enquête utilisateur">
      <button className="survey-invite__close" type="button" aria-label="Fermer" onClick={dismiss}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      <div className="survey-invite__emoji" aria-hidden="true">📝</div>
      <p className="survey-invite__title">Une étude est en cours&nbsp;!</p>
      <p className="survey-invite__text">
        On améliore Tiroir et ton avis compte. Compte 6 à 8 minutes.
      </p>
      <a
        className="survey-invite__cta"
        href={SURVEY_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={dismiss}
      >
        Participer à l&apos;enquête
      </a>

      <style jsx>{`
        .survey-invite {
          position: fixed;
          left: 20px;
          bottom: 20px;
          z-index: 90;
          width: 300px;
          max-width: calc(100vw - 40px);
          background: #fff;
          border: 1px solid rgba(0, 0, 0, 0.08);
          border-radius: 16px;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.16);
          padding: 20px 20px 22px;
          animation: survey-in 0.35s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .survey-invite.leaving {
          animation: survey-out 0.3s ease forwards;
        }
        @keyframes survey-in {
          from { opacity: 0; transform: translateX(-24px) translateY(8px); }
          to { opacity: 1; transform: translateX(0) translateY(0); }
        }
        @keyframes survey-out {
          from { opacity: 1; transform: translateX(0); }
          to { opacity: 0; transform: translateX(-24px); }
        }
        .survey-invite__close {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 28px;
          height: 28px;
          display: grid;
          place-items: center;
          border: 0;
          border-radius: 8px;
          background: transparent;
          color: #8a8178;
          cursor: pointer;
          transition: background 0.15s;
        }
        .survey-invite__close:hover { background: #f2ede6; }
        .survey-invite__emoji {
          font-size: 26px;
          margin-bottom: 6px;
        }
        .survey-invite__title {
          font-size: 16px;
          font-weight: 800;
          color: #1a1612;
          margin: 0 0 4px;
        }
        .survey-invite__text {
          font-size: 13.5px;
          color: #6b6158;
          line-height: 1.5;
          margin: 0 0 16px;
          padding-right: 8px;
        }
        .survey-invite__cta {
          display: block;
          text-align: center;
          background: #f26900;
          color: #fff;
          font-weight: 700;
          font-size: 14px;
          text-decoration: none;
          padding: 11px 16px;
          border-radius: 10px;
          transition: background 0.15s;
        }
        .survey-invite__cta:hover { background: #d85e00; }

        @media (prefers-reduced-motion: reduce) {
          .survey-invite, .survey-invite.leaving { animation: none; }
        }
      `}</style>
    </div>
  )
}
