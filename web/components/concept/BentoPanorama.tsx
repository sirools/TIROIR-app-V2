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
  children, span = 1, rows = 1, i = 0, tone = 'dark', className = '', bleed = false,
}: {
  children: React.ReactNode
  span?: number
  rows?: number
  i?: number
  tone?: 'dark' | 'cream' | 'accent' | 'glass'
  className?: string
  /** Supprime le padding : le contenu occupe la tuile bord à bord. */
  bleed?: boolean
}) {
  return (
    <div
      className={`tile tone-${tone} ${bleed ? 'is-bleed' : ''} ${className}`}
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
          align-items: flex-start;
          /* Le contenu s'empile depuis le haut, la légende est poussée en bas
             par son margin-top: auto. Avec space-between, les tuiles peu
             remplies se creusaient d'un grand vide au milieu. */
          gap: clamp(6px, 0.8vw, 12px);
          transform: translateY(26px) rotateX(7deg) scale(0.975);
        }
        .tile.is-bleed {
          padding: 0;
          gap: 0;
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
            <Tile span={2} rows={2} tone="dark" i={0} bleed>
              {/* Plateau de studio : fond blanc cassé, deux sources de
                  lumière, produit au centre. Noir et blanc jusqu'au flash,
                  puis la couleur revient pendant le chargement dans l'app. */}
              <div className="studio">
                <div className="studio-scene">
                  <div className="studio-cyc" />
                  <div className="studio-key" />
                  <div className="studio-fill" />
                  <div className="studio-shadow" />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="studio-prod" src="/screens/mannequin-couture.png" alt="" />
                </div>
                <div className="studio-retic">
                  <i className="tl" /><i className="tr" /><i className="bl" /><i className="br" />
                </div>

                {/* Le téléphone entre en scène et déclenche : c'est le geste
                    d'ajout d'un objet qu'il faut rendre lisible. */}
                <div className="studio-phone">
                  <div className="sp-body">
                    <div className="sp-screen">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/screens/mannequin-couture.png" alt="" />
                      <div className="sp-grid" />
                      <div className="sp-flash" />
                    </div>
                    <div className="sp-bar">
                      <span className="sp-mode">Photo</span>
                      <span className="sp-shutter"><i /></span>
                      <span className="sp-count">1 / 20</span>
                    </div>
                  </div>
                </div>

                <div className="studio-scan" />
                <div className="studio-flash" />
                <div className="studio-state">
                  <span className="s-aim">Cadrage · f/8 · 1/125</span>
                  <span className="s-load">Analyse de l’image…</span>
                  <span className="s-done">Fiche créée ✓</span>
                </div>
                <span className="studio-cap">Viseur · une pression</span>
              </div>
            </Tile>
            <Tile span={2} tone="accent" i={1}>
              <div className="chainHead">
                <strong className="big">2,4 s</strong>
                <div className="chainStat">
                  <b>25</b><span>objets / heure</span>
                </div>
              </div>
              {/* Chaîne de production : les objets défilent, la cadence est
                  le sujet. */}
              <div className="chain">
                <div className="chain-ticks">
                  {Array.from({ length: 14 }).map((_, n) => <i key={n} />)}
                </div>
                {/* Séquence répétée trois fois : on translate d'un motif
                    (480 px) et il reste toujours de quoi couvrir la largeur
                    visible, sans saut ni trou au rebouclage. */}
                <div className="chain-belt">
                  {Array.from({ length: 3 }).flatMap((_, copy) =>
                    ['🧥', '👟', '⌚', '📸', '👖', '🧢', '🎸', '📚'].map((e, n) => (
                      <span key={`${copy}-${n}`}>{e}</span>
                    ))
                  )}
                </div>
                <div className="chain-rail" />
              </div>
              <span className="tile-cap light">de la photo à la fiche enregistrée</span>
            </Tile>
            <Tile tone="cream" i={2}>
              <span className="lab">Titre généré</span>
              <span className="val">Veste en jean délavé</span>
              <div className="specs">
                <div><span>Marque</span><strong>Levi’s</strong></div>
                <div><span>Modèle</span><strong>Type III</strong></div>
                <div><span>Taille</span><strong>M</strong></div>
                <div><span>Catégorie</span><strong>Veste</strong></div>
              </div>
            </Tile>
            <Tile tone="glass" i={3}>
              <span className="lab">Caractéristiques</span>
              <span className="val">Denim de coton</span>
              <div className="specs light">
                <div><span>Couleur</span><strong>Bleu délavé</strong></div>
                <div><span>Matière</span><strong>Denim 12 oz</strong></div>
                <div><span>État</span><strong>Bon, usure légère</strong></div>
                <div><span>Époque</span><strong>Années 90</strong></div>
              </div>
            </Tile>
          </Panel>

          {/* 02 — Analyse */}
          <Panel panel={PANELS[1]} shown={active >= 1}>
            <Tile span={2} rows={2} tone="cream" i={0}>
              <div className="fields">
                {[
                  ['Catégorie', 'Veste'],
                  ['Matière', 'Denim'],
                  ['Couleur', 'Bleu délavé'],
                  ['État', 'Bon'],
                  ['Époque', 'Années 90'],
                ].map(([f, v], n) => (
                  <div className="frow" key={f} style={{ animationDelay: `${n * 0.35}s` }}>
                    <span>{f}</span><i /><b>{v}</b>
                  </div>
                ))}
              </div>
              <span className="tile-cap dark">Cinq champs, remplis automatiquement</span>
            </Tile>
            <Tile span={2} tone="dark" i={1}>
              <p className="quote">« L’IA remplit la colonne de gauche. Vous complétez celle de droite. »</p>
              <div className="tags">
                <span>Prix d’achat</span>
                <span>Lieu de rangement</span>
                <span>Authenticité</span>
                <span>Valeur sentimentale</span>
              </div>
              <span className="tile-cap">Ce qu’elle ne peut pas deviner</span>
            </Tile>
            <Tile tone="glass" i={2}>
              <strong className="big sm">✓</strong>
              <span className="val">Toujours modifiable</span>
              <span className="tile-cap">Vos corrections priment sur la suggestion.</span>
            </Tile>
            <Tile tone="accent" i={3}>
              <strong className="big sm">0</strong>
              <span className="val">formulaire vide</span>
              <span className="tile-cap light">Aucun champ obligatoire à remplir.</span>
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
              <span className="val">objets par lot</span>
              <span className="tile-cap light">1 photo = 1 objet = 1 analyse</span>
            </Tile>
            <Tile tone="cream" i={2}>
              <span className="val">Sans attendre</span>
              <div className="specs">
                <div><span>Analysées</span><strong>12 / 20</strong></div>
                <div><span>Corrigées</span><strong>5</strong></div>
                <div><span>Enregistrées</span><strong>5</strong></div>
              </div>
              <span className="tile-cap dark">corrigez pendant que ça tourne</span>
            </Tile>
          </Panel>

          {/* 04 — Cycle de vie */}
          <Panel panel={PANELS[3]} shown={active >= 3}>
            <Tile span={2} rows={2} tone="cream" i={0}>
              <div className="timeline">
                {[
                  { l: 'Possédé', d: '12 mars', c: '#2D5016', b: '#E8F0E0' },
                  { l: 'Rangé — carton grenier', d: '4 mai', c: '#1A3A6B', b: '#E0EAF8' },
                  { l: 'Prêté à Marie', d: '18 juin', c: '#7A3B10', b: '#FDE8D0' },
                  { l: 'Vendu · 45 €', d: '2 août', c: '#5E1A2F', b: '#FCE0E8' },
                ].map(s => (
                  <div className="tl" key={s.l}>
                    <i style={{ background: s.c }} />
                    <span className="tlChip" style={{ color: s.c, background: s.b }}>{s.l}</span>
                    <em>{s.d}</em>
                  </div>
                ))}
              </div>
              <span className="tile-cap dark">Le statut, pas la suppression</span>
            </Tile>
            <Tile span={2} tone="dark" i={1}>
              <p className="quote">« Un inventaire meurt le jour où il devient faux. »</p>
              <span className="tile-cap">Six états : possédé, rangé, prêté, vendu, donné, perdu.</span>
            </Tile>
            <Tile span={2} tone="glass" i={2}>
              <span className="val">Historique conservé</span>
              <div className="specs light">
                <div><span>Prix de vente réel</span><strong>45 €</strong></div>
                <div><span>Acheteur</span><strong>Marie L.</strong></div>
                <div><span>Vendu le</span><strong>2 août 2026</strong></div>
              </div>
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
              <div className="specs light">
                <div><span>Objet</span><strong>Leica M6</strong></div>
                <div><span>Payé en 2019</span><strong>1 450 €</strong></div>
                <div><span>Écart</span><strong>− 250 €</strong></div>
              </div>
              <span className="tile-cap">Fourchette issue d’annonces réelles</span>
            </Tile>
            <Tile span={2} tone="cream" i={1}>
              <span className="lab">Annonces comparables</span>
              <div className="ads">
                <div><span>leboncoin · très bon état</span><strong>1 150 €</strong></div>
                <div><span>eBay · avec objectif</span><strong>1 240 €</strong></div>
                <div><span>Marketplace · boîtier nu</span><strong>1 190 €</strong></div>
              </div>
            </Tile>
            <Tile span={2} tone="glass" i={2}>
              <span className="val">Lire la fourchette</span>
              <div className="specs light">
                <div><span>Serrée</span><strong>modèle courant, prix fiable</strong></div>
                <div><span>Large</span><strong>marché peu liquide</strong></div>
              </div>
            </Tile>
          </Panel>

          {/* 06 — Partage */}
          <Panel panel={PANELS[5]} shown={active >= 5}>
            <Tile span={2} rows={2} tone="accent" i={0}>
              <div className="linkbox">tiroir.app/s/8f2c…</div>
              <div className="specs light">
                <div><span>Visibilité</span><strong>Publique</strong></div>
                <div><span>Expire le</span><strong>28 août 2026</strong></div>
                <div><span>Vues</span><strong>14</strong></div>
              </div>
              <span className="tile-cap light">Révocable à tout moment</span>
            </Tile>
            <Tile span={2} tone="dark" i={1}>
              <p className="quote">« Pas de compte. Pas d’installation. Rien à accepter. »</p>
              <span className="tile-cap">Une page web, ouverte depuis n’importe quel appareil.</span>
            </Tile>
            <Tile tone="cream" i={2}>
              <span className="val">Acheteur</span>
              <span className="tile-cap dark">Voit la fiche, les photos et l’état. Pas vos prix d’achat.</span>
            </Tile>
            <Tile tone="glass" i={3}>
              <span className="val">Assureur</span>
              <span className="tile-cap">Reçoit la collection entière, avec factures jointes.</span>
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
          margin-top: auto;   /* colle la légende au bas de la tuile */
        }

        /* Lignes clé / valeur : l'ossature des tuiles « fiche ». */
        .tile .specs {
          width: 100%;
          display: flex; flex-direction: column;
          border-top: 1px solid rgba(26, 22, 18, 0.1);
        }
        .tile .specs.light { border-top-color: rgba(247, 243, 238, 0.14); }
        .tile .specs div {
          display: flex; align-items: baseline; justify-content: space-between;
          gap: 12px; padding: 6px 0;
          border-bottom: 1px solid rgba(26, 22, 18, 0.07);
          font-size: clamp(11px, 1.05vw, 13px);
        }
        .tile .specs.light div { border-bottom-color: rgba(247, 243, 238, 0.09); }
        .tile .specs div:last-child { border-bottom: 0; }
        .tile .specs span { opacity: 0.6; font-weight: 600; }
        .tile .specs strong { font-weight: 800; text-align: right; }

        /* Chaîne de traitement (panneau 01) */
        .tile .steps {
          display: flex; align-items: center; flex-wrap: wrap; gap: 6px;
          font-size: clamp(10px, 1vw, 12px); font-weight: 700;
        }
        .tile .steps span {
          background: rgba(255, 255, 255, 0.22);
          border-radius: 999px; padding: 4px 10px;
        }
        .tile .steps em { font-style: normal; opacity: 0.7; }

        /* Étiquettes « ce que l'IA ne devine pas » (panneau 02) */
        .tile .tags { display: flex; flex-wrap: wrap; gap: 6px; }
        .tile .tags span {
          font-size: clamp(10px, 1vw, 12px); font-weight: 700;
          color: rgba(247, 243, 238, 0.82);
          background: rgba(247, 243, 238, 0.08);
          border: 1px solid rgba(247, 243, 238, 0.12);
          border-radius: 999px; padding: 4px 10px;
        }

        /* Frise des statuts (panneau 04) — toujours visible, plus de cycle
           d'apparition qui laissait la tuile vide une partie du temps. */
        .tile .timeline {
          width: 100%; flex: 1;
          display: flex; flex-direction: column; justify-content: center;
          gap: clamp(8px, 2.2vh, 24px);
        }
        .tile .tl {
          display: flex; align-items: center; gap: 10px;
        }
        .tile .tl i {
          width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
        }
        .tile .tlChip {
          font-size: clamp(11px, 1.15vw, 14px); font-weight: 800;
          padding: 5px 12px; border-radius: 999px; white-space: nowrap;
        }
        .tile .tl em {
          font-style: normal; margin-left: auto;
          font-size: 11px; font-weight: 700; opacity: 0.45;
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

        /* ── Plateau studio (panneau 01) ──────────────────────────────
           Cycle de 9 s : cadrage en noir et blanc → flash → chargement
           dans l'app, la couleur revient → fiche créée → retour au N&B. */
        .tile .studio { position: absolute; inset: 0; overflow: hidden; }

        .tile .studio-scene {
          position: absolute; inset: 0;
          filter: grayscale(1) contrast(1.08);
          animation: studioGrade 9s infinite;
        }
        /* Fond continu type cyclorama : mur clair qui se raccorde au sol. */
        .tile .studio-cyc {
          position: absolute; inset: 0;
          background:
            radial-gradient(120% 80% at 50% 22%, #f2ede6 0%, #ded5c9 45%, #b9ad9e 100%),
            linear-gradient(#cfc5b7, #cfc5b7);
        }
        .tile .studio-cyc::after {
          content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 34%;
          background: linear-gradient(#00000000, rgba(60, 50, 40, 0.22));
        }
        /* Boîtes à lumière : une clé en haut à gauche, une douce à droite. */
        .tile .studio-key {
          position: absolute; inset: 0;
          background: radial-gradient(46% 40% at 22% 6%, rgba(255,255,255,0.85), transparent 70%);
          mix-blend-mode: screen;
        }
        .tile .studio-fill {
          position: absolute; inset: 0;
          background: radial-gradient(40% 46% at 92% 42%, rgba(255,255,255,0.5), transparent 72%);
          mix-blend-mode: screen;
        }
        .tile .studio-shadow {
          position: absolute; left: 50%; bottom: 5%;
          width: 26%; height: 5%;
          transform: translateX(-50%);
          background: radial-gradient(closest-side, rgba(40,32,24,0.5), transparent);
          filter: blur(5px);
          animation: prodFloat 9s ease-in-out infinite;
        }
        .tile .studio-prod {
          position: absolute; left: 50%; top: 50%;
          transform: translate(-50%, -50%);
          /* Le sujet est centré dans un PNG carré : on cale sur la hauteur,
             la largeur suit et reste bien en deçà du cadre. */
          height: 92%; width: auto;
          object-fit: contain;
          filter: drop-shadow(0 22px 30px rgba(40, 32, 24, 0.32));
          animation: prodBreathe 9s ease-in-out infinite;
        }

        /* Repères de cadrage, présents seulement avant le déclenchement. */
        .tile .studio-retic { position: absolute; inset: 0; animation: reticFade 9s infinite; }
        .tile .studio-retic i {
          position: absolute; width: 26px; height: 26px;
          border: 2px solid rgba(255,255,255,0.9);
          filter: drop-shadow(0 1px 2px rgba(0,0,0,0.35));
        }
        .tile .studio-retic .tl { top: 14%; left: 11%; border-right: 0; border-bottom: 0; border-radius: 6px 0 0 0; }
        .tile .studio-retic .tr { top: 14%; right: 11%; border-left: 0; border-bottom: 0; border-radius: 0 6px 0 0; }
        .tile .studio-retic .bl { bottom: 22%; left: 11%; border-right: 0; border-top: 0; border-radius: 0 0 0 6px; }
        .tile .studio-retic .br { bottom: 22%; right: 11%; border-left: 0; border-top: 0; border-radius: 0 0 6px 0; }

        .tile .studio-flash {
          position: absolute; inset: 0; background: #fff;
          opacity: 0; animation: flashPop 9s infinite;
        }
        /* Balayage d'analyse, du bas vers le haut : le regard remonte le
           long de l'objet, comme quand on le cadre depuis les pieds. */
        .tile .studio-scan {
          position: absolute; left: 0; right: 0; height: 32%;
          background: linear-gradient(#F2690000, rgba(242,105,0,0.28), #F2690000);
          border-top: 1px solid rgba(242,105,0,0.85);
          opacity: 0; animation: scanSweep 9s infinite;
        }

        .tile .studio-state { position: absolute; left: 16px; top: 16px; height: 24px; }
        .tile .studio-state span {
          position: absolute; left: 0; top: 0; white-space: nowrap;
          font-size: 11px; font-weight: 700; letter-spacing: 0.02em;
          padding: 5px 11px; border-radius: 999px;
          background: rgba(20, 16, 13, 0.55);
          border: 1px solid rgba(255,255,255,0.14);
          backdrop-filter: blur(6px);
          color: #F7F3EE; opacity: 0;
          animation: 9s infinite;
        }
        .tile .studio-state .s-aim  { animation-name: stAim; }
        .tile .studio-state .s-load { animation-name: stLoad; }
        .tile .studio-state .s-done {
          animation-name: stDone;
          background: rgba(45, 80, 22, 0.7); border-color: rgba(184, 224, 178, 0.45);
        }

        /* ── Téléphone en surimpression ─────────────────────────────── */
        .tile .studio-phone {
          position: absolute; right: 6%; bottom: 8%;
          width: clamp(128px, 15vw, 176px);
          opacity: 0;
          animation: phoneIn 9s cubic-bezier(0.22, 0.68, 0.32, 1) infinite;
        }
        .tile .sp-body {
          border-radius: 22px;
          background: #14100d;
          border: 1px solid rgba(255,255,255,0.16);
          padding: 7px 7px 0;
          box-shadow: 0 24px 50px rgba(0,0,0,0.5), 0 6px 14px rgba(0,0,0,0.35);
        }
        .tile .sp-screen {
          position: relative;
          aspect-ratio: 3 / 4.4;
          border-radius: 16px;
          overflow: hidden;
          background: radial-gradient(80% 70% at 50% 30%, #e9e2d8, #b9ad9e);
        }
        .tile .sp-screen img {
          position: absolute; left: 50%; top: 52%;
          transform: translate(-50%, -50%);
          height: 86%; width: auto; object-fit: contain;
        }
        /* Règle des tiers, comme dans le viseur de l'app. */
        .tile .sp-grid {
          position: absolute; inset: 0;
          background:
            linear-gradient(rgba(255,255,255,0.28) 1px, transparent 1px) 0 33.3% / 100% 33.3%,
            linear-gradient(90deg, rgba(255,255,255,0.28) 1px, transparent 1px) 33.3% 0 / 33.3% 100%;
        }
        .tile .sp-flash {
          position: absolute; inset: 0; background: #fff;
          opacity: 0; animation: spFlash 9s infinite;
        }
        .tile .sp-bar {
          display: flex; align-items: center; justify-content: space-between;
          padding: 9px 4px 10px;
        }
        .tile .sp-mode, .tile .sp-count {
          font-size: 8px; font-weight: 700; letter-spacing: 0.05em;
          color: rgba(247,243,238,0.6); text-transform: uppercase;
        }
        .tile .sp-shutter {
          width: 26px; height: 26px; border-radius: 50%;
          border: 2px solid rgba(247,243,238,0.9);
          display: grid; place-items: center;
        }
        .tile .sp-shutter i {
          width: 18px; height: 18px; border-radius: 50%;
          background: #F7F3EE;
          animation: spPress 9s infinite;
        }

        @keyframes phoneIn {
          0%, 8% { opacity: 0; transform: translateY(26px) scale(0.94); }
          18%, 84% { opacity: 1; transform: translateY(0) scale(1); }
          92%, 100% { opacity: 0; transform: translateY(18px) scale(0.96); }
        }
        @keyframes spPress {
          0%, 30% { transform: scale(1); }
          33% { transform: scale(0.72); }
          37%, 100% { transform: scale(1); }
        }
        @keyframes spFlash {
          0%, 32% { opacity: 0; }
          34% { opacity: 0.9; }
          40%, 100% { opacity: 0; }
        }

        .tile .studio-cap {
          position: absolute; left: 0; right: 0; bottom: 0;
          padding: 34px 16px 14px;
          font-size: 12px; font-weight: 600;
          color: rgba(247, 243, 238, 0.86);
          background: linear-gradient(#00000000, rgba(12, 9, 7, 0.72));
        }

        @keyframes studioGrade {
          0%, 34% { filter: grayscale(1) contrast(1.08); }
          40%, 92% { filter: grayscale(0) contrast(1); }
          100% { filter: grayscale(1) contrast(1.08); }
        }
        @keyframes prodBreathe {
          0%, 32% { transform: translate(-50%, -50%) scale(1); }
          36% { transform: translate(-50%, -50%) scale(0.965); }
          46%, 100% { transform: translate(-50%, -50%) scale(1.015); }
        }
        @keyframes prodFloat {
          0%, 32% { opacity: 0.55; transform: translateX(-50%) scaleX(1); }
          36% { opacity: 0.75; transform: translateX(-50%) scaleX(1.08); }
          46%, 100% { opacity: 0.5; transform: translateX(-50%) scaleX(0.98); }
        }
        @keyframes reticFade {
          0%, 30% { opacity: 1; }
          34%, 96% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes flashPop {
          0%, 32% { opacity: 0; }
          34% { opacity: 0.95; }
          40%, 100% { opacity: 0; }
        }
        @keyframes scanSweep {
          0%, 40% { opacity: 0; top: 100%; }
          44% { opacity: 1; }
          62% { opacity: 1; top: -32%; }
          64%, 100% { opacity: 0; top: -32%; }
        }
        /* Les trois étiquettes se relaient sans trou, hormis pendant le
           flash — où l'image est blanche de toute façon. */
        @keyframes stAim {
          0%, 28% { opacity: 1; }
          32%, 97% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes stLoad {
          0%, 38% { opacity: 0; }
          42%, 62% { opacity: 1; }
          66%, 100% { opacity: 0; }
        }
        @keyframes stDone {
          0%, 62% { opacity: 0; }
          66%, 96% { opacity: 1; }
          99%, 100% { opacity: 0; }
        }

        /* ── Chaîne de production (panneau 01, tuile orange) ────────── */
        .tile .chainHead {
          width: 100%;
          display: flex; align-items: baseline; justify-content: space-between; gap: 12px;
        }
        .tile .chainStat { text-align: right; line-height: 1.1; }
        .tile .chainStat b { font-size: clamp(16px, 1.7vw, 22px); font-weight: 800; }
        .tile .chainStat span {
          display: block; font-size: 10px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.07em;
          color: rgba(255,255,255,0.75);
        }

        .tile .chain {
          position: relative; width: 100%; flex: 1;
          min-height: 62px;
          display: flex; flex-direction: column; justify-content: center;
          overflow: hidden;
        }
        .tile .chain-ticks {
          display: flex; justify-content: space-between;
          margin-bottom: 8px; opacity: 0.5;
        }
        .tile .chain-ticks i {
          width: 1px; height: 7px; background: rgba(255,255,255,0.85);
        }
        .tile .chain-ticks i:nth-child(4n + 1) { height: 12px; }
        .tile .chain-belt {
          display: flex; gap: 18px; width: max-content;
          animation: beltRun 7s linear infinite;
        }
        .tile .chain-belt span {
          width: 42px; height: 42px; flex-shrink: 0;
          border-radius: 11px;
          background: rgba(255,255,255,0.2);
          border: 1px solid rgba(255,255,255,0.3);
          display: grid; place-items: center; font-size: 20px;
        }
        .tile .chain-rail {
          height: 3px; margin-top: 8px; border-radius: 99px;
          background: repeating-linear-gradient(
            90deg,
            rgba(255,255,255,0.55) 0 8px,
            rgba(255,255,255,0.15) 8px 16px
          );
          animation: railRun 0.9s linear infinite;
        }
        /* Pas de 60 px (42 + 18) × 8 objets = 480 px : on translate d'un
           motif complet, la séquence dupliquée prend le relais. */
        @keyframes beltRun {
          from { transform: translateX(0); }
          to { transform: translateX(-480px); }
        }
        @keyframes railRun {
          from { background-position: 0 0; }
          to { background-position: -16px 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .tile .studio-scene, .tile .studio-prod, .tile .studio-shadow,
          .tile .studio-retic, .tile .studio-flash, .tile .studio-scan,
          .tile .studio-state span, .tile .chain-belt, .tile .chain-rail,
          .tile .studio-phone, .tile .sp-shutter i, .tile .sp-flash {
            animation: none;
          }
          .tile .studio-scene { filter: grayscale(0); }
          .tile .studio-flash, .tile .studio-scan, .tile .sp-flash { opacity: 0; }
          .tile .studio-phone { opacity: 1; transform: none; }
          .tile .studio-state .s-done { opacity: 1; }
        }

        .tile .fields { display: flex; flex-direction: column; gap: 8px; flex: 1; justify-content: center; }
        .tile .frow {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          font-size: clamp(11px, 1.05vw, 13px); font-weight: 700; color: #6B6158;
        }
        .tile .frow > span { min-width: 74px; }
        .tile .frow b {
          min-width: 92px; text-align: right;
          color: #1A1612; font-weight: 800;
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
