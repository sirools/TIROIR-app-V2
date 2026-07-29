// Panorama bento en tête de la page Concept.
//
// Principe : un conteneur haut de N × 100vh, dont l'intérieur est collé
// (sticky) sur toute la hauteur du viewport. La progression du scroll
// vertical dans ce conteneur est convertie en translation horizontale de
// la piste. Résultat : un défilement latéral linéaire et continu, sans
// détournement de la molette ni déclencheur — et quand le conteneur est
// dépassé, le scroll vertical reprend naturellement sur la suite de la page.
//
// Sous 860 px, le principe est abandonné : les panneaux s'empilent
// verticalement. Épingler un défilement horizontal au doigt se retourne
// systématiquement contre l'utilisateur sur mobile.
import React, { useEffect, useRef, useState } from 'react'

const PANELS = [
  { id: 'capture',      kicker: '01 — Capture',      title: 'Une photo suffit.' },
  { id: 'intelligence', kicker: '02 — Analyse',      title: 'La fiche s’écrit seule.' },
  { id: 'volume',       kicker: '03 — Volume',       title: 'Cent objets, une session.' },
  { id: 'vie',          kicker: '04 — Cycle de vie', title: 'L’objet ne meurt jamais.' },
  { id: 'valeur',       kicker: '05 — Valeur',       title: 'Le marché, en direct.' },
  { id: 'partage',      kicker: '06 — Partage',      title: 'Un lien. C’est tout.' },
]

const DESKTOP = '(min-width: 861px)'

/** Tuile bento. `span` = colonnes, `rows` = lignes, `i` = ordre d'apparition. */
function Tile({
  children, span = 1, rows = 1, i = 0, tone = 'dark', className = '',
}: {
  children: React.ReactNode
  span?: number
  rows?: number
  i?: number
  tone?: 'dark' | 'cream' | 'accent' | 'glass'
  className?: string
}) {
  return (
    <div
      className={`tile tone-${tone} ${className}`}
      style={{
        gridColumn: `span ${span}`,
        gridRow: `span ${rows}`,
        transitionDelay: `${0.08 + i * 0.06}s`,
      }}
    >
      {children}
      <style jsx>{`
        .tile {
          position: relative;
          border-radius: 22px;
          padding: clamp(14px, 1.6vw, 22px);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          transform: translateY(26px) rotateX(7deg) scale(0.975);
          opacity: 0;
          transition:
            opacity 0.7s cubic-bezier(0.22, 0.68, 0.32, 1),
            transform 0.7s cubic-bezier(0.22, 0.68, 0.32, 1);
          will-change: transform, opacity;
        }
        :global(.is-in) .tile { opacity: 1; transform: translateY(0) rotateX(0) scale(1); }

        /* La profondeur vient de l'empilement d'ombres, pas d'une ombre unique. */
        .tone-dark {
          background:
            radial-gradient(120% 90% at 12% 0%, rgba(255,255,255,0.09), transparent 60%),
            linear-gradient(155deg, #2a241e, #17130f);
          border: 1px solid rgba(255,255,255,0.07);
          box-shadow:
            0 1px 0 rgba(255,255,255,0.06) inset,
            0 12px 24px rgba(0,0,0,0.34),
            0 40px 80px rgba(0,0,0,0.28);
          color: #F7F3EE;
        }
        .tone-cream {
          background:
            radial-gradient(110% 90% at 85% 0%, rgba(255,255,255,0.9), transparent 55%),
            linear-gradient(155deg, #F7F3EE, #E9E1D6);
          box-shadow:
            0 1px 0 rgba(255,255,255,0.8) inset,
            0 12px 24px rgba(0,0,0,0.22),
            0 40px 80px rgba(0,0,0,0.2);
          color: #1A1612;
        }
        .tone-accent {
          background:
            radial-gradient(110% 90% at 20% 0%, rgba(255,255,255,0.28), transparent 55%),
            linear-gradient(150deg, #F58220, #D85E00);
          box-shadow:
            0 1px 0 rgba(255,255,255,0.35) inset,
            0 12px 28px rgba(216,94,0,0.4),
            0 40px 80px rgba(0,0,0,0.28);
          color: #fff;
        }
        .tone-glass {
          background: rgba(247, 243, 238, 0.06);
          border: 1px solid rgba(255,255,255,0.1);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          box-shadow: 0 20px 50px rgba(0,0,0,0.3);
          color: #F7F3EE;
        }

        @media (prefers-reduced-motion: reduce) {
          .tile { transition: none; transform: none; opacity: 1; }
        }
      `}</style>
    </div>
  )
}

function Panel({
  panel, shown, children,
}: {
  panel: typeof PANELS[number]
  shown: boolean
  children: React.ReactNode
}) {
  return (
    <section id={panel.id} className={`pan-panel ${shown ? 'is-in' : ''}`}>
      <div className="pan-inner">
        <header>
          <span className="pan-kicker">{panel.kicker}</span>
          <h2 className="pan-title">{panel.title}</h2>
        </header>
        <div className="bx-bento">{children}</div>
      </div>

      <style jsx>{`
        .pan-panel {
          flex: 0 0 100vw;
          width: 100vw;
          height: 100%;
          display: flex;
          padding:
            clamp(16px, 3.5vh, 40px)
            clamp(20px, 6vw, 96px)
            clamp(92px, 11vh, 108px);
          min-width: 0;
        }
        .pan-inner {
          width: 100%;
          max-width: var(--max);
          margin: 0 auto;
          min-width: 0;
          min-height: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: clamp(18px, 3vh, 34px);
        }
        .pan-kicker {
          display: block;
          font-size: 12px; font-weight: 700; letter-spacing: 0.14em;
          text-transform: uppercase; color: #F26900;
          opacity: 0; transform: translateY(14px);
          transition: opacity 0.6s ease, transform 0.6s ease;
        }
        .pan-title {
          font-size: clamp(28px, 4.4vw, 56px);
          line-height: 1.05; letter-spacing: -0.03em;
          font-weight: 800; color: #F7F3EE;
          margin: 8px 0 0;
          opacity: 0; transform: translateY(20px);
          transition: opacity 0.7s ease 0.06s, transform 0.7s ease 0.06s;
        }
        .is-in .pan-kicker, .is-in .pan-title { opacity: 1; transform: translateY(0); }

        .bx-bento {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          grid-auto-rows: minmax(96px, auto);
          gap: clamp(10px, 1.4vw, 18px);
          perspective: 1400px;
        }
        @media (min-width: 861px) {
          .bx-bento {
            flex: 1;
            min-height: 0;
            max-height: 560px;
            grid-auto-rows: minmax(110px, 1fr);
          }
        }
        @media (max-width: 860px) {
          .pan-panel {
            flex: none;
            width: 100%;
            height: auto;
            padding: 40px 20px;
          }
          .bx-bento { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
      `}</style>
    </section>
  )
}

export default function BentoPanorama() {
  const wrapRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0)
  const [active, setActive] = useState(0)

  useEffect(() => {
    const wrap = wrapRef.current
    const track = trackRef.current
    if (!wrap || !track) return

    let raf = 0

    const apply = () => {
      // Empilement vertical sous 860 px : aucune translation à appliquer.
      if (!window.matchMedia(DESKTOP).matches) {
        track.style.transform = ''
        setProgress(0)
        setActive(0)
        return
      }
      const travel = wrap.offsetHeight - window.innerHeight
      const scrolled = -wrap.getBoundingClientRect().top
      const p = travel > 0 ? Math.min(1, Math.max(0, scrolled / travel)) : 0
      const maxX = track.scrollWidth - window.innerWidth
      track.style.transform = `translate3d(${-(p * maxX).toFixed(2)}px, 0, 0)`
      setProgress(p)
      setActive(Math.round(p * (PANELS.length - 1)))
    }

    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(apply)
    }

    // Flèches du clavier : un panneau = une hauteur de viewport.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
      if (!window.matchMedia(DESKTOP).matches) return
      const r = wrap.getBoundingClientRect()
      // Uniquement quand le panorama occupe l'écran.
      if (r.top > 0 || r.bottom < window.innerHeight) return
      e.preventDefault()
      window.scrollBy({
        top: e.key === 'ArrowRight' ? window.innerHeight : -window.innerHeight,
        behavior: 'smooth',
      })
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    window.addEventListener('keydown', onKey)
    apply()

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      window.removeEventListener('keydown', onKey)
      cancelAnimationFrame(raf)
    }
  }, [])

  function goTo(i: number) {
    const wrap = wrapRef.current
    if (!wrap) return
    const travel = wrap.offsetHeight - window.innerHeight
    const top = wrap.offsetTop + (travel * i) / (PANELS.length - 1)
    window.scrollTo({ top, behavior: 'smooth' })
  }

  return (
    <div
      className="pan"
      ref={wrapRef}
      style={{ height: `${PANELS.length * 100}vh` }}
    >
      <div className="pan-sticky">
        <div className="pan-track" ref={trackRef}>
          {/* 01 — Capture */}
          <Panel panel={PANELS[0]} shown={active >= 0}>
            <Tile span={2} rows={2} tone="dark" i={0}>
              <div className="shot">
                <div className="shot-sub">🧥</div>
                <div className="shot-ring" />
              </div>
              <span className="tile-cap">Viseur · une pression</span>
            </Tile>
            <Tile span={2} tone="accent" i={1}>
              <strong className="big">2,4 s</strong>
              <span className="tile-cap">de la photo à la fiche</span>
            </Tile>
            <Tile tone="cream" i={2}>
              <span className="lab">Titre</span>
              <span className="val">Veste en jean</span>
            </Tile>
            <Tile tone="glass" i={3}>
              <span className="lab">Matière</span>
              <span className="val">Denim</span>
            </Tile>
          </Panel>

          {/* 02 — Analyse */}
          <Panel panel={PANELS[1]} shown={active >= 1}>
            <Tile span={2} rows={2} tone="cream" i={0}>
              <div className="fields">
                {['Catégorie', 'Matière', 'Couleur', 'État', 'Époque'].map((f, n) => (
                  <div className="frow" key={f} style={{ animationDelay: `${n * 0.35}s` }}>
                    <span>{f}</span><i />
                  </div>
                ))}
              </div>
              <span className="tile-cap dark">Cinq champs, remplis automatiquement</span>
            </Tile>
            <Tile span={2} tone="dark" i={1}>
              <p className="quote">« L’IA remplit la colonne de gauche. Vous complétez celle de droite. »</p>
            </Tile>
            <Tile tone="glass" i={2}>
              <strong className="big sm">✓</strong>
              <span className="tile-cap">Toujours modifiable</span>
            </Tile>
            <Tile tone="accent" i={3}>
              <strong className="big sm">0</strong>
              <span className="tile-cap">formulaire vide</span>
            </Tile>
          </Panel>

          {/* 03 — Volume */}
          <Panel panel={PANELS[2]} shown={active >= 2}>
            <Tile span={3} rows={2} tone="dark" i={0}>
              <div className="mosaic">
                {['👟','⌚','📸','🎸','🧥','📚','🧢','👖','🥾','🧣','👕','🎽'].map((e, n) => (
                  <span key={n} style={{ animationDelay: `${n * 0.09}s` }}>{e}</span>
                ))}
              </div>
              <span className="tile-cap">Mode rafale · analyses en parallèle</span>
            </Tile>
            <Tile tone="accent" i={1}>
              <strong className="big">×20</strong>
              <span className="tile-cap">objets par lot</span>
            </Tile>
            <Tile tone="cream" i={2}>
              <span className="val">Sans attendre</span>
              <span className="tile-cap dark">corrigez pendant que ça tourne</span>
            </Tile>
          </Panel>

          {/* 04 — Cycle de vie */}
          <Panel panel={PANELS[3]} shown={active >= 3}>
            <Tile span={2} rows={2} tone="cream" i={0}>
              <div className="chips">
                {[
                  { l: 'Possédé', c: '#2D5016', b: '#E8F0E0' },
                  { l: 'Rangé', c: '#1A3A6B', b: '#E0EAF8' },
                  { l: 'Prêté', c: '#7A3B10', b: '#FDE8D0' },
                  { l: 'Vendu · 45 €', c: '#5E1A2F', b: '#FCE0E8' },
                ].map((s, n) => (
                  <span key={s.l} style={{ color: s.c, background: s.b, animationDelay: `${n * 0.55}s` }}>
                    {s.l}
                  </span>
                ))}
              </div>
              <span className="tile-cap dark">Le statut, pas la suppression</span>
            </Tile>
            <Tile span={2} tone="dark" i={1}>
              <p className="quote">« Un inventaire meurt le jour où il devient faux. »</p>
            </Tile>
            <Tile span={2} tone="glass" i={2}>
              <span className="val">Historique conservé</span>
              <span className="tile-cap">prix réel, date, destinataire</span>
            </Tile>
          </Panel>

          {/* 05 — Valeur */}
          <Panel panel={PANELS[4]} shown={active >= 4}>
            <Tile span={2} rows={2} tone="dark" i={0}>
              <div className="gauge">
                <div className="gtrack"><div className="gfill" /></div>
                <div className="gbounds"><span>950 €</span><span>1 400 €</span></div>
                <strong className="gmid">≈ 1 200 €</strong>
              </div>
              <span className="tile-cap">Fourchette issue d’annonces réelles</span>
            </Tile>
            <Tile span={2} tone="cream" i={1}>
              <div className="ads">
                <div><span>leboncoin</span><strong>1 150 €</strong></div>
                <div><span>eBay</span><strong>1 240 €</strong></div>
                <div><span>Marketplace</span><strong>1 190 €</strong></div>
              </div>
            </Tile>
            <Tile span={2} tone="glass" i={2}>
              <span className="tile-cap">Une fourchette large est une information : marché peu liquide.</span>
            </Tile>
          </Panel>

          {/* 06 — Partage */}
          <Panel panel={PANELS[5]} shown={active >= 5}>
            <Tile span={2} rows={2} tone="accent" i={0}>
              <div className="linkbox">tiroir.app/s/8f2c…</div>
              <span className="tile-cap light">Public, révocable, expirable</span>
            </Tile>
            <Tile span={2} tone="dark" i={1}>
              <p className="quote">« Pas de compte. Pas d’installation. Rien à accepter. »</p>
            </Tile>
            <Tile tone="cream" i={2}>
              <span className="val">Acheteur</span>
            </Tile>
            <Tile tone="glass" i={3}>
              <span className="val">Assureur</span>
            </Tile>
          </Panel>
        </div>

        {/* Progression + pastilles */}
        <div className="pan-nav">
          <div className="pan-progress"><i style={{ transform: `scaleX(${progress})` }} /></div>
          <div className="pan-dots">
            {PANELS.map((p, i) => (
              <button
                key={p.id}
                type="button"
                aria-label={p.title}
                aria-current={active === i}
                className={`pan-dot ${active === i ? 'on' : ''}`}
                onClick={() => goTo(i)}
              />
            ))}
          </div>
          <span className="pan-hint">
            Continuez à faire défiler · la doc complète suit
          </span>
        </div>
      </div>

      <style jsx>{`
        .pan { position: relative; }
        .pan-sticky {
          position: sticky;
          top: 0;
          height: 100vh;
          overflow: hidden;
          background:
            radial-gradient(80% 60% at 10% 0%, rgba(242,105,0,0.16), transparent 60%),
            radial-gradient(70% 60% at 90% 100%, rgba(45,80,22,0.22), transparent 60%),
            #14100d;
        }
        .pan-track {
          display: flex;
          height: 100%;
          width: max-content;
          will-change: transform;
        }

        .pan-nav {
          position: absolute;
          left: 0; right: 0; bottom: 18px;
          display: flex; flex-direction: column; align-items: center; gap: 10px;
          pointer-events: none;
        }
        .pan-progress {
          width: min(280px, 60vw); height: 2px;
          background: rgba(247,243,238,0.16); border-radius: 99px; overflow: hidden;
        }
        .pan-progress i {
          display: block; height: 100%; width: 100%;
          background: #F26900; transform-origin: left;
        }
        .pan-dots { display: flex; gap: 8px; pointer-events: auto; }
        .pan-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: rgba(247,243,238,0.3);
          border: 0; padding: 0; cursor: pointer;
          transition: background 0.2s, transform 0.2s;
        }
        .pan-dot.on { background: #F26900; transform: scale(1.25); }
        .pan-dot:hover { background: #F26900; }
        .pan-hint {
          font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase;
          color: rgba(247,243,238,0.4); font-weight: 600; text-align: center;
        }

        /* Mobile : plus d'épinglage, les panneaux s'empilent. */
        @media (max-width: 860px) {
          .pan { height: auto !important; }
          .pan-sticky { position: static; height: auto; }
          .pan-track { flex-direction: column; width: 100%; transform: none !important; }
          .pan-nav { display: none; }
        }
      `}</style>

      {/* Styles internes des tuiles (contenu rendu par les enfants) */}
      <style jsx global>{`
        .tile .tile-cap {
          font-size: 12px; font-weight: 600; line-height: 1.4;
          color: rgba(247, 243, 238, 0.62);
        }
        .tile .tile-cap.dark { color: #6B6158; }
        .tile .tile-cap.light { color: rgba(255,255,255,0.85); }
        .tile .big { font-size: clamp(30px, 3.6vw, 52px); font-weight: 800; letter-spacing: -0.03em; line-height: 1; }
        .tile .big.sm { font-size: clamp(24px, 2.6vw, 36px); }
        .tile .lab {
          font-size: 10px; text-transform: uppercase; letter-spacing: 0.09em;
          font-weight: 700; opacity: 0.55;
        }
        .tile .val { font-size: clamp(14px, 1.5vw, 19px); font-weight: 700; letter-spacing: -0.01em; }
        .tile .quote {
          font-size: clamp(15px, 1.6vw, 21px); line-height: 1.45;
          font-weight: 600; margin: 0; letter-spacing: -0.01em;
        }

        .tile .shot {
          position: relative; flex: 1;
          border-radius: 16px;
          background: linear-gradient(160deg, #3a3129, #1c1712);
          display: grid; place-items: center;
          margin-bottom: 12px;
        }
        .tile .shot-sub { font-size: clamp(44px, 6vw, 84px); animation: breathe 4s ease-in-out infinite; }
        .tile .shot-ring {
          position: absolute; width: 62%; aspect-ratio: 1;
          border: 2px solid rgba(242,105,0,0.55); border-radius: 20px;
          animation: ring 4s ease-in-out infinite;
        }
        @keyframes breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }
        @keyframes ring {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50% { opacity: 1; transform: scale(0.94); }
        }

        .tile .fields { display: flex; flex-direction: column; gap: 8px; flex: 1; justify-content: center; }
        .tile .frow {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          font-size: 12px; font-weight: 700; color: #6B6158;
        }
        .tile .frow i {
          flex: 1; height: 8px; border-radius: 99px;
          background: rgba(26,22,18,0.1); position: relative; overflow: hidden;
        }
        .tile .frow i::after {
          content: ''; position: absolute; inset: 0; width: 0;
          background: linear-gradient(90deg, #7B9B6B, #2D5016);
          border-radius: 99px;
          animation: fillbar 3.6s ease-in-out infinite;
          animation-delay: inherit;
        }
        @keyframes fillbar {
          0%, 8% { width: 0; }
          38%, 88% { width: 100%; }
          100% { width: 0; }
        }

        .tile .mosaic {
          flex: 1; display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 8px; align-content: center; margin-bottom: 12px;
        }
        .tile .mosaic span {
          aspect-ratio: 1; border-radius: 12px;
          background: rgba(247,243,238,0.06);
          border: 1px solid rgba(255,255,255,0.07);
          display: grid; place-items: center;
          font-size: clamp(15px, 1.7vw, 24px);
          animation: pop 4.4s ease-in-out infinite;
        }
        @keyframes pop {
          0%, 6% { opacity: 0.15; transform: scale(0.88); }
          26%, 84% { opacity: 1; transform: scale(1); }
          100% { opacity: 0.15; transform: scale(0.88); }
        }

        .tile .chips { position: relative; flex: 1; min-height: 54px; }
        .tile .chips span {
          position: absolute; top: 50%; left: 0;
          transform: translateY(-50%);
          font-size: clamp(13px, 1.4vw, 17px); font-weight: 800;
          padding: 9px 16px; border-radius: 999px; white-space: nowrap;
          opacity: 0; animation: chipCycle 4.4s ease-in-out infinite;
        }
        @keyframes chipCycle {
          0% { opacity: 0; transform: translateY(calc(-50% + 8px)); }
          6%, 22% { opacity: 1; transform: translateY(-50%); }
          28%, 100% { opacity: 0; transform: translateY(calc(-50% - 8px)); }
        }

        .tile .gauge { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 8px; }
        .tile .gtrack { height: 9px; border-radius: 99px; background: rgba(247,243,238,0.12); overflow: hidden; }
        .tile .gfill {
          height: 100%; width: 0; border-radius: 99px;
          background: linear-gradient(90deg, #7B9B6B, #F26900);
          animation: fillbar 4.4s ease-in-out infinite;
        }
        .tile .gbounds {
          display: flex; justify-content: space-between;
          font-size: 11px; font-weight: 700; color: rgba(247,243,238,0.5);
        }
        .tile .gmid { font-size: clamp(22px, 2.6vw, 36px); font-weight: 800; letter-spacing: -0.02em; }
        .tile .ads { display: flex; flex-direction: column; gap: 8px; justify-content: center; flex: 1; }
        .tile .ads div {
          display: flex; align-items: center; justify-content: space-between;
          font-size: 13px; color: #6B6158;
          padding-bottom: 8px; border-bottom: 1px solid rgba(26,22,18,0.08);
        }
        .tile .ads div:last-child { border-bottom: 0; padding-bottom: 0; }
        .tile .ads strong { color: #1A1612; font-weight: 800; }

        .tile .linkbox {
          flex: 1; display: grid; place-items: center;
          font-size: clamp(14px, 1.7vw, 22px); font-weight: 800; letter-spacing: -0.01em;
          background: rgba(255,255,255,0.16);
          border: 1px dashed rgba(255,255,255,0.4);
          border-radius: 16px; margin-bottom: 12px;
        }
      `}</style>
    </div>
  )
}
