import Image from "next/image"

const features = [
  { t: "Inventaire visuel", d: "Ajoutez vos objets en un instant, avec photo et détails.", img: "/screens/feature-inventory.png" },
  { t: "Collections & lieux", d: "Classez par tiroir, pièce ou thème. Comme dans la vraie vie—mais plus simple.", img: "/screens/feature-collections.png" },
  { t: "Statuts intelligents", d: "À vendre, prêté, à réparer : suivez l’état de vos objets.", img: "/screens/feature-status.png" },
  { t: "Partage sécurisé", d: "Envoyez un lien à un proche. Avec ou sans mot de passe.", img: "/screens/feature-share.png" },
  { t: "Recherche instantanée", d: "Retrouvez ce que vous cherchez sans effort et très rapidement.", img: "/screens/feature-search.png" },

]

export default function Features() {
  return (
    <section id="features" className="section" style={{background:"var(--beige-2)"}}>
      <div className="container">
        <h2 className="h2">Fonctionnalités clés</h2>
        <div className="grid-cards" style={{marginTop:16}}>
          {features.map((f) => (
            <article key={f.t} className="card" style={{padding:16, display:"grid", gap:12, gridTemplateColumns:"1fr", alignItems:"center"}}>
              <div>
                <h3 style={{fontWeight:700}}>{f.t}</h3>
                <p className="p" style={{marginTop:6}}>{f.d}</p>
              </div>
              <div className="mock" style={{position:"relative", height:400}}>
                <Image src={f.img} alt={f.t} fill style={{objectFit:"cover"}} />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}