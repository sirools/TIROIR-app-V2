// pages/privacy.tsx — Politique de confidentialité / Privacy Policy TiROiR
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'

const LAST_UPDATED = { fr: '25 juin 2026', en: 'June 25, 2026' }
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

// ── Contenu FR ────────────────────────────────────────────────────────────────
function FrBody() {
  return (
    <>
      <h1 className="page-title">Politique de confidentialité</h1>
      <p className="meta">Dernière mise à jour : {LAST_UPDATED.fr}</p>

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
    </>
  )
}

// ── English content ───────────────────────────────────────────────────────────
function EnBody() {
  return (
    <>
      <h1 className="page-title">Privacy Policy</h1>
      <p className="meta">Last updated: {LAST_UPDATED.en}</p>

      <Section title="1. About">
        <p>TiROiR is a personal inventory management mobile app. It lets you photograph your belongings, create AI-enriched entries, and find them easily.</p>
        <p>This policy explains how we collect, use, and protect your personal data in accordance with the General Data Protection Regulation (GDPR) and applicable French law.</p>
      </Section>

      <Section title="2. Data we collect">
        <p>We only collect the data necessary for the service to work properly:</p>
        <ul>
          <li>Email address and password (authentication)</li>
          <li>Photos and images you upload</li>
          <li>Information about your items (title, description, status, location, attributes)</li>
          <li>Anonymized usage data (feature usage)</li>
        </ul>
      </Section>

      <Section title="3. How we use your data">
        <p>Your data is used solely to:</p>
        <ul>
          <li>Provide and improve the app's features</li>
          <li>Generate item descriptions via our AI (on-demand processing only)</li>
          <li>Let you share selections of items through public links</li>
          <li>Send you essential communications (security, changes to the Terms)</li>
        </ul>
        <p><strong>We never sell your data to third parties.</strong></p>
      </Section>

      <Section title="4. Storage and security">
        <p>Your data is stored on secure servers operated by Supabase (European Union). Images are encrypted at rest and in transit. Access is protected by Row Level Security policies.</p>
        <p>Public share links only expose the information you have explicitly chosen to share.</p>
      </Section>

      <Section title="5. Data retention">
        <p>Your data is kept for as long as your account is active. You can request the complete deletion of your account and all your data by contacting us by email.</p>
        <p>Expired share links are automatically deleted after 90 days.</p>
      </Section>

      <Section title="6. Your rights (GDPR)">
        <p>Under the GDPR, you have the following rights:</p>
        <ul>
          <li>Right of access to your data</li>
          <li>Right to rectification</li>
          <li>Right to erasure ("right to be forgotten")</li>
          <li>Right to data portability</li>
          <li>Right to object to processing</li>
        </ul>
        <p>To exercise these rights, contact us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
      </Section>

      <Section title="7. Cookies and trackers">
        <p>The mobile app does not use cookies. The web version only uses technical cookies strictly necessary for authentication to work. No advertising or third-party tracking cookies are set.</p>
      </Section>

      <Section title="8. Third-party services">
        <p>We use the following services:</p>
        <ul>
          <li>Supabase — database and authentication (EU)</li>
          <li>Anthropic Claude — image analysis and value estimation (on-demand processing only)</li>
          <li>Expo / React Native — open-source mobile framework</li>
        </ul>
        <p>Each service is bound by a GDPR-compliant data processing agreement.</p>
      </Section>

      <Section title="9. Minors">
        <p>TiROiR is not intended for people under 13. We do not knowingly collect personal data about children.</p>
      </Section>

      <Section title="10. Changes">
        <p>Any material change to this policy will be notified to you by email and in the app at least 30 days before it takes effect.</p>
      </Section>

      <Section title="Contact">
        <p>For any questions about this policy or your personal data:</p>
        <p><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
      </Section>
    </>
  )
}

export default function PrivacyPage() {
  const { locale } = useRouter()
  const isEn = locale === 'en'

  return (
    <>
      <Head>
        <title>{isEn ? 'Privacy Policy — TiROiR' : 'Politique de confidentialité — TiROiR'}</title>
        <meta
          name="description"
          content={isEn ? 'Privacy policy for the TiROiR app.' : "Politique de confidentialité de l'application TiROiR."}
        />
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
            {isEn ? <EnBody /> : <FrBody />}
          </div>
        </main>

        <footer className="footer">
          <Link href="/" legacyBehavior passHref>
            <a className="footer-link">{isEn ? 'Home' : 'Accueil'}</a>
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
