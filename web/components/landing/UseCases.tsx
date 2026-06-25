import Image from "next/image"

const data = [
  { t:"Collectionneur de vinyles", d:"Catalogue et retrouve ses disques rapidement.", img:"/assets/usecases/vinyles.png" },
  { t:"Famille & sport", d:"Organise sacs, ballons et accessoires.", img:"/assets/usecases/sport.png" },
  { t:"Étudiant & prêts", d:"Sait qui a quoi, et quand le récupérer.", img:"/assets/usecases/etudiant.png" },
  { t:"Un particulier", d:"qui prépare ses ventes d’occasion.", img:"/assets/usecases/particulier.png" },
  { t:"Un professionnel de la mode", d:"qui organise son stock de vêtements.", img:"/assets/usecases/mode.png" },
  { t:"Un vidéaste", d:"qui partage ses listes de matériel à une prod pour un prochain tournage.", img:"/assets/usecases/cinema.png" },
]

function Card({ t, d, img }: any) {
  return (
    <div
      className="card"
      style={{
        borderRadius: 16,
        overflow: "hidden",
        boxShadow: "0 4px 20px rgba(0,0,0,.06)",
        background: "#fff",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Image bord-à-bord */}
      <div style={{ position: "relative", height: 400, flexShrink: 0 }}>
        <Image src={img} alt={t} fill style={{ objectFit: "cover" }} />
      </div>
      {/* Texte */}
      <div style={{ padding: 16 }}>
        <h4 style={{ fontWeight: 700, margin: 0, marginBottom: 8 }}>{t}</h4>
        <p className="p" style={{ margin: 0 }}>{d}</p>
      </div>
    </div>
  )
}

export default function UseCases() {
  return (
    <section id="usecases" className="section">
      <div className="container">
        <h2 className="h2">Cas d’usage</h2>

        {/* Desktop grid */}
        <div className="usecases-desktop">
          {data.map((c) => <Card key={c.t} {...c} />)}
        </div>

        {/* Mobile slider */}
        <div className="usecases-scroll">
          {data.map((c) => (
            <div key={c.t} className="usecases-item">
              <Card {...c} />
            </div>
          ))}
        </div>
      </div>

      <style jsx>{`
        /* === Desktop grid === */
        .usecases-desktop {
          margin-top: 24px;
          display: grid;
          grid-template-columns: repeat(3, 1fr); /* 3 colonnes fixes */
          gap: 24px;
        }
        .usecases-scroll { display: none; }

        /* === Mobile slider === */
        @media (max-width: 900px) {
          .usecases-desktop { display: none; }
          .usecases-scroll {
            display: flex;
            gap: 16px;
            overflow-x: auto;
            margin-top: 16px;
            padding: 4px 4px 8px;
            -webkit-overflow-scrolling: touch;
            scroll-snap-type: x mandatory;
          }
          .usecases-item {
            min-width: 260px; /* largeur fixe en scroll */
            flex: 0 0 auto;
            scroll-snap-align: start;
          }
        }
      `}</style>
    </section>
  )
}