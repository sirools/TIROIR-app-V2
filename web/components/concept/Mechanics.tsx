// Maquettes animées des mécaniques de l'app, pour la page /concept.
//
// Tout est en CSS pur (keyframes en boucle infinie) plutôt qu'en vidéo :
// c'est net à toutes les résolutions, ça pèse zéro kilo-octet, ça démarre
// sans attendre un téléchargement, et ça reste modifiable quand l'UI de
// l'app bouge. Les couleurs reprennent celles du mobile (crème #F7F3EE,
// vert profond #2D5016) pour que la démo ressemble à l'app, pas au site.
import React from 'react'

/** Cadre de téléphone commun à toutes les démos. */
export function Phone({ children, label }: { children: React.ReactNode; label?: string }) {
  return (
    <div className="phone-wrap">
      <div className="phone">
        <div className="phone-notch" />
        <div className="phone-screen">{children}</div>
      </div>
      {label && <span className="phone-label">{label}</span>}

      <style jsx>{`
        .phone-wrap { display: flex; flex-direction: column; align-items: center; gap: 12px; }
        .phone {
          position: relative;
          width: 260px;
          height: 530px;
          border-radius: 38px;
          background: #1A1612;
          padding: 10px;
          box-shadow: 0 18px 50px rgba(0, 0, 0, 0.18);
          flex-shrink: 0;
        }
        .phone-notch {
          position: absolute;
          top: 18px; left: 50%;
          transform: translateX(-50%);
          width: 78px; height: 20px;
          border-radius: 999px;
          background: #1A1612;
          z-index: 3;
        }
        .phone-screen {
          position: relative;
          width: 100%; height: 100%;
          border-radius: 29px;
          background: #F7F3EE;
          overflow: hidden;
        }
        .phone-label { font-size: 13px; color: #8a8177; font-weight: 600; }
        @media (max-width: 520px) {
          .phone { width: 232px; height: 474px; }
        }
      `}</style>
    </div>
  )
}

/* ── 1. Photo → fiche ──────────────────────────────────────────────
   Le geste fondateur : viseur, déclencheur, puis remplissage des
   champs un à un. Cycle de 9 s. */
export function CaptureLoop() {
  return (
    <Phone label="Photographier · 9 s en boucle">
      <div className="cap">
        <div className="viewfinder">
          <div className="subject">🧥</div>
          <div className="flash" />
          <div className="corner tl" /><div className="corner tr" />
          <div className="corner bl" /><div className="corner br" />
        </div>

        <div className="sheet">
          <div className="thinking">
            <span className="dot" /><span className="dot" /><span className="dot" />
            <em>Analyse en cours…</em>
          </div>
          <Field label="Titre" value="Veste en jean délavé" delay="3.6s" />
          <Field label="Catégorie" value="Vêtement · Veste" delay="4.4s" />
          <Field label="Matière" value="Denim de coton" delay="5.2s" />
          <Field label="État" value="Bon état, usure légère" delay="6s" />
          <div className="cta">Enregistrer dans mon Tiroir</div>
        </div>
      </div>

      <style jsx>{`
        .cap { position: absolute; inset: 0; }

        .viewfinder {
          position: absolute; inset: 0;
          background: linear-gradient(160deg, #3a3129, #1f1a15);
          display: grid; place-items: center;
          animation: viewfinder 9s infinite;
        }
        .subject { font-size: 96px; animation: subject 9s infinite; }
        .flash { position: absolute; inset: 0; background: #fff; opacity: 0; animation: flash 9s infinite; }
        .corner {
          position: absolute; width: 26px; height: 26px;
          border: 2.5px solid rgba(255,255,255,0.85);
          animation: corners 9s infinite;
        }
        .tl { top: 68px; left: 34px; border-right: 0; border-bottom: 0; border-radius: 6px 0 0 0; }
        .tr { top: 68px; right: 34px; border-left: 0; border-bottom: 0; border-radius: 0 6px 0 0; }
        .bl { bottom: 150px; left: 34px; border-right: 0; border-top: 0; border-radius: 0 0 0 6px; }
        .br { bottom: 150px; right: 34px; border-left: 0; border-top: 0; border-radius: 0 0 6px 0; }

        .sheet {
          position: absolute; inset: 0;
          background: #F7F3EE;
          padding: 34px 16px 16px;
          display: flex; flex-direction: column; gap: 8px;
          opacity: 0;
          animation: sheet 9s infinite;
        }
        .thinking {
          display: flex; align-items: center; gap: 5px;
          font-size: 11px; color: #6B6158; font-style: normal;
          margin-bottom: 4px;
          animation: thinking 9s infinite;
        }
        .thinking em { font-style: normal; margin-left: 4px; }
        .dot {
          width: 5px; height: 5px; border-radius: 50%;
          background: #2D5016;
          animation: pulse 1.1s infinite;
        }
        .dot:nth-child(2) { animation-delay: 0.18s; }
        .dot:nth-child(3) { animation-delay: 0.36s; }

        .cta {
          margin-top: auto;
          background: #2D5016; color: #fff;
          text-align: center; font-size: 12px; font-weight: 700;
          padding: 11px; border-radius: 12px;
          opacity: 0; animation: cta 9s infinite;
        }

        @keyframes viewfinder {
          0%, 30% { opacity: 1; }
          34%, 100% { opacity: 0; }
        }
        @keyframes subject {
          0% { transform: scale(0.94); }
          26% { transform: scale(1); }
          30% { transform: scale(0.9); }
          100% { transform: scale(0.9); }
        }
        @keyframes flash {
          0%, 26% { opacity: 0; }
          28% { opacity: 0.9; }
          33%, 100% { opacity: 0; }
        }
        @keyframes corners {
          0%, 24% { opacity: 1; }
          26%, 100% { opacity: 0; }
        }
        @keyframes sheet {
          0%, 30% { opacity: 0; }
          36%, 96% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes thinking {
          0%, 32% { opacity: 0; }
          36%, 44% { opacity: 1; }
          50%, 100% { opacity: 0; }
        }
        @keyframes cta {
          0%, 72% { opacity: 0; transform: translateY(6px); }
          78%, 96% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(0.7); opacity: 0.4; }
          50% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </Phone>
  )
}

function Field({ label, value, delay }: { label: string; value: string; delay: string }) {
  return (
    <div className="field" style={{ animationDelay: delay }}>
      <span className="k">{label}</span>
      <span className="v">{value}</span>
      <style jsx>{`
        .field {
          background: #fff;
          border: 1px solid #E8E2DA;
          border-radius: 10px;
          padding: 8px 10px;
          display: flex; flex-direction: column; gap: 2px;
          opacity: 0;
          animation: fieldIn 9s infinite;
        }
        .k { font-size: 9px; text-transform: uppercase; letter-spacing: 0.06em; color: #A89F96; font-weight: 700; }
        .v { font-size: 12px; color: #1A1612; font-weight: 600; }
        @keyframes fieldIn {
          0%, 4% { opacity: 0; transform: translateY(8px); }
          9%, 66% { opacity: 1; transform: translateY(0); }
          70%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}

/* ── 2. Mode rafale ────────────────────────────────────────────────
   Une photo = un objet. Les analyses partent en parallèle et
   atterrissent dans le désordre, comme dans l'app. */
const BATCH = [
  { emoji: '👟', title: 'Nike Air Max', d: '1.2s' },
  { emoji: '⌚', title: 'Seiko Presage', d: '2.6s' },
  { emoji: '📸', title: 'Leica M6', d: '1.8s' },
  { emoji: '🎸', title: 'Stratocaster', d: '3.4s' },
  { emoji: '🧥', title: 'Veste denim', d: '2.1s' },
  { emoji: '📚', title: 'Lot de romans', d: '3.9s' },
]

export function BatchLoop() {
  return (
    <Phone label="Mode rafale · 8 s en boucle">
      <div className="batch">
        <div className="bar">
          <span className="count">6 photos</span>
          <span className="chip">Analyse groupée</span>
        </div>
        <div className="grid">
          {BATCH.map(item => (
            <div className="cell" key={item.title}>
              <div className="thumb">{item.emoji}</div>
              <div className="meta">
                <span className="spin" style={{ animationDelay: item.d }} />
                <span className="title" style={{ animationDelay: item.d }}>{item.title}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        .batch { position: absolute; inset: 0; padding: 40px 12px 12px; }
        .bar {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 10px;
        }
        .count { font-size: 12px; font-weight: 800; color: #1A1612; }
        .chip {
          font-size: 9px; font-weight: 700; color: #2D5016;
          background: #E8F0E0; border-radius: 999px; padding: 3px 8px;
        }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .cell { background: #fff; border: 1px solid #E8E2DA; border-radius: 10px; overflow: hidden; }
        .thumb {
          height: 62px; display: grid; place-items: center;
          font-size: 30px; background: #F0EBE3;
        }
        .meta { padding: 6px 7px; min-height: 26px; position: relative; }
        .spin {
          position: absolute; top: 9px; left: 7px;
          width: 9px; height: 9px; border-radius: 50%;
          border: 1.6px solid #E8E2DA; border-top-color: #2D5016;
          animation: spin 0.7s linear infinite, spinOut 8s infinite;
        }
        .title {
          display: block;
          font-size: 10px; font-weight: 700; color: #1A1612;
          opacity: 0;
          animation: titleIn 8s infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes spinOut {
          0%, 42% { opacity: 1; }
          46%, 94% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes titleIn {
          0%, 42% { opacity: 0; transform: translateY(4px); }
          48%, 94% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; }
        }
      `}</style>
    </Phone>
  )
}

/* ── 3. Cycle de vie d'un objet ────────────────────────────────────
   Le statut n'est pas décoratif : c'est lui qui fait vivre
   l'inventaire après le jour de la création. */
export function StatusLoop() {
  return (
    <Phone label="Statuts · 10 s en boucle">
      <div className="st">
        <div className="cover">🧥</div>
        <h4>Veste en jean délavé</h4>

        <div className="stack">
          <Status label="Possédé" color="#2D5016" bg="#E8F0E0" delay="0s" />
          <Status label="Rangé — carton grenier" color="#1A3A6B" bg="#E0EAF8" delay="2.5s" />
          <Status label="Prêté à Marie" color="#7A3B10" bg="#FDE8D0" delay="5s" />
          <Status label="Vendu · 45 €" color="#5E1A2F" bg="#FCE0E8" delay="7.5s" />
        </div>

        <p className="note">Chaque changement garde l’objet dans l’inventaire, avec son historique.</p>
      </div>

      <style jsx>{`
        .st { position: absolute; inset: 0; padding: 44px 16px 16px; text-align: center; }
        .cover {
          height: 128px; border-radius: 14px; background: #F0EBE3;
          display: grid; place-items: center; font-size: 56px;
          margin-bottom: 12px;
        }
        h4 { font-size: 14px; font-weight: 800; color: #1A1612; margin: 0 0 14px; }
        .stack { position: relative; height: 34px; }
        .note { font-size: 10px; color: #A89F96; line-height: 1.5; margin-top: 18px; }
      `}</style>
    </Phone>
  )
}

function Status({ label, color, bg, delay }: { label: string; color: string; bg: string; delay: string }) {
  return (
    <span className="s" style={{ color, background: bg, animationDelay: delay }}>
      {label}
      <style jsx>{`
        .s {
          position: absolute; left: 50%; top: 0;
          transform: translateX(-50%);
          font-size: 12px; font-weight: 700;
          padding: 7px 14px; border-radius: 999px;
          white-space: nowrap;
          opacity: 0;
          animation: statusIn 10s infinite;
        }
        @keyframes statusIn {
          0% { opacity: 0; transform: translateX(-50%) translateY(6px); }
          4%, 22% { opacity: 1; transform: translateX(-50%) translateY(0); }
          26%, 100% { opacity: 0; transform: translateX(-50%) translateY(-6px); }
        }
      `}</style>
    </span>
  )
}

/* ── 4. Partage par lien ───────────────────────────────────────────
   Deux écrans : l'expéditeur génère, le destinataire consulte —
   sans compte, sans installation. */
export function ShareLoop() {
  return (
    <Phone label="Partage · 9 s en boucle">
      <div className="sh">
        <div className="panel sender">
          <div className="handle" />
          <h4>Partager la collection</h4>
          <p className="sub">Dressing · 104 objets</p>
          <div className="row"><span>Lien public</span><em className="on" /></div>
          <div className="row"><span>Expire dans 30 jours</span><em className="on" /></div>
          <div className="link">tiroir.app/s/8f2c…</div>
          <div className="copied">Lien copié ✓</div>
        </div>

        <div className="panel receiver">
          <div className="rhead">
            <strong>Dressing</strong>
            <span>partagé par Clément</span>
          </div>
          <div className="rgrid">
            <i>🧥</i><i>👟</i><i>⌚</i><i>👖</i><i>🧢</i><i>👕</i>
          </div>
          <div className="rfoot">Aucun compte requis</div>
        </div>
      </div>

      <style jsx>{`
        .sh { position: absolute; inset: 0; }
        .panel { position: absolute; inset: 0; padding: 44px 16px 16px; }

        .sender { background: #F7F3EE; animation: senderOut 9s infinite; }
        .handle { width: 34px; height: 4px; border-radius: 99px; background: #E8E2DA; margin: 0 auto 14px; }
        h4 { font-size: 14px; font-weight: 800; color: #1A1612; margin: 0 0 2px; text-align: center; }
        .sub { font-size: 11px; color: #A89F96; text-align: center; margin: 0 0 16px; }
        .row {
          display: flex; align-items: center; justify-content: space-between;
          background: #fff; border: 1px solid #E8E2DA; border-radius: 10px;
          padding: 10px; margin-bottom: 8px;
          font-size: 11px; color: #1A1612; font-weight: 600;
        }
        .on { width: 26px; height: 15px; border-radius: 99px; background: #2D5016; position: relative; }
        .on::after {
          content: ''; position: absolute; top: 2px; right: 2px;
          width: 11px; height: 11px; border-radius: 50%; background: #fff;
        }
        .link {
          font-size: 11px; color: #2D5016; font-weight: 700;
          background: #E8F0E0; border-radius: 10px; padding: 10px;
          text-align: center; margin-top: 4px;
          animation: linkPop 9s infinite;
        }
        .copied {
          font-size: 10px; color: #2D5016; font-weight: 700;
          text-align: center; margin-top: 8px; opacity: 0;
          animation: copied 9s infinite;
        }

        .receiver { background: #fff; opacity: 0; animation: receiverIn 9s infinite; }
        .rhead { text-align: center; margin-bottom: 14px; }
        .rhead strong { display: block; font-size: 15px; color: #1A1612; }
        .rhead span { font-size: 10px; color: #A89F96; }
        .rgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
        .rgrid i {
          aspect-ratio: 1; border-radius: 8px; background: #F0EBE3;
          display: grid; place-items: center; font-size: 24px; font-style: normal;
        }
        .rfoot {
          margin-top: 16px; text-align: center;
          font-size: 10px; color: #A89F96; font-weight: 600;
        }

        @keyframes senderOut {
          0%, 55% { opacity: 1; }
          62%, 94% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes linkPop {
          0%, 22% { opacity: 0; transform: scale(0.96); }
          28%, 60% { opacity: 1; transform: scale(1); }
          64%, 100% { opacity: 0; }
        }
        @keyframes copied {
          0%, 34% { opacity: 0; }
          40%, 58% { opacity: 1; }
          62%, 100% { opacity: 0; }
        }
        @keyframes receiverIn {
          0%, 58% { opacity: 0; }
          66%, 94% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}</style>
    </Phone>
  )
}

/* ── 5. Valeur estimée ─────────────────────────────────────────────
   La fourchette se construit à partir d'annonces comparables. */
export function ValueLoop() {
  return (
    <Phone label="Estimation · 9 s en boucle">
      <div className="vl">
        <div className="cover">📸</div>
        <h4>Leica M6 argentique</h4>

        <div className="gauge">
          <div className="track"><div className="fill" /></div>
          <div className="bounds"><span>950 €</span><span>1 400 €</span></div>
          <div className="mid">≈ 1 200 €</div>
        </div>

        <span className="cmpLabel">Annonces comparables</span>
        <Ad source="leboncoin" price="1 150 €" delay="3.4s" />
        <Ad source="eBay" price="1 240 €" delay="4.2s" />
        <Ad source="Marketplace" price="1 190 €" delay="5s" />
      </div>

      <style jsx>{`
        .vl { position: absolute; inset: 0; padding: 44px 16px 16px; text-align: center; }
        .cover {
          height: 96px; border-radius: 14px; background: #F0EBE3;
          display: grid; place-items: center; font-size: 44px; margin-bottom: 10px;
        }
        h4 { font-size: 13px; font-weight: 800; color: #1A1612; margin: 0 0 14px; }
        .gauge { margin-bottom: 16px; }
        .track { height: 7px; border-radius: 99px; background: #E8E2DA; overflow: hidden; }
        .fill {
          height: 100%; width: 0;
          background: linear-gradient(90deg, #7B9B6B, #2D5016);
          animation: fill 9s infinite;
        }
        .bounds {
          display: flex; justify-content: space-between;
          font-size: 9px; color: #A89F96; font-weight: 700; margin-top: 5px;
        }
        .mid {
          font-size: 20px; font-weight: 800; color: #2D5016; margin-top: 6px;
          opacity: 0; animation: mid 9s infinite;
        }
        .cmpLabel {
          display: block; font-size: 9px; text-transform: uppercase;
          letter-spacing: 0.07em; color: #A89F96; font-weight: 700;
          text-align: left; margin-bottom: 6px;
        }
        @keyframes fill {
          0%, 6% { width: 0; }
          30%, 92% { width: 100%; }
          100% { width: 0; }
        }
        @keyframes mid {
          0%, 26% { opacity: 0; transform: scale(0.9); }
          34%, 92% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; }
        }
      `}</style>
    </Phone>
  )
}

function Ad({ source, price, delay }: { source: string; price: string; delay: string }) {
  return (
    <div className="ad" style={{ animationDelay: delay }}>
      <span>{source}</span><strong>{price}</strong>
      <style jsx>{`
        .ad {
          display: flex; align-items: center; justify-content: space-between;
          background: #fff; border: 1px solid #E8E2DA; border-radius: 9px;
          padding: 8px 10px; margin-bottom: 6px;
          font-size: 11px; color: #6B6158;
          opacity: 0; animation: adIn 9s infinite;
        }
        strong { color: #1A1612; font-weight: 800; }
        @keyframes adIn {
          0%, 2% { opacity: 0; transform: translateX(-8px); }
          8%, 60% { opacity: 1; transform: translateX(0); }
          66%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}

/* ── 6. Collections ────────────────────────────────────────────────
   Les objets se rangent, la grille se densifie. */
export function CollectionLoop() {
  return (
    <Phone label="Collections · 8 s en boucle">
      <div className="cl">
        <div className="tabs">
          <span className="tab on">Dressing</span>
          <span className="tab">Atelier</span>
          <span className="tab">À vendre</span>
        </div>
        <div className="grid">
          {['🧥','👟','⌚','👖','🧢','👕','🥾','🧣','🎽'].map((e, i) => (
            <div className="it" key={i} style={{ animationDelay: `${i * 0.12}s` }}>{e}</div>
          ))}
        </div>
        <div className="zoom">
          <span>Densité</span>
          <div className="bars"><i /><i /><i /></div>
        </div>
      </div>

      <style jsx>{`
        .cl { position: absolute; inset: 0; padding: 44px 12px 12px; }
        .tabs { display: flex; gap: 6px; margin-bottom: 10px; }
        .tab {
          font-size: 10px; font-weight: 700; color: #6B6158;
          background: #fff; border: 1px solid #E8E2DA;
          border-radius: 999px; padding: 5px 10px;
        }
        .tab.on { background: #2D5016; color: #fff; border-color: #2D5016; }
        .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
        .it {
          aspect-ratio: 1; border-radius: 9px; background: #fff;
          border: 1px solid #E8E2DA;
          display: grid; place-items: center; font-size: 24px;
          opacity: 0; animation: itIn 8s infinite;
        }
        .zoom {
          display: flex; align-items: center; justify-content: space-between;
          margin-top: 14px; font-size: 10px; color: #A89F96; font-weight: 700;
        }
        .bars { display: flex; gap: 3px; align-items: flex-end; height: 14px; }
        .bars i {
          width: 5px; background: #2D5016; border-radius: 2px;
          animation: bar 8s infinite;
        }
        .bars i:nth-child(1) { animation-delay: 0s; }
        .bars i:nth-child(2) { animation-delay: 0.2s; }
        .bars i:nth-child(3) { animation-delay: 0.4s; }
        @keyframes itIn {
          0%, 3% { opacity: 0; transform: scale(0.85); }
          12%, 90% { opacity: 1; transform: scale(1); }
          100% { opacity: 0; }
        }
        @keyframes bar {
          0%, 100% { height: 5px; }
          50% { height: 14px; }
        }
      `}</style>
    </Phone>
  )
}
