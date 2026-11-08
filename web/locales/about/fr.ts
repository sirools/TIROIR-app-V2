// Généré par design/generate.mjs depuis design/i18n/site/fr.json — ne pas modifier à la main.
//
// Textes about en français — référence de structure pour en, de, es
// (type AboutCopy). Importé par ../fr.ts sous la clé « about ».
const aboutFr = {
  meta: {
    title: 'À propos — Tiroir',
    description: 'Qui est derrière Tiroir : Clément Ougier, fondateur solo. Le projet, ce que je cherche (conseils, associés, testeurs) et comment me joindre.',
  },
  // Libellés du bouton d'agenda : lien d'agenda configuré, ou repli sur un e-mail.
  agendaCta: 'Réserver un créneau',
  agendaCtaMail: 'M\'écrire pour caler un créneau',
  // Objets des e-mails préremplis (repli sans agenda).
  heroSubject: 'Parler de Tiroir',
  agendaSubject: 'Un créneau pour parler de Tiroir',
  hero: {
    badge: 'À propos',
    title: 'Bonjour, moi c’est Clément.',
    p1: 'Je suis product designer, et Tiroir est mon projet — conçu, dessiné et développé en solo. L’idée est simple : tu photographies un objet, l’IA rédige sa fiche, et ton inventaire se tient enfin tout seul.',
    p2: 'Je construis en public, je me trompe en public, et j’apprends beaucoup plus vite quand je parle à des gens qu’en restant devant mon écran. C’est tout l’objet de cette page.',
    linkedin: 'Me suivre sur LinkedIn',
  },
  role: 'Senior Product Designer & Builder, concepteur de Tiroir',
  why: {
    title: 'Pourquoi Tiroir',
    paragraphs: [
      'Tout le monde possède des centaines d’objets et personne ne sait vraiment ce qu’il a. On rachète ce qu’on avait déjà, on brade ce qui valait quelque chose, on ne retrouve pas la facture au moment où il faudrait. Faire un inventaire, c’est utile à tout le monde — et suffisamment pénible pour que personne ne le fasse.',
      'Tiroir supprime l’étape pénible. Une photo, et la fiche est écrite : catégorie, matière, état, estimation de valeur. Le reste — collections, partage d’un lien, suivi de ce qui est vendu ou rangé — sert juste à ce que l’inventaire vive au-delà du jour où on l’a créé.',
      'L’app est disponible sur l’App Store et Google Play. Elle progresse chaque semaine, avec les retours de celles et ceux qui l’utilisent pour de vrai.',
    ],
  },
  looking: {
    title: 'Ce que je cherche',
    intro: 'Je ne cherche pas (encore) à lever des fonds. Je cherche des gens : pour me conseiller, me contredire, m’ouvrir une porte, ou simplement partager une expérience que je n’ai pas.',
    // Même ordre que les émojis de la page.
    items: [
      {
        title: 'Des conseils, pas des injonctions',
        body: 'Produit, pricing, growth, levée ou pas de levée : j\'avance vite mais seul, et j\'ai besoin de gens qui ont déjà fait le chemin pour challenger mes angles morts.',
      },
      {
        title: 'Des personnes qui connaissent le terrain',
        body: 'Seconde main, friperies, brocanteurs, assurance, déménagement, succession : si tu vis un de ces mondes au quotidien, ton regard vaut dix études de marché.',
      },
      {
        title: 'Peut-être un ou une associée',
        body: 'Je conçois et je code le produit. Le jour où quelqu\'un a envie de porter le business, la distribution ou la tech avec moi, la porte est grande ouverte.',
      },
      {
        title: 'Des utilisateurs exigeants',
        body: 'Des gens qui ont trop d\'objets, qui testent l\'app pour de vrai et qui me disent sans filtre ce qui coince. C\'est ce qui fait avancer Tiroir le plus vite.',
      },
    ],
  },
  agenda: {
    title: 'Mon agenda est ouvert',
    body: '30 minutes, en visio, sans ordre du jour imposé. Que tu aies un conseil, une question, une critique ou juste de la curiosité pour le projet : prends un créneau, il est pour toi.',
    mail: 'ou m’écrire à {email}',
  },
  contact: {
    title: 'Où me trouver',
    linkedin: 'Le journal de bord du projet, semaine après semaine.',
    blog: 'cofondateurauchomage.fr — les coulisses, sans filtre.',
    emailLabel: 'E-mail',
    email: '{email} — je réponds à tout le monde.',
  },
}

export type AboutCopy = typeof aboutFr
export default aboutFr
