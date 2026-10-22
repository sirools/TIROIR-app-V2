import Link from 'next/link'
import { LegalSection } from '../../layout/LegalPage'
import { CONTACT_EMAIL, SUPPORT_EMAIL } from '../contacts'

// Conditions Générales d'Utilisation — traduction danoise (la version
// française fait foi).
export default function DaBody() {
  return (
    <>
      <LegalSection title="1. Formål">
        <p>
          Disse generelle brugsbetingelser (»Betingelserne«) regulerer adgangen til og brugen af
          TiROiR-mobilappen og -webstedet (herefter »Tjenesten«), som udgives af TiROiR (herefter
          »vi«, »vores«).
        </p>
        <p>
          Ved at oprette en konto eller bruge Tjenesten accepterer du Betingelserne uden forbehold.
          Hvis du ikke accepterer disse betingelser, må du ikke bruge Tjenesten.
        </p>
      </LegalSection>

      <LegalSection title="2. Beskrivelse af tjenesten">
        <p>
          TiROiR er en app til håndtering af personlig inventar. Den giver brugeren mulighed for at
          fotografere sine genstande, automatisk generere beskrivende registreringer ved hjælp af
          kunstig intelligens, organisere sine genstande i samlinger, anslå deres markedsværdi,
          vedhæfte dokumenter (fakturaer, brugsanvisninger, forsikringsdokumenter) og dele udvalg af
          genstande via offentlige links.
        </p>
      </LegalSection>

      <LegalSection title="3. Oprettelse af konto">
        <p>
          Brug af Tjenesten kræver oprettelse af en konto, der er knyttet til en gyldig e-mailadresse
          og en adgangskode. Du er ansvarlig for at holde dine loginoplysninger fortrolige og for al
          aktivitet, der foretages fra din konto.
        </p>
        <p>
          Tjenesten er beregnet til personer på mindst 13 år. Ved at oprette en konto erklærer du, at
          du opfylder dette alderskrav.
        </p>
      </LegalSection>

      <LegalSection title="4. Premium-abonnement">
        <p>
          TiROiR tilbyder en gratis version med begrænsede brugskvoter (antal genstande, AI-analyser
          og fotos pr. genstand) samt et betalt Premium-abonnement, der ophæver disse begrænsninger.
        </p>
        <p>
          Abonnementer faktureres via Apples App Store til de priser, der vises på købstidspunktet. De
          fornyes automatisk, medmindre de opsiges, hvilket sker direkte i indstillingerne for din
          Apple-konto. Refusion er ikke mulig uden for Apples standardpolitikker.
        </p>
        <p>
          Gratis prøveperioder overgår, når de tilbydes, automatisk til et betalt abonnement ved
          periodens udløb, medmindre de forinden opsiges.
        </p>
      </LegalSection>

      <LegalSection title="5. Brugerindhold">
        <p>
          Du bevarer samtlige immaterielle rettigheder til de fotos, beskrivelser og dokumenter, som
          du uploader til Tjenesten (»Brugerindhold«).
        </p>
        <p>
          Ved at uploade Brugerindhold giver du os en begrænset, ikke-eksklusiv licens, som er
          nødvendig for opbevaring, visning og behandling af dette indhold som led i driften af
          Tjenesten (navnlig analyse ved hjælp af kunstig intelligens og generering af delingslinks,
          som du udtrykkeligt opsætter).
        </p>
        <p>
          Du er eneansvarlig for det Brugerindhold, du uploader. Du forpligter dig til ikke at
          offentliggøre indhold, der er ulovligt, krænker tredjemands rettigheder eller strider mod
          den offentlige orden.
        </p>
      </LegalSection>

      <LegalSection title="6. Delingslinks">
        <p>
          Tjenesten giver dig mulighed for at generere offentlige links, der giver skrivebeskyttet
          adgang til et udvalg af genstande efter eget valg. Du er eneansvarlig for de oplysninger, du
          vælger at gøre tilgængelige via disse links, og for de personer, du deler dem med.
        </p>
      </LegalSection>

      <LegalSection title="7. Kunstig intelligens">
        <p>
          De beskrivelser, kategoriseringer og værdiansættelser, der genereres af kunstig
          intelligens, er udelukkende vejledende. De udgør under ingen omstændigheder en professionel
          vurdering, navnlig hvad angår forsikring, skat eller vurdering af antikviteter. Vi
          garanterer ikke for nøjagtigheden af disse automatisk genererede oplysninger.
        </p>
      </LegalSection>

      <LegalSection title="8. Tjenestens tilgængelighed">
        <p>
          Vi bestræber os på at sikre, at Tjenesten er uafbrudt tilgængelig, uden at garantere, at der
          ikke forekommer afbrydelser, navnlig i forbindelse med vedligeholdelse. Vi kan ikke holdes
          ansvarlige for midlertidige afbrydelser af Tjenesten.
        </p>
      </LegalSection>

      <LegalSection title="9. Ansvarsbegrænsning">
        <p>
          Tjenesten leveres »som den er«. I det omfang gældende lov tillader det, fraskriver vi os
          ethvert ansvar for indirekte tab som følge af brugen af eller manglende mulighed for at
          bruge Tjenesten, herunder tab af data.
        </p>
        <p>
          Vi anbefaler, at du opbevarer en sikkerhedskopi af dine vigtige dokumenter (fakturaer,
          forsikringsdokumentation) uden for Tjenesten.
        </p>
      </LegalSection>

      <LegalSection title="10. Opsigelse">
        <p>
          Du kan til enhver tid slette din konto fra appen eller ved at kontakte os på{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. Sletning af kontoen medfører, at dine
          data slettes i overensstemmelse med vores{' '}
          <Link href="/privacy" legacyBehavior passHref><a>privatlivspolitik</a></Link>.
        </p>
        <p>
          Vi forbeholder os ret til at suspendere eller lukke enhver konto i tilfælde af overtrædelse
          af Betingelserne.
        </p>
      </LegalSection>

      <LegalSection title="11. Ændringer af Betingelserne">
        <p>
          Vi kan til enhver tid ændre Betingelserne. Enhver væsentlig ændring vil blive meddelt dig pr.
          e-mail eller i appen mindst 30 dage før dens ikrafttræden. Fortsat brug af Tjenesten efter
          denne dato betragtes som accept af de nye Betingelser.
        </p>
      </LegalSection>

      <LegalSection title="12. Lovvalg og værneting">
        <p>
          Betingelserne er underlagt fransk ret. Enhver tvist vedrørende deres fortolkning eller
          opfyldelse hører under de franske domstoles eksklusive kompetence, med forbehold for de
          ufravigelige regler, der gælder for forbrugere.
        </p>
      </LegalSection>

      <LegalSection title="Kontakt">
        <p>For spørgsmål vedrørende Betingelserne:</p>
        <p><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
      </LegalSection>
    </>
  )
}
