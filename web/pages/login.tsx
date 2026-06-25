// apps/next/pages/login.tsx
import Link from "next/link"

export default function LoginDisabled() {
  return (
    <main style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 480, textAlign: "center", background: "white", padding: "40px 32px", borderRadius: 16, boxShadow: "0 6px 20px rgba(0,0,0,0.08)" }}>
        <h1 style={{ fontSize: "clamp(22px, 3vw, 28px)", marginBottom: 16 }}>🚧 En construction</h1>
        <p style={{ color: "#666", lineHeight: 1.6, marginBottom: 24 }}>
          L’espace de connexion n’est pas encore disponible.  
          Il arrivera avec la sortie publique de Tiroir&nbsp;V1.  
          En attendant, vous pouvez rejoindre la beta !
        </p>
        <Link href="/" passHref legacyBehavior>
          <a className="btn btn-primary">← Retour à l’accueil</a>
        </Link>
      </div>
    </main>
  )
}