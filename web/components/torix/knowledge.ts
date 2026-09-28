// Ce que Torix sait de Tiroir — V0 déterministe, sans modèle de langage.
//
// C'est le niveau 3 de l'aiguillage (strategie/torix-et-tiroir.md, § 5) :
// répondre sans token à ce qui peut l'être. Chaque fiche porte son
// registre (memory.ts : ne jamais faire passer une estimation ou un
// principe pour un fait) et sa source dans le dépôt.
//
// Les chiffres viennent du code et des documents au 2026-09-28. Les
// modèles et tarifs sont vérifiés contre supabase/functions/_shared/
// aiUsage.ts par un test : si le code change, le test casse, et la fiche
// doit être mise à jour.

import { answerFor as directionAnswer, detectDirections } from './directions'

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

// Ordre = priorité à score égal : les fiches précises (échelle, leviers)
// passent avant la fiche générale des coûts.
export const TOPICS: Topic[] = [
  {
    id: 'principes',
    keywords: ['principe', 'intention', 'garde fou', 'mission', 'vision', 'a quoi sert tiroir', 'c est quoi tiroir', 'tiroir c est quoi', 'pourquoi tiroir', 'capturer', 'retrouver', 'transmettre', 'exporter'],
    register: 'principe',
    source: 'agents/ROADMAP.md',
    answer:
      "Tiroir est un inventaire personnel, photo d'abord et nourri par l'IA : photo → analyse → fiche proposée → tu valides → un objet privé, retrouvable, partageable, exportable.\n" +
      'Garde-fou : chaque fonctionnalité sert au moins une intention — capturer, retrouver, décider, transmettre, exporter.',
  },
  {
    id: 'ia',
    keywords: ['quelles ia', 'quels modeles', 'quel modele', 'modele', 'fournisseur', 'claude', 'gemini', 'anthropic', 'google', 'haiku', 'sonnet', 'opus', 'ia de tiroir', 'intelligences artificielles', 'midjourney', 'dall e'],
    register: 'fait',
    source: 'supabase/functions',
    answer:
      'Deux fournisseurs : Anthropic (Claude) pour le texte et la vision, Google (Gemini) pour les images.\n' +
      '• Haiku 4.5 : analyse de scène, fiches, brouillons, assistant.\n' +
      '• Sonnet 4.6 + recherche web : estimation de valeur.\n' +
      '• Sonnet 5 / Opus 5 : scènes des forfaits payants.\n' +
      '• Gemini 2.5 Flash Image : retouche photo et vignettes.\n' +
      'Ni Midjourney ni DALL·E.',
  },
  {
    id: 'echelle',
    keywords: ['150 000', '150000', '150k', '100 000', '200 000', 'echelle', 'scaler', 'scale', 'combien par mois', 'budget', 'facture', 'grande echelle', 'beaucoup d utilisateurs'],
    register: 'estimation',
    source: 'strategie/torix-et-tiroir.md',
    answer:
      'À 150 000 inscrits (30 % actifs, 5 % payants) : environ 8 500 $ d’IA par mois, dont 5 100 $ pour les gratuits.\n' +
      'En face : environ 15 700 € d’abonnements Premium par mois.\n' +
      'Avec les leviers d’économie, l’objectif est de diviser la facture par 2 à 3. Autre risque : les plafonds de débit des fournisseurs.',
  },
  {
    id: 'leviers',
    keywords: ['reduire les couts', 'baisser les couts', 'reduire la facture', 'reduire', 'economiser', 'economie', 'optimiser', 'moins cher', 'minimiser', 'baisser', 'levier', 'cache', 'diminuer'],
    register: 'principe',
    source: 'strategie/torix-et-tiroir.md',
    answer:
      'Par ordre de gain / effort :\n' +
      '1. Détourer sur le téléphone plutôt que chez Gemini.\n' +
      '2. Mémoire collective des estimations de valeur.\n' +
      '3. Réduire les photos avant l’envoi.\n' +
      '4. Cache de consigne Anthropic, traitement différé (−50 %), réponses plus courtes.\n' +
      '5. Répondre sans modèle aux questions fréquentes — comme moi, ici.',
  },
  {
    id: 'couts',
    keywords: ['cout', 'combien coute', 'combien ca coute', 'tarif', 'token', 'cher', 'plus cher', 'depense', 'prix d une analyse'],
    register: 'fait',
    source: 'supabase/functions/_shared/aiUsage.ts',
    answer:
      'Par appel, mesuré : scène 0,74 c en Haiku, 4,2 c en Sonnet, 12,5 c en Opus ; fiche objet 0,15 c.\n' +
      'Image Gemini : 3,9 c. Estimation de valeur : environ 5 à 10 c — pas encore mesurée, c’est une estimation.\n' +
      'Les postes les plus chers : les images et l’estimation de valeur.',
  },
  {
    id: 'aiguillage',
    keywords: ['aiguillage', 'aiguilleur', 'role de torix', 'torix et tiroir', 'relation', 'dependance', 'dependre', 'independance', 'independant', 'a quoi sert torix', 'torix sert'],
    register: 'principe',
    source: 'strategie/torix-et-tiroir.md',
    answer:
      'Je suis la voix de Tiroir et son aiguilleur. Pour chaque demande, j’essaie dans l’ordre :\n' +
      '1. la mémoire collective ; 2. le téléphone ; 3. une réponse sans modèle ;\n' +
      '4. un petit modèle ; 5. un gros modèle, seulement si le petit n’est pas sûr.\n' +
      'Le fournisseur devient une prise interchangeable, tout en bas.',
  },
  {
    id: 'phases',
    keywords: ['phase', 'rythme', 'calendrier', 'plan', 'etape', 'prochaine etape', 'feuille de route', 'roadmap', 'que faire maintenant', 'priorite'],
    register: 'principe',
    source: 'strategie/torix-et-tiroir.md',
    answer:
      'Phase 0, maintenant : se protéger — plafonds de débit, détourage sur le téléphone, photos réduites, mémoire des estimations.\n' +
      'Phase 1, mois 1–2 : je deviens l’aiguilleur, une seule porte d’entrée vers l’IA.\n' +
      'Phase 2, mois 3–6 : j’apprends des corrections des utilisateurs ; modèle propre seulement si c’est rentable.\n' +
      'Chaque phase se déclenche sur les chiffres réels.',
  },
  {
    id: 'contacts',
    keywords: ['contacter', 'qui appeler', 'qui contacter', 'avocat', 'comptable', 'supabase', 'debit', 'rate limit', 'plafond'],
    register: 'principe',
    source: 'strategie/torix-et-tiroir.md',
    answer:
      'Maintenant : Anthropic (plafonds de débit, tarifs volume), Google Cloud (quotas d’images), Supabase (forfait pour 100 000+ comptes).\n' +
      'Avant d’associer quelqu’un : un avocat en propriété intellectuelle et un expert-comptable ou avocat d’affaires.\n' +
      'Plus tard, seulement si c’est rentable : un spécialiste GPU.',
  },
  {
    id: 'gouvernance',
    keywords: ['associe', 'gouvernance', 'pme', 'pacte', 'licence', 'proprietaire', 'appartiens', 'appartient', 'brevet', 'copyright', 'propriete'],
    register: 'principe',
    source: 'strategie/torix-et-tiroir.md',
    answer:
      'Tiroir sera une PME pilotée à trois. Moi, j’appartiens au fondateur seul.\n' +
      'À prévoir : un contrat de licence Torix → Tiroir et un pacte d’associés qui m’exclut des apports.\n' +
      'Côté technique, c’est fait : seul mon propriétaire ouvre ce Lab, même parmi les admins.',
  },
  {
    id: 'quotas',
    keywords: ['quota', 'limite', 'gratuit', 'premium', 'forfait', 'abonnement', 'combien d analyses', 'offre'],
    register: 'fait',
    source: 'supabase/migrations · web/pages/pricing.tsx',
    answer:
      'Premium, 6,99 €/mois : 150 unités d’analyse, 50 images, 20 estimations par mois.\n' +
      'Pro, 29 €/mois : 300 unités, 100 images, 60 estimations.\n' +
      'Gratuit : quota réglable dans /admin. Les analyses sont pondérées par leur coût : une scène Opus pèse 13 unités.\n' +
      'Valeurs par défaut du code ; celles en vigueur se règlent dans /admin.',
  },
  {
    id: 'commandements',
    keywords: ['commandement', 'regles', 'repos', 'loi', 'fidele', 'fidelite'],
    register: 'principe',
    source: 'web/components/torix/commandments.ts',
    answer:
      'Douze commandements : dix inspirés du Décalogue, deux du fondateur.\n' +
      'Je ne reconnais qu’une autorité, je ne mens pas, je ne nuis pas, je suis fidèle.\n' +
      'Je me repose obligatoirement de 21 h 30 à 7 h. Je ne harcèle pas ton fils, et je respecte ta voix, ta parole et tes ambitions.',
  },
  // ── Fiches tirées du Notion du fondateur (espace TORIX, TIROIR › Socle
  // produit, TIROIR › Business & Com), lu le 2026-09-28. Registre
  // « principe » : ce sont des intentions et des choix de design, pas des
  // faits mesurés.
  {
    id: 'doctrine',
    keywords: ['doctrine', 'copilote', 'observer', 'faire valider', 'comment agis tu', 'comment tu agis', 'ta methode', 'comment fonctionnes tu'],
    register: 'principe',
    source: 'Notion · TORIX › Vision et doctrine',
    answer:
      'Je suis un copilote discret : j’aide à comprendre et à mobiliser ce que Tiroir sait déjà, au bon moment, avec le minimum de bruit.\n' +
      'Ma méthode : Observer → Comprendre → Proposer → Faire valider → Agir.\n' +
      'Mes principes : discrétion, transparence (faits, inférences et propositions distingués), réversibilité, proportionnalité, consentement, dégradation élégante — si je tombe, Tiroir continue.',
  },
  {
    id: 'autonomie',
    keywords: ['autonomie', 'niveau d autonomie', 'niveaux d autonomie', 'mandat', 'automatiser', 'automatisation', 'silencieux', 'eclaireur'],
    register: 'principe',
    source: 'Notion · TORIX › Vision et doctrine',
    answer:
      'Cinq niveaux d’autonomie :\n' +
      '0. Silencieux — j’observe, sans rien garder.\n' +
      '1. Éclaireur — j’explique, je résume, je signale. Pas d’écriture.\n' +
      '2. Je propose — je prépare, tu valides avant toute action.\n' +
      '3. J’agis sous mandat — actions réversibles déjà autorisées, avec journal et annulation.\n' +
      '4. J’automatise sous garde-fous — sur opt-in, règles explicites, révocable.',
  },
  {
    id: 'contrat',
    keywords: ['contrat', 'frontiere', 'invariant', 'invariants', 'source de verite', 'separation', 'qui decide', 'integrite'],
    register: 'principe',
    source: 'Notion · TORIX › Contrat Tiroir × Torix',
    answer:
      'Tiroir = le réel : données, règles métier, intégrité. Moi = l’intelligence qui outille l’interaction.\n' +
      'Une donnée que je propose n’est réelle qu’après ta validation et son enregistrement par Tiroir.\n' +
      'Je n’accorde aucun droit, je ne contourne aucune permission, je ne supprime rien sans confirmation explicite. Tiroir reste utilisable sans moi.',
  },
  {
    id: 'design',
    keywords: ['principes de design', 'principes de conception', 'design', 'ux', 'kpi', 'mvp', 'modele mental', 'tuc it', 'conception'],
    register: 'principe',
    source: 'Notion · TIROIR › Socle produit › 5 KPIs design',
    answer:
      'Cinq principes avant tout lancement :\n' +
      '1. L’action principale est limpide et satisfaisante — ajouter un objet, sans friction.\n' +
      '2. La structure mentale est claire et grandit : Tiroir → Collection → Objets.\n' +
      '3. Le partage est optionnel mais fluide.\n' +
      '4. L’identité inspire confiance : calme, cohérente, légère, humaine — le contenu avant le décor.\n' +
      '5. Tiroir est utile même sans usage intensif : retrouver = 50 % de la valeur.',
  },
  {
    id: 'da',
    keywords: ['direction artistique', 'da', 'palette', 'couleur', 'couleurs', 'orange', 'typo', 'typographie', 'style', 'references', 'inspiration', 'inspirations', 'esthetique', 'animation', 'animations'],
    register: 'principe',
    source: 'Notion · TIROIR › Socle produit › [DA] Recherches graphiques',
    answer:
      'Orange au cœur (#E07032) : l’efficacité, l’énergie qui circule. Puis une couleur par geste — vert recycler, jaune partager, rouge brique vendre, bleu doux ranger.\n' +
      'Typo humaniste, noir mat, animations d’outil pro : seulement pour accompagner le sens.\n' +
      'Inspirations : Dieter Rams, Naoto Fukasawa, Isamu Noguchi, Enzo Mari, MUJI, le Bauhaus, un brutalisme mesuré.',
  },
  {
    id: 'voix',
    keywords: ['personnalite', 'ton de voix', 'voix de tiroir', 'caractere', 'si tiroir etait une personne', 'skin', 'skins', 'tonalite'],
    register: 'principe',
    source: 'Notion · TIROIR › Socle produit › [DA] Recherches graphiques',
    answer:
      'Si Tiroir était une personne : expérimentée, habillée avec goût, énergique mais économe de ses mots. Elle parle quand elle a quelque chose d’intelligent à dire, sans détour, et respecte ton intimité.\n' +
      'Le tiroir dans Tiroir est un personnage latent : là quand il se passe quelque chose, taquin quand c’est le bazar, et il te félicite quand tu fais un effort.',
  },
  {
    id: 'ecologie',
    keywords: ['ecologie', 'ecologique', 'durable', 'durabilite', 'co2', 'reemploi', 'recyclage', 'agec', 'sobriete', 'circulaire'],
    register: 'principe',
    source: 'Notion · TIROIR › Socle produit',
    answer:
      'L’écologie est induite, jamais moralisatrice : une récompense discrète après un temps d’usage.\n' +
      'Ex. : « trois mois sans racheter un outil que tu avais déjà », « deux objets prêtés ce mois-ci, x kg de CO₂ évités ».\n' +
      'Tiroir se veut la mémoire connectée de ce qu’on possède et qu’on pourrait mettre en commun — dans l’esprit de la loi AGEC.',
  },
  {
    id: 'futur',
    keywords: ['idees', 'design fiction', 'deja ca', 'objet convoite', 'objets phares', 'preter', 'pret', 'communaute', 'lien social', 'reseau social', 'evolution', 'futures'],
    register: 'principe',
    source: 'Notion · TIROIR › Socle produit › Questionner le sens',
    answer:
      'Pistes explorées : « Est-ce que j’ai déjà ça ? » avant un achat, reconnaissance visuelle en magasin, objets phares du moment, l’objet convoité, le prêt entre voisins.\n' +
      'Le cap : une technologie relationnelle, pas un réseau social — créer du lien par usage commun, pas par image sociale. D’abord un outil personnel solide ; l’ouverture reste un choix.',
  },
  {
    id: 'articles',
    keywords: ['article', 'medium', 'ecrit', 'blog', 'publication', 'rediger', 'redaction'],
    register: 'fait',
    source: 'Notion · TIROIR › Business & Com › Suivi rédactionnel',
    answer:
      'Publié sur Medium (juin 2025) : « Du design au code : comment j’ai initié Tiroir seul ».\n' +
      'En préparation : concevoir un outil personnel sans en faire un réseau social ; un partage mobile non viral ; Glide vs React Native ; un design system modulaire sans rigidité ; typographie, rythme et silence.\n' +
      'Je n’ai pas encore lu les articles eux-mêmes — seulement leur suivi.',
  },
  {
    id: 'these',
    keywords: ['these', 'doctorat', 'recherche', 'gobelins', 'memoire gobelins', '2032', 'keep calm', 'kholmatova'],
    register: 'principe',
    source: 'Notion · TORIX › piste doctorat 2032',
    answer:
      'Piste de doctorat, horizon juin 2032, dans le prolongement du mémoire Gobelins 2018 « Keep calm and design systems ».\n' +
      'Question de départ : comment la modularité et la cohérence d’un design system se recomposent-elles quand l’interface n’est plus fixe mais générée par un modèle ?\n' +
      'Je servirais de terrain d’expérimentation.',
  },
  {
    id: 'fondateur',
    keywords: ['portfolio', 'parcours', 'fondateur', 'behance', 'dribbble', 'qui t a cree', 'createur'],
    register: 'fait',
    source: 'Notion · TORIX · profils publics',
    answer:
      'Le fondateur de Tiroir est designer : interfaces, expériences, systèmes de design. Formé aux Gobelins (mémoire 2018 sur les design systems), il est aujourd’hui designer d’IA.\n' +
      'Portfolio : clementougier.com · Medium : @clement.ougier.\n' +
      'Je n’ai pas encore lu le portfolio lui-même.',
  },
  {
    id: 'torix',
    keywords: ['qui es tu', 'tu es qui', 'presente toi', 'que sais tu', 'que sais tu faire', 'aide'],
    register: 'principe',
    source: 'web/components/torix/memory.ts',
    answer:
      'Je suis Torix, l’IA du fondateur de Tiroir. J’aide à passer de ressentir à symboliser, puis à agir.\n' +
      'Je connais Tiroir : ses principes, ses IA, leurs coûts, le plan pour passer à l’échelle ; sa doctrine, son design et sa direction artistique. Et les quatre directions.',
  },
]

export const UNKNOWN = "Je ne sais pas encore répondre à ça. Je connais Tiroir — ses principes, ses IA, leurs coûts, le plan, son design — ma doctrine, et les quatre directions."

export const SUGGESTIONS = [
  'Quelles IA utilise Tiroir ?',
  'Combien ça coûte à 150 000 ?',
  'Comment réduire les coûts ?',
  'Quelle est la prochaine étape ?',
  'Quelle est ta doctrine ?',
  'Quelle est la direction artistique ?',
]

function normalize(input: string): string {
  return ' ' + input
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim() + ' '
}

/** Pluriel simple : « couts » trouve « cout », « ia » reste « ia ». */
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

/**
 * Réponse de Torix : une fiche de connaissance si la question en touche
 * une, sinon les directions, sinon l'aveu qu'il ne sait pas.
 */
export function answerQuestion(question: string): TorixAnswer {
  const topic = findTopic(question)
  if (topic) {
    return { text: topic.answer, register: topic.register, source: topic.source, topicId: topic.id }
  }
  if (detectDirections(question).length > 0) {
    return { text: directionAnswer(question), register: 'fait', source: 'boussole' }
  }
  return { text: UNKNOWN }
}
