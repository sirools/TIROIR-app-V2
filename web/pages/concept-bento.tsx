// Page « Concept » — direction B : bento panoramique horizontal.
//
// Lecture latérale par panneaux scroll-snap, façon page produit Apple :
// chaque panneau est une grille bento, les tuiles s'élèvent en 3D à
// l'entrée dans le viewport (IntersectionObserver), ombres portées
// multi-couches et textures en dégradé. Texte réduit au minimum —
// la démonstration passe par la forme.
//
// Variante éditoriale : /concept. Les deux coexistent le temps d'arbitrer.
import Head from 'next/head'
import { useEffect, useRef, useState } from 'react'
import HeaderTiroirWeb from '../components/layout/HeaderTiroirWeb'

const PANELS = [
  { id: 'capture',     kicker: '01 — Capture',     title: 'Une photo suffit.' },
  { id: 'intelligence',kicker: '02 — Analyse',     title: 'La fiche s’écrit seule.' },
  { id: 'volume',      kicker: '03 — Volume',      title: 'Cent objets, une session.' },
  { id: 'vie',         kicker: '04 — Cycle de vie',title: 'L’objet ne meurt jamais.' },
  { id: 'valeur',      kicker: '05 — Valeur',      title: 'Le marché, en direct.' },
  { id: 'partage',     kicker: '06 — Partage',     title: 'Un lien. C’est tout.' },
]

/** Révèle les tuiles d'un panneau quand il entre dans le viewport. */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Pas d'observer si l'utilisateur a demandé moins d'animations.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setShown(true)
      return
    }
    const io = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) setShown(true) }),
      { threshold: 0.35 }
    )
    io.observe(el)

    // Filet de sécurité : les tuiles partent à opacité 0, donc un observer
    // qui ne se déclenche pas (onglet en arrière-plan au chargement, pipeline
    // de rendu suspendu, navigateur exotique) laisserait le panneau vide pour
    // toujours. Passé ce délai, on révèle quoi qu'il arrive.
    const fallback = window.setTimeout(() => setShown(true), 1200)

    return () => { io.disconnect(); window.clearTimeout(fallback) }
  }, [])

  return { ref, shown }
}

function Panel({
  panel, children,
}: {
  panel: typeof PANELS[number]
  children: React.ReactNode
}) {
  const { ref, shown } = useReveal<HTMLElement>()
  return (
    <section ref={ref} id={panel.id} className={`bx-panel ${shown ? 'is-in' : ''}`}>
      <header className="bx-head">
        <span className="bx-kicker">{panel.kicker}</span>
        <h2 className="bx-title">{panel.title}</h2>
      </header>
      <div className="bx-bento">{children}</div>

      <style jsx>{`
        .bx-panel {
          flex: 0 0 100%;
          scroll-snap-align: center;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: clamp(18px, 3vh, 34px);
          padding: clamp(20px, 4vw, 56px) clamp(20px, 5vw, 72px);
          min-width: 0;
        }
        .bx-kicker {
          display: block;
          font-size: 12px; font-weight: 700; letter-spacing: 0.14em;
          text-transform: uppercase; color: #F26900;
          opacity: 0; transform: translateY(14px);
          transition: opacity 0.6s ease, transform 0.6s ease;
        }
        .bx-title {
          font-size: clamp(28px, 4.4vw, 56px);
          line-height: 1.05; letter-spacing: -0.03em;
          font-weight: 800; color: #F7F3EE;
          margin: 8px 0 0;
          opacity: 0; transform: translateY(20px);
          transition: opacity 0.7s ease 0.08s, transform 0.7s ease 0.08s;
        }
        .is-in .bx-kicker, .is-in .bx-title { opacity: 1; transform: translateY(0); }

        .bx-bento {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          grid-auto-rows: minmax(96px, auto);
          gap: clamp(10px, 1.4vw, 18px);
          perspective: 1400px;
        }
        /* Desktop : la grille occupe toute la hauteur restante du panneau,
           les lignes se partagent l'espace. Sans ça, les tuiles gardaient
           leur hauteur minimale et flottaient au milieu d'un grand écran. */
        @media (min-width: 861px) {
          .bx-bento {
            flex: 1;
            min-height: 0;
            grid-auto-rows: minmax(120px, 1fr);
          }
        }
        @media (max-width: 860px) {
          .bx-bento { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
      `}</style>
    </section>
  )
}

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
        transitionDelay: `${0.12 + i * 0.07}s`,
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
            opacity 0.75s cubic-bezier(0.22, 0.68, 0.32, 1),
            transform 0.75s cubic-bezier(0.22, 0.68, 0.32, 1);
          will-change: transform, opacity;
        }
        :global(.is-in) .tile { opacity: 1; transform: translateY(0) rotateX(0) scale(1); }

        /* Ombres portées en couches — la profondeur vient de l'empilement,
           pas d'une ombre unique très marquée. */
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

export default function ConceptBento() {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0)

  // Barre de progression + molette verticale convertie en défilement latéral.
  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return

    const onScroll = () => {
      const max = el.scrollWidth - el.clientWidth
      setProgress(max > 0 ? el.scrollLeft / max : 0)
    }
    const onWheel = (e: WheelEvent) => {
      // Only hijack a clearly vertical gesture; trackpad horizontal swipes pass through.
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    el.addEventListener('wheel', onWheel, { passive: false })
    onScroll()
    return () => {
      el.removeEventListener('scroll', onScroll)
      el.removeEventListener('wheel', onWheel)
    }
  }, [])

  function goTo(i: number) {
    const el = scrollerRef.current
    if (!el) return
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }

  return (
    <>
      <Head>
        <title>Concept — Tiroir</title>
        <meta
          name="description"
          content="Le fonctionnement de Tiroir, panneau par panneau : capture, analyse, volume, cycle de vie, valeur, partage."
        />
      </Head>

      <HeaderTiroirWeb />

      <main className="bx-root">
        <div className="bx-scroller" ref={scrollerRef}>
          {/* 01 — Capture */}
          <Panel panel={PANELS[0]}>
            <Tile span={2} rows={2} tone="dark" i={0} className="t-shot">
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
          <Panel panel={PANELS[1]}>
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
          <Panel panel={PANELS[2]}>
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
          <Panel panel={PANELS[3]}>
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
          <Panel panel={PANELS[4]}>
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
          <Panel panel={PANELS[5]}>
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

            <Tile span={4} tone="cream" i={4} className="t-cta">
              <div className="ctaRow">
                <div>
                  <strong className="ctaTitle">Cent objets en gratuit.</strong>
                  <span className="tile-cap dark">Sans carte bancaire.</span>
                </div>
                <a href="/inscription" className="ctaBtn">Créer un compte</a>
              </div>
            </Tile>
          </Panel>
        </div>

        {/* Navigation latérale */}
        <div className="bx-nav">
          <div className="bx-progress"><i style={{ transform: `scaleX(${progress})` }} /></div>
          <div className="bx-dots">
            {PANELS.map((p, i) => (
              <button
                key={p.id}
                type="button"
                aria-label={p.title}
                className="bx-dot"
                onClick={() => goTo(i)}
              />
            ))}
          </div>
          <span className="bx-hint">Faites défiler latéralement</span>
        </div>
      </main>

      <style jsx>{`
        .bx-root {
          position: relative;
          height: calc(100vh - 65px);
          background:
            radial-gradient(80% 60% at 10% 0%, rgba(242,105,0,0.16), transparent 60%),
            radial-gradient(70% 60% at 90% 100%, rgba(45,80,22,0.22), transparent 60%),
            #14100d;
          overflow: hidden;
        }
        .bx-scroller {
          display: flex;
          height: 100%;
          overflow-x: auto;
          overflow-y: hidden;
          scroll-snap-type: x mandatory;
          scroll-behavior: smooth;
          scrollbar-width: none;
        }
        .bx-scroller::-webkit-scrollbar { display: none; }

        .bx-nav {
          position: absolute;
          left: 0; right: 0; bottom: 18px;
          display: flex; flex-direction: column; align-items: center; gap: 10px;
          pointer-events: none;
        }
        .bx-progress {
          width: min(280px, 60vw); height: 2px;
          background: rgba(247,243,238,0.16); border-radius: 99px; overflow: hidden;
        }
        .bx-progress i {
          display: block; height: 100%; width: 100%;
          background: #F26900; transform-origin: left;
          transition: transform 0.12s linear;
        }
        .bx-dots { display: flex; gap: 8px; pointer-events: auto; }
        .bx-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: rgba(247,243,238,0.3);
          border: 0; padding: 0; cursor: pointer;
          transition: background 0.2s, transform 0.2s;
        }
        .bx-dot:hover { background: #F26900; transform: scale(1.3); }
        .bx-hint {
          font-size: 11px; letter-spacing: 0.08em; text-transform: uppercase;
          color: rgba(247,243,238,0.4); font-weight: 600;
        }
      `}</style>

      {/* Styles partagés par les tuiles (rendus dans des composants enfants) */}
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

        /* 01 — viseur */
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

        /* 02 — champs qui se remplissent */
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

        /* 03 — mosaïque */
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

        /* 04 — statuts */
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

        /* 05 — jauge + annonces */
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

        /* 06 — lien + CTA */
        .tile .linkbox {
          flex: 1; display: grid; place-items: center;
          font-size: clamp(14px, 1.7vw, 22px); font-weight: 800; letter-spacing: -0.01em;
          background: rgba(255,255,255,0.16);
          border: 1px dashed rgba(255,255,255,0.4);
          border-radius: 16px; margin-bottom: 12px;
        }
        .tile.t-cta { justify-content: center; }
        .tile .ctaRow {
          display: flex; align-items: center; justify-content: space-between;
          gap: 16px; flex-wrap: wrap;
        }
        .tile .ctaTitle { display: block; font-size: clamp(17px, 2vw, 24px); font-weight: 800; letter-spacing: -0.02em; }
        .tile .ctaBtn {
          background: #F26900; color: #fff; text-decoration: none;
          font-weight: 700; font-size: 15px;
          padding: 13px 22px; border-radius: 12px;
          box-shadow: 0 10px 24px rgba(242,105,0,0.35);
        }
      `}</style>
    </>
  )
}
