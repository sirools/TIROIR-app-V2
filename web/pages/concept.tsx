// Page « Concept » — l'envers de la landing.
//
// La landing vend le produit en 30 secondes ; cette page prend le temps
// d'expliquer comment Tiroir fonctionne réellement, mécanique par
// mécanique, avec une démo animée en regard de chaque explication.
// Elle sert aussi de socle au futur espace tuto/communauté.
import Head from 'next/head'
import HeaderTiroirWeb from '../components/layout/HeaderTiroirWeb'
import FooterTiroirWeb from '../components/layout/FooterTiroirWeb'
import {
  CaptureLoop, BatchLoop, CollectionLoop,
  StatusLoop, ValueLoop, ShareLoop,
} from '../components/concept/Mechanics'

const CHAPTERS = [
  { id: 'principe',    label: 'Le principe' },
  { id: 'ia',          label: "Ce que lit l'IA" },
  { id: 'rafale',      label: 'Le mode rafale' },
  { id: 'collections', label: 'Les collections' },
  { id: 'statuts',     label: "Le cycle de vie" },
  { id: 'valeur',      label: 'La valeur' },
  { id: 'partage',     label: 'Le partage' },
  { id: 'donnees',     label: 'Vos données' },
  { id: 'tutos',       label: 'Recettes' },
  { id: 'communaute',  label: 'La communauté' },
]

const RECIPES = [
  {
    emoji: '👕',
    title: 'Vider un dressing en 20 minutes',
    steps: [
      'Étalez tout sur un fond neutre — un drap clair suffit.',
      'Mode rafale : une photo par pièce, sans vous relire.',
      'Laissez les analyses tourner, revenez corriger après.',
      'Passez en revue les statuts : à garder, à vendre, à donner.',
    ],
  },
  {
    emoji: '🛡️',
    title: 'Préparer un dossier d’assurance',
    steps: [
      'Photographiez les objets de valeur, un par un cette fois.',
      'Renseignez le prix d’achat et la date quand vous les avez.',
      'Joignez les factures en pièce jointe sur la fiche.',
      'Partagez la collection à votre assureur par lien.',
    ],
  },
  {
    emoji: '🏷️',
    title: 'Préparer un vide-grenier',
    steps: [
      'Créez une collection « À vendre ».',
      'Consultez l’estimation pour fixer un prix de départ.',
      'Marquez « Vendu » au fil de la journée, avec le prix réel.',
      'Le total vendu se calcule tout seul.',
    ],
  },
  {
    emoji: '📦',
    title: 'Déménager sans rien perdre',
    steps: [
      'Une collection par carton, nommée comme le carton.',
      'Statut « Rangé » avec la pièce de destination en note.',
      'À l’arrivée, cherchez l’objet, pas le carton.',
    ],
  },
]

export default function Concept() {
  return (
    <>
      <Head>
        <title>Concept — comment fonctionne Tiroir</title>
        <meta
          name="description"
          content="Le fonctionnement détaillé de Tiroir : analyse par photo, mode rafale, collections, statuts, estimation de valeur, partage par lien. Avec des démos animées de chaque mécanique."
        />
      </Head>

      <HeaderTiroirWeb />

      <main>
        {/* ── Hero éditorial ── */}
        <section className="cx-hero">
          <div className="container">
            <span className="badge">Concept</span>
            <h1 className="h1" style={{ maxWidth: 720, marginBottom: 16 }}>
              Comment Tiroir fonctionne, pour de vrai.
            </h1>
            <p className="p" style={{ fontSize: 18, maxWidth: 620 }}>
              La page d’accueil vous dit ce que fait Tiroir. Celle-ci vous dit <em>comment</em> :
              ce que l’IA regarde sur une photo, ce qu’elle ne devine pas, comment un objet vit
              après sa création, et ce qui se passe exactement quand vous partagez un lien.
            </p>
            <p className="p" style={{ maxWidth: 620 }}>
              Chaque mécanique est expliquée à côté d’une démo animée de l’écran concerné.
              Comptez une dizaine de minutes de lecture.
            </p>
          </div>
        </section>

        <div className="container cx-layout">
          {/* ── Sommaire ── */}
          <nav className="cx-toc" aria-label="Sommaire">
            <span className="cx-toc__title">Sommaire</span>
            {CHAPTERS.map((c, i) => (
              <a key={c.id} href={`#${c.id}`} className="cx-toc__link">
                <span className="cx-toc__num">{String(i + 1).padStart(2, '0')}</span>
                {c.label}
              </a>
            ))}
          </nav>

          <div className="cx-body">
            {/* 01 — Le principe */}
            <Chapter num="01" id="principe" title="Une photo, une fiche" demo={<CaptureLoop />}>
              <p>
                Tout part d’un geste : vous photographiez un objet. L’image part vers un modèle
                de vision qui la décrit, puis un second passage transforme cette description en
                fiche structurée — titre, catégorie, matière, état, couleur dominante.
              </p>
              <p>
                Vous récupérez une fiche pré-remplie, pas un formulaire vide. C’est là que se
                joue toute la différence : un inventaire échoue presque toujours à la même
                étape, celle où il faut taper le trentième nom d’objet à la main.
              </p>
              <p className="cx-aside">
                Le résultat reste une proposition. Chaque champ est modifiable, et vos
                corrections priment toujours sur la suggestion.
              </p>
            </Chapter>

            {/* 02 — Ce que lit l'IA */}
            <Chapter num="02" id="ia" title="Ce que l’IA lit, et ce qu’elle ne devine pas">
              <p>
                Autant être direct : le modèle est bon sur ce qui est visible, et incapable sur
                ce qui ne l’est pas. Le distinguer vous évitera de lui en vouloir.
              </p>
              <div className="cx-cols">
                <div>
                  <h4 className="cx-colTitle cx-colTitle--yes">Ce qu’elle voit bien</h4>
                  <ul>
                    <li>La nature de l’objet et sa catégorie</li>
                    <li>La matière apparente, la couleur, la coupe</li>
                    <li>L’état visible : usure, taches, accrocs</li>
                    <li>Une marque quand le logo est lisible</li>
                    <li>Le style et l’époque approximative</li>
                  </ul>
                </div>
                <div>
                  <h4 className="cx-colTitle cx-colTitle--no">Ce qu’elle ne peut pas savoir</h4>
                  <ul>
                    <li>Où vous l’avez rangé</li>
                    <li>Combien vous l’avez payé, et quand</li>
                    <li>S’il est authentique ou contrefait</li>
                    <li>Sa valeur sentimentale, à qui il a appartenu</li>
                    <li>La taille exacte sans étiquette visible</li>
                  </ul>
                </div>
              </div>
              <p>
                D’où la règle de la fiche : l’IA remplit la colonne de gauche, vous complétez
                celle de droite — et seulement pour les objets qui le méritent. Sur un lot de
                soixante vêtements, personne ne renseigne soixante prix d’achat, et ce n’est
                pas grave.
              </p>
              <p className="cx-aside">
                Une photo nette, sur fond uni, cadrée sur l’objet seul : c’est 80 % de la
                qualité du résultat. Les photos prises dans un tas donnent des fiches en vrac.
              </p>
            </Chapter>

            {/* 03 — Rafale */}
            <Chapter num="03" id="rafale" title="Le mode rafale, pour les gros volumes" demo={<BatchLoop />} reverse>
              <p>
                Photographier un objet à la fois convient pour dix objets. Au-delà, le rythme
                casse. Le mode rafale prend un lot de photos d’un coup : une photo = un objet,
                et les analyses partent en parallèle.
              </p>
              <p>
                Elles n’aboutissent pas dans l’ordre — une veste unie est traitée plus vite
                qu’un appareil photo couvert d’inscriptions. Vous voyez les fiches se remplir
                au fur et à mesure, et vous pouvez déjà en corriger une pendant que les autres
                tournent.
              </p>
              <p>
                Chaque photo du lot consomme une analyse de votre quota mensuel. Un lot de
                vingt objets, c’est vingt analyses.
              </p>
            </Chapter>

            {/* 04 — Collections */}
            <Chapter num="04" id="collections" title="Ranger sans se forcer" demo={<CollectionLoop />}>
              <p>
                Une collection est un regroupement libre : une pièce de la maison, un carton de
                déménagement, un lot à vendre, une catégorie. Un objet peut n’appartenir à
                aucune — le fourre-tout est un état valide, pas un échec.
              </p>
              <p>
                Le curseur de densité change le nombre de colonnes de la grille. Sur un
                inventaire de trois cents pièces, passer de deux à cinq colonnes transforme
                complètement la navigation : on cesse de lire des titres pour reconnaître des
                formes et des couleurs.
              </p>
              <p className="cx-aside">
                La recherche fonctionne sur le texte des fiches, y compris ce que l’IA a écrit.
                Chercher « rayé bleu » retrouve des objets dont vous n’avez jamais tapé le nom.
              </p>
            </Chapter>

            {/* 05 — Statuts */}
            <Chapter num="05" id="statuts" title="Le cycle de vie d’un objet" demo={<StatusLoop />} reverse>
              <p>
                C’est la mécanique la plus sous-estimée. Un inventaire meurt le jour où il
                devient faux : vous avez vendu la veste, donné les chaussures, prêté la
                perceuse, et plus rien ne correspond à la réalité.
              </p>
              <p>
                Le statut évite ça. Possédé, rangé, prêté, vendu, donné, perdu : l’objet ne
                disparaît jamais de l’inventaire, il change d’état. Vous gardez l’historique,
                le prix de vente réel, la personne à qui vous avez prêté.
              </p>
              <p>
                C’est aussi ce qui rend l’inventaire utile après coup : combien j’ai vendu ce
                mois-ci, qu’est-ce que j’ai prêté et à qui, qu’est-ce qui dort au grenier.
              </p>
            </Chapter>

            {/* 06 — Valeur */}
            <Chapter num="06" id="valeur" title="Combien ça vaut, vraiment" demo={<ValueLoop />}>
              <p>
                L’estimation ne sort pas d’un chapeau : elle s’appuie sur des annonces
                comparables trouvées sur les plateformes de seconde main. Vous obtenez une
                fourchette et les annonces qui l’ont produite, pas un chiffre magique.
              </p>
              <p>
                Une fourchette large est une information en soi : elle signale un marché peu
                liquide ou un objet difficile à comparer. À l’inverse, une fourchette serrée
                sur un modèle courant vous donne un prix de départ fiable.
              </p>
              <p className="cx-aside">
                Ce n’est pas une expertise. Pour une pièce rare, une signature, un bijou ou
                une œuvre, l’estimation vous donne un ordre de grandeur — pas un avis
                professionnel opposable à un assureur.
              </p>
            </Chapter>

            {/* 07 — Partage */}
            <Chapter num="07" id="partage" title="Un lien, rien à installer" demo={<ShareLoop />} reverse>
              <p>
                Vous générez un lien public vers une fiche ou une collection entière. Celui qui
                le reçoit ouvre une page web : pas de compte à créer, pas d’application à
                installer, rien à accepter.
              </p>
              <p>
                Le lien ne montre que ce que vous avez partagé, et vous pouvez le désactiver à
                tout moment — il devient alors inaccessible, sans supprimer quoi que ce soit
                de votre côté. Une date d’expiration est réglable à la création.
              </p>
              <p>
                C’est le format qui marche avec un acheteur pressé, un assureur, un notaire, ou
                simplement quelqu’un à qui vous voulez montrer ce que vous avez.
              </p>
            </Chapter>

            {/* 08 — Données */}
            <Chapter num="08" id="donnees" title="Vos données, en clair">
              <p>
                Vos photos et vos fiches vous appartiennent. Elles ne sont ni revendues, ni
                utilisées pour entraîner des modèles, ni exploitées à des fins publicitaires.
                Il n’y a pas de publicité dans Tiroir, et le modèle économique est l’abonnement
                — c’est précisément ce qui permet cette phrase.
              </p>
              <p>
                Les photos que vous envoyez à l’analyse transitent par un modèle d’IA tiers, le
                temps du traitement. Elles ne servent pas à l’entraîner.
              </p>
              <p>
                La suppression de compte efface tout : objets, photos, collections, liens
                partagés. Immédiatement, et sans passer par le support.
              </p>
              <p className="cx-aside">
                Le détail complet est dans la{' '}
                <a href="/privacy" className="cx-link">politique de confidentialité</a>.
              </p>
            </Chapter>

            {/* 09 — Recettes */}
            <section id="tutos" className="cx-chapter">
              <span className="cx-num">09</span>
              <h2 className="h2 cx-title">Recettes</h2>
              <p className="cx-lead">
                Les mécaniques prises une par une servent à peu de choses. Voici comment elles
                s’enchaînent sur des situations réelles.
              </p>
              <div className="cx-recipes">
                {RECIPES.map(r => (
                  <div className="card cx-recipe" key={r.title}>
                    <span className="cx-recipe__emoji" aria-hidden="true">{r.emoji}</span>
                    <h3 className="cx-recipe__title">{r.title}</h3>
                    <ol className="cx-recipe__steps">
                      {r.steps.map(s => <li key={s}>{s}</li>)}
                    </ol>
                  </div>
                ))}
              </div>
            </section>

            {/* 10 — Communauté */}
            <section id="communaute" className="cx-chapter">
              <span className="cx-num">10</span>
              <h2 className="h2 cx-title">La communauté, bientôt</h2>
              <p className="cx-lead">
                Les usages les plus malins de Tiroir ne viennent pas de moi. Une brocanteuse qui
                shoote son stock du dimanche soir, un couple qui inventorie avant un
                déménagement, un collectionneur qui documente une série : chacun invente sa
                méthode.
              </p>
              <p>
                Cet espace accueillera ces retours d’expérience — des méthodes de travail
                publiées par celles et ceux qui utilisent l’app pour de vrai, avec leurs
                photos et leurs chiffres. En attendant que ce soit construit, si vous avez une
                méthode qui marche, elle m’intéresse déjà.
              </p>
              <div className="cx-soon">
                <a href="/about#contact" className="btn btn-primary">Raconter mon usage</a>
                <a href="/about" className="btn cx-btnGhost">Qui est derrière Tiroir</a>
              </div>
            </section>

            {/* CTA */}
            <section className="cx-final">
              <h2 className="h2" style={{ color: 'white', marginBottom: 8 }}>
                Le plus court chemin reste d’essayer.
              </h2>
              <p className="cx-finalP">
                Cent objets et dix analyses par mois en gratuit, sans carte bancaire.
              </p>
              <div className="cx-finalCtas">
                <a href="/inscription" className="btn cx-btnWhite">Créer un compte</a>
                <a href="/pricing" className="cx-finalLink">Voir les tarifs</a>
              </div>
            </section>
          </div>
        </div>
      </main>

      <FooterTiroirWeb />

      <style jsx>{`
        .cx-hero {
          padding: clamp(40px, 6vw, 80px) 0 clamp(32px, 4vw, 56px);
          background: radial-gradient(70% 70% at 15% 0%, rgba(242,105,0,0.10), transparent), var(--beige);
        }

        .cx-layout {
          display: grid;
          grid-template-columns: 1fr;
          gap: 40px;
          padding-top: 56px;
          padding-bottom: 56px;
          align-items: start;
        }
        @media (min-width: 1040px) {
          .cx-layout { grid-template-columns: 210px minmax(0, 1fr); gap: 56px; }
        }

        /* Sommaire */
        .cx-toc { display: none; }
        @media (min-width: 1040px) {
          .cx-toc {
            display: flex; flex-direction: column; gap: 2px;
            position: sticky; top: 88px;
          }
        }
        .cx-toc__title {
          font-size: 11px; font-weight: 700; letter-spacing: 0.09em;
          text-transform: uppercase; color: #A89F96; margin-bottom: 10px;
        }
        .cx-toc__link {
          display: flex; align-items: baseline; gap: 8px;
          font-size: 14px; color: var(--muted); text-decoration: none;
          padding: 6px 0; transition: color 0.15s;
        }
        .cx-toc__link:hover { color: var(--orange); }
        .cx-toc__num { font-size: 11px; font-weight: 700; color: #C9C1B8; }

        .cx-body { min-width: 0; }

        /* Sections sans démo (recettes, communauté) */
        .cx-chapter { padding: 48px 0; border-top: 1px solid rgba(0,0,0,0.07); }
        .cx-num {
          display: block; font-size: 12px; font-weight: 800;
          letter-spacing: 0.1em; color: var(--orange); margin-bottom: 8px;
        }
        .cx-title { margin-bottom: 12px; }
        .cx-lead { font-size: 16px; color: var(--muted); line-height: 1.7; margin-bottom: 24px; max-width: 640px; }

        /* Recettes */
        .cx-recipes { display: grid; grid-template-columns: 1fr; gap: 16px; }
        @media (min-width: 720px) { .cx-recipes { grid-template-columns: 1fr 1fr; } }
        .cx-recipe { padding: 24px; }
        .cx-recipe__emoji { font-size: 26px; line-height: 1; }
        .cx-recipe__title { font-size: 16px; font-weight: 700; color: var(--ink); margin: 10px 0 12px; }
        .cx-recipe__steps { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 7px; }
        .cx-recipe__steps li { font-size: 14px; color: var(--muted); line-height: 1.55; }

        /* Communauté */
        .cx-soon { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 24px; }
        .cx-btnGhost {
          background: white; color: var(--ink);
          border: 1px solid rgba(0,0,0,0.12);
          text-decoration: none;
        }

        /* CTA final */
        .cx-final {
          background: var(--orange);
          border-radius: 20px;
          padding: clamp(32px, 5vw, 56px) 24px;
          text-align: center;
          margin-top: 48px;
        }
        .cx-finalP { color: rgba(255,255,255,0.9); font-size: 15px; margin: 0 0 20px; }
        .cx-finalCtas { display: flex; flex-direction: column; align-items: center; gap: 12px; }
        .cx-btnWhite { background: white; color: var(--ink); text-decoration: none; }
        .cx-finalLink { color: rgba(255,255,255,0.92); font-size: 14px; text-decoration: underline; }
      `}</style>
    </>
  )
}

/** Un chapitre : texte à gauche, démo animée à droite (alternance via `reverse`). */
function Chapter({
  num, id, title, children, demo, reverse,
}: {
  num: string
  id: string
  title: string
  children: React.ReactNode
  demo?: React.ReactNode
  reverse?: boolean
}) {
  return (
    <section id={id} className={`ch ${demo ? 'ch--split' : ''} ${reverse ? 'ch--rev' : ''}`}>
      <div className="ch__text">
        <span className="ch__num">{num}</span>
        <h2 className="h2 ch__title">{title}</h2>
        <div className="ch__prose">{children}</div>
      </div>
      {demo && <div className="ch__demo">{demo}</div>}

      <style jsx>{`
        .ch {
          padding: 48px 0;
          border-top: 1px solid rgba(0, 0, 0, 0.07);
        }
        .ch--split {
          display: grid;
          grid-template-columns: 1fr;
          gap: 32px;
          align-items: center;
        }
        @media (min-width: 860px) {
          .ch--split { grid-template-columns: minmax(0, 1fr) auto; gap: 48px; }
          .ch--rev .ch__text { order: 2; }
          .ch--rev .ch__demo { order: 1; }
        }

        .ch__num {
          display: block;
          font-size: 12px; font-weight: 800;
          letter-spacing: 0.1em; color: var(--orange);
          margin-bottom: 8px;
        }
        .ch__title { margin-bottom: 16px; }
        .ch__prose { max-width: 620px; }
        .ch__demo { display: flex; justify-content: center; }
      `}</style>

      {/* Styles de prose : ciblés en :global car le contenu vient des enfants */}
      <style jsx>{`
        .ch__prose :global(p) {
          font-size: 16px;
          line-height: 1.75;
          color: var(--muted);
          margin: 0 0 16px;
        }
        .ch__prose :global(.cx-aside) {
          font-size: 14px;
          color: #7a7168;
          background: var(--beige-2);
          border-left: 3px solid var(--orange);
          border-radius: 0 10px 10px 0;
          padding: 14px 16px;
          margin-top: 8px;
        }
        .ch__prose :global(.cx-link) { color: var(--orange); font-weight: 600; }
        .ch__prose :global(.cx-cols) {
          display: grid; grid-template-columns: 1fr; gap: 20px;
          margin: 8px 0 20px;
        }
        @media (min-width: 620px) {
          .ch__prose :global(.cx-cols) { grid-template-columns: 1fr 1fr; }
        }
        .ch__prose :global(.cx-colTitle) {
          font-size: 13px; font-weight: 700; margin: 0 0 8px;
          display: flex; align-items: center; gap: 6px;
        }
        .ch__prose :global(.cx-colTitle--yes) { color: #2D5016; }
        .ch__prose :global(.cx-colTitle--no) { color: #C0392B; }
        .ch__prose :global(.cx-colTitle--yes)::before { content: '✓'; }
        .ch__prose :global(.cx-colTitle--no)::before { content: '✕'; }
        .ch__prose :global(ul) {
          margin: 0; padding-left: 18px;
          display: flex; flex-direction: column; gap: 6px;
        }
        .ch__prose :global(li) { font-size: 14px; color: var(--muted); line-height: 1.55; }
      `}</style>
    </section>
  )
}
