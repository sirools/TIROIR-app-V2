// pages/privacy.tsx — Politique de confidentialité / Privacy Policy TiROiR
import LegalPage, { LegalSection } from '../components/layout/LegalPage'
import { useRouter } from 'next/router'

const LAST_UPDATED = { fr: '25 juin 2026', en: 'June 25, 2026' }
const CONTACT_EMAIL = 'privacy@tiroir.app'

// ── Contenu FR ────────────────────────────────────────────────────────────────
function FrBody() {
  return (
    <>

      <LegalSection title="1. À propos">
        <p>TiROiR est une application mobile de gestion d'inventaire personnel. Elle vous permet de photographier vos objets, de créer des fiches enrichies par l'IA, et de les retrouver facilement.</p>
        <p>Cette politique décrit comment nous collectons, utilisons et protégeons vos données personnelles conformément au Règlement Général sur la Protection des Données (RGPD) et à la législation française applicable.</p>
      </LegalSection>

      <LegalSection title="2. Données collectées">
        <p>Nous collectons uniquement les données nécessaires au bon fonctionnement du service :</p>
        <ul>
          <li>Adresse e-mail et mot de passe (authentification)</li>
          <li>Photos et images que vous téléversez</li>
          <li>Informations sur vos objets (titre, description, statut, emplacement, attributs)</li>
          <li>Données de navigation anonymisées (usage des fonctionnalités)</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Utilisation des données">
        <p>Vos données sont utilisées exclusivement pour :</p>
        <ul>
          <li>Fournir et améliorer les fonctionnalités de l'application</li>
          <li>Générer des descriptions d'objets via notre IA (traitement à la demande uniquement)</li>
          <li>Vous permettre de partager des sélections d'objets via des liens publics</li>
          <li>Vous envoyer des communications essentielles (sécurité, modifications des CGU)</li>
        </ul>
        <p><strong>Nous ne vendons jamais vos données à des tiers.</strong></p>
      </LegalSection>

      <LegalSection title="4. Stockage et sécurité">
        <p>Vos données sont stockées sur des serveurs sécurisés opérés par Supabase (Union Européenne). Les images sont chiffrées au repos et en transit. Les accès sont protégés par des politiques de sécurité au niveau des lignes (Row Level Security).</p>
        <p>Les liens de partage publics n'exposent que les informations que vous avez explicitement choisies de partager.</p>
      </LegalSection>

      <LegalSection title="5. Conservation des données">
        <p>Vos données sont conservées aussi longtemps que votre compte est actif. Vous pouvez demander la suppression complète de votre compte et de toutes vos données en nous contactant par e-mail.</p>
        <p>Les liens de partage expirés sont automatiquement supprimés après 90 jours.</p>
      </LegalSection>

      <LegalSection title="6. Vos droits (RGPD)">
        <p>Conformément au RGPD, vous disposez des droits suivants :</p>
        <ul>
          <li>Droit d'accès à vos données</li>
          <li>Droit de rectification</li>
          <li>Droit à l'effacement ("droit à l'oubli")</li>
          <li>Droit à la portabilité des données</li>
          <li>Droit d'opposition au traitement</li>
        </ul>
        <p>Pour exercer ces droits, contactez-nous à <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
      </LegalSection>

      <LegalSection title="7. Cookies et traceurs">
        <p>L'application mobile n'utilise pas de cookies. La version web utilise uniquement des cookies techniques strictement nécessaires au fonctionnement de l'authentification. Aucun cookie publicitaire ou de tracking tiers n'est déposé.</p>
      </LegalSection>

      <LegalSection title="8. Services tiers">
        <p>Nous utilisons les services suivants :</p>
        <ul>
          <li>Supabase — base de données et authentification (UE)</li>
          <li>Anthropic Claude — analyse d'images et estimation de valeur (traitement à la demande uniquement)</li>
          <li>Expo / React Native — framework mobile open source</li>
        </ul>
        <p>Chaque service est lié par un contrat de traitement des données conforme au RGPD.</p>
      </LegalSection>

      <LegalSection title="9. Mineurs">
        <p>TiROiR n'est pas destiné aux personnes de moins de 13 ans. Nous ne collectons pas sciemment de données personnelles concernant des enfants.</p>
      </LegalSection>

      <LegalSection title="10. Modifications">
        <p>Toute modification substantielle de cette politique vous sera notifiée par e-mail et dans l'application au moins 30 jours avant son entrée en vigueur.</p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>Pour toute question relative à cette politique ou à vos données personnelles :</p>
        <p><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
      </LegalSection>
    </>
  )
}

// ── English content ───────────────────────────────────────────────────────────
function EnBody() {
  return (
    <>

      <LegalSection title="1. About">
        <p>TiROiR is a personal inventory management mobile app. It lets you photograph your belongings, create AI-enriched entries, and find them easily.</p>
        <p>This policy explains how we collect, use, and protect your personal data in accordance with the General Data Protection Regulation (GDPR) and applicable French law.</p>
      </LegalSection>

      <LegalSection title="2. Data we collect">
        <p>We only collect the data necessary for the service to work properly:</p>
        <ul>
          <li>Email address and password (authentication)</li>
          <li>Photos and images you upload</li>
          <li>Information about your items (title, description, status, location, attributes)</li>
          <li>Anonymized usage data (feature usage)</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. How we use your data">
        <p>Your data is used solely to:</p>
        <ul>
          <li>Provide and improve the app's features</li>
          <li>Generate item descriptions via our AI (on-demand processing only)</li>
          <li>Let you share selections of items through public links</li>
          <li>Send you essential communications (security, changes to the Terms)</li>
        </ul>
        <p><strong>We never sell your data to third parties.</strong></p>
      </LegalSection>

      <LegalSection title="4. Storage and security">
        <p>Your data is stored on secure servers operated by Supabase (European Union). Images are encrypted at rest and in transit. Access is protected by Row Level Security policies.</p>
        <p>Public share links only expose the information you have explicitly chosen to share.</p>
      </LegalSection>

      <LegalSection title="5. Data retention">
        <p>Your data is kept for as long as your account is active. You can request the complete deletion of your account and all your data by contacting us by email.</p>
        <p>Expired share links are automatically deleted after 90 days.</p>
      </LegalSection>

      <LegalSection title="6. Your rights (GDPR)">
        <p>Under the GDPR, you have the following rights:</p>
        <ul>
          <li>Right of access to your data</li>
          <li>Right to rectification</li>
          <li>Right to erasure ("right to be forgotten")</li>
          <li>Right to data portability</li>
          <li>Right to object to processing</li>
        </ul>
        <p>To exercise these rights, contact us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
      </LegalSection>

      <LegalSection title="7. Cookies and trackers">
        <p>The mobile app does not use cookies. The web version only uses technical cookies strictly necessary for authentication to work. No advertising or third-party tracking cookies are set.</p>
      </LegalSection>

      <LegalSection title="8. Third-party services">
        <p>We use the following services:</p>
        <ul>
          <li>Supabase — database and authentication (EU)</li>
          <li>Anthropic Claude — image analysis and value estimation (on-demand processing only)</li>
          <li>Expo / React Native — open-source mobile framework</li>
        </ul>
        <p>Each service is bound by a GDPR-compliant data processing agreement.</p>
      </LegalSection>

      <LegalSection title="9. Minors">
        <p>TiROiR is not intended for people under 13. We do not knowingly collect personal data about children.</p>
      </LegalSection>

      <LegalSection title="10. Changes">
        <p>Any material change to this policy will be notified to you by email and in the app at least 30 days before it takes effect.</p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>For any questions about this policy or your personal data:</p>
        <p><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
      </LegalSection>
    </>
  )
}

export default function PrivacyPage() {
  const { locale } = useRouter()
  const isEn = locale === 'en'
  return (
    <LegalPage
      title={isEn ? 'Privacy Policy — Tiroir' : 'Politique de confidentialité — Tiroir'}
      description={isEn ? 'Privacy policy for the Tiroir app.' : "Politique de confidentialité de l'application Tiroir."}
      heading={isEn ? 'Privacy Policy' : 'Politique de confidentialité'}
      updated={isEn ? `Last updated: ${LAST_UPDATED.en}` : `Dernière mise à jour : ${LAST_UPDATED.fr}`}
    >
      {isEn ? <EnBody /> : <FrBody />}
    </LegalPage>
  )
}
