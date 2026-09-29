// Ce que Torix sait de la V4.0 — fiches déterministes, sans modèle.
//
// Pendant de web/components/torix/knowledge.ts, pour le chantier v4/.
// Même forme (registre + source par fiche, zéro token) ; module autonome
// parce que la règle d'or de v4/README.md interdit tout import entre v4/
// et web/. Il rejoindra le Torix Lab quand la V4.0 sera fusionnée.
//
// Contenu tiré de v4/ au 2026-09-29. Un test (knowledge.test.ts) compare
// les fiches à domain/*.ts, aux brouillons SQL et aux docs : si la V4
// change, le test casse, et la fiche doit être mise à jour.

export type Register = 'fait' | 'estimation' | 'principe'

export type Topic = {
  id: string
  /** Mots ou expressions, normalisés (minuscules, sans accents). */
  keywords: string[]
  register: Register
  source: string
  answer: string
}

export type TorixAnswer = {
  text: string
  register?: Register
  source?: string
  topicId?: string
}

export const REGISTER_LABELS: Record<Register, string> = {
  fait: 'Fait',
  estimation: 'Estimation',
  principe: 'Principe',
}

// Ordre = priorité à score égal : les fiches précises avant les générales.
export const TOPICS: Topic[] = [
  {
    id: 'vision',
    keywords: ['v4', 'v4 0', 'vision', 'idee de la v4', 'c est quoi la v4', 'la v4 c est quoi', 'a quoi sert la v4', 'collaboratif', 'tiroir collaboratif', 'circuler', 'circulation'],
    register: 'principe',
    source: 'v4/docs/vision.md',
    answer:
      'La V4.0 fait passer Tiroir de l’inventaire personnel au partage effectif des objets : je sais ce que j’ai, et mes proches voient ce que je peux leur prêter.\n' +
      'Deux mouvements : le Tiroir collaboratif (plusieurs personnes sur un même Tiroir — grenier de mamie, succession, déménagement) et le prêt (un objet, une personne, une durée).\n' +
      'Les objets circulent au lieu de dormir dans un tiroir.',
  },
  {
    id: 'trousseau',
    keywords: ['trousseau', 'cle', 'role', 'membre', 'membres', 'inviter', 'invitation', 'editeur', 'lecteur', 'viewer', 'editor', 'confier une cle'],
    register: 'fait',
    source: 'v4/domain/serrure.ts · v4/supabase/drafts/0001_drawer_members.sql',
    answer:
      'Chaque membre d’un Tiroir tient une clé, qui porte un rôle : propriétaire, éditeur ou lecteur. On parle de clés, jamais de permissions.\n' +
      'Une clé confiée peut expirer ; celle du propriétaire, jamais.\n' +
      'On invite par un lien à usage unique, valable 7 jours — pas de recherche par e-mail, qui révélerait qui est inscrit.',
  },
  {
    id: 'droits',
    keywords: ['qui peut', 'droit', 'droits', 'peut modifier', 'peut preter', 'peut voir', 'autorise', 'permission'],
    register: 'fait',
    source: 'v4/domain/serrure.ts',
    answer:
      'Voir : lecteur et plus. Modifier : éditeur et plus. Prêter et gérer les membres : le propriétaire seul.\n' +
      'La serrure prime sur les clés : fermé, seul le propriétaire entre ; ouvert, tout le monde voit, mais seules les clés permettent d’agir.',
  },
  {
    id: 'serrure',
    keywords: ['serrure', 'ferme', 'entrouvert', 'ouvert', 'vitrine', 'niveau d ouverture', 'prive', 'public', 'visibilite'],
    register: 'fait',
    source: 'v4/domain/serrure.ts · v4/supabase/drafts/0001_drawer_members.sql',
    answer:
      'Trois niveaux de serrure :\n' +
      '• Fermé — strictement privé, visible du propriétaire seul. C’est le réglage par défaut : rien ne change tant qu’on n’ouvre pas.\n' +
      '• Entrouvert — visible des membres choisis, selon leur clé.\n' +
      '• Ouvert — vitrine publique : tout le monde voit, personne n’agit sans clé.',
  },
  {
    id: 'pret',
    keywords: ['pret', 'preter', 'emprunt', 'emprunter', 'emprunteur', 'rendre', 'rendu', 'retard', 'echeance', 'loaned', 'cycle de vie'],
    register: 'fait',
    source: 'v4/domain/pret.ts · v4/supabase/drafts/0002_object_loans.sql',
    answer:
      'Le prêt est un objet de première classe, avec son cycle de vie :\n' +
      'demande → accepté → en cours → rendu. Une demande peut être refusée ou annulée ; un prêt accepté, annulé avant la remise ; un prêt en cours ne peut que revenir.\n' +
      'En retard : en cours et échéance dépassée, jour inclus. Pendant qu’il est en cours, l’objet passe au statut V2 « loaned ».',
  },
  {
    id: 'suggestions',
    keywords: ['suggestion', 'suggerer', 'idee d objet', 'wish', 'trier', 'tri', 'tinder', 'glisser', 'garder', 'ecarter', 'collection partagee'],
    register: 'fait',
    source: 'v4/docs/suggestions.md · v4/supabase/drafts/0003_collection_suggestions.sql',
    answer:
      'Depuis un lien de partage, un visiteur connecté suggère un objet ; le propriétaire trie par glissement — droite garder (l’objet devient une idée), gauche écarter — avec annulation.\n' +
      'Désactivé par défaut, réglable par collection. Une table à part : les idées n’apparaissent jamais comme des objets possédés dans les anciennes versions de l’app.\n' +
      'Garde-fous : nom de 120 caractères au plus, lien http(s), prix entre 0 et 10 M, 50 suggestions en attente par auteur et par collection.',
  },
  {
    id: 'parrainage',
    keywords: ['parrainage', 'parrain', 'filleul', 'referral', 'code promo', 'code d offre', 'offer code', 'inviter des amis', 'croissance'],
    register: 'principe',
    source: 'v4/docs/parrainage.md',
    answer:
      'À cadrer, pas codé. Depuis un partage, inviter à rejoindre Tiroir avec un code de parrainage.\n' +
      'Seuil : 2 à 3 filleuls validés (e-mail confirmé, premier objet), réglable dans l’admin. Le parrain reçoit un mois Premium, puis −50 % sur son premier abonnement ; le filleul, −50 % dès la validation.\n' +
      'Côté Apple, le −50 % passe par des codes d’offre à usage unique, tenus en stock côté serveur.',
  },
  {
    id: 'migration',
    keywords: ['migration', 'migrer', 'bascule', 'phase', 'phases', 'plan', 'rls', 'policy', 'single', 'casser', 'additif', 'anciennes versions'],
    register: 'principe',
    source: 'v4/docs/migration-tiroir-partage.md',
    answer:
      'Chaque phase est déployable seule et laisse la V2 fonctionner à l’identique :\n' +
      '0. Chantier isolé. 1. Trousseau et serrure, purement additifs. 2. Préparer les clients — les « .single() » de l’app sont corrigés, reste à laisser la version s’installer.\n' +
      '3. Lecture partagée par des fonctions dédiées, sans toucher aux policies existantes. 4. Écriture partagée et prêts.\n' +
      'Pourquoi : une quarantaine de lectures comptent sur la RLS ; l’ouvrir mêlerait les objets partagés aux siens, jusque dans les versions déjà installées.',
  },
  {
    id: 'prod',
    keywords: ['prod', 'touche la prod', 'production', 'regle d or', 'sans risque', 'isole', 'isolement', 'brouillon', 'brouillons', 'db push', 'preprod'],
    register: 'fait',
    source: 'v4/README.md',
    answer:
      'Règle d’or : rien dans v4/ ne touche la prod.\n' +
      'Docs seules, brouillons SQL non appliqués (« supabase db push » ne lit que supabase/migrations/), logique métier pure que ni web/ ni mobile/ n’importe.\n' +
      'Un brouillon n’entre dans les migrations qu’après validation sur le Supabase de preprod — en vérifiant le « link » avant tout push.',
  },
  {
    id: 'etat',
    keywords: ['etat', 'ou en est', 'avancement', 'prochaine etape', 'prochaines etapes', 'que reste t il', 'reste a faire', 'fusion', 'fusionne', 'testflight', 'que faire maintenant'],
    register: 'fait',
    source: 'v4/docs/prochaines-etapes.md',
    answer:
      'Sur main, au 28 septembre : les suggestions vivent sur la branche feature/v4-suggestions-web, rien de la V4 n’est fusionné.\n' +
      'Ensuite : valider en preprod (brouillon 0003 et scénario à trois comptes), mettre à jour la preprod et TestFlight sans le Mac.\n' +
      'Décisions en attente : exiger le cookie signé aussi en lecture, retenir la collection d’un lien à sa création, photo dans le formulaire de suggestion.',
  },
  {
    id: 'questions',
    keywords: ['question ouverte', 'questions ouvertes', 'pas tranche', 'a trancher', 'indecis', 'non rendu', 'pas rendu', 'cercle de confiance', 'getaround'],
    register: 'principe',
    source: 'v4/docs/vision.md',
    answer:
      'Encore ouvert :\n' +
      '• Cercle de confiance : contacts, foyer ou groupes nommés ? Le brouillon part des membres d’un Tiroir, le plus petit pas.\n' +
      '• Objet prêté non rendu : relance, historique, trace ?\n' +
      '• Un prêt minimal avant la V4.0 collaborative ?\n' +
      '• Comparable à étudier : Getaround.',
  },
  {
    id: 'torix',
    keywords: ['qui es tu', 'tu es qui', 'presente toi', 'que sais tu', 'que sais tu faire', 'aide'],
    register: 'principe',
    source: 'v4/torix/knowledge.ts',
    answer:
      'Je suis Torix, l’IA du fondateur de Tiroir. Ici, je connais la V4.0 : sa vision, le trousseau et la serrure, les droits, le prêt, les suggestions, le parrainage, le plan de migration et où en est le chantier.',
  },
]

export const UNKNOWN = 'Je ne sais pas encore répondre à ça. Je connais la V4.0 — la vision, le trousseau, la serrure, le prêt, les suggestions, le parrainage, la migration et l’état du chantier.'

export const SUGGESTIONS = [
  'C’est quoi la V4 ?',
  'Comment marche la serrure ?',
  'Qui peut prêter un objet ?',
  'Quel est le cycle de vie d’un prêt ?',
  'Où en est la V4 ?',
  'Comment marche le parrainage ?',
]

function normalize(input: string): string {
  return ' ' + input
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim() + ' '
}

/** Pluriel simple : « cles » trouve « cle », « v4 » reste « v4 ». */
function containsWord(text: string, word: string): boolean {
  return text.includes(` ${word} `) || text.includes(` ${word}s `) || text.includes(` ${word}x `)
}

/** Une expression vaut 2, un mot seul vaut 1. */
export function scoreTopic(question: string, topic: Topic): number {
  const text = normalize(question)
  return topic.keywords.reduce((score, kw) => {
    if (!containsWord(text, kw)) return score
    return score + (kw.includes(' ') ? 2 : 1)
  }, 0)
}

export function findTopic(question: string): Topic | null {
  let best: Topic | null = null
  let bestScore = 0
  for (const topic of TOPICS) {
    const s = scoreTopic(question, topic)
    if (s > bestScore) { best = topic; bestScore = s }
  }
  return best
}

/** Une fiche si la question en touche une, sinon l'aveu qu'il ne sait pas. */
export function answerQuestion(question: string): TorixAnswer {
  const topic = findTopic(question)
  if (topic) {
    return { text: topic.answer, register: topic.register, source: topic.source, topicId: topic.id }
  }
  return { text: UNKNOWN }
}
