const STEPS = [
  {
    label: 'Scan',
    emoji: '📷',
    href: '#scan',
    bg: '#FDE8D0',
    text: '#7A3B10',
    tagBg: '#F9C9A0',
    pitch: 'Une photo suffit. L\'IA génère le titre, la description et les caractéristiques en quelques secondes.',
  },
  {
    label: 'Rangement',
    emoji: '🗂️',
    href: '#rangement',
    bg: '#DCEFD8',
    text: '#1E4D1A',
    tagBg: '#B8E0B2',
    pitch: 'Organisez vos objets en collections thématiques. Retrouvez n\'importe quoi en deux secondes.',
  },
  {
    label: 'Centralisation',
    emoji: '🌐',
    href: '#centraliser',
    bg: '#E0EAF8',
    text: '#1A2F5E',
    tagBg: '#B8D0F0',
    pitch: 'Accédez à votre inventaire depuis n\'importe quel appareil. Tout est synchronisé en temps réel.',
  },
  {
    label: 'Évaluation',
    emoji: '💰',
    href: '#evaluer',
    bg: '#FFF3CC',
    text: '#5E3D00',
    tagBg: '#FFE080',
    pitch: 'L\'IA estime la valeur marché de chaque objet. Fourchette de prix, sources, tendances.',
  },
  {
    label: 'Partage',
    emoji: '🔗',
    href: '#partager',
    bg: '#EDE0F8',
    text: '#3D1A5E',
    tagBg: '#D4B8F0',
    pitch: 'Envoyez une fiche ou une collection entière via un lien. Aucune installation requise.',
  },
  {
    label: 'Vente',
    emoji: '🏷️',
    href: '#vente',
    bg: '#FCE0E8',
    text: '#5E1A2F',
    tagBg: '#F4B0C8',
    pitch: 'Vendez au bon prix avec les données du marché. Partagez la fiche directement à l\'acheteur.',
  },
]

export default function FlowSteps() {
  return (
    <section className="flow-section">
      {/* En-tête de section */}
      <div className="flow-header">
        <span className="flow-eyebrow">Votre parcours avec Tiroir</span>
        <h2 className="flow-title">De la photo à la vente,<br />chaque objet compte.</h2>
        <p className="flow-sub">
          Tiroir transforme le chaos en clarté. Photographiez, organisez, évaluez et partagez
          vos affaires — en quelques secondes, depuis votre téléphone.
        </p>
      </div>

      {/* Blocs */}
      <div className="flow-grid">
        {STEPS.map((step) => (
          <a key={step.label} className="flow-card" href={step.href} style={{ background: step.bg }}>
            <div className="flow-card-top">
              <span className="flow-tag" style={{ background: step.tagBg, color: step.text }}>
                <span className="flow-emoji">{step.emoji}</span>
                {step.label}
              </span>
              <span className="flow-arrow" style={{ color: step.text }}>→</span>
            </div>
            <p className="flow-pitch" style={{ color: step.text }}>{step.pitch}</p>
          </a>
        ))}
      </div>

      <style jsx>{`
        .flow-section {
          background: #fff;
          padding: 72px 24px 64px;
          border-bottom: 1px solid rgba(0,0,0,0.06);
        }

        /* Header */
        .flow-header {
          max-width: 640px;
          margin: 0 auto 48px;
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .flow-eyebrow {
          display: inline-block;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          color: #F26900;
        }
        .flow-title {
          font-size: clamp(28px, 4vw, 42px);
          font-weight: 900;
          line-height: 1.1;
          letter-spacing: -0.8px;
          color: #121212;
          margin: 0;
        }
        .flow-sub {
          font-size: 17px;
          line-height: 1.6;
          color: #555;
          margin: 0;
        }

        /* Grille */
        .flow-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
          max-width: 1000px;
          margin: 0 auto;
        }

        /* Carte */
        .flow-card {
          display: flex;
          flex-direction: column;
          gap: 14px;
          padding: 20px;
          border-radius: 18px;
          text-decoration: none;
          transition: transform 0.18s ease, box-shadow 0.18s ease;
        }
        .flow-card:hover {
          transform: translateY(-3px);
          box-shadow: 0 12px 32px rgba(0,0,0,0.10);
        }

        .flow-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .flow-tag {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 12px 5px 8px;
          border-radius: 100px;
          font-size: 13px;
          font-weight: 700;
        }
        .flow-emoji {
          font-size: 16px;
          line-height: 1;
        }
        .flow-arrow {
          font-size: 18px;
          font-weight: 600;
          opacity: 0.5;
          transition: transform 0.15s ease, opacity 0.15s ease;
          flex-shrink: 0;
        }
        .flow-card:hover .flow-arrow {
          transform: translateX(4px);
          opacity: 1;
        }

        .flow-pitch {
          font-size: 14px;
          line-height: 1.55;
          margin: 0;
          opacity: 0.82;
          font-weight: 500;
        }

        /* Responsive */
        @media (max-width: 720px) {
          .flow-grid { grid-template-columns: repeat(2, 1fr); }
          .flow-section { padding: 52px 16px 48px; }
        }
        @media (max-width: 440px) {
          .flow-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </section>
  )
}
