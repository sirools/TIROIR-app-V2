import Image from "next/image"

const testimonials = [
  {
    quote: "Grâce à Tiroir, j’ai remis de l’ordre dans mon appartement. Je sais ce que j’ai, et où c’est.",
    name: "Julien",
    role: "early user",
    avatar: "/assets/avatars/julien.png",
  },
  {
    quote: "Parfait pour partager facilement mes jeux avec mes amis.",
    name: "Camille",
    role: "testeuse beta",
    avatar: "/assets/avatars/camille.png",
  },
]

function TestimonialCard({ quote, name, role, avatar }: any) {
  return (
    <div
      className="card"
      style={{
        background: "#fff",
        borderRadius: 20,
        padding: "40px 24px",
        boxShadow: "0 6px 24px rgba(0,0,0,.06)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
      }}
    >
      <p
         style={{
          fontSize: 22,
          fontWeight: 600,
          lineHeight: 1.5,
          marginBottom: 32,
          maxWidth: 480,         // largeur max de la citation
          marginLeft: "auto",    // centre horizontalement
          marginRight: "auto",
        }}
      >
        “{quote}”
      </p>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        <div
          style={{
            position: "relative",
            width: 80,
            height: 80,
            borderRadius: "50%",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          <Image src={avatar} alt={name} fill style={{ objectFit: "cover" }} />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 16 }}>{name}</div>
          <div style={{ fontSize: 14, color: "#666", fontStyle: "italic" }}>{role}</div>
        </div>
      </div>
    </div>
  )
}

export default function Testimonials() {
  return (
    <section
      className="section"
      style={{ background: "#FFF7E7", padding: "72px 0" }}
    >
      <div
        className="container"
        style={{
          display: "grid",
          gap: 32,
          gridTemplateColumns: "1fr 1fr",
        }}
      >
        {testimonials.map((t) => (
          <TestimonialCard key={t.name} {...t} />
        ))}
      </div>

      <style jsx>{`
        @media (max-width: 900px) {
          .container {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  )
}