// Torix V0 : le seul « savoir » de Torix, les quatre points cardinaux.
// Volontairement déterministe — aucun modèle derrière pour l'instant.

export type Direction = 'nord' | 'sud' | 'est' | 'ouest'

const ANSWERS: Record<Direction, string> = {
  nord: 'Le nord est devant toi.',
  sud: 'Le sud est derrière toi.',
  est: "L'est est à ta droite.",
  ouest: "L'ouest est à ta gauche.",
}

export const UNKNOWN_ANSWER = "Pour l'instant, je ne connais que le nord, le sud, l'est et l'ouest."

// « est » désigne le point cardinal et non le verbe quand il suit l'un de
// ces mots : « l'est », « à l'est », « vers l'est »…
const EST_CUES = new Set(['l', 'a', 'vers'])
// … ou quand il termine la phrase après l'un de ceux-ci : « direction est »,
// « cap est ». Pas au milieu : « quelle direction est le nord ? ».
const EST_FINAL_CUES = new Set(['direction', 'cap', 'plein'])

function tokenize(input: string): string[] {
  return input
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    // « nord-est » : seul le trait d'union distingue le point composé de
    // « le nord est où ? ». On le réécrit en « nord l est » avant de perdre
    // la ponctuation.
    .replace(/\b(nord|sud)\s*-\s*est\b/g, '$1 l est')
    .split(/[^a-z]+/)
    .filter(Boolean)
}

/** Directions citées dans la question, dans l'ordre et sans doublon. */
export function detectDirections(input: string): Direction[] {
  const tokens = tokenize(input)
  const found: Direction[] = []
  const add = (d: Direction) => { if (!found.includes(d)) found.push(d) }

  tokens.forEach((t, i) => {
    if (t === 'nord' || t === 'sud' || t === 'ouest') add(t)
    else if (t === 'est') {
      // Verbe par défaut (« Où est le nord ? », « C'est… », « Est-ce que… ») ;
      // point cardinal s'il est seul ou annoncé par un mot-repère.
      const prev = i > 0 ? tokens[i - 1] : null
      const last = i === tokens.length - 1
      const cued = prev !== null && (EST_CUES.has(prev) || (last && EST_FINAL_CUES.has(prev)))
      if (tokens.length === 1 || cued) add('est')
    }
  })

  return found
}

export function answerFor(input: string): string {
  const directions = detectDirections(input)
  if (directions.length === 0) return UNKNOWN_ANSWER
  return directions.map(d => ANSWERS[d]).join(' ')
}
