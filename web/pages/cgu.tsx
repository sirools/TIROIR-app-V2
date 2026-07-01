// pages/cgu.tsx — Conditions Générales d'Utilisation TiROiR
import Head from 'next/head'
import Link from 'next/link'
import HeaderTiroirWeb from '../components/layout/HeaderTiroirWeb'

const LAST_UPDATED = '1 juillet 2026'
const CONTACT_EMAIL = 'hello@tiroir.app'
const SUPPORT_EMAIL = 'support@tiroir.app'

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

export default function CguPage() {
  return (
    <>
      <Head>
        <title>Conditions Générales d&apos;Utilisation — TiROiR</title>
        <meta name="description" content="Conditions Générales d'Utilisation de l'application TiROiR." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="root">
        <HeaderTiroirWeb />

        <main className="main">
          <div className="prose">
            <h1 className="page-title">Conditions Générales d&apos;Utilisation</h1>
            <p className="meta">Dernière mise à jour : {LAST_UPDATED}</p>

            <Section title="1. Objet">
              <p>
                Les présentes Conditions Générales d&apos;Utilisation (« CGU ») régissent l&apos;accès et l&apos;utilisation de
                l&apos;application mobile et du site web TiROiR (ci-après « le Service »), édités par TiROiR
                (ci-après « nous », « notre »).
              </p>
              <p>
                En créant un compte ou en utilisant le Service, vous acceptez sans réserve les présentes CGU.
                Si vous n&apos;acceptez pas ces conditions, vous ne devez pas utiliser le Service.
              </p>
            </Section>

            <Section title="2. Description du service">
              <p>
                TiROiR est une application de gestion d&apos;inventaire personnel. Elle permet à l&apos;utilisateur de
                photographier ses objets, de générer automatiquement des fiches descriptives à l&apos;aide de
                l&apos;intelligence artificielle, d&apos;organiser ses objets en collections, d&apos;estimer leur valeur
                marchande, de joindre des documents (factures, notices, assurances), et de partager des
                sélections d&apos;objets via des liens publics.
              </p>
            </Section>

            <Section title="3. Création de compte">
              <p>
                L&apos;utilisation du Service nécessite la création d&apos;un compte, associé à une adresse e-mail valide
                et un mot de passe. Vous êtes responsable de la confidentialité de vos identifiants et de
                toute activité effectuée depuis votre compte.
              </p>
              <p>
                Le Service est destiné aux personnes âgées d&apos;au moins 13 ans. En créant un compte, vous
                déclarez remplir cette condition d&apos;âge.
              </p>
            </Section>

            <Section title="4. Abonnement Premium">
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
            </Section>

            <Section title="5. Contenu utilisateur">
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
            </Section>

            <Section title="6. Liens de partage">
              <p>
                Le Service vous permet de générer des liens publics donnant accès en lecture seule à une
                sélection d&apos;objets de votre choix. Vous êtes seul responsable des informations que vous
                choisissez de rendre accessibles via ces liens, ainsi que des personnes avec qui vous les
                partagez.
              </p>
            </Section>

            <Section title="7. Intelligence artificielle">
              <p>
                Les descriptions, catégorisations et estimations de valeur générées par l&apos;intelligence
                artificielle sont fournies à titre indicatif uniquement. Elles ne constituent en aucun cas une
                expertise professionnelle, notamment en matière d&apos;assurance, de fiscalité ou d&apos;évaluation
                d&apos;antiquités. Nous ne garantissons pas l&apos;exactitude de ces informations générées
                automatiquement.
              </p>
            </Section>

            <Section title="8. Disponibilité du service">
              <p>
                Nous nous efforçons d&apos;assurer une disponibilité continue du Service, sans garantie
                d&apos;absence d&apos;interruption, notamment pour des opérations de maintenance. Nous ne saurions être
                tenus responsables des interruptions temporaires du Service.
              </p>
            </Section>

            <Section title="9. Limitation de responsabilité">
              <p>
                Le Service est fourni « en l&apos;état ». Dans la limite permise par la loi applicable, nous
                déclinons toute responsabilité pour les dommages indirects résultant de l&apos;utilisation ou de
                l&apos;impossibilité d&apos;utiliser le Service, y compris la perte de données.
              </p>
              <p>
                Nous vous recommandons de conserver une copie de sauvegarde de vos documents importants
                (factures, justificatifs d&apos;assurance) en dehors du Service.
              </p>
            </Section>

            <Section title="10. Résiliation">
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
            </Section>

            <Section title="11. Modifications des CGU">
              <p>
                Nous pouvons modifier les présentes CGU à tout moment. Toute modification substantielle vous
                sera notifiée par e-mail ou dans l&apos;application au moins 30 jours avant son entrée en vigueur.
                La poursuite de l&apos;utilisation du Service après cette date vaut acceptation des nouvelles CGU.
              </p>
            </Section>

            <Section title="12. Droit applicable et juridiction">
              <p>
                Les présentes CGU sont régies par le droit français. Tout litige relatif à leur interprétation
                ou à leur exécution relève de la compétence exclusive des tribunaux français, sous réserve des
                dispositions d&apos;ordre public applicables aux consommateurs.
              </p>
            </Section>

            <Section title="Contact">
              <p>Pour toute question relative aux présentes CGU :</p>
              <p><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
            </Section>
          </div>
        </main>

        <footer className="footer">
          <Link href="/" legacyBehavior passHref>
            <a className="footer-link">Accueil</a>
          </Link>
          <span className="footer-sep">·</span>
          <Link href="/privacy" legacyBehavior passHref>
            <a className="footer-link">Confidentialité</a>
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

        .main { flex: 1; max-width: 800px; margin: 0 auto; padding: 48px 20px; width: 100%; }
        .prose { display: flex; flex-direction: column; }
        .page-title { font-size: 32px; font-weight: 800; color: #1A1612; margin-bottom: 8px; }
        .meta { font-size: 13px; color: #A89F96; margin-bottom: 40px; }

        .prose p { font-size: 15px; color: #6B6158; line-height: 1.7; margin-bottom: 12px; }
        .prose ul { padding-left: 20px; margin-bottom: 12px; }
        .prose li { font-size: 15px; color: #6B6158; line-height: 1.7; margin-bottom: 4px; }
        .prose strong { color: #1A1612; }
        .prose a { color: #F26900; text-decoration: underline; }
        .prose a:hover { color: #D85E00; }

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
