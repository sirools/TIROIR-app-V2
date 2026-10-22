import { LegalSection } from '../../layout/LegalPage'
import { PRIVACY_EMAIL as CONTACT_EMAIL } from '../contacts'

// Politique de confidentialité — traduction allemande (la version française fait foi).
export default function DeBody() {
  return (
    <>
      <LegalSection title="1. Über TiROiR">
        <p>TiROiR ist eine mobile App zur Verwaltung des persönlichen Inventars. Sie ermöglicht es Ihnen, Ihre Gegenstände zu fotografieren, KI-gestützte Einträge zu erstellen und sie leicht wiederzufinden.</p>
        <p>Diese Erklärung beschreibt, wie wir Ihre personenbezogenen Daten gemäß der Datenschutz-Grundverordnung (DSGVO) und dem anwendbaren französischen Recht erheben, verwenden und schützen.</p>
      </LegalSection>

      <LegalSection title="2. Erhobene Daten">
        <p>Wir erheben nur die Daten, die für das ordnungsgemäße Funktionieren des Dienstes erforderlich sind:</p>
        <ul>
          <li>E-Mail-Adresse und Passwort (Authentifizierung)</li>
          <li>Fotos und Bilder, die Sie hochladen</li>
          <li>Informationen zu Ihren Gegenständen (Titel, Beschreibung, Status, Standort, Merkmale)</li>
          <li>Anonymisierte Nutzungsdaten (Nutzung der Funktionen)</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Verwendung der Daten">
        <p>Ihre Daten werden ausschließlich verwendet, um:</p>
        <ul>
          <li>die Funktionen der App bereitzustellen und zu verbessern</li>
          <li>mithilfe unserer KI Beschreibungen von Gegenständen zu erstellen (Verarbeitung nur auf Anfrage)</li>
          <li>Ihnen das Teilen von Auswahlen von Gegenständen über öffentliche Links zu ermöglichen</li>
          <li>Ihnen wesentliche Mitteilungen zu senden (Sicherheit, Änderungen der Nutzungsbedingungen)</li>
        </ul>
        <p><strong>Wir verkaufen Ihre Daten niemals an Dritte.</strong></p>
      </LegalSection>

      <LegalSection title="4. Speicherung und Sicherheit">
        <p>Ihre Daten werden auf sicheren Servern gespeichert, die von Supabase (Europäische Union) betrieben werden. Bilder werden im Ruhezustand und bei der Übertragung verschlüsselt. Der Zugriff ist durch Sicherheitsrichtlinien auf Zeilenebene (Row Level Security) geschützt.</p>
        <p>Öffentliche Freigabelinks zeigen nur die Informationen, die Sie ausdrücklich zum Teilen ausgewählt haben.</p>
      </LegalSection>

      <LegalSection title="5. Speicherdauer">
        <p>Ihre Daten werden so lange aufbewahrt, wie Ihr Konto aktiv ist. Sie können die vollständige Löschung Ihres Kontos und aller Ihrer Daten beantragen, indem Sie uns per E-Mail kontaktieren.</p>
        <p>Abgelaufene Freigabelinks werden nach 90 Tagen automatisch gelöscht.</p>
      </LegalSection>

      <LegalSection title="6. Ihre Rechte (DSGVO)">
        <p>Gemäß der DSGVO haben Sie folgende Rechte:</p>
        <ul>
          <li>Recht auf Auskunft über Ihre Daten</li>
          <li>Recht auf Berichtigung</li>
          <li>Recht auf Löschung (&bdquo;Recht auf Vergessenwerden&ldquo;)</li>
          <li>Recht auf Datenübertragbarkeit</li>
          <li>Recht auf Widerspruch gegen die Verarbeitung</li>
        </ul>
        <p>Um diese Rechte auszuüben, kontaktieren Sie uns unter <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
      </LegalSection>

      <LegalSection title="7. Cookies und Tracker">
        <p>Die mobile App verwendet keine Cookies. Die Webversion verwendet ausschließlich technische Cookies, die für die Funktion der Authentifizierung unbedingt erforderlich sind. Es werden keine Werbe- oder Tracking-Cookies von Drittanbietern gesetzt.</p>
      </LegalSection>

      <LegalSection title="8. Dienste von Drittanbietern">
        <p>Wir nutzen folgende Dienste:</p>
        <ul>
          <li>Supabase — Datenbank und Authentifizierung (EU)</li>
          <li>Anthropic Claude — Bildanalyse und Wertschätzung (Verarbeitung nur auf Anfrage)</li>
          <li>Expo / React Native — Open-Source-Framework für mobile Apps</li>
        </ul>
        <p>Jeder Dienst ist durch einen DSGVO-konformen Auftragsverarbeitungsvertrag gebunden.</p>
      </LegalSection>

      <LegalSection title="9. Minderjährige">
        <p>TiROiR richtet sich nicht an Personen unter 13 Jahren. Wir erheben wissentlich keine personenbezogenen Daten von Kindern.</p>
      </LegalSection>

      <LegalSection title="10. Änderungen">
        <p>Jede wesentliche Änderung dieser Erklärung wird Ihnen mindestens 30 Tage vor ihrem Inkrafttreten per E-Mail und in der App mitgeteilt.</p>
      </LegalSection>

      <LegalSection title="Kontakt">
        <p>Bei Fragen zu dieser Erklärung oder zu Ihren personenbezogenen Daten:</p>
        <p><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
      </LegalSection>
    </>
  )
}
