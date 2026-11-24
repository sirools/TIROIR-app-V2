import { useEffect, useState } from 'react'
import { crowdfundingLink, crowdfundingLive } from '../lib/crowdfunding'
import { useCopy } from '../locales'

// Toast de l'accueil : annonce la collecte Ulule et y emmène, dans un nouvel
// onglet. Adresse, état et date de fin viennent de lib/crowdfunding.ts ;
// passé la date de fin, il ne s'affiche plus.

// Fermé, il ne revient pas de la session (onglet) ; il revient à la visite suivante.
const DISMISS_KEY = 'tiroir_ulule_toast_dismissed'
// Scroll minimum avant apparition (~un écran)
const SCROLL_TRIGGER = 600

export default function UluleInvite() {
  const { t: { home: { ululeInvite: t } } } = useCopy()
  // 'hidden' tant que non déclenché, puis 'visible', puis 'leaving' pendant la sortie
  const [state, setState] = useState<'hidden' | 'visible' | 'leaving'>('hidden')

  useEffect(() => {
    // La date se lit dans le navigateur : la page peut avoir été générée avant la fin.
    if (!crowdfundingLive()) return
    try {
      if (window.sessionStorage.getItem(DISMISS_KEY)) return
    } catch {
      /* sessionStorage indisponible : on affiche quand même */
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
      window.sessionStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* sans conséquence */
    }
    // laisse l'animation de sortie se jouer avant de démonter
    window.setTimeout(() => setState('hidden'), 300)
  }

  if (state === 'hidden') return null

  return (
    <div className={`ulule-toast ${state === 'leaving' ? 'leaving' : ''}`} role="region" aria-label={t.label}>
      <a
        className="ulule-toast__link"
        href={crowdfundingLink('toast')}
        target="_blank"
        rel="noopener noreferrer"
      >
        <span className="ulule-toast__emoji" aria-hidden="true">🎄</span>
        <span>{t.text}</span>
      </a>
      <button className="ulule-toast__close" type="button" aria-label={t.close} onClick={dismiss}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      <style jsx>{`
        .ulule-toast {
          position: fixed;
          left: 20px;
          bottom: 20px;
          z-index: 90;
          display: flex;
          align-items: flex-start;
          gap: 4px;
          width: 340px;
          max-width: calc(100vw - 40px);
          background: var(--white);
          border: 1px solid var(--border);
          border-radius: 16px;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.16);
          padding: 6px 6px 6px 0;
          animation: ulule-in 0.35s cubic-bezier(0.22, 1, 0.36, 1);
        }
        .ulule-toast.leaving {
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
        .ulule-toast__link {
          flex: 1;
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 10px 4px 10px 16px;
          font-family: var(--font-body);
          font-size: 14.5px;
          font-weight: 700;
          line-height: 1.45;
          color: var(--ink);
          text-decoration: none;
          border-radius: 12px;
        }
        .ulule-toast__link:hover { color: var(--orange); }
        .ulule-toast__emoji { font-size: 20px; line-height: 1.1; }
        .ulule-toast__close {
          flex: none;
          width: 36px;
          height: 36px;
          display: grid;
          place-items: center;
          border: 0;
          border-radius: 10px;
          background: transparent;
          color: var(--muted);
          cursor: pointer;
          transition: background 0.15s;
        }
        .ulule-toast__close:hover { background: var(--beige-2); }

        @media (max-width: 480px) {
          .ulule-toast { left: 12px; right: 12px; bottom: 12px; width: auto; max-width: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .ulule-toast, .ulule-toast.leaving { animation: none; }
        }
      `}</style>
    </div>
  )
}
