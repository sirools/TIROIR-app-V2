// apps/next/components/landing/Hero.tsx
import Image from 'next/image'

type Props = { onJoin?: () => void }

export default function Hero({ onJoin }: Props) {
  return (
    <section className="hero">
      <div className="container hero-grid">
        {/* Colonne texte */}
        <div className="hero-copy">
          <span className="badge">L’outil idéal pour votre stock</span>
          <h1 className="h1">Tout ce que vous possédez, <br />rangé dans un seul endroit digital.</h1>
          <p className="p" style={{ marginTop: 12 }}>
            Tiroir est votre mémoire augmentée : ajoutez, organisez et partagez vos objets simplement,
            depuis votre poche.
          </p>

          <div className="hero-ctas">
            <button className="btn btn-primary" onClick={onJoin}>Rejoindre la beta</button>
            <a className="btn btn-secondary" href="#features">Voir les fonctionnalités</a>
          </div>
        </div>

        {/* Colonne visuel */}
        <div className="hero-visual">
          <Image
            src="/screens/tiroir-mock-collection.png"
            alt="Aperçu Tiroir"
            fill
            priority
            // tailles servies selon le viewport (évite les grosses images inutiles)
            sizes="(min-width:1200px) 520px, (min-width:900px) 42vw, 88vw"
            // facultatif: améliore la netteté
            quality={90}
          />
        </div>
      </div>
    </section>
  )
}