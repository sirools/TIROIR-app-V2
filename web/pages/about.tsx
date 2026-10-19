// pages/about.tsx — Page « À propos » : qui est derrière Tiroir, ce que je cherche,
// et comment me joindre. Le contenu est un premier jet à relire/personnaliser.
import Head from 'next/head'
import HeaderTiroirWeb from '../components/layout/HeaderTiroirWeb'
import FooterTiroirWeb from '../components/layout/FooterTiroirWeb'
import { FOUNDER, CONTACT_EMAIL, agendaHref, hasAgenda } from '../lib/founderLinks'

// Portrait du fondateur (carré 512 px, recadré visage). Laissé vide → monogramme typographique.
const PHOTO_URL = '/assets/clement-ougier.jpg'

const LOOKING_FOR = [
  {
    emoji: '🧭',
    title: 'Des conseils, pas des injonctions',
    body:
      "Produit, pricing, growth, levée ou pas de levée : j'avance vite mais seul, et j'ai besoin de gens qui ont déjà fait le chemin pour challenger mes angles morts.",
  },
  {
    emoji: '👥',
    title: 'Des personnes qui connaissent le terrain',
    body:
      "Seconde main, friperies, brocanteurs, assurance, déménagement, succession : si vous vivez un de ces mondes au quotidien, votre regard vaut dix études de marché.",
  },
  {
    emoji: '🤝',
    title: "Peut-être un ou une associée",
    body:
      "Je conçois et je code le produit. Le jour où quelqu'un a envie de porter le business, la distribution ou la tech avec moi, la porte est grande ouverte.",
  },
  {
    emoji: '🧪',
    title: 'Des utilisateurs exigeants',
    body:
      "Des gens qui ont trop d'objets, qui testent l'app pour de vrai et qui me disent sans filtre ce qui coince. C'est ce qui fait avancer Tiroir le plus vite.",
  },
]

export default function About() {
  const agendaCta = hasAgenda() ? 'Réserver un créneau' : "M'écrire pour caler un créneau"

  return (
    <>
      <Head>
        <title>À propos — Tiroir</title>
        <meta
          name="description"
          content="Qui est derrière Tiroir : Clément Ougier, fondateur solo. Le projet, ce que je cherche (conseils, associés, testeurs) et comment me joindre."
        />
      </Head>

      <HeaderTiroirWeb />

      <main>
        {/* ── Hero ───────────────────────────────────────────────────────── */}
        <section className="about-hero">
          <div className="container">
            <div className="about-hero__grid">
              <div>
                <span className="badge">À propos</span>
                <h1 className="h1" style={{ marginBottom: 16 }}>
                  Bonjour, moi c’est Clément.
                </h1>
                <p className="p" style={{ fontSize: 18, maxWidth: 560 }}>
                  Je suis product designer, et Tiroir est mon projet — conçu, dessiné et
                  développé en solo. L’idée est simple : vous photographiez un objet,
                  l’IA rédige sa fiche, et votre inventaire se tient enfin tout seul.
                </p>
                <p className="p" style={{ maxWidth: 560 }}>
                  Je construis en public, je me trompe en public, et j’apprends beaucoup
                  plus vite quand je parle à des gens qu’en restant devant mon écran.
                  C’est tout l’objet de cette page.
                </p>
                <div className="about-hero__ctas">
                  <a className="btn btn-primary" href={agendaHref('Parler de Tiroir')}>
                    {agendaCta}
                  </a>
                  <a
                    className="btn btn-secondary"
                    href={FOUNDER.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Me suivre sur LinkedIn
                  </a>
                </div>
              </div>

              <div className="about-portrait">
                {PHOTO_URL ? (
                  <img
                    className="about-portrait__img"
                    src={PHOTO_URL}
                    alt={`Portrait de ${FOUNDER.name}, fondateur de Tiroir`}
                    width={168}
                    height={168}
                  />
                ) : (
                  <div className="about-portrait__mono" aria-hidden="true">
                    CO
                  </div>
                )}
                <div className="about-portrait__id">
                  <strong>{FOUNDER.name}</strong>
                  <span>{FOUNDER.role}</span>
                  <a
                    className="about-portrait__site"
                    href={FOUNDER.website}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {FOUNDER.websiteLabel}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Pourquoi ───────────────────────────────────────────────────── */}
        <section className="section">
          <div className="container about-prose">
            <h2 className="h2">Pourquoi Tiroir</h2>
            <p className="p">
              Tout le monde possède des centaines d’objets et personne ne sait vraiment ce
              qu’il a. On rachète ce qu’on avait déjà, on brade ce qui valait quelque chose,
              on ne retrouve pas la facture au moment où il faudrait. Faire un inventaire,
              c’est utile à tout le monde — et suffisamment pénible pour que personne ne le
              fasse.
            </p>
            <p className="p">
              Tiroir supprime l’étape pénible. Une photo, et la fiche est écrite : catégorie,
              matière, état, estimation de valeur. Le reste — collections, partage d’un lien,
              suivi de ce qui est vendu ou rangé — sert juste à ce que l’inventaire vive
              au-delà du jour où on l’a créé.
            </p>
            <p className="p">
              L’app est disponible sur l’App Store et Google Play. Elle progresse chaque
              semaine, avec les retours de celles et ceux qui l’utilisent pour de vrai.
            </p>
          </div>
        </section>

        {/* ── Ce que je cherche ──────────────────────────────────────────── */}
        <section className="section about-looking">
          <div className="container">
            <h2 className="h2" style={{ marginBottom: 8 }}>
              Ce que je cherche
            </h2>
            <p className="p" style={{ maxWidth: 640, marginBottom: 28 }}>
              Je ne cherche pas (encore) à lever des fonds. Je cherche des gens : pour me
              conseiller, me contredire, m’ouvrir une porte, ou simplement partager une
              expérience que je n’ai pas.
            </p>
            <div className="about-cards">
              {LOOKING_FOR.map(item => (
                <div className="card about-card" key={item.title}>
                  <span className="about-card__emoji" aria-hidden="true">
                    {item.emoji}
                  </span>
                  <h3 className="about-card__title">{item.title}</h3>
                  <p className="about-card__body">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Agenda ─────────────────────────────────────────────────────── */}
        <section className="section" id="agenda">
          <div className="container">
            <div className="about-agenda">
              <h2 className="h2" style={{ color: 'white', marginBottom: 8 }}>
                Mon agenda est ouvert
              </h2>
              <p className="about-agenda__p">
                30 minutes, en visio, sans ordre du jour imposé. Que vous ayez un conseil,
                une question, une critique ou juste de la curiosité pour le projet : prenez
                un créneau, il est pour vous.
              </p>
              <div className="about-agenda__ctas">
                <a
                  className="btn about-agenda__btn"
                  href={agendaHref('Un créneau pour parler de Tiroir')}
                >
                  {agendaCta}
                </a>
                <a className="about-agenda__mail" href={`mailto:${CONTACT_EMAIL}`}>
                  ou m’écrire à {CONTACT_EMAIL}
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ── Réseaux ────────────────────────────────────────────────────── */}
        <section className="section" id="contact">
          <div className="container about-prose">
            <h2 className="h2" style={{ marginBottom: 16 }}>
              Où me trouver
            </h2>
            <div className="about-links">
              <a
                className="about-link"
                href={FOUNDER.linkedin}
                target="_blank"
                rel="noopener noreferrer"
              >
                <strong>LinkedIn</strong>
                <span>Le journal de bord du projet, semaine après semaine.</span>
              </a>
              <a
                className="about-link"
                href={FOUNDER.blog}
                target="_blank"
                rel="noopener noreferrer"
              >
                <strong>{FOUNDER.blogLabel}</strong>
                <span>cofondateurauchomage.fr — les coulisses, sans filtre.</span>
              </a>
              <a className="about-link" href={`mailto:${CONTACT_EMAIL}`}>
                <strong>E-mail</strong>
                <span>{CONTACT_EMAIL} — je réponds à tout le monde.</span>
              </a>
            </div>
          </div>
        </section>
      </main>

      <FooterTiroirWeb />

      <style jsx>{`
        .about-hero {
          padding: clamp(40px, 6vw, 72px) 0;
          background: radial-gradient(65% 65% at 85% 0%, rgba(242, 105, 0, 0.1), transparent),
            var(--beige);
        }
        .about-hero__grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 32px;
          align-items: center;
        }
        @media (min-width: 900px) {
          .about-hero__grid { grid-template-columns: 1.25fr 0.75fr; }
        }
        .about-hero__ctas { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 24px; }

        /* Portrait */
        .about-portrait {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          padding: 28px;
          background: #fff;
          border: 1px solid rgba(0, 0, 0, 0.06);
          border-radius: 20px;
          box-shadow: var(--shadow);
          justify-self: center;
          max-width: 320px;
          width: 100%;
        }
        .about-portrait__img {
          width: 168px;
          height: 168px;
          object-fit: cover;
          border-radius: 50%;
          display: block;
        }
        .about-portrait__mono {
          display: grid;
          place-items: center;
          width: 168px;
          height: 168px;
          border-radius: 50%;
          background: linear-gradient(145deg, #ffd7b5, var(--orange));
          color: #fff;
          font-size: 58px;
          font-weight: 800;
          letter-spacing: 1px;
        }
        .about-portrait__id {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          text-align: center;
        }
        .about-portrait__id strong { font-size: 17px; color: var(--ink); }
        .about-portrait__id span { font-size: 14px; line-height: 1.45; color: var(--muted); }
        .about-portrait__site {
          margin-top: 4px;
          font-size: 14px;
          font-weight: 600;
          color: var(--orange);
          text-decoration: none;
        }
        .about-portrait__site:hover { text-decoration: underline; }

        /* Prose */
        .about-prose { max-width: 760px; }

        /* Cartes « ce que je cherche » */
        .about-looking { background: var(--beige-2); }
        .about-cards {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }
        @media (min-width: 800px) {
          .about-cards { grid-template-columns: 1fr 1fr; }
        }
        .about-card { padding: 24px; }
        .about-card__emoji { font-size: 24px; line-height: 1; }
        .about-card__title {
          margin: 12px 0 6px;
          font-size: 17px;
          font-weight: 700;
          color: var(--ink);
        }
        .about-card__body { margin: 0; font-size: 15px; line-height: 1.6; color: var(--muted); }

        /* Bandeau agenda */
        .about-agenda {
          background: var(--orange);
          border-radius: 20px;
          padding: clamp(32px, 5vw, 64px) 24px;
          text-align: center;
          box-shadow: var(--shadow);
        }
        .about-agenda__p {
          max-width: 560px;
          margin: 0 auto;
          color: rgba(255, 255, 255, 0.92);
          font-size: 16px;
          line-height: 1.6;
        }
        .about-agenda__ctas {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          margin-top: 24px;
        }
        .about-agenda__btn {
          background: #fff;
          color: var(--ink);
          text-decoration: none;
        }
        .about-agenda__btn:hover { background: #f7f2ec; }
        .about-agenda__mail {
          color: rgba(255, 255, 255, 0.9);
          font-size: 14px;
          text-decoration: underline;
        }

        /* Liens réseaux */
        .about-links { display: grid; grid-template-columns: 1fr; gap: 12px; }
        .about-link {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 18px 20px;
          border: 1px solid rgba(0, 0, 0, 0.1);
          border-radius: 14px;
          background: #fff;
          text-decoration: none;
          transition: border-color 0.15s, transform 0.15s;
        }
        .about-link:hover { border-color: var(--orange); transform: translateY(-1px); }
        .about-link strong { font-size: 15px; color: var(--ink); }
        .about-link span { font-size: 14px; color: var(--muted); }
      `}</style>
    </>
  )
}
