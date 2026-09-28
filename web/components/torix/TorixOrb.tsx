// Présence visuelle de Torix : un cœur blanc qui respire, un halo bleu,
// et une énergie en forme de flammes derrière.
//
// Tout est en CSS (transform / opacity uniquement dans les boucles, pour
// rester fluide sur iPhone). Les états ne modifient jamais les animations
// en cours — changer une durée ferait sauter la phase. Chaque boucle vit sur
// un élément intérieur ; l'état agit sur son enveloppe (échelle, opacité)
// avec une transition, ou fait apparaître des couches supplémentaires.
//
// Taille pilotée par la variable CSS --torix-core (diamètre du cœur),
// posée par le parent.
import type { CSSProperties } from 'react'

export type TorixState = 'idle' | 'listening' | 'speaking'

type Tongue = { x: number; w: number; h: number; d: number; delay: number; sway: number }

// Langues de flamme : position horizontale (% du foyer), largeur et hauteur
// (fractions du cœur), durée (s), déphasage (s), dérive latérale (%).
const CALM: Tongue[] = [
  { x: 50, w: 0.7, h: 2.1, d: 3.8, delay: 0, sway: -5 },
  { x: 36, w: 0.52, h: 1.6, d: 4.3, delay: -1.4, sway: 9 },
  { x: 64, w: 0.54, h: 1.7, d: 4.0, delay: -2.6, sway: -9 },
  { x: 45, w: 0.42, h: 1.9, d: 3.3, delay: -0.8, sway: 12 },
  { x: 56, w: 0.44, h: 2.0, d: 4.7, delay: -3.1, sway: -12 },
  { x: 27, w: 0.36, h: 1.2, d: 5.0, delay: -2.0, sway: 16 },
  { x: 73, w: 0.36, h: 1.25, d: 4.5, delay: -3.8, sway: -16 },
]

const LIVELY: Tongue[] = [
  { x: 50, w: 0.56, h: 2.4, d: 1.9, delay: -0.3, sway: 7 },
  { x: 38, w: 0.42, h: 1.9, d: 1.6, delay: -1.1, sway: -11 },
  { x: 62, w: 0.42, h: 2.0, d: 1.75, delay: -0.6, sway: 11 },
  { x: 46, w: 0.34, h: 2.2, d: 2.1, delay: -1.5, sway: -14 },
  { x: 55, w: 0.34, h: 2.1, d: 1.5, delay: -0.9, sway: 14 },
]

function tongueStyle(t: Tongue): CSSProperties {
  return {
    '--x': `${t.x}%`,
    '--w': t.w,
    '--h': t.h,
    '--sway': `${t.sway}%`,
    animationDuration: `${t.d}s`,
    animationDelay: `${t.delay}s`,
  } as CSSProperties
}

export default function TorixOrb({ state = 'idle' }: { state?: TorixState }) {
  return (
    <div className="orb" data-state={state} aria-hidden="true">
      <div className="layer aura"><span className="aura__glow" /></div>

      <div className="layer fire fire--calm">
        <span className="fire__bed" />
        {CALM.map((t, i) => <span key={i} className="tongue" style={tongueStyle(t)} />)}
      </div>
      <div className="layer fire fire--lively">
        {LIVELY.map((t, i) => <span key={i} className="tongue" style={tongueStyle(t)} />)}
      </div>

      <div className="layer halo"><span className="halo__glow" /></div>

      <div className="layer rings rings--listen">
        <span className="ring ring--in" />
        <span className="ring ring--in ring--late" />
      </div>
      <div className="layer rings rings--speak">
        <span className="ring ring--out" />
        <span className="ring ring--out ring--late" />
      </div>

      <div className="layer core">
        <span className="core__shine" />
        <span className="skin skin--a" />
        <span className="skin skin--b" />
        <span className="skin skin--c" />
        <span className="skin skin--lively" />
      </div>

      <style jsx>{`
        .orb {
          --core: var(--torix-core, 120px);
          --ease: cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          width: calc(var(--core) * 3);
          height: calc(var(--core) * 3);
          max-width: 100%;
          pointer-events: none;
          isolation: isolate;
        }
        .layer {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          transition: transform 900ms var(--ease), opacity 900ms var(--ease);
        }

        /* ---------- Aura lointaine ---------- */
        .aura { width: calc(var(--core) * 3.2); height: calc(var(--core) * 3.2); }
        .aura__glow {
          position: absolute; inset: 0; border-radius: 50%;
          background: radial-gradient(circle, rgba(34, 86, 214, 0.28) 0%, rgba(18, 48, 140, 0.12) 40%, rgba(6, 16, 50, 0) 68%);
          animation: breathe 9s ease-in-out infinite;
        }

        /* ---------- Énergie / flammes ---------- */
        .fire {
          width: calc(var(--core) * 1.8);
          height: calc(var(--core) * 2.6);
          /* Le foyer part un peu sous le centre du cœur et monte. */
          transform: translate(-50%, -92%);
          transform-origin: 50% 100%;
        }
        .fire__bed {
          position: absolute;
          left: 50%; bottom: calc(var(--core) * -0.25);
          width: calc(var(--core) * 1.5); height: calc(var(--core) * 1.1);
          margin-left: calc(var(--core) * -0.75);
          border-radius: 50%;
          background: radial-gradient(ellipse at 50% 60%, rgba(70, 150, 255, 0.55) 0%, rgba(30, 80, 230, 0.22) 45%, rgba(10, 30, 120, 0) 72%);
          filter: blur(6px);
          transform-origin: 50% 80%;
          animation: bed 5.5s ease-in-out infinite;
        }
        .tongue {
          position: absolute;
          bottom: 0;
          left: var(--x);
          width: calc(var(--core) * var(--w));
          height: calc(var(--core) * var(--h));
          margin-left: calc(var(--core) * var(--w) * -0.5);
          /* Goutte inversée : large à la base, effilée en haut. */
          border-radius: 50% 50% 46% 46% / 72% 72% 28% 28%;
          background: radial-gradient(ellipse 50% 62% at 50% 72%,
            rgba(185, 238, 255, 0.95) 0%,
            rgba(85, 175, 255, 0.75) 30%,
            rgba(34, 96, 240, 0.4) 60%,
            rgba(12, 40, 160, 0) 100%);
          filter: blur(6px);
          mix-blend-mode: screen;
          transform-origin: 50% 100%;
          opacity: 0;
          will-change: transform, opacity;
          animation-name: rise;
          animation-timing-function: cubic-bezier(0.45, 0.05, 0.55, 0.95);
          animation-iteration-count: infinite;
        }
        .fire--lively { opacity: 0; }
        .fire--lively .tongue { filter: blur(5px); }

        /* ---------- Halo proche ---------- */
        .halo { width: calc(var(--core) * 2.3); height: calc(var(--core) * 2.3); }
        .halo__glow {
          position: absolute; inset: 0; border-radius: 50%;
          background: radial-gradient(circle,
            rgba(150, 205, 255, 0.55) 0%,
            rgba(80, 150, 255, 0.34) 30%,
            rgba(40, 95, 235, 0.14) 50%,
            rgba(20, 50, 160, 0) 70%);
          animation: breathe 6.5s ease-in-out infinite, flicker 11s ease-in-out infinite;
        }

        /* ---------- Anneaux d'écoute / de parole ---------- */
        .rings { width: var(--core); height: var(--core); opacity: 0; }
        .ring {
          position: absolute; inset: 0; border-radius: 50%;
          border: 1px solid rgba(170, 215, 255, 0.5);
          opacity: 0;
        }
        .ring--in { animation: gather 1.5s var(--ease) infinite; }
        .ring--out { animation: ripple 1.8s var(--ease) infinite; }
        .ring--late { animation-delay: -0.75s; }
        .ring--out.ring--late { animation-delay: -0.9s; }

        /* ---------- Cœur ---------- */
        .core {
          width: var(--core); height: var(--core);
          transition: transform 900ms var(--ease), filter 900ms var(--ease);
        }
        .core__shine {
          position: absolute;
          inset: calc(var(--core) * -0.22);
          border-radius: 50%;
          background: radial-gradient(circle, rgba(235, 245, 255, 0.55) 30%, rgba(140, 200, 255, 0.18) 55%, rgba(80, 140, 255, 0) 72%);
          animation: breathe 5s ease-in-out infinite;
        }
        .skin {
          position: absolute; inset: 0;
          background: radial-gradient(circle at 50% 44%, #ffffff 0%, #fbfdff 52%, #e6f1ff 82%, #cfe3ff 100%);
          border-radius: 50%;
          will-change: transform, border-radius;
        }
        /* Trois peaux presque rondes, déformées et tournées à des rythmes
           premiers entre eux : leur union donne un contour qui ondule
           sans jamais se répéter visiblement. */
        .skin--a { animation: morph-a 7s ease-in-out infinite, spin 29s linear infinite; }
        .skin--b { animation: morph-b 9s ease-in-out infinite, spin-rev 37s linear infinite; }
        .skin--c { animation: morph-c 11s ease-in-out infinite, spin 43s linear infinite; }
        .skin--lively {
          opacity: 0;
          transition: opacity 700ms var(--ease);
          animation: morph-lively 2.3s ease-in-out infinite, spin 7s linear infinite;
        }

        /* ---------- États ---------- */
        .orb[data-state='listening'] .core { transform: translate(-50%, -50%) scale(1.035); }
        .orb[data-state='listening'] .halo { transform: translate(-50%, -50%) scale(1.1); }
        .orb[data-state='listening'] .rings--listen { opacity: 1; }
        .orb[data-state='listening'] .fire--calm { transform: translate(-50%, -92%) scale(0.94, 0.9); }
        .orb[data-state='listening'] .skin--lively { opacity: 0.5; }

        .orb[data-state='speaking'] .core { transform: translate(-50%, -50%) scale(1.06); }
        .orb[data-state='speaking'] .halo { transform: translate(-50%, -50%) scale(1.18); }
        .orb[data-state='speaking'] .aura { transform: translate(-50%, -50%) scale(1.08); }
        .orb[data-state='speaking'] .rings--speak { opacity: 1; }
        .orb[data-state='speaking'] .fire--calm { transform: translate(-50%, -92%) scale(1.05, 1.12); }
        .orb[data-state='speaking'] .fire--lively { opacity: 1; }
        .orb[data-state='speaking'] .skin--lively { opacity: 1; }

        /* ---------- Boucles ---------- */
        @keyframes breathe {
          0%, 100% { transform: scale(0.96); opacity: 0.82; }
          50% { transform: scale(1.04); opacity: 1; }
        }
        @keyframes flicker {
          0%, 100% { opacity: 0.9; }
          23% { opacity: 1; }
          41% { opacity: 0.78; }
          67% { opacity: 0.97; }
          82% { opacity: 0.84; }
        }
        @keyframes bed {
          0%, 100% { transform: scale(1, 1); opacity: 0.85; }
          35% { transform: scale(1.06, 0.92); opacity: 1; }
          70% { transform: scale(0.95, 1.08); opacity: 0.9; }
        }
        @keyframes rise {
          0% { transform: translate(0, 10%) scale(0.6, 0.5); opacity: 0; }
          20% { opacity: 0.95; }
          45% { transform: translate(calc(var(--sway) * 0.6), -8%) scale(0.95, 1); opacity: 0.85; }
          75% { transform: translate(calc(var(--sway) * -0.4), -24%) scale(0.62, 1.15); opacity: 0.45; }
          100% { transform: translate(var(--sway), -40%) scale(0.28, 1.25); opacity: 0; }
        }
        @keyframes gather {
          0% { transform: scale(1.7); opacity: 0; }
          40% { opacity: 0.55; }
          100% { transform: scale(1.02); opacity: 0; }
        }
        @keyframes ripple {
          0% { transform: scale(1.02); opacity: 0.6; }
          100% { transform: scale(2.3); opacity: 0; }
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes spin-rev { to { transform: rotate(-360deg); } }
        @keyframes morph-a {
          0%, 100% { border-radius: 50% 50% 50% 50% / 50% 50% 50% 50%; }
          33% { border-radius: 53% 47% 51% 49% / 48% 53% 47% 52%; }
          66% { border-radius: 48% 52% 47% 53% / 52% 48% 53% 47%; }
        }
        @keyframes morph-b {
          0%, 100% { border-radius: 49% 51% 52% 48% / 51% 49% 50% 50%; }
          40% { border-radius: 52% 48% 48% 52% / 47% 52% 49% 53%; }
          75% { border-radius: 47% 53% 51% 49% / 53% 47% 52% 48%; }
        }
        @keyframes morph-c {
          0%, 100% { border-radius: 51% 49% 48% 52% / 49% 51% 52% 48%; }
          50% { border-radius: 48% 52% 53% 47% / 52% 48% 47% 53%; }
        }
        @keyframes morph-lively {
          0%, 100% { border-radius: 50% 50% 50% 50% / 50% 50% 50% 50%; }
          25% { border-radius: 54% 46% 51% 49% / 47% 53% 47% 53%; }
          50% { border-radius: 47% 53% 47% 53% / 53% 47% 53% 47%; }
          75% { border-radius: 52% 48% 54% 46% / 48% 52% 47% 53%; }
        }

        @media (prefers-reduced-motion: reduce) {
          .orb *, .orb *::before, .orb *::after {
            animation: none !important;
          }
          .layer, .core, .skin--lively { transition-duration: 300ms; }
          /* Figées, les flammes restent présentes mais discrètes. */
          .tongue { opacity: 0.5; transform: scale(0.85, 0.85); }
          .fire--lively .tongue { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}
