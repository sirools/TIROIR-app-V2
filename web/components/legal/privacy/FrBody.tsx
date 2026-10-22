import { LegalSection } from '../../layout/LegalPage'
import { PRIVACY_EMAIL as CONTACT_EMAIL } from '../contacts'

// Politique de confidentialité — texte français, version qui fait foi.
export default function FrBody() {
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
