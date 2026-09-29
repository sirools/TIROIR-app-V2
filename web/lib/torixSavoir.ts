// Torix puise dans savoir.md (components/torix/savoir.md), le savoir de
// Clément. Lecture et recherche sans modèle : on découpe le fichier en
// entrées (une puce = une entrée, avec son registre), puis on garde celles
// qui partagent le plus de mots avec la question.
//
// Serveur seulement (pages/api/torix/ask.ts) : ce module ne doit jamais être
// importé par une page (test torixPrive). Les parties « À compléter » ne
// sont jamais citées : Torix n'invente rien.
import type { Register } from '../components/torix/registers'

export type SavoirEntry = { section: string; register: Register; label: string; text: string }

const REGISTERS: [RegExp, Register][] = [
  [/^fait$/i, 'fait'],
  [/^principe$/i, 'principe'],
  [/^d[ée]cision\b/i, 'decision'],
  [/^v[ée]cu$/i, 'vecu'],
]

/** Découpe savoir.md en entrées « **Registre** — texte ». */
export function parseSavoir(md: string): SavoirEntry[] {
  const entries: SavoirEntry[] = []
  let section = ''
  let current: SavoirEntry | null = null
  const flush = () => { if (current) entries.push(current); current = null }

  for (const raw of md.split('\n')) {
    const line = raw.trimEnd()
    const heading = line.match(/^##\s+(?:\d+\.\s*)?(.+)$/)
    if (heading) { flush(); section = heading[1].trim(); continue }
    const bullet = line.match(/^-\s+\*\*([^*]+)\*\*\s*[—–-]\s*(.+)$/)
    if (bullet && section) {
      flush()
      const label = bullet[1].trim()
      const reg = REGISTERS.find(([re]) => re.test(label))
      if (!reg) continue
      current = { section, register: reg[1], label, text: bullet[2].trim() }
      continue
    }
    // Suite d'une puce sur plusieurs lignes.
    if (current && /^\s{2,}\S/.test(raw)) { current.text += ' ' + line.trim(); continue }
    flush()
  }
  flush()
  return entries.map(e => ({ ...e, text: e.text.replace(/`([^`]+)`/g, '$1') }))
}

const STOP = new Set([
  'les', 'des', 'une', 'est', 'que', 'qui', 'quoi', 'dans', 'pour', 'par', 'sur', 'avec', 'mon', 'ma', 'mes',
  'ton', 'ta', 'tes', 'son', 'sa', 'ses', 'ce', 'cet', 'cette', 'ces', 'du', 'de', 'la', 'le', 'et', 'ou', 'en',
  'au', 'aux', 'il', 'elle', 'je', 'tu', 'on', 'nous', 'vous', 'ils', 'pas', 'plus', 'c', 'qu', 'd', 'l', 'j',
  'fait', 'faire', 'comment', 'quel', 'quelle', 'quels', 'quelles', 'dis', 'moi', 'toi', 'as', 'ai', 'a',
  // Présents partout : ils ne départagent rien.
  'tiroir', 'torix',
])

function words(text: string): string[] {
  return text
    .normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(w => w.length >= 3 && !STOP.has(w))
    .map(w => (w.length > 4 ? w.replace(/(s|x)$/, '').replace(/e$/, '') : w))
}

/** Entrées les plus proches de la question (deux au plus), ou aucune. */
export function searchSavoir(question: string, entries: SavoirEntry[], max = 2): SavoirEntry[] {
  return scoreSavoir(question, entries).slice(0, max).map(s => s.e)
}

/** Toutes les entrées qui touchent la question, de la plus proche à la moins proche. */
export function scoreSavoir(question: string, entries: SavoirEntry[]): { e: SavoirEntry; score: number }[] {
  const q = new Set(words(question))
  if (!q.size) return []
  const scored = entries
    .map(e => {
      const inText = new Set(words(e.text))
      const inSection = new Set(words(e.section))
      let score = 0
      for (const w of q) {
        if (inText.has(w)) score += 1
        if (inSection.has(w)) score += 2
      }
      return { e, score }
    })
    .filter(s => s.score >= 2)
    .sort((a, b) => b.score - a.score)
  return scored
}

/** Au-delà de ce score, savoir.md passe avant les fiches sur Tiroir. */
export const STRONG_MATCH = 3

/** Réponse de Torix tirée de savoir.md, ou null s'il n'y trouve rien. */
export function answerFromSavoir(question: string, entries: SavoirEntry[], minScore = 2) {
  const scored = scoreSavoir(question, entries)
  if (!scored.length || scored[0].score < minScore) return null
  const found = scored.slice(0, 2).map(s => s.e)
  return {
    text: found.map(e => e.text).join('\n'),
    register: found[0].register,
    source: `savoir.md · ${found[0].section}`,
  }
}
