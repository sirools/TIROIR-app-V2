// Consignes, schémas et lecture des réponses de la « Fiche express ».
// Aucun appel réseau ici : ce fichier est pur, testé par
// __tests__/hybridAI.test.ts, et destiné à être repris tel quel par l'app.
import type { Enrichment, QuickCard, ValueEstimate } from './types'

const LANGUAGE_NAMES: Record<string, string> = {
  fr: 'French', en: 'English', es: 'Spanish', de: 'German', pt: 'Portuguese',
}
const languageName = (locale: string) => LANGUAGE_NAMES[locale.slice(0, 2)] ?? 'English'

/** Schéma JSON de la fiche rapide (même schéma sur l'appareil et dans le cloud). */
export const QUICK_CARD_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    category: { type: 'string' },
    description: { type: 'string' },
  },
  required: ['name', 'category', 'description'],
} as const

/** Schéma JSON de l'enrichissement. `valueLow` = `valueHigh` = 0 : pas d'estimation. */
export const ENRICHMENT_SCHEMA = {
  type: 'object',
  properties: {
    detailedDescription: { type: 'string' },
    valueLow: { type: 'number' },
    valueHigh: { type: 'number' },
    valueNote: { type: 'string' },
  },
  required: ['detailedDescription', 'valueLow', 'valueHigh', 'valueNote'],
} as const

export function quickCardPrompt(locale: string): string {
  return [
    'You catalogue personal belongings for a home inventory app.',
    'Look at the photo and identify the main object.',
    `Answer in ${languageName(locale)} with a JSON object:`,
    '- "name": the object, 2 to 6 words, no trailing period;',
    '- "category": one or two words (for example: books, tools, clothing, electronics, toys, kitchen, furniture, art);',
    '- "description": one sentence, 25 words at most, stating only what is visible.',
    'Do not guess a brand or a model that you cannot read on the object.',
  ].join('\n')
}

/**
 * Ce que l'appareil a vu sur la photo sans modèle de langage (sur iPhone :
 * le framework Vision d'Apple) — étiquettes d'image et texte lisible.
 */
export type PhotoObservations = { labels: string[]; texts: string[] }

/**
 * Fiche rapide pour un modèle embarqué qui ne lit pas les images : il
 * rédige à partir de ce que l'appareil a observé sur la photo.
 */
export function observationsPrompt(locale: string, seen: PhotoObservations): string {
  const list = (items: string[]) => (items.length ? items.map(i => i.replace(/[\n"]/g, ' ').trim()).join(', ') : 'none')
  return [
    'You catalogue personal belongings for a home inventory app.',
    'An on-device image analysis of a photo of one object returned:',
    `- image labels, most likely first: ${list(seen.labels.slice(0, 8))}`,
    `- text readable on the object: ${list(seen.texts.slice(0, 8))}`,
    `Write, in ${languageName(locale)}:`,
    '- name: the object, 2 to 6 words, no trailing period;',
    '- category: one or two words (for example: books, tools, clothing, electronics, toys, kitchen, furniture, art);',
    '- description: one sentence, 25 words at most, using only the labels and the text above.',
    'Use the readable text as a brand, title or model only when it clearly is one.',
  ].join('\n')
}

export function enrichmentPrompt(locale: string, quick: QuickCard): string {
  return [
    'You are Torix, the assistant of the Tiroir home inventory app.',
    `A first pass named this object "${quick.name}" (category: ${quick.category}).`,
    'Look at the photo again and correct that first pass if it is wrong.',
    `Answer in ${languageName(locale)} with a JSON object:`,
    '- "detailedDescription": 3 to 5 sentences: material, condition, distinctive marks, likely period or model when visible;',
    '- "valueLow" and "valueHigh": a realistic second-hand price range in euros for this object in the condition shown;',
    '- "valueNote": one sentence explaining what drives the price, and what would need checking.',
    'If the object cannot be valued from the photo, set "valueLow" and "valueHigh" to 0 and explain why in "valueNote".',
  ].join('\n')
}

/** Extrait l'objet JSON d'une réponse, même entourée de ```json … ```. */
function parseObject(text: string): Record<string, unknown> {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('Réponse sans objet JSON')
  const parsed: unknown = JSON.parse(text.slice(start, end + 1))
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Réponse JSON inattendue')
  return parsed as Record<string, unknown>
}

function text(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  const clean = value.replace(/\s+/g, ' ').trim()
  return clean.length > max ? clean.slice(0, max - 1).trimEnd() + '…' : clean
}

/** Lit la fiche rapide ; lève si le modèle n'a pas nommé l'objet. */
export function parseQuickCard(raw: string): QuickCard {
  const o = parseObject(raw)
  const name = text(o.name, 80).replace(/\.$/, '')
  if (!name) throw new Error('Fiche sans nom')
  return { name, category: text(o.category, 40), description: text(o.description, 280) }
}

function parseValue(o: Record<string, unknown>): ValueEstimate | null {
  const low = Number(o.valueLow)
  const high = Number(o.valueHigh)
  if (!Number.isFinite(low) || !Number.isFinite(high) || low < 0 || high <= 0) return null
  const [min, max] = low <= high ? [low, high] : [high, low]
  return { low: Math.round(min), high: Math.round(max), currency: 'EUR', note: text(o.valueNote, 280) }
}

/** Lit l'enrichissement ; lève si la description détaillée manque. */
export function parseEnrichment(raw: string): Enrichment {
  const o = parseObject(raw)
  const detailedDescription = text(o.detailedDescription, 1200)
  if (!detailedDescription) throw new Error('Enrichissement sans description')
  return { detailedDescription, value: parseValue(o) }
}
