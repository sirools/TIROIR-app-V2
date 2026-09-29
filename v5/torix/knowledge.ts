// Ce que Torix sait de la V5 — fiches déterministes, sans modèle.
//
// Pendant de v4/torix/knowledge.ts pour le chantier v5/, module autonome
// (aucun import entre v5/, v4/, web/ et mobile/). La V5 n'est pas encore
// définie : les fiches disent ce qui est établi, et rien de plus. Chaque
// décision consignée dans docs/vision.md doit y entrer ; le test
// knowledge.test.ts vérifie qu'elles suivent ce document.

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

export const TOPICS: Topic[] = [
  {
    id: 'vision',
    keywords: ['v5', 'v5 0', 'vision', 'c est quoi la v5', 'la v5 c est quoi', 'a quoi sert la v5', 'contenu de la v5', 'que contient la v5'],
    register: 'fait',
    source: 'v5/docs/vision.md',
    answer:
      'La V5 n’est pas encore définie : aucune décision n’est consignée, ni dans le dépôt ni dans Notion.\n' +
      'Elle a seulement sa place réservée en preprod, après la V4.0.\n' +
      'Dis-moi ce qu’elle doit contenir : je le note dans v5/docs/vision.md et je l’apprends.',
  },
  {
    id: 'v4',
    keywords: ['v4', 'avant la v5', 'difference', 'par rapport a la v4', 'apres la v4', 'suite'],
    register: 'fait',
    source: 'v5/docs/vision.md · v5/README.md',
    answer:
      'La V5 vient après la V4.0 — le Tiroir collaboratif et le prêt, en chantier dans v4/.\n' +
      'Ce qu’elle ajoute à la V4.0 reste à décider : c’est la première question ouverte.',
  },
  {
    id: 'questions',
    keywords: ['question ouverte', 'questions ouvertes', 'a trancher', 'a decider', 'reste a decider', 'prochaine etape', 'que faire maintenant'],
    register: 'fait',
    source: 'v5/docs/vision.md',
    answer:
      'Encore ouvert : que couvre la V5 par rapport à la V4.0, et quelle en sera la source produit — une page Notion « TIROIR V5 » à créer ?',
  },
  {
    id: 'prod',
    keywords: ['prod', 'touche la prod', 'production', 'regle d or', 'sans risque', 'isole', 'isolement', 'preprod'],
    register: 'fait',
    source: 'v5/README.md',
    answer:
      'Règle d’or : rien dans v5/ ne touche la prod, comme pour v4/.\n' +
      'Ni web/, ni mobile/, ni v4/ n’importent v5/, et rien n’entre dans supabase/migrations/ sans validation sur le Supabase de preprod.',
  },
  {
    id: 'torix',
    keywords: ['qui es tu', 'tu es qui', 'presente toi', 'que sais tu', 'que sais tu faire', 'aide'],
    register: 'principe',
    source: 'v5/torix/knowledge.ts',
    answer:
      'Je suis Torix, l’IA du fondateur de Tiroir. Ici, je tiens la mémoire de la V5 : pour l’instant, qu’elle reste à définir. J’apprends chaque décision que tu y consignes.',
  },
]

export const UNKNOWN = 'Je ne sais pas encore répondre à ça. La V5 reste à définir : je connais seulement sa place après la V4.0, sa règle d’or et ses questions ouvertes.'

export const SUGGESTIONS = [
  'C’est quoi la V5 ?',
  'Qu’apporte la V5 par rapport à la V4 ?',
  'Quelles questions ouvertes restent ?',
  'Est-ce que la V5 touche la prod ?',
]

function normalize(input: string): string {
  return ' ' + input
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim() + ' '
}

/** Pluriel simple : « cles » trouve « cle », « v5 » reste « v5 ». */
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
