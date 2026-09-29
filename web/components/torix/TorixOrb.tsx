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
//
// Boussole (facultative) : la flamme est une aiguille qui pointe vers le
// nord — en haut quand on fait face au nord, en bas face au sud — et prend
// la couleur de la direction où pointe le téléphone (palette.ts). `facing`
// signale qu'on fait face à un point cardinal : la flamme s'élance. Sans
// `heading`, Torix reste bleu, flamme vers le haut.
//
// Nord : la flamme monte en puissance à mesure qu'on s'aligne vers le nord
// (northPower, 0 à 1, posé en --north) — une colonne de feu plus haute et
// plus vive dans l'aiguille, une lueur autour du cœur. Face au nord, elle
// est au maximum et une onde s'en échappe. Au sud, rien de plus.
import type { CSSProperties } from 'react'
import { northPower, type Cardinal } from './heading'
import { paletteAt, paletteVars } from './palette'

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

// Colonne du nord : plus haute, plus rapide, plus serrée.
const SURGE: Tongue[] = [
  { x: 50, w: 0.62, h: 3.0, d: 1.4, delay: -0.2, sway: 4 },
  { x: 42, w: 0.4, h: 2.6, d: 1.2, delay: -0.7, sway: -8 },
  { x: 58, w: 0.4, h: 2.7, d: 1.3, delay: -0.45, sway: 8 },
  { x: 50, w: 0.3, h: 3.3, d: 1.0, delay: -0.9, sway: -3 },
  { x: 47, w: 0.26, h: 2.9, d: 1.1, delay: -0.35, sway: 10 },
]

// Teinte de chaque langue parmi les quatre de la palette. La première
// revient une fois sur deux : au sud, c'est ce qui fait un feu surtout jaune,
// piqué de rouge, de vert et d'argent.
const SLOT_PATTERN = [0, 1, 0, 2, 0, 3]

function tongueStyle(t: Tongue, i: number): CSSProperties {
  const slot = SLOT_PATTERN[i % SLOT_PATTERN.length]
  return {
    '--c-hi': `var(--s${slot}-hi)`,
    '--c-mid': `var(--s${slot}-mid)`,
    '--c-lo': `var(--s${slot}-lo)`,
    '--x': `${t.x}%`,
    '--w': t.w,
    '--h': t.h,
    '--sway': `${t.sway}%`,
    animationDuration: `${t.d}s`,
    animationDelay: `${t.delay}s`,
  } as CSSProperties
}

type Props = {
  state?: TorixState
  /** Cap du téléphone en degrés (0 = nord, horaire), ou null sans boussole. */
  heading?: number | null
  /** Point cardinal auquel on fait face : la flamme s'élance. */
  facing?: Cardinal | null
}

export default function TorixOrb({ state = 'idle', heading = null, facing = null }: Props) {
  const seeking = heading !== null
  const north = seeking ? northPower(heading) : 0
  return (
    <div
      className="orb"
      data-state={state}
      data-compass={seeking ? (facing ? 'found' : 'seeking') : undefined}
      data-north={facing === 'N' ? 'on' : undefined}
      style={{ ...paletteVars(paletteAt(heading ?? 0)), '--north': north } as CSSProperties}
      aria-hidden="true"
    >
      <div className="layer aura"><span className="aura__glow" /></div>
      <div className="layer north-glow"><span className="north-glow__light" /></div>

      {/* Aiguille à la taille de l'orbe : ses calques se placent comme
          avant, et elle pivote (vers le nord) et se met à l'échelle (le sud
          est un petit feu) autour du centre du cœur. Le cap est lissé en
          amont : pas de transition pendant la boussole. */}
      <div
        className="needle"
        style={{ transform: `rotate(${seeking ? -heading : 0}deg) scale(var(--fire-scale, 1))` }}
      >
        <div className="layer fire fire--calm">
          <span className="fire__bed" />
          {CALM.map((t, i) => <span key={i} className="tongue" style={tongueStyle(t, i)} />)}
        </div>
        <div className="layer fire fire--lively">
          {LIVELY.map((t, i) => <span key={i} className="tongue" style={tongueStyle(t, i + 1)} />)}
        </div>
        <div className="layer fire fire--north">
          {SURGE.map((t, i) => <span key={i} className="tongue" style={tongueStyle(t, i)} />)}
        </div>
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
      <div className="layer rings rings--north">
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
          background: radial-gradient(circle, rgba(var(--glow-lo), 0.3) 0%, rgba(var(--glow-lo), 0.1) 40%, rgba(var(--glow-lo), 0) 68%);
          animation: breathe 9s ease-in-out infinite;
        }

        /* ---------- Aiguille (boussole) ---------- */
        .needle {
          position: absolute;
          inset: 0;
          will-change: transform;
        }
        /* Boussole coupée : la flamme revient doucement vers le haut. */
        .orb:not([data-compass]) .needle { transition: transform 900ms var(--ease); }

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
          background: radial-gradient(ellipse at 50% 60%, rgba(var(--glow-mid), 0.55) 0%, rgba(var(--glow-lo), 0.22) 45%, rgba(var(--glow-lo), 0) 72%);
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
            rgba(var(--c-hi), 0.95) 0%,
            rgba(var(--c-mid), 0.75) 30%,
            rgba(var(--c-lo), 0.4) 60%,
            rgba(var(--c-lo), 0) 100%);
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

        /* ---------- Nord : montée en puissance ----------
           --north va de 0 (sud, ou sans boussole) à 1 (face au nord). Le cap
           est déjà lissé : transition courte, juste pour les à-coups. */
        .fire--north {
          opacity: var(--north, 0);
          transform: translate(-50%, -92%)
            scale(calc(0.7 + 0.4 * var(--north, 0)), calc(0.55 + 0.85 * var(--north, 0)));
          transition: transform 160ms linear, opacity 160ms linear;
        }
        .fire--north .tongue { filter: blur(4px); }
        .north-glow {
          width: calc(var(--core) * 3.4); height: calc(var(--core) * 3.4);
          opacity: calc(var(--north, 0) * var(--north, 0));
          transition: opacity 160ms linear;
        }
        .north-glow__light {
          position: absolute; inset: 0; border-radius: 50%;
          background: radial-gradient(circle,
            rgba(255, 255, 255, 0.5) 0%,
            rgba(var(--glow-hi), 0.45) 22%,
            rgba(var(--glow-mid), 0.22) 42%,
            rgba(var(--glow-lo), 0) 66%);
          animation: breathe 2.6s ease-in-out infinite;
        }
        .orb[data-north='on'] .rings--north { opacity: 1; }
        .orb[data-north='on'] .fire--lively { opacity: 1; }
        .orb[data-north='on'] .skin--lively { opacity: 0.8; }
        .rings--north .ring { border-color: rgba(var(--glow-hi), 0.7); }

        /* ---------- Halo proche ---------- */
        .halo { width: calc(var(--core) * 2.3); height: calc(var(--core) * 2.3); }
        .halo__glow {
          position: absolute; inset: 0; border-radius: 50%;
          background: radial-gradient(circle,
            rgba(var(--glow-hi), 0.55) 0%,
            rgba(var(--glow-mid), 0.34) 30%,
            rgba(var(--glow-lo), 0.14) 50%,
            rgba(var(--glow-lo), 0) 70%);
          animation: breathe 6.5s ease-in-out infinite, flicker 11s ease-in-out infinite;
        }

        /* ---------- Anneaux d'écoute / de parole ---------- */
        .rings { width: var(--core); height: var(--core); opacity: 0; }
        .ring {
          position: absolute; inset: 0; border-radius: 50%;
          border: 1px solid rgba(var(--glow-hi), 0.5);
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
          background: radial-gradient(circle, rgba(235, 245, 255, 0.55) 30%, rgba(var(--glow-hi), 0.18) 55%, rgba(var(--glow-mid), 0) 72%);
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

        /* ---------- Boussole ----------
           Entre deux points cardinaux : la flamme se tasse et pâlit.
           Face à l'un d'eux : elle s'élance, halo et cœur s'illuminent. */
        .orb[data-compass='seeking'] .fire--calm { transform: translate(-50%, -92%) scale(0.82, 0.78); opacity: 0.7; }
        .orb[data-compass='found'] .fire--calm { transform: translate(-50%, -92%) scale(1.08, 1.22); }
        .orb[data-compass='found'] .fire--lively { opacity: 0.85; }
        .orb[data-compass='found'] .halo { transform: translate(-50%, -50%) scale(1.14); }
        .orb[data-compass='found'] .aura { transform: translate(-50%, -50%) scale(1.1); }
        .orb[data-compass='found'] .core { transform: translate(-50%, -50%) scale(1.04); }

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
