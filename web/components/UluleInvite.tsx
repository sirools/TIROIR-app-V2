import { useEffect, useState } from 'react'
import { localePrefix } from '../lib/localeRouting'
import { useCopy } from '../locales'

// Passe par /u/ : page de rendez-vous avant le lancement, puis redirection
// vers Ulule (date réglée dans /admin/ulule).
const CAMPAIGN_PATH = '/u/accueil'

const DISMISS_KEY = 'tiroir_ulule_invite_dismissed_at'
// Ne pas reproposer avant ce délai après une fermeture (7 jours)
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000
// Scroll minimum avant apparition (~un écran)
const SCROLL_TRIGGER = 600

export default function UluleInvite() {
  const { t: { home: { ululeInvite: t } }, locale } = useCopy()
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
    <div className={`ulule-invite ${state === 'leaving' ? 'leaving' : ''}`} role="dialog" aria-label={t.label}>
      <button className="ulule-invite__close" type="button" aria-label={t.close} onClick={dismiss}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      <div className="ulule-invite__emoji" aria-hidden="true">🗝️</div>
      <p className="ulule-invite__title">{t.title}</p>
      <p className="ulule-invite__text">{t.text}</p>
      <a
        className="ulule-invite__cta"
        href={`${localePrefix(locale)}${CAMPAIGN_PATH}`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={dismiss}
      >
        {t.cta}
      </a>

      <style jsx>{`
        .ulule-invite {
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
          animation: ulule-in 0.35s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .ulule-invite.leaving {
          animation: ulule-out 0.3s ease forwards;
        }
        @keyframes ulule-in {
          from { opacity: 0; transform: translateX(-24px) translateY(8px); }
          to { opacity: 1; transform: translateX(0) translateY(0); }
        }
        @keyframes ulule-out {
          from { opacity: 1; transform: translateX(0); }
          to { opacity: 0; transform: translateX(-24px); }
        }
        .ulule-invite__close {
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
        .ulule-invite__close:hover { background: #f2ede6; }
        .ulule-invite__emoji {
          font-size: 26px;
          margin-bottom: 6px;
        }
        .ulule-invite__title {
          font-size: 16px;
          font-weight: 800;
          color: #1a1612;
          margin: 0 0 4px;
        }
        .ulule-invite__text {
          font-size: 13.5px;
          color: #6b6158;
          line-height: 1.5;
          margin: 0 0 16px;
          padding-right: 8px;
        }
        .ulule-invite__cta {
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
        .ulule-invite__cta:hover { background: #d85e00; }

        @media (prefers-reduced-motion: reduce) {
          .ulule-invite, .ulule-invite.leaving { animation: none; }
        }
      `}</style>
    </div>
  )
}
