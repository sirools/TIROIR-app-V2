export default function Hero() {
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
          <span className="badge">Disponible sur l'App Store</span>
          <h1 className="h1">Photographiez.<br />Documentez rapidement.</h1>
          <p className="p">
            Tiroir catalogue vos objets en quelques secondes.<br />
            Valeur marché, collections, partage en un lien.
          </p>
          <div className="hero-ctas">
            <a
              className="appstore-btn"
              href="https://apps.apple.com/app/id6751784101"
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
              Télécharger gratuitement
            </a>
            <a className="btn btn-ghost" href="#ranger">Voir comment ça marche</a>
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

        .appstore-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: #fff;
          color: #1a1a1a;
          padding: 13px 24px;
          border-radius: 14px;
          font-size: 15px;
          font-weight: 700;
          text-decoration: none;
          transition: opacity 0.15s, transform 0.15s;
          box-shadow: 0 4px 20px rgba(0,0,0,0.25);
        }
        .appstore-btn:hover { opacity: 0.9; transform: translateY(-1px); }

        .btn-ghost {
          display: inline-flex;
          align-items: center;
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
