import { LegalSection } from '../../layout/LegalPage'
import { PRIVACY_EMAIL as CONTACT_EMAIL } from '../contacts'

// Politique de confidentialité — traduction danoise (la version française fait foi).
export default function DaBody() {
  return (
    <>
      <LegalSection title="1. Om TiROiR">
        <p>TiROiR er en mobilapp til håndtering af personlig inventar. Den giver dig mulighed for at fotografere dine genstande, oprette registreringer beriget med AI og nemt finde dem igen.</p>
        <p>Denne politik beskriver, hvordan vi indsamler, bruger og beskytter dine personoplysninger i overensstemmelse med databeskyttelsesforordningen (GDPR) og gældende fransk lovgivning.</p>
      </LegalSection>

      <LegalSection title="2. Indsamlede oplysninger">
        <p>Vi indsamler kun de oplysninger, der er nødvendige for, at tjenesten fungerer korrekt:</p>
        <ul>
          <li>E-mailadresse og adgangskode (godkendelse)</li>
          <li>Fotos og billeder, som du uploader</li>
          <li>Oplysninger om dine genstande (titel, beskrivelse, status, placering, egenskaber)</li>
          <li>Anonymiserede brugsdata (brug af funktionerne)</li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Brug af oplysningerne">
        <p>Dine oplysninger bruges udelukkende til at:</p>
        <ul>
          <li>Levere og forbedre appens funktioner</li>
          <li>Generere beskrivelser af genstande via vores AI (behandling kun efter anmodning)</li>
          <li>Give dig mulighed for at dele udvalg af genstande via offentlige links</li>
          <li>Sende dig væsentlige meddelelser (sikkerhed, ændringer af brugsbetingelserne)</li>
        </ul>
        <p><strong>Vi sælger aldrig dine oplysninger til tredjeparter.</strong></p>
      </LegalSection>

      <LegalSection title="4. Opbevaring og sikkerhed">
        <p>Dine oplysninger opbevares på sikre servere, der drives af Supabase (Den Europæiske Union). Billeder krypteres både i hvile og under overførsel. Adgangen er beskyttet af sikkerhedspolitikker på rækkeniveau (Row Level Security).</p>
        <p>Offentlige delingslinks viser kun de oplysninger, du udtrykkeligt har valgt at dele.</p>
      </LegalSection>

      <LegalSection title="5. Opbevaringsperiode">
        <p>Dine oplysninger opbevares, så længe din konto er aktiv. Du kan anmode om fuldstændig sletning af din konto og alle dine oplysninger ved at kontakte os pr. e-mail.</p>
        <p>Udløbne delingslinks slettes automatisk efter 90 dage.</p>
      </LegalSection>

      <LegalSection title="6. Dine rettigheder (GDPR)">
        <p>I henhold til GDPR har du følgende rettigheder:</p>
        <ul>
          <li>Ret til indsigt i dine oplysninger</li>
          <li>Ret til berigtigelse</li>
          <li>Ret til sletning (»retten til at blive glemt«)</li>
          <li>Ret til dataportabilitet</li>
          <li>Ret til indsigelse mod behandling</li>
        </ul>
        <p>For at udøve disse rettigheder kan du kontakte os på <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
      </LegalSection>

      <LegalSection title="7. Cookies og sporingsteknologier">
        <p>Mobilappen bruger ikke cookies. Webversionen bruger kun tekniske cookies, der er strengt nødvendige for, at godkendelsen fungerer. Der placeres ingen reklamecookies eller sporingscookies fra tredjeparter.</p>
      </LegalSection>

      <LegalSection title="8. Tredjepartstjenester">
        <p>Vi bruger følgende tjenester:</p>
        <ul>
          <li>Supabase — database og godkendelse (EU)</li>
          <li>Anthropic Claude — billedanalyse og værdiansættelse (behandling kun efter anmodning)</li>
          <li>Expo / React Native — open source-framework til mobilapps</li>
        </ul>
        <p>Hver tjeneste er bundet af en databehandleraftale, der overholder GDPR.</p>
      </LegalSection>

      <LegalSection title="9. Mindreårige">
        <p>TiROiR er ikke beregnet til personer under 13 år. Vi indsamler ikke bevidst personoplysninger om børn.</p>
      </LegalSection>

      <LegalSection title="10. Ændringer">
        <p>Enhver væsentlig ændring af denne politik vil blive meddelt dig pr. e-mail og i appen mindst 30 dage før dens ikrafttræden.</p>
      </LegalSection>

      <LegalSection title="Kontakt">
        <p>For spørgsmål vedrørende denne politik eller dine personoplysninger:</p>
        <p><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
      </LegalSection>
    </>
  )
}
