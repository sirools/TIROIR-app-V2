// pages/cgu.tsx — Conditions Générales d'Utilisation TiROiR
import LegalPage, { LegalSection } from '../components/layout/LegalPage'
import Link from 'next/link'

const LAST_UPDATED = '1 juillet 2026'
const CONTACT_EMAIL = 'hello@tiroir.app'
const SUPPORT_EMAIL = 'support@tiroir.app'

export default function CguPage() {
  return (
    <LegalPage
      title="Conditions Générales d'Utilisation — Tiroir"
      description="Conditions Générales d'Utilisation de l'application Tiroir."
      heading="Conditions Générales d'Utilisation"
      updated={`Dernière mise à jour : ${LAST_UPDATED}`}
    >
      <LegalSection title="1. Objet">
        <p>
          Les présentes Conditions Générales d&apos;Utilisation (« CGU ») régissent l&apos;accès et l&apos;utilisation de
          l&apos;application mobile et du site web TiROiR (ci-après « le Service »), édités par TiROiR
          (ci-après « nous », « notre »).
        </p>
        <p>
          En créant un compte ou en utilisant le Service, vous acceptez sans réserve les présentes CGU.
          Si vous n&apos;acceptez pas ces conditions, vous ne devez pas utiliser le Service.
        </p>
      </LegalSection>

      <LegalSection title="2. Description du service">
        <p>
          TiROiR est une application de gestion d&apos;inventaire personnel. Elle permet à l&apos;utilisateur de
          photographier ses objets, de générer automatiquement des fiches descriptives à l&apos;aide de
          l&apos;intelligence artificielle, d&apos;organiser ses objets en collections, d&apos;estimer leur valeur
          marchande, de joindre des documents (factures, notices, assurances), et de partager des
          sélections d&apos;objets via des liens publics.
        </p>
      </LegalSection>

      <LegalSection title="3. Création de compte">
        <p>
          L&apos;utilisation du Service nécessite la création d&apos;un compte, associé à une adresse e-mail valide
          et un mot de passe. Vous êtes responsable de la confidentialité de vos identifiants et de
          toute activité effectuée depuis votre compte.
        </p>
        <p>
          Le Service est destiné aux personnes âgées d&apos;au moins 13 ans. En créant un compte, vous
          déclarez remplir cette condition d&apos;âge.
        </p>
      </LegalSection>

      <LegalSection title="4. Abonnement Premium">
        <p>
          TiROiR propose une version gratuite avec des quotas d&apos;usage limités (nombre d&apos;objets,
          d&apos;analyses IA et de photos par objet), ainsi qu&apos;un abonnement Premium payant levant ces
          limites.
        </p>
        <p>
          Les abonnements sont facturés via l&apos;App Store d&apos;Apple selon les tarifs affichés au moment de
          l&apos;achat. Ils se renouvellent automatiquement sauf annulation, effectuée directement depuis
          les réglages de votre compte Apple. Aucun remboursement n&apos;est possible en dehors des
          politiques standard d&apos;Apple.
        </p>
        <p>
          Les périodes d&apos;essai gratuit, lorsqu&apos;elles sont proposées, se transforment automatiquement
          en abonnement payant à leur terme, sauf annulation préalable.
        </p>
      </LegalSection>

      <LegalSection title="5. Contenu utilisateur">
        <p>
          Vous conservez l&apos;intégralité des droits de propriété intellectuelle sur les photos,
          descriptions et documents que vous téléversez sur le Service (« Contenu Utilisateur »).
        </p>
        <p>
          En téléversant du Contenu Utilisateur, vous nous accordez une licence limitée, non exclusive,
          nécessaire au stockage, à l&apos;affichage et au traitement de ce contenu dans le cadre du
          fonctionnement du Service (notamment l&apos;analyse par intelligence artificielle et la
          génération de liens de partage que vous configurez explicitement).
        </p>
        <p>
          Vous êtes seul responsable du Contenu Utilisateur que vous téléversez. Vous vous engagez à ne
          pas publier de contenu illicite, portant atteinte aux droits de tiers, ou contraire à l&apos;ordre
          public.
        </p>
      </LegalSection>

      <LegalSection title="6. Liens de partage">
        <p>
          Le Service vous permet de générer des liens publics donnant accès en lecture seule à une
          sélection d&apos;objets de votre choix. Vous êtes seul responsable des informations que vous
          choisissez de rendre accessibles via ces liens, ainsi que des personnes avec qui vous les
          partagez.
        </p>
      </LegalSection>

      <LegalSection title="7. Intelligence artificielle">
        <p>
          Les descriptions, catégorisations et estimations de valeur générées par l&apos;intelligence
          artificielle sont fournies à titre indicatif uniquement. Elles ne constituent en aucun cas une
          expertise professionnelle, notamment en matière d&apos;assurance, de fiscalité ou d&apos;évaluation
          d&apos;antiquités. Nous ne garantissons pas l&apos;exactitude de ces informations générées
          automatiquement.
        </p>
      </LegalSection>

      <LegalSection title="8. Disponibilité du service">
        <p>
          Nous nous efforçons d&apos;assurer une disponibilité continue du Service, sans garantie
          d&apos;absence d&apos;interruption, notamment pour des opérations de maintenance. Nous ne saurions être
          tenus responsables des interruptions temporaires du Service.
        </p>
      </LegalSection>

      <LegalSection title="9. Limitation de responsabilité">
        <p>
          Le Service est fourni « en l&apos;état ». Dans la limite permise par la loi applicable, nous
          déclinons toute responsabilité pour les dommages indirects résultant de l&apos;utilisation ou de
          l&apos;impossibilité d&apos;utiliser le Service, y compris la perte de données.
        </p>
        <p>
          Nous vous recommandons de conserver une copie de sauvegarde de vos documents importants
          (factures, justificatifs d&apos;assurance) en dehors du Service.
        </p>
      </LegalSection>

      <LegalSection title="10. Résiliation">
        <p>
          Vous pouvez supprimer votre compte à tout moment depuis l&apos;application ou en nous contactant à{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. La suppression du compte entraîne
          l&apos;effacement de vos données conformément à notre{' '}
          <Link href="/privacy" legacyBehavior passHref><a>politique de confidentialité</a></Link>.
        </p>
        <p>
          Nous nous réservons le droit de suspendre ou résilier tout compte en cas de violation des
          présentes CGU.
        </p>
      </LegalSection>

      <LegalSection title="11. Modifications des CGU">
        <p>
          Nous pouvons modifier les présentes CGU à tout moment. Toute modification substantielle vous
          sera notifiée par e-mail ou dans l&apos;application au moins 30 jours avant son entrée en vigueur.
          La poursuite de l&apos;utilisation du Service après cette date vaut acceptation des nouvelles CGU.
        </p>
      </LegalSection>

      <LegalSection title="12. Droit applicable et juridiction">
        <p>
          Les présentes CGU sont régies par le droit français. Tout litige relatif à leur interprétation
          ou à leur exécution relève de la compétence exclusive des tribunaux français, sous réserve des
          dispositions d&apos;ordre public applicables aux consommateurs.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>Pour toute question relative aux présentes CGU :</p>
        <p><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
      </LegalSection>
    </LegalPage>
  )
}
