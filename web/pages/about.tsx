// pages/about.tsx — Page « À propos » : qui est derrière Tiroir, ce que je cherche,
// et comment me joindre. Le contenu est un premier jet à relire/personnaliser.
// Textes dans web/locales/about, en cinq langues.
import Head from 'next/head'
import HeaderTiroirWeb from '../components/layout/HeaderTiroirWeb'
import FooterTiroirWeb from '../components/layout/FooterTiroirWeb'
import { localeLinks } from '../components/layout/LocaleLinks'
import { FOUNDER, CONTACT_EMAIL, agendaHref, hasAgenda } from '../lib/founderLinks'
import { fill, useCopy } from '../locales'

// Portrait du fondateur (carré 512 px, recadré visage). Laissé vide → monogramme typographique.
const PHOTO_URL = '/assets/clement-ougier.jpg'

// Émojis des cartes « ce que je cherche », dans l'ordre de t.looking.items.
const LOOKING_EMOJIS = ['🧭', '👥', '🤝', '🧪']

export default function About() {
  const { t: { about: t }, locale } = useCopy()
  const agendaCta = hasAgenda() ? t.agendaCta : t.agendaCtaMail

  return (
    <>
      <Head>
        <title>{t.meta.title}</title>
        <meta name="description" content={t.meta.description} />
        {localeLinks(locale, '/about')}
      </Head>

      <HeaderTiroirWeb />

      <main>
        {/* ── Hero ───────────────────────────────────────────────────────── */}
        <section className="about-hero">
          <div className="container">
            <div className="about-hero__grid">
              <div>
                <span className="badge">{t.hero.badge}</span>
                <h1 className="h1" style={{ marginBottom: 16 }}>
                  {t.hero.title}
                </h1>
                <p className="p" style={{ fontSize: 18, maxWidth: 560 }}>
                  {t.hero.p1}
                </p>
                <p className="p" style={{ maxWidth: 560 }}>
                  {t.hero.p2}
                </p>
                <div className="about-hero__ctas">
                  <a className="btn btn-primary" href={agendaHref(t.heroSubject)}>
                    {agendaCta}
                  </a>
                  <a
                    className="btn btn-secondary"
                    href={FOUNDER.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t.hero.linkedin}
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
                  <span>{t.role}</span>
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
            <h2 className="h2">{t.why.title}</h2>
            {t.why.paragraphs.map(text => (
              <p className="p" key={text}>
                {text}
              </p>
            ))}
          </div>
        </section>

        {/* ── Ce que je cherche ──────────────────────────────────────────── */}
        <section className="section about-looking">
          <div className="container">
            <h2 className="h2" style={{ marginBottom: 8 }}>
              {t.looking.title}
            </h2>
            <p className="p" style={{ maxWidth: 640, marginBottom: 28 }}>
              {t.looking.intro}
            </p>
            <div className="about-cards">
              {t.looking.items.map((item, i) => (
                <div className="card about-card" key={item.title}>
                  <span className="about-card__emoji" aria-hidden="true">
                    {LOOKING_EMOJIS[i]}
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
                {t.agenda.title}
              </h2>
              <p className="about-agenda__p">
                {t.agenda.body}
              </p>
              <div className="about-agenda__ctas">
                <a
                  className="btn about-agenda__btn"
                  href={agendaHref(t.agendaSubject)}
                >
                  {agendaCta}
                </a>
                <a className="about-agenda__mail" href={`mailto:${CONTACT_EMAIL}`}>
                  {fill(t.agenda.mail, { email: CONTACT_EMAIL })}
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ── Réseaux ────────────────────────────────────────────────────── */}
        <section className="section" id="contact">
          <div className="container about-prose">
            <h2 className="h2" style={{ marginBottom: 16 }}>
              {t.contact.title}
            </h2>
            <div className="about-links">
              <a
                className="about-link"
                href={FOUNDER.linkedin}
                target="_blank"
                rel="noopener noreferrer"
              >
                <strong>LinkedIn</strong>
                <span>{t.contact.linkedin}</span>
              </a>
              <a
                className="about-link"
                href={FOUNDER.blog}
                target="_blank"
                rel="noopener noreferrer"
              >
                <strong>{FOUNDER.blogLabel}</strong>
                <span>{t.contact.blog}</span>
              </a>
              <a className="about-link" href={`mailto:${CONTACT_EMAIL}`}>
                <strong>{t.contact.emailLabel}</strong>
                <span>{fill(t.contact.email, { email: CONTACT_EMAIL })}</span>
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
