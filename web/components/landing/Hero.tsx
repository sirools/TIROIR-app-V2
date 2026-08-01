import Link from 'next/link'
import { useRouter } from 'next/router'
import StoreButtons from '../StoreButtons'

const COPY = {
  fr: {
    badge: 'Disponible sur iOS et Android',
    how: 'Voir comment ça marche',
    concept: 'Le concept en détail',
  },
  en: {
    badge: 'Available on iOS & Android',
    how: 'See how it works',
    concept: 'The concept in detail',
  },
}

export default function Hero() {
  const { locale } = useRouter()
  const t = locale === 'en' ? COPY.en : COPY.fr
  const isEn = locale === 'en'
  return (
    <section className="hero">
      {/* Video background */}
      <video
        className="hero-video"
        src="/hero-loop.mp4"
        autoPlay
        loop
        muted
        playsInline
      />

      {/* Gradient overlay — left fade for readability */}
      <div className="hero-overlay" />

      {/* Content */}
      <div className="container hero-content">
        <div className="hero-copy">
          <span className="badge">{t.badge}</span>
          <h1 className="h1">
            {isEn
              ? <>Snap a photo.<br />Document in seconds.</>
              : <>Photographiez.<br />Documentez rapidement.</>}
          </h1>
          <p className="p">
            {isEn
              ? <>Tiroir catalogs your belongings in seconds.<br />Market value, collections, share with one link.</>
              : <>Tiroir catalogue vos objets en quelques secondes.<br />Valeur marché, collections, partage en un lien.</>}
          </p>
          <div className="hero-ctas">
            <StoreButtons isEn={isEn} variant="dark" />
            <a className="btn btn-ghost" href="#ranger">{t.how}</a>
            {/* Le lien précédent descend dans la page ; celui-ci sort vers
                la doc — d'où le chevron qui distingue les deux.
                `legacyBehavior` : styled-jsx ne scope ses classes que sur
                les éléments natifs, il faut donc lui donner un vrai <a>. */}
            <Link href="/concept" legacyBehavior passHref>
              <a className="btn btn-ghost">
                {t.concept}
                <span aria-hidden="true" className="btn-arrow">›</span>
              </a>
            </Link>
          </div>
        </div>
      </div>

      <style jsx>{`
        .hero {
          position: relative;
          min-height: 92vh;
          display: flex;
          align-items: center;
          overflow: hidden;
          background: #1a1008;
        }

        .hero-video {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
          opacity: 0.85;
        }

        .hero-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            105deg,
            rgba(20, 12, 4, 0.82) 0%,
            rgba(20, 12, 4, 0.60) 45%,
            rgba(20, 12, 4, 0.10) 75%,
            transparent 100%
          );
        }

        .hero-content {
          position: relative;
          z-index: 2;
          width: 100%;
          max-width: 1200px;
          margin: 0 auto;
          padding: 80px 24px;
        }

        .hero-copy {
          max-width: 540px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .hero-copy .badge {
          display: inline-block;
          width: fit-content;
          padding: 6px 14px;
          border-radius: 100px;
          background: rgba(192, 104, 42, 0.25);
          border: 1px solid rgba(192, 104, 42, 0.5);
          color: #f0b07a;
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.2px;
        }

        .hero-copy .h1 {
          font-size: clamp(40px, 5.5vw, 72px);
          font-weight: 900;
          line-height: 1.05;
          letter-spacing: -1.5px;
          color: #fff;
          margin: 0;
        }

        .hero-copy .p {
          font-size: 18px;
          line-height: 1.65;
          color: rgba(255, 255, 255, 0.65);
          margin: 0;
        }

        .hero-ctas {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          align-items: center;
          margin-top: 4px;
        }

        .btn-ghost {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 13px 24px;
          border-radius: 14px;
          font-size: 15px;
          font-weight: 600;
          text-decoration: none;
          color: rgba(255,255,255,0.8);
          border: 1.5px solid rgba(255,255,255,0.25);
          transition: border-color 0.15s, color 0.15s;
          backdrop-filter: blur(4px);
          background: rgba(255,255,255,0.06);
        }
        .btn-ghost:hover { border-color: rgba(255,255,255,0.5); color: #fff; }
        .btn-arrow {
          font-size: 19px;
          line-height: 1;
          opacity: 0.7;
          transition: transform 0.15s;
        }
        .btn-ghost:hover .btn-arrow { transform: translateX(2px); opacity: 1; }

        @media (max-width: 640px) {
          .hero { min-height: 100svh; }
          .hero-video { object-position: 70% center; }
          .hero-overlay {
            background: linear-gradient(
              180deg,
              rgba(20,12,4,0.75) 0%,
              rgba(20,12,4,0.55) 60%,
              rgba(20,12,4,0.2) 100%
            );
          }
        }
      `}</style>
    </section>
  )
}
