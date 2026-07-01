// components/landing/Principles.tsx
import React from "react"

type Item = {
  title: string
  desc: string
  icon: string // chemin vers un SVG dans /public/icons
}

const items: Item[] = [
  {
    title: "Valoriser les objets",
    desc: "Remettre de l’ordre dans ce qu’on aime, vendre le pas utilisé.",
    icon: "/icons/valoriser.svg",
  },
  {
    title: "Réduire notre empreinte",
    desc: "Moins d’achats, plus de conscience, plus de réemploi #économie-circulaire.",
    icon: "/icons/empreinte.svg",
  },
  {
    title: "Partager en confiance",
    desc: "Vous choisissez à qui, quand, comment et pour combien de temps.",
    icon: "/icons/confiance.svg",
  },
  {
    title: "Créer des liens locaux",
    desc: "Prêt, entraide, transmission, suivi. Rendre service aux proches.",
    icon: "/icons/liens.svg",
  },
  {
    title: "Penser plus clair",
    desc: "Un esprit léger, un Tiroir bien rangé, un outil de communication utile.",
    icon: "/icons/clair.svg",
  },
]

export default function Principles() {
  return (
    <section className="section" aria-labelledby="principles-title">
      <div className="container">
        <h2 id="principles-title" className="h2" style={{ marginBottom: 20 }}>
          5 idées simples qui nous façonnent
        </h2>

        <div className="grid">
          {items.map((it, i) => (
            <article key={i} className="card item">
              <div className="icon" aria-hidden>
                {/* SVG statique depuis /public/icons */}
                <img
                  src={it.icon}
                  alt=""
                  width={40}
                  height={40}
                  loading="lazy"
                  style={{ display: "block" }}
                />
              </div>
              <h3 className="title">{it.title}</h3>
              <p className="desc">{it.desc}</p>
            </article>
          ))}
        </div>
      </div>

      <style jsx>{`
        .grid {
          display: grid;
          gap: 16px;
          grid-template-columns: 1fr; /* mobile */
        }

        /* tablette */
        @media (min-width: 700px) {
          .grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        /* laptop */
        @media (min-width: 960px) {
          .grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        /* large desktop → 5 colonnes sur une seule ligne */
        @media (min-width: 1360px) {
          .grid {
            grid-template-columns: repeat(5, 1fr);
          }
        }

        .item {
          padding: 28px;
          background: #fff8f1; /* proche de var(--beige-2) */
          border-radius: 24px;
          box-shadow: var(--shadow);
          border: 1px solid rgba(0, 0, 0, 0.06);
          display: flex;
          flex-direction: column;
          gap: 12px;
          min-height: 260px;
          transition: transform 160ms ease, box-shadow 160ms ease;
        }
        .item:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.08);
        }

        .icon {
          width: 64px;
          height: 64px;
          border-radius: 16px;
          background: transparant;
          border: 1px solid var(--orange);
          display: grid;
          place-items: center;
          margin-bottom: 8px;
        }

        .title {
          font-weight: 800;
          color: var(--ink);
          line-height: 1.2;
          margin: 0;
          font-size: clamp(18px, 2.3vw, 22px);
        }

        .desc {
          color: var(--muted);
          margin: 0;
          line-height: 1.6;
          font-size: 15px;
        }
      `}</style>
    </section>
  )
}