import { LegalSection } from '../../layout/LegalPage'
import { PRIVACY_EMAIL as CONTACT_EMAIL } from '../contacts'

// Politique de confidentialité — traduction anglaise (la version française fait foi).
export default function EnBody() {
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
