import { useState, useRef, useEffect } from 'react'

interface Flow {
  id: string
  persona: string
  headline: string
  sub: string
  video: string
  color: string
  textColor: string
}

const FLOWS: Flow[] = [
  {
    id: 'vendeur',
    persona: 'Je vends',
    headline: 'Photographiez. L\'IA crée la fiche.',
    sub: 'Titre, description, catégorie — générés en quelques secondes. Plus besoin de tout retaper à la main.',
    video: '/flows/flow-a.mp4',
    color: '#FDE8DF',
    textColor: '#7A3010',
  },
  {
    id: 'organisé',
    persona: 'Je range',
    headline: 'Sachez ce que vaut chaque objet.',
    sub: 'Prix du marché en temps réel, comparé à votre prix d\'achat. Utile pour vendre, assurer, ou simplement savoir.',
    video: '/flows/flow-b.mp4',
    color: '#E8F0FB',
    textColor: '#1A3A6B',
  },
  {
    id: 'collectionneur',
    persona: 'Je partage',
    headline: 'Un lien. Rien à installer.',
    sub: 'Envoyez une fiche complète à un acheteur, un proche, un assureur. Ils voient tout, sans créer de compte.',
    video: '/flows/flow-c.mp4',
    color: '#EEF0FE',
    textColor: '#3C3489',
  },
]

export default function FlowDemo() {
  const [active, setActive] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load()
      videoRef.current.play().catch(() => {})
    }
  }, [active])

  const flow = FLOWS[active]

  return (
    <section className="fd">
      <div className="fd-wrap">
        <div className="fd-tabs">
          {FLOWS.map((f, i) => (
            <button
              key={f.id}
              className={`fd-tab ${i === active ? 'fd-tab--active' : ''}`}
              onClick={() => setActive(i)}
              style={i === active ? { background: f.color, color: f.textColor, borderColor: f.color } : {}}
            >
              {f.persona}
            </button>
          ))}
        </div>

        <div className="fd-content">
          <div className="fd-text">
            <h2 className="fd-headline">{flow.headline}</h2>
            <p className="fd-sub">{flow.sub}</p>
          </div>

          <div className="fd-phone">
            <div className="fd-phone-frame">
              <div className="fd-phone-notch" />
              <video
                ref={videoRef}
                key={flow.video}
                src={flow.video}
                autoPlay
                loop
                muted
                playsInline
                className="fd-video"
              />
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .fd {
          padding: 72px 0 80px;
          background: #FAFAF8;
        }
        .fd-wrap {
          max-width: 1100px;
          margin: 0 auto;
          padding: 0 24px;
        }
        .fd-tabs {
          display: flex;
          gap: 10px;
          margin-bottom: 48px;
          flex-wrap: wrap;
        }
        .fd-tab {
          padding: 10px 22px;
          border-radius: 100px;
          border: 1.5px solid #E0DDD8;
          background: white;
          color: #666;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.18s ease;
          font-family: inherit;
        }
        .fd-tab:hover {
          border-color: #999;
          color: #222;
        }
        .fd-tab--active {
          font-weight: 600;
        }
        .fd-content {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 64px;
          align-items: center;
        }
        .fd-text {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .fd-headline {
          font-size: 36px;
          font-weight: 700;
          line-height: 1.2;
          color: #1a1a1a;
          margin: 0;
          letter-spacing: -0.5px;
        }
        .fd-sub {
          font-size: 17px;
          color: #555;
          line-height: 1.65;
          margin: 0;
        }
        .fd-phone {
          display: flex;
          justify-content: center;
        }
        .fd-phone-frame {
          width: 240px;
          height: 520px;
          border-radius: 36px;
          border: 3px solid #1a1a1a;
          background: #000;
          overflow: hidden;
          position: relative;
          box-shadow: 0 24px 64px rgba(0,0,0,0.18);
        }
        .fd-phone-notch {
          position: absolute;
          top: 10px;
          left: 50%;
          transform: translateX(-50%);
          width: 80px;
          height: 22px;
          background: #1a1a1a;
          border-radius: 14px;
          z-index: 2;
        }
        .fd-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        @media (max-width: 800px) {
          .fd-content {
            grid-template-columns: 1fr;
            gap: 40px;
          }
          .fd-phone {
            order: -1;
          }
          .fd-phone-frame {
            width: 200px;
            height: 432px;
          }
          .fd-headline {
            font-size: 26px;
          }
        }
      `}</style>
    </section>
  )
}
