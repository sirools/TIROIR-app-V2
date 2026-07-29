import { useRef, useEffect, useState } from 'react'
import Image from 'next/image'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/router'

interface Story {
  id: string
  tag: string
  headline: string
  sub: string
  video?: string
  screenshot?: string
  illustration?: string
  /** Maquette animée en CSS plutôt qu'un visuel figé. */
  motion?: 'sale'
  /** Lien complémentaire affiché à la suite du paragraphe. */
  link?: { href: string; label: string }
  placeholder?: { emoji: string; label: string; hint: string }
  bg: string
  textColor: string
  tagBg: string
  flip: boolean
  tilt: string
}

const STORIES: Story[] = [
  {
    id: 'scan',
    tag: 'Scan',
    headline: 'Une photo. Une fiche complète.',
    sub: "Pointez votre appareil sur n'importe quel objet. L'IA reconnaît, nomme, décrit et classe en quelques secondes. Votre inventaire se constitue presque tout seul.",
    video: '/flows/flow-a.mp4',
    bg: '#F6EDE0',
    textColor: '#3B2A1A',
    tagBg: '#FDDCBF',
    flip: false,
    tilt: 'perspective(900px) rotateY(-12deg) rotateX(3deg)',
  },
  {
    id: 'rangement',
    tag: 'Rangement',
    headline: 'Organisez sans effort. Retrouvez en deux secondes.',
    sub: "Créez des collections thématiques, déplacez vos objets en un geste, filtrez par statut ou valeur. Fini les heures perdues à chercher où vous avez mis quoi.",
    video: '/flows/flow-b.mp4',
    bg: '#DCEFD8',
    textColor: '#1A3B1A',
    tagBg: '#B8E0B2',
    flip: true,
    tilt: 'perspective(900px) rotateY(10deg) rotateX(3deg)',
  },
  {
    id: 'centraliser',
    tag: 'Centralisation',
    headline: 'Tout au même endroit, accessible partout.',
    sub: "Tiroir synchronise votre inventaire sur tous vos appareils. Application mobile, version web — vos objets vous suivent. Rien n'est jamais perdu.",
    screenshot: '/screens/partage-collection.jpg',
    bg: '#E0EAF8',
    textColor: '#1A2F5E',
    tagBg: '#B8D0F0',
    flip: false,
    tilt: 'perspective(1200px) rotateY(-6deg) rotateX(3deg)',
  },
  {
    id: 'evaluer',
    tag: 'Évaluation',
    headline: 'Sachez exactement ce que vaut chaque objet.',
    sub: "L'IA estime la valeur marché en temps réel — fourchette Leboncoin, Vinted, eBay. Comparez avec votre prix d'achat. Utile pour vendre juste, assurer ou simplement savoir.",
    video: '/flows/flow-c.mp4',
    bg: '#FFF3CC',
    textColor: '#5E3D00',
    tagBg: '#FFE080',
    flip: true,
    tilt: 'perspective(900px) rotateY(12deg) rotateX(3deg)',
  },
  {
    id: 'partager',
    tag: 'Partage',
    headline: 'Un lien. Rien à installer.',
    sub: "Envoyez une fiche complète à un acheteur, un proche, un assureur, un notaire. Ils voient photos, infos et prix estimé — sans compte, sans friction, depuis n'importe quel appareil.",
    video: '/flows/flow-d.mp4',
    bg: '#EDE0F8',
    textColor: '#3D1A5E',
    tagBg: '#D4B8F0',
    flip: false,
    tilt: 'perspective(1200px) rotateY(-6deg) rotateX(3deg)',
  },
  {
    id: 'vente',
    tag: 'Vente',
    headline: 'Vendez au bon prix. Du premier coup.',
    sub: "Données de marché en temps réel, fiche produit prête à partager, historique du prix d'achat. Vous négociez avec des arguments. L'acheteur reçoit une fiche professionnelle.",
    motion: 'sale',
    link: { href: '/concept', label: 'Comment ça marche, en détail' },
    bg: '#FCE0E8',
    textColor: '#5E1A2F',
    tagBg: '#F4B0C8',
    flip: true,
    tilt: 'perspective(900px) rotateY(10deg) rotateX(3deg)',
  },
]

function PhoneLightbox({ video, onClose }: { video: string; onClose: () => void }) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    ref.current?.play().catch(() => {})
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="lb-root" onClick={onClose}>
      <div className="lb-phone" onClick={e => e.stopPropagation()}>
        <div className="lb-notch" />
        <video ref={ref} src={video} autoPlay loop muted playsInline className="lb-video" />
      </div>
      <style jsx>{`
        .lb-root {
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: rgba(255,255,255,0.78);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          animation: lbIn 0.25s ease;
        }
        @keyframes lbIn { from { opacity: 0; } to { opacity: 1; } }
        .lb-phone {
          width: min(300px, 82vw);
          height: min(650px, 86vh);
          border-radius: 42px;
          border: 3px solid rgba(0,0,0,0.18);
          background: #111;
          overflow: hidden;
          position: relative;
          box-shadow: 0 48px 120px rgba(0,0,0,0.28), 0 16px 40px rgba(0,0,0,0.15);
          animation: phoneIn 0.35s cubic-bezier(0.34, 1.26, 0.64, 1);
        }
        @keyframes phoneIn { from { transform: scale(0.88); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .lb-notch {
          position: absolute;
          top: 10px;
          left: 50%;
          transform: translateX(-50%);
          width: 80px;
          height: 22px;
          background: #111;
          border-radius: 12px;
          z-index: 2;
        }
        .lb-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
      `}</style>
    </div>,
    document.body
  )
}

function PhoneFrame({ video, tilt }: { video: string; tilt: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { el.load(); el.play().catch(() => {}) }
        else el.pause()
      },
      { threshold: 0.3 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [video])

  return (
    <>
      {/* Le phone reste dans le flux — la section ne bouge pas */}
      <div className="phone-wrap">
        <div
          className="phone-frame"
          style={{ transform: tilt, opacity: expanded ? 0.3 : 1 }}
          onClick={() => setExpanded(true)}
        >
          <div className="phone-notch" />
          <video ref={ref} src={video} autoPlay loop muted playsInline className="phone-video" />
        </div>
      </div>

      {/* Lightbox via portal — rendu dans document.body */}
      {expanded && <PhoneLightbox video={video} onClose={() => setExpanded(false)} />}

      <style jsx>{`
        .phone-wrap {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 32px 0;
        }
        .phone-frame {
          width: 300px;
          height: 650px;
          border-radius: 38px;
          border: 3px solid rgba(0,0,0,0.15);
          background: #111;
          overflow: hidden;
          position: relative;
          box-shadow: 0 32px 80px rgba(0,0,0,0.18), 0 8px 20px rgba(0,0,0,0.10);
          cursor: zoom-in;
          transition: transform 0.45s cubic-bezier(0.34, 1.26, 0.64, 1), opacity 0.2s ease;
        }
        .phone-frame:hover {
          transform: perspective(900px) rotateY(0deg) rotateX(0deg) scale(1.04) !important;
        }
        .phone-notch {
          position: absolute;
          top: 10px;
          left: 50%;
          transform: translateX(-50%);
          width: 72px;
          height: 20px;
          background: #111;
          border-radius: 12px;
          z-index: 2;
        }
        .phone-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
      `}</style>
    </>
  )
}

function BrowserChrome({ url, light }: { url: string; light?: boolean }) {
  return (
    <div className="browser-bar">
      <div className="browser-dots">
        <span style={{ background: '#FF5F57' }} />
        <span style={{ background: '#FEBC2E' }} />
        <span style={{ background: '#28C840' }} />
      </div>
      <div className="browser-url">{url}</div>
      <style jsx>{`
        .browser-bar {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          background: ${light ? '#e8e0d4' : '#2a2a2a'};
          border-bottom: 1px solid ${light ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.06)'};
          flex-shrink: 0;
        }
        .browser-dots { display: flex; gap: 5px; flex-shrink: 0; }
        .browser-dots span { width: 10px; height: 10px; border-radius: 50%; display: block; }
        .browser-url {
          flex: 1;
          background: ${light ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.07)'};
          border-radius: 6px;
          padding: 4px 10px;
          font-size: 11px;
          color: ${light ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)'};
          font-family: monospace;
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `}</style>
    </div>
  )
}

function DesktopLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', handler); document.body.style.overflow = '' }
  }, [onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <div className="lb-root" onClick={onClose}>
      <div className="lb-window" onClick={e => e.stopPropagation()}>
        <BrowserChrome url="tiroir.app/s/projet-stylisme" light />
        <div className="lb-screen">
          <Image src={src} alt="Aperçu web Tiroir" fill sizes="90vw" style={{ objectFit: 'contain', objectPosition: 'top' }} />
        </div>
      </div>
      <style jsx>{`
        .lb-root {
          position: fixed; inset: 0; z-index: 9999;
          background: rgba(245,240,232,0.82);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          display: flex; align-items: center; justify-content: center;
          padding: 32px;
          animation: lbIn 0.22s ease;
        }
        @keyframes lbIn { from { opacity: 0; } to { opacity: 1; } }
        .lb-window {
          width: min(900px, 92vw);
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 48px 120px rgba(0,0,0,0.22), 0 12px 32px rgba(0,0,0,0.12);
          display: flex; flex-direction: column;
          animation: winIn 0.32s cubic-bezier(0.34,1.2,0.64,1);
        }
        @keyframes winIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .lb-screen {
          position: relative;
          aspect-ratio: 2 / 1;
          background: #F5F0E8;
          overflow: hidden;
        }
      `}</style>
    </div>,
    document.body
  )
}

function DesktopFrame({ src, tilt }: { src: string; tilt: string }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      <div className="desktop-wrap">
        <div
          className="desktop-frame"
          style={{ transform: tilt, opacity: expanded ? 0.3 : 1 }}
          onClick={() => setExpanded(true)}
        >
          <BrowserChrome url="tiroir.app/s/projet-stylisme" />
          <div className="browser-screen">
            <Image src={src} alt="Aperçu web Tiroir" fill sizes="520px" style={{ objectFit: 'cover', objectPosition: 'top' }} />
          </div>
        </div>
      </div>

      {expanded && <DesktopLightbox src={src} onClose={() => setExpanded(false)} />}

      <style jsx>{`
        .desktop-wrap {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 32px 0;
        }
        .desktop-frame {
          width: 500px;
          max-width: 92vw;
          border-radius: 14px;
          background: #2a2a2a;
          overflow: hidden;
          box-shadow: 0 32px 80px rgba(0,0,0,0.28), 0 8px 20px rgba(0,0,0,0.15);
          transition: transform 0.45s cubic-bezier(0.34,1.1,0.64,1), opacity 0.2s ease;
          cursor: zoom-in;
        }
        .desktop-frame:hover {
          transform: perspective(1200px) rotateY(0deg) rotateX(0deg) scale(1.03) !important;
        }
        .browser-screen {
          position: relative;
          height: 420px;
          overflow: hidden;
          background: #F5F0E8;
        }
      `}</style>
    </>
  )
}

function IllustrationFrame({ src, tilt }: { src: string; tilt: string }) {
  return (
    <div className="ill-wrap">
      <div className="ill-frame" style={{ transform: tilt }}>
        <Image src={src} alt="Illustration" fill sizes="520px" style={{ objectFit: 'contain' }} />
      </div>
      <style jsx>{`
        .ill-wrap { display: flex; justify-content: center; align-items: center; padding: 16px 0; }
        .ill-frame {
          position: relative;
          width: 500px;
          max-width: 92vw;
          aspect-ratio: 16/9;
          border-radius: 20px;
          overflow: hidden;
          box-shadow: 0 24px 64px rgba(0,0,0,0.18);
          transition: transform 0.45s cubic-bezier(0.34,1.1,0.64,1);
        }
        .ill-frame:hover {
          transform: perspective(1200px) rotateY(0deg) rotateX(0deg) scale(1.03) !important;
        }
      `}</style>
    </div>
  )
}

function PlaceholderFrame({ data, tilt, bg, textColor }: {
  data: NonNullable<Story['placeholder']>
  tilt: string
  bg: string
  textColor: string
}) {
  return (
    <div className="ph-wrap">
      <div className="ph-frame" style={{ transform: tilt }}>
        <span className="ph-emoji">{data.emoji}</span>
        <span className="ph-label">{data.label}</span>
        <span className="ph-hint">{data.hint}</span>
      </div>
      <style jsx>{`
        .ph-wrap { display: flex; justify-content: center; align-items: center; padding: 32px 0; }
        .ph-frame {
          width: 320px; max-width: 88vw;
          aspect-ratio: 4/3;
          border-radius: 18px;
          border: 2px dashed ${textColor}33;
          background: ${bg};
          display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 10px;
        }
        .ph-emoji { font-size: 40px; }
        .ph-label { font-size: 15px; font-weight: 700; color: ${textColor}; opacity: 0.7; }
        .ph-hint { font-size: 11px; color: ${textColor}; opacity: 0.4; font-family: monospace; text-align: center; padding: 0 16px; }
      `}</style>
    </div>
  )
}

/**
 * Suivi de vente animé, en CSS pur (autoplay, boucle de 10 s).
 *
 * Trois objets passent de « En vente » à « Vendu » l'un après l'autre, et
 * le total encaissé suit. Le tableau de bord vaut mieux qu'une photo de
 * téléphone ici : c'est le suivi dans le temps qu'on veut montrer, pas
 * l'écran d'un seul objet.
 */
const SALE_ROWS = [
  { emoji: '🧥', name: 'Veste en jean', price: '45 €', delay: '1.4s' },
  { emoji: '👟', name: 'Nike Air Max 90', price: '80 €', delay: '3.4s' },
  { emoji: '📸', name: 'Leica M6', price: '85 €', delay: '5.4s' },
]

const SALE_TOTALS = ['0 €', '45 €', '125 €', '210 €']

function SaleMotion({ tilt }: { tilt: string }) {
  return (
    <div className="sale-wrap">
      <div className="sale-card" style={{ transform: tilt }}>
        <div className="sale-head">
          <div>
            <span className="sale-kicker">Collection</span>
            <strong className="sale-title">À vendre</strong>
          </div>
          <span className="sale-badge">3 objets</span>
        </div>

        <div className="sale-rows">
          {SALE_ROWS.map(r => (
            <div className="sale-row" key={r.name}>
              <span className="sale-emoji">{r.emoji}</span>
              <div className="sale-meta">
                <strong>{r.name}</strong>
                <span className="sale-price">{r.price}</span>
              </div>
              <span className="sale-chips">
                <em className="c-live" style={{ animationDelay: r.delay }}>En vente</em>
                <em className="c-sold" style={{ animationDelay: r.delay }}>Vendu ✓</em>
              </span>
            </div>
          ))}
        </div>

        <div className="sale-foot">
          <span className="sale-footLab">Total encaissé</span>
          <span className="sale-totals">
            {SALE_TOTALS.map(t => <b key={t}>{t}</b>)}
          </span>
        </div>
      </div>

      <style jsx>{`
        .sale-wrap {
          display: flex; align-items: center; justify-content: center;
          padding: 32px 0;
        }
        .sale-card {
          width: min(380px, 100%);
          background: #fff;
          border-radius: 24px;
          padding: 22px;
          box-shadow: 0 32px 80px rgba(94, 26, 47, 0.18), 0 8px 20px rgba(94, 26, 47, 0.1);
          transition: transform 0.45s cubic-bezier(0.34, 1.26, 0.64, 1);
        }
        .sale-card:hover {
          transform: perspective(900px) rotateY(0deg) rotateX(0deg) scale(1.03) !important;
        }

        .sale-head {
          display: flex; align-items: flex-start; justify-content: space-between;
          margin-bottom: 18px;
        }
        .sale-kicker {
          display: block; font-size: 10px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase; color: #C08098;
        }
        .sale-title { font-size: 20px; font-weight: 800; color: #5E1A2F; letter-spacing: -0.3px; }
        .sale-badge {
          font-size: 11px; font-weight: 700; color: #5E1A2F;
          background: #FCE0E8; border-radius: 999px; padding: 5px 11px;
        }

        .sale-rows { display: flex; flex-direction: column; gap: 10px; }
        .sale-row {
          display: flex; align-items: center; gap: 12px;
          background: #FBF7F4;
          border: 1px solid rgba(94, 26, 47, 0.07);
          border-radius: 14px;
          padding: 11px 13px;
        }
        .sale-emoji {
          width: 38px; height: 38px; flex-shrink: 0;
          border-radius: 10px; background: #fff;
          display: grid; place-items: center; font-size: 20px;
        }
        .sale-meta { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
        .sale-meta strong {
          font-size: 14px; font-weight: 700; color: #3A2028;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .sale-price { font-size: 12px; font-weight: 700; color: #C08098; }

        /* Les deux étiquettes se superposent et se relaient. */
        .sale-chips { position: relative; width: 74px; height: 24px; flex-shrink: 0; }
        .sale-chips em {
          position: absolute; inset: 0;
          display: grid; place-items: center;
          font-style: normal; font-size: 11px; font-weight: 800;
          border-radius: 999px;
          animation: 10s infinite;
        }
        .c-live {
          background: #F0EBE3; color: #8a7a80;
          animation-name: chipLive;
        }
        .c-sold {
          background: #DCEFD8; color: #1E4D1A;
          opacity: 0;
          animation-name: chipSold;
        }
        /* Avant son délai, chaque étiquette garde son état de base :
           « En vente » visible, « Vendu » masqué. La bascule a donc lieu
           juste après le démarrage de l'animation. */
        @keyframes chipLive {
          0%, 2% { opacity: 1; transform: scale(1); }
          6%, 92% { opacity: 0; transform: scale(0.9); }
          96%, 100% { opacity: 1; transform: scale(1); }
        }
        @keyframes chipSold {
          0%, 2% { opacity: 0; transform: scale(0.9); }
          7%, 92% { opacity: 1; transform: scale(1); }
          96%, 100% { opacity: 0; transform: scale(0.9); }
        }

        .sale-foot {
          display: flex; align-items: center; justify-content: space-between;
          margin-top: 18px; padding-top: 14px;
          border-top: 1px solid rgba(94, 26, 47, 0.1);
        }
        .sale-footLab { font-size: 12px; font-weight: 700; color: #C08098; }
        .sale-totals { position: relative; width: 90px; height: 30px; }
        .sale-totals b {
          position: absolute; inset: 0;
          display: grid; place-items: end center;
          font-size: 24px; font-weight: 800; color: #5E1A2F; letter-spacing: -0.5px;
          opacity: 0;
          animation: 10s infinite;
        }
        /* Un palier par vente, calé sur la bascule des étiquettes. Le
           dernier montant tient jusqu'à la fin du cycle, pour ne jamais
           laisser le total vide. */
        .sale-totals b:nth-child(1) { animation-name: total0; }
        .sale-totals b:nth-child(2) { animation-name: total1; }
        .sale-totals b:nth-child(3) { animation-name: total2; }
        .sale-totals b:nth-child(4) { animation-name: total3; }
        @keyframes total0 {
          0%, 14% { opacity: 1; transform: translateY(0); }
          17%, 97% { opacity: 0; transform: translateY(-6px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes total1 {
          0%, 14% { opacity: 0; transform: translateY(6px); }
          17%, 34% { opacity: 1; transform: translateY(0); }
          37%, 100% { opacity: 0; transform: translateY(-6px); }
        }
        @keyframes total2 {
          0%, 34% { opacity: 0; transform: translateY(6px); }
          37%, 54% { opacity: 1; transform: translateY(0); }
          57%, 100% { opacity: 0; transform: translateY(-6px); }
        }
        @keyframes total3 {
          0%, 54% { opacity: 0; transform: translateY(6px); }
          57%, 97% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .sale-chips em, .sale-totals b { animation: none; }
          .c-live { opacity: 0; }
          .c-sold { opacity: 1; }
          .sale-totals b:last-child { opacity: 1; }
        }
      `}</style>
    </div>
  )
}

function StoryBlock({ story }: { story: Story }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold: 0.12 }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const visualEl = story.motion === 'sale'
    ? <SaleMotion tilt={story.tilt} />
    : story.placeholder
    ? <PlaceholderFrame data={story.placeholder} tilt={story.tilt} bg={story.bg} textColor={story.textColor} />
    : story.illustration
      ? <IllustrationFrame src={story.illustration} tilt={story.tilt} />
      : story.screenshot
        ? <DesktopFrame src={story.screenshot} tilt={story.tilt} />
        : <PhoneFrame video={story.video!} tilt={story.tilt} />
  const textEl = (
    <div className="text-col">
      <span className="tag">{story.tag}</span>
      <h2 className="headline">{story.headline}</h2>
      <p className="sub">{story.sub}</p>
      {story.link && (
        <a className="story-link" href={story.link.href}>
          {story.link.label}
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12h13M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2.2"
              strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      )}
      <style jsx>{`
        .text-col { display: flex; flex-direction: column; gap: 16px; justify-content: center; }
        .story-link {
          display: inline-flex; align-items: center; gap: 8px;
          width: fit-content;
          padding: 11px 20px;
          border-radius: 100px;
          background: ${story.textColor};
          color: ${story.bg};
          font-size: 14px; font-weight: 700;
          text-decoration: none;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .story-link:hover {
          transform: translateY(-1px);
          box-shadow: 0 8px 20px ${story.textColor}33;
        }
        .story-link svg { transition: transform 0.2s ease; }
        .story-link:hover svg { transform: translateX(3px); }
        .tag {
          display: inline-block;
          width: fit-content;
          padding: 6px 14px;
          border-radius: 100px;
          background: ${story.tagBg};
          color: ${story.textColor};
          font-size: 13px;
          font-weight: 700;
        }
        .headline {
          font-size: clamp(26px, 3.5vw, 40px);
          font-weight: 800;
          line-height: 1.15;
          color: ${story.textColor};
          margin: 0;
          letter-spacing: -0.5px;
        }
        .sub {
          font-size: 17px;
          line-height: 1.65;
          color: ${story.textColor};
          opacity: 0.72;
          margin: 0;
          max-width: 440px;
        }
      `}</style>
    </div>
  )

  return (
    <section ref={ref} id={story.id} className={`block ${visible ? 'visible' : ''}`} style={{ background: story.bg }}>
      <div className={`inner${story.flip ? ' flip' : ''}`}>
        {story.flip ? <>{textEl}{visualEl}</> : <>{visualEl}{textEl}</>}
      </div>
      <style jsx>{`
        .block {
          padding: 96px 24px;
          opacity: 0;
          transform: translateY(28px);
          transition: opacity 0.65s ease, transform 0.65s ease;
        }
        .block.visible { opacity: 1; transform: translateY(0); }
        .inner {
          max-width: 1000px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 72px;
          align-items: center;
        }
        @media (max-width: 720px) {
          .inner { grid-template-columns: 1fr; gap: 40px; }
          .block { padding: 64px 24px; }
        }
      `}</style>
    </section>
  )
}

// Traductions anglaises (fusionnées par id ; les STORIES ci-dessus restent la source FR + le visuel)
const STORY_COPY_EN: Record<string, { tag: string; headline: string; sub: string }> = {
  scan: {
    tag: 'Scan',
    headline: 'One photo. A complete entry.',
    sub: 'Point your camera at any item. The AI recognizes, names, describes, and sorts it in seconds. Your inventory builds itself almost on its own.',
  },
  rangement: {
    tag: 'Organize',
    headline: 'Organize effortlessly. Find things in two seconds.',
    sub: 'Create themed collections, move items in one tap, filter by status or value. No more hours lost trying to remember where you put what.',
  },
  centraliser: {
    tag: 'Centralize',
    headline: 'Everything in one place, accessible anywhere.',
    sub: 'Tiroir syncs your inventory across all your devices. Mobile app, web version — your items follow you. Nothing is ever lost.',
  },
  evaluer: {
    tag: 'Valuation',
    headline: 'Know exactly what each item is worth.',
    sub: 'The AI estimates market value in real time — price ranges from resale marketplaces. Compare with your purchase price. Handy to sell fairly, insure, or simply know.',
  },
  partager: {
    tag: 'Share',
    headline: 'One link. Nothing to install.',
    sub: 'Send a complete entry to a buyer, a relative, an insurer, a notary. They see photos, details, and estimated price — no account, no friction, from any device.',
  },
  vente: {
    tag: 'Sell',
    headline: 'Sell at the right price. First time.',
    sub: 'Real-time market data, a share-ready product entry, purchase-price history. You negotiate with facts. The buyer receives a professional listing.',
  },
}

export default function StoryScroll() {
  const { locale } = useRouter()
  const isEn = locale === 'en'
  return (
    <div>
      {STORIES.map(story => (
        <StoryBlock key={story.id} story={isEn ? { ...story, ...STORY_COPY_EN[story.id] } : story} />
      ))}
    </div>
  )
}
