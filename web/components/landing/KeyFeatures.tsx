// apps/next/components/landing/KeyFeatures.tsx
import Image from 'next/image'

type Feature = {
  id: string
  kicker: string
  title: string
  description: string
  image: { src: string; alt: string; width?: number; height?: number }
  /** image à 'left' ou 'right' sur DESKTOP (le texte occupe l'autre colonne) */
  align?: 'left' | 'right'
}

type Props = {
  title?: string
  features: Feature[]
  /** couleur des applats */
  plateColor?: string
}

export default function KeyFeatures({
  title = 'Fonctionnalités clés',
  features,
  plateColor = '#F6EDE0',
}: Props) {
  return (
    <section className="kf">
      <div className="wrap">
        <h2 className="kf-title">{title}</h2>

        <div className="rows">
          {features.map((f, i) => {
            const align: 'left' | 'right' = f.align ?? (i % 2 === 0 ? 'right' : 'left')
            return (
              <article
                key={f.id}
                className={`row ${align === 'left' ? 'align-left' : 'align-right'}`}
              >
                {/* Applat beige arrondi plein container */}
                <div className="plate" aria-hidden />

                {/* Colonne IMAGE */}
                <div className="col image">
                  <div className="phone">
                    <Image
                      src={f.image.src}
                      alt={f.image.alt}
                      width={f.image.width ?? 420}
                      height={f.image.height ?? 840}
                      priority={i === 0}
                    />
                  </div>
                </div>

                {/* Colonne TEXTE */}
                <div className="col text">
                  <div className="text-inner">
                    <div className="kicker">{f.kicker}</div>
                    <h3 className="h3">{f.title}</h3>
                    <p className="desc">{f.description}</p>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      </div>

      <style jsx>{`
        .kf {
          --plate: ${plateColor};
          --title: #111;
          --text: #444;
          --accent: #f26900;
          padding: 56px 0 16px;
        }

        .wrap {
          max-width: 1440px;
          margin: 0 auto;
          padding: 0 16px;
        }

        .kf-title {
          font-size: 32px;
          line-height: 1.2;
          margin: 0 0 28px;
          color: var(--title);
        }

        .rows {
          display: grid;
          gap: 48px;
        }

        /* ---- LIGNE (2 colonnes) ---- */
        .row {
          position: relative;
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-areas: 'image text';
          align-items: center;
          min-height: 420px;
          padding: 48px 32px;
        }
        .align-right {
          grid-template-areas: 'text image';
        }
        .align-left {
          grid-template-areas: 'image text';
        }

        /* Desktop : plaque plus compacte et centrée verticalement */
        .plate {
          position: absolute;
          left: 16px;
          right: 16px;
          top: 50%;
          height: 60%;                /* ajuste 70–85% selon ton goût */
          transform: translateY(-50%);
          background: var(--plate);
          background-color: #FFF7E7;
          border-radius: 32px;
          z-index: 0;
        }

        /* Mobile */
        @media (max-width: 900px) {
          .row {
            grid-template-columns: 1fr;
            grid-template-areas:
              'text'
              'image';
            min-height: unset;
            padding: 16px;
          }
          .plate {
            left: 8px;
            right: 8px;
            top: 0;
            height: auto;             /* la plaque suit la hauteur du contenu en pile */
            transform: none;
            border-radius: 16px;
          }
          .text-inner {
            max-width: 640px;
            padding: 4px 8px;
          }
          .phone :global(img) {
            width: min(420px, 92vw);  /* évite les débordements */
          }
        }

        .col {
          position: relative;
          z-index: 1;
          background: transparent;
        }
        .image {
          grid-area: image;
          display: grid;
          place-items: center;
        }
        .text {
          grid-area: text;
          display: grid;
          place-items: center;
        }

        .text-inner {
          max-width: 460px;
          text-align: center;
          padding: 8px 12px;
        }
        .kicker {
          color: var(--accent);
          font-weight: 700;
          margin-bottom: 6px;
        }
        .h3 {
          margin: 0 0 8px;
          font-size: 22px;
          line-height: 1.25;
          // color: var(--accent); /* titres en orange */
        }
        .desc {
          margin: 0;
          color: var(--text);
          line-height: 1.55;
        }

        .phone :global(img) {
          width: min(420px, 100%);
          height: auto;
          display: block;
          filter: drop-shadow(0 10px 30px rgba(0, 0, 0, 0.12));
        }

        /* ---- Mobile ---- */
        @media (max-width: 900px) {
          .kf {
            padding: 40px 0 8px;
          }
          .kf-title {
            font-size: 26px;
          }

          .row {
            grid-template-columns: 1fr;
            grid-template-areas:
              'text'
              'image';
            min-height: unset;
            padding: 16px;
          }
          .plate {
            inset: 0;
            border-radius: 16px;
          }
          .text-inner {
            max-width: 640px;
          }
        }
      `}</style>
    </section>
  )
}