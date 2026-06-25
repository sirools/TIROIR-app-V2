// pages/privacy.tsx — Politique de confidentialité TiROiR
import Head from 'next/head'
import Link from 'next/link'

const LAST_UPDATED = '25 juin 2026'
const CONTACT_EMAIL = 'privacy@tiroir.app'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="section">
      <h2 className="section-title">{title}</h2>
      {children}
      <style jsx>{`
        .section { margin-bottom: 32px; }
        .section-title {
          font-size: 17px; font-weight: 700; color: #1A1612;
          margin-bottom: 12px;
        }
      `}</style>
    </section>
  )
}

export default function PrivacyPage() {
  return (
    <>
      <Head>
        <title>Politique de confidentialité — TiROiR</title>
        <meta name="description" content="Politique de confidentialité de l'application TiROiR." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="root">
        <header className="header">
          <div className="header-inner">
            <Link href="/" legacyBehavior passHref>
              <a className="logo">
                <div className="logo-box">T</div>
                <strong className="logo-text">TiROiR</strong>
              </a>
            </Link>
          </div>
        </header>

        <main className="main">
          <div className="prose">
            <h1 className="page-title">Politique de confidentialité</h1>
            <p className="meta">Dernière mise à jour : {LAST_UPDATED}</p>

            <Section title="1. À propos">
              <p>TiROiR est une application mobile de gestion d'inventaire personnel. Elle vous permet de photographier vos objets, de créer des fiches enrichies par l'IA, et de les retrouver facilement.</p>
              <p>Cette politique décrit comment nous collectons, utilisons et protégeons vos données personnelles conformément au Règlement Général sur la Protection des Données (RGPD) et à la législation française applicable.</p>
            </Section>

            <Section title="2. Données collectées">
              <p>Nous collectons uniquement les données nécessaires au bon fonctionnement du service :</p>
              <ul>
                <li>Adresse e-mail et mot de passe (authentification)</li>
                <li>Photos et images que vous téléversez</li>
                <li>Informations sur vos objets (titre, description, statut, emplacement, attributs)</li>
                <li>Données de navigation anonymisées (usage des fonctionnalités)</li>
              </ul>
            </Section>

            <Section title="3. Utilisation des données">
              <p>Vos données sont utilisées exclusivement pour :</p>
              <ul>
                <li>Fournir et améliorer les fonctionnalités de l'application</li>
                <li>Générer des descriptions d'objets via notre IA (traitement à la demande uniquement)</li>
                <li>Vous permettre de partager des sélections d'objets via des liens publics</li>
                <li>Vous envoyer des communications essentielles (sécurité, modifications des CGU)</li>
              </ul>
              <p><strong>Nous ne vendons jamais vos données à des tiers.</strong></p>
            </Section>

            <Section title="4. Stockage et sécurité">
              <p>Vos données sont stockées sur des serveurs sécurisés opérés par Supabase (Union Européenne). Les images sont chiffrées au repos et en transit. Les accès sont protégés par des politiques de sécurité au niveau des lignes (Row Level Security).</p>
              <p>Les liens de partage publics n'exposent que les informations que vous avez explicitement choisies de partager.</p>
            </Section>

            <Section title="5. Conservation des données">
              <p>Vos données sont conservées aussi longtemps que votre compte est actif. Vous pouvez demander la suppression complète de votre compte et de toutes vos données en nous contactant par e-mail.</p>
              <p>Les liens de partage expirés sont automatiquement supprimés après 90 jours.</p>
            </Section>

            <Section title="6. Vos droits (RGPD)">
              <p>Conformément au RGPD, vous disposez des droits suivants :</p>
              <ul>
                <li>Droit d'accès à vos données</li>
                <li>Droit de rectification</li>
                <li>Droit à l'effacement ("droit à l'oubli")</li>
                <li>Droit à la portabilité des données</li>
                <li>Droit d'opposition au traitement</li>
              </ul>
              <p>Pour exercer ces droits, contactez-nous à <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
            </Section>

            <Section title="7. Cookies et traceurs">
              <p>L'application mobile n'utilise pas de cookies. La version web utilise uniquement des cookies techniques strictement nécessaires au fonctionnement de l'authentification. Aucun cookie publicitaire ou de tracking tiers n'est déposé.</p>
            </Section>

            <Section title="8. Services tiers">
              <p>Nous utilisons les services suivants :</p>
              <ul>
                <li>Supabase — base de données et authentification (UE)</li>
                <li>Anthropic Claude — analyse d'images et estimation de valeur (traitement à la demande uniquement)</li>
                <li>Expo / React Native — framework mobile open source</li>
              </ul>
              <p>Chaque service est lié par un contrat de traitement des données conforme au RGPD.</p>
            </Section>

            <Section title="9. Mineurs">
              <p>TiROiR n'est pas destiné aux personnes de moins de 13 ans. Nous ne collectons pas sciemment de données personnelles concernant des enfants.</p>
            </Section>

            <Section title="10. Modifications">
              <p>Toute modification substantielle de cette politique vous sera notifiée par e-mail et dans l'application au moins 30 jours avant son entrée en vigueur.</p>
            </Section>

            <Section title="Contact">
              <p>Pour toute question relative à cette politique ou à vos données personnelles :</p>
              <p><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
            </Section>
          </div>
        </main>

        <footer className="footer">
          <Link href="/" legacyBehavior passHref>
            <a className="footer-link">Accueil</a>
          </Link>
          <span className="footer-sep">·</span>
          <span className="footer-copy">© 2026 TiROiR</span>
        </footer>
      </div>

      <style jsx>{`
        * { box-sizing: border-box; }
        .root {
          min-height: 100vh;
          background: #F7F3EE;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          color: #1A1612;
          display: flex; flex-direction: column;
        }
        .header {
          background: #fff;
          border-bottom: 1px solid #E8E2DA;
        }
        .header-inner {
          max-width: 800px; margin: 0 auto;
          padding: 0 20px; height: 60px;
          display: flex; align-items: center;
        }
        .logo { display: flex; align-items: center; gap: 8px; text-decoration: none; }
        .logo-box {
          width: 30px; height: 30px; border-radius: 8px;
          background: #2D5016; color: white;
          display: grid; place-items: center; font-weight: 800;
        }
        .logo-text { font-weight: 800; font-size: 18px; color: #1A1612; }

        .main { flex: 1; max-width: 800px; margin: 0 auto; padding: 48px 20px; width: 100%; }
        .prose { display: flex; flex-direction: column; }
        .page-title { font-size: 32px; font-weight: 800; color: #1A1612; margin-bottom: 8px; }
        .meta { font-size: 13px; color: #A89F96; margin-bottom: 40px; }

        .prose p { font-size: 15px; color: #6B6158; line-height: 1.7; margin-bottom: 12px; }
        .prose ul { padding-left: 20px; margin-bottom: 12px; }
        .prose li { font-size: 15px; color: #6B6158; line-height: 1.7; margin-bottom: 4px; }
        .prose strong { color: #1A1612; }
        .prose a { color: #2D5016; text-decoration: underline; }
        .prose a:hover { color: #1e3a0f; }

        .footer {
          display: flex; align-items: center; justify-content: center;
          gap: 8px; padding: 20px;
          border-top: 1px solid #E8E2DA;
        }
        .footer-link { font-size: 12px; color: #A89F96; text-decoration: underline; }
        .footer-sep { font-size: 12px; color: #A89F96; }
        .footer-copy { font-size: 12px; color: #A89F96; }
      `}</style>
    </>
  )
}
