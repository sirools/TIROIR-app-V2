import Link from 'next/link'
import { LegalSection } from '../../layout/LegalPage'
import { BUSINESS_EMAIL, BUSINESS_MAILTO, BUSINESS_SUBJECT, CONTACT_EMAIL, SUPPORT_EMAIL } from '../contacts'

// Conditions Générales d'Utilisation — traduction allemande (la version
// française fait foi).
export default function DeBody() {
  return (
    <>
      <LegalSection title="1. Gegenstand">
        <p>
          Diese Allgemeinen Nutzungsbedingungen (&bdquo;Nutzungsbedingungen&ldquo;) regeln den Zugang zu
          und die Nutzung der mobilen Anwendung und der Website TiROiR (nachfolgend &bdquo;der
          Dienst&ldquo;), herausgegeben von TiROiR (nachfolgend &bdquo;wir&ldquo;, &bdquo;unser&ldquo;).
        </p>
        <p>
          Indem Sie ein Konto erstellen oder den Dienst nutzen, akzeptieren Sie diese
          Nutzungsbedingungen vorbehaltlos. Wenn Sie diese Bedingungen nicht akzeptieren, dürfen Sie
          den Dienst nicht nutzen.
        </p>
      </LegalSection>

      <LegalSection title="2. Beschreibung des Dienstes">
        <p>
          TiROiR ist eine Anwendung zur Verwaltung des persönlichen Inventars. Sie ermöglicht es dem
          Nutzer, seine Gegenstände zu fotografieren, mithilfe künstlicher Intelligenz automatisch
          beschreibende Einträge zu erstellen, seine Gegenstände in Sammlungen zu organisieren, ihren
          Marktwert zu schätzen, Dokumente (Rechnungen, Bedienungsanleitungen, Versicherungsunterlagen)
          beizufügen und Auswahlen von Gegenständen über öffentliche Links zu teilen.
        </p>
      </LegalSection>

      <LegalSection title="3. Kontoerstellung">
        <p>
          Die Nutzung des Dienstes erfordert die Erstellung eines Kontos, das mit einer gültigen
          E-Mail-Adresse und einem Passwort verknüpft ist. Sie sind für die Vertraulichkeit Ihrer
          Zugangsdaten sowie für alle über Ihr Konto vorgenommenen Aktivitäten verantwortlich.
        </p>
        <p>
          Der Dienst richtet sich an Personen, die mindestens 13 Jahre alt sind. Mit der Erstellung
          eines Kontos erklären Sie, diese Altersvoraussetzung zu erfüllen.
        </p>
      </LegalSection>

      <LegalSection title="4. Premium-Abonnement">
        <p>
          TiROiR bietet eine kostenlose Version mit begrenzten Nutzungskontingenten (Anzahl der
          Gegenstände, KI-Analysen und Fotos pro Gegenstand) sowie ein kostenpflichtiges
          Premium-Abonnement, das diese Beschränkungen aufhebt.
        </p>
        <p>
          Abonnements werden über den App Store von Apple zu den zum Zeitpunkt des Kaufs angezeigten
          Preisen abgerechnet. Sie verlängern sich automatisch, sofern sie nicht gekündigt werden; die
          Kündigung erfolgt direkt in den Einstellungen Ihres Apple-Kontos. Eine Erstattung ist
          außerhalb der Standardrichtlinien von Apple nicht möglich.
        </p>
        <p>
          Kostenlose Testzeiträume gehen, sofern sie angeboten werden, an ihrem Ende automatisch in ein
          kostenpflichtiges Abonnement über, sofern sie nicht vorher gekündigt werden.
        </p>
      </LegalSection>

      <LegalSection title="4a. Käufe auf tiroir.app (Abonnements und KI-Credits)">
        <p>
          Premium- und Pro-Abonnements sowie KI-Credit-Pakete können auch auf tiroir.app per Karte,
          Apple Pay oder Google Pay gekauft werden. Die Zahlung wickelt Stripe ab; TiROiR hat nie Zugriff auf
          Kartendaten. Die Preise enthalten die französische Mehrwertsteuer von 20 %; zu jeder Zahlung wird
          eine Rechnung per E-Mail versandt.
        </p>
        <p>
          Ein auf der Website gekauftes Abonnement verlängert sich automatisch zu jedem monatlichen oder
          jährlichen Termin. Es wird unter „Mein Konto“ verwaltet (Tarifwechsel, Karte, Rechnungen,
          Kündigung); eine Kündigung wird zum Ende des bereits bezahlten Zeitraums wirksam. Gekaufte
          KI-Credits verfallen nicht.
        </p>
        <p>
          <strong>Widerrufsrecht.</strong> Der Zugang zum Abonnement oder zu den Credits wird unmittelbar nach
          der Zahlung bereitgestellt. Vor der Zahlung kreuzt der Kunde ein Kästchen an, mit dem er diesen
          sofortigen Zugang verlangt und bestätigt, sein 14-tägiges Widerrufsrecht zu verlieren (Artikel
          L221-28 des französischen Verbrauchergesetzbuchs). Diese Zustimmung wird mit Datum gespeichert und
          auf der Rechnung vermerkt.
        </p>
      </LegalSection>

      <LegalSection title="5. Pro- und Business-Tarife">
        <p>
          Die Tarife Pro und Business richten sich an gewerbliche Nutzer. Inhalt und Preise werden auf
          der Preisseite dargestellt.
        </p>
        <p>
          Alle Anliegen zu diesen Tarifen (Informationen, Angebot, Abschluss, Rechnungsstellung) erfolgen
          per E-Mail an <a href={BUSINESS_MAILTO}>{BUSINESS_EMAIL}</a>, mit dem Betreff
          „{BUSINESS_SUBJECT}“.
        </p>
      </LegalSection>

      <LegalSection title="6. Nutzerinhalte">
        <p>
          Sie behalten sämtliche Rechte des geistigen Eigentums an den Fotos, Beschreibungen und
          Dokumenten, die Sie in den Dienst hochladen (&bdquo;Nutzerinhalte&ldquo;).
        </p>
        <p>
          Mit dem Hochladen von Nutzerinhalten räumen Sie uns eine beschränkte, nicht ausschließliche
          Lizenz ein, die für die Speicherung, Anzeige und Verarbeitung dieser Inhalte im Rahmen des
          Betriebs des Dienstes erforderlich ist (insbesondere für die Analyse durch künstliche
          Intelligenz und die Erstellung von Freigabelinks, die Sie ausdrücklich einrichten).
        </p>
        <p>
          Sie sind allein für die von Ihnen hochgeladenen Nutzerinhalte verantwortlich. Sie verpflichten
          sich, keine Inhalte zu veröffentlichen, die rechtswidrig sind, Rechte Dritter verletzen oder
          gegen die öffentliche Ordnung verstoßen.
        </p>
      </LegalSection>

      <LegalSection title="7. Freigabelinks">
        <p>
          Der Dienst ermöglicht es Ihnen, öffentliche Links zu erstellen, die einen Nur-Lese-Zugriff
          auf eine Auswahl von Gegenständen Ihrer Wahl gewähren. Sie sind allein verantwortlich für die
          Informationen, die Sie über diese Links zugänglich machen, sowie für die Personen, mit denen
          Sie sie teilen.
        </p>
      </LegalSection>

      <LegalSection title="8. Künstliche Intelligenz">
        <p>
          Die von der künstlichen Intelligenz erstellten Beschreibungen, Kategorisierungen und
          Wertschätzungen dienen ausschließlich der Orientierung. Sie stellen in keinem Fall ein
          professionelles Gutachten dar, insbesondere nicht in Versicherungs- oder Steuerfragen oder
          bei der Bewertung von Antiquitäten. Wir übernehmen keine Gewähr für die Richtigkeit dieser
          automatisch erstellten Informationen.
        </p>
      </LegalSection>

      <LegalSection title="9. Verfügbarkeit des Dienstes">
        <p>
          Wir bemühen uns um eine durchgehende Verfügbarkeit des Dienstes, ohne zu garantieren, dass
          es zu keinen Unterbrechungen kommt, insbesondere aufgrund von Wartungsarbeiten. Wir haften
          nicht für vorübergehende Unterbrechungen des Dienstes.
        </p>
      </LegalSection>

      <LegalSection title="10. Haftungsbeschränkung">
        <p>
          Der Dienst wird &bdquo;wie besehen&ldquo; bereitgestellt. Soweit nach geltendem Recht
          zulässig, lehnen wir jede Haftung für mittelbare Schäden ab, die sich aus der Nutzung oder
          der Unmöglichkeit der Nutzung des Dienstes ergeben, einschließlich des Verlusts von Daten.
        </p>
        <p>
          Wir empfehlen Ihnen, eine Sicherungskopie Ihrer wichtigen Dokumente (Rechnungen,
          Versicherungsnachweise) außerhalb des Dienstes aufzubewahren.
        </p>
      </LegalSection>

      <LegalSection title="11. Kündigung">
        <p>
          Sie können Ihr Konto jederzeit in der App oder durch eine Nachricht an{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> löschen. Die Löschung des Kontos führt
          zur Löschung Ihrer Daten gemäß unserer{' '}
          <Link href="/privacy" legacyBehavior passHref><a>Datenschutzerklärung</a></Link>.
        </p>
        <p>
          Wir behalten uns das Recht vor, jedes Konto bei einem Verstoß gegen diese
          Nutzungsbedingungen zu sperren oder zu kündigen.
        </p>
      </LegalSection>

      <LegalSection title="12. Änderungen der Nutzungsbedingungen">
        <p>
          Wir können diese Nutzungsbedingungen jederzeit ändern. Jede wesentliche Änderung wird Ihnen
          mindestens 30 Tage vor ihrem Inkrafttreten per E-Mail oder in der App mitgeteilt. Die
          weitere Nutzung des Dienstes nach diesem Datum gilt als Annahme der neuen
          Nutzungsbedingungen.
        </p>
      </LegalSection>

      <LegalSection title="13. Anwendbares Recht und Gerichtsstand">
        <p>
          Diese Nutzungsbedingungen unterliegen französischem Recht. Für alle Streitigkeiten über ihre
          Auslegung oder Durchführung sind ausschließlich die französischen Gerichte zuständig,
          vorbehaltlich der für Verbraucher geltenden zwingenden Vorschriften.
        </p>
      </LegalSection>

      <LegalSection title="Kontakt">
        <p>Bei Fragen zu diesen Nutzungsbedingungen:</p>
        <p><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
        <p>Für die Tarife Pro und Business: <a href={BUSINESS_MAILTO}>{BUSINESS_EMAIL}</a></p>
      </LegalSection>
    </>
  )
}
