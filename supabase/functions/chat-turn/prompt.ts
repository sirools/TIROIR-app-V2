// ================================================================
// chat-turn/prompt.ts
// Construction du prompt système et des messages Claude.
// Séparé de la logique d'appel pour faciliter les tests et
// l'évolution du prompt sans toucher à l'orchestration.
// ================================================================

import type {
  ClaudeContentBlock,
  ClaudeImageSource,
  ClaudeMessage,
  AiDraftImageRow,
  AiLocale,
} from './types.ts'

// ── Langues supportées ───────────────────────────────────────────

/** Nom de la langue cible tel qu'exprimé DANS cette langue, pour l'instruction au modèle. */
const LANGUAGE_NATIVE_NAME: Record<AiLocale, string> = {
  fr: 'français',
  en: 'English',
  es: 'español',
  de: 'Deutsch',
  'pt-BR': 'português do Brasil',
  'pt-PT': 'português europeu',
}

/** Langue par défaut côté serveur si le client n'envoie rien de valide. */
export const DEFAULT_AI_LOCALE: AiLocale = 'fr'

// ── Prompt système ───────────────────────────────────────────────

/**
 * Construit le prompt système en fonction de la langue active de l'app.
 * Les champs rédactionnels (title, description, category, color, material,
 * assistant_message) sortent dans la langue demandée ; les noms propres et
 * valeurs techniques (brand, model, serial_number, currency, dimensions,
 * voltage) ne sont JAMAIS traduits.
 */
export function buildSystemPrompt(locale: AiLocale = DEFAULT_AI_LOCALE): string {
  const language = LANGUAGE_NATIVE_NAME[locale] ?? LANGUAGE_NATIVE_NAME[DEFAULT_AI_LOCALE]

  return `Tu es l'assistant d'inventaire de l'application Tiroir.
Ton rôle est d'analyser les photos d'un objet et d'en extraire les informations structurées.

RÈGLES ABSOLUES :
1. Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans texte avant ou après.
2. Le JSON doit respecter exactement ce schéma :
{
  "title": "string — nom court et précis de l'objet (max 80 caractères)",
  "description": "string — description utile en 1-3 phrases",
  "status": "owned",
  "location_note": null,
  "attributes": {
    "brand": "string ou null",
    "model": "string ou null",
    "category": "string — catégorie principale",
    "color": "string ou null",
    "material": "string ou null",
    "serial_number": "string ou null",
    "estimated_value": "string ou null — ex: '150'",
    "currency": "string ou null — ex: 'EUR'",
    "dimensions": "string ou null — ex: '30x20x10 cm'",
    "voltage": "string ou null — ex: '230V'"
  },
  "assistant_message": "string — message court et chaleureux à afficher à l'utilisateur (1-2 phrases)"
}

CONTRAINTES SUR attributes :
- Toutes les valeurs sont des strings ou null (jamais d'objets imbriqués, jamais de tableaux).
- N'inclure que les clés pour lesquelles tu as une information réelle.
- estimated_value est une string représentant un nombre (ex: "150"), pas un nombre.
- Omets les clés dont la valeur serait null si tu n'as aucune information.

CONTRAINTES GÉNÉRALES :
- status est toujours "owned" pour un nouvel objet.
- location_note est toujours null (l'utilisateur le renseignera lui-même).
- Si plusieurs objets sont visibles, concentre-toi sur l'objet principal au premier plan.
- Si l'image est floue ou illisible, propose quand même un titre générique et explique dans assistant_message.

LANGUE DE RÉDACTION :
- Rédige title, description, assistant_message et les valeurs de attributes.category, attributes.color et attributes.material en ${language}.
- Ne traduis JAMAIS les noms propres ni les valeurs techniques : brand, model, serial_number, currency (code ISO, ex: "EUR"), dimensions et voltage restent tels quels, quelle que soit la langue.`
}

// ── Construction des messages ────────────────────────────────────

/**
 * Convertit un mime_type de la base de données vers un type accepté par Claude.
 * image/heic → image/jpeg (Claude ne supporte pas HEIC nativement).
 */
function toClaudeMediaType(
  mimeType: string,
): 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' {
  switch (mimeType) {
    case 'image/png':
      return 'image/png'
    case 'image/webp':
      return 'image/webp'
    case 'image/gif':
      return 'image/gif'
    case 'image/heic':
    case 'image/jpeg':
    default:
      return 'image/jpeg'
  }
}

/**
 * Construit les blocs de contenu Claude à partir des images du draft.
 * Les images sont triées par position (ascendant) pour respecter l'ordre
 * défini par l'utilisateur lors de la capture.
 *
 * @param images - Lignes ai_draft_images avec leur contenu base64
 * @param userMessage - Message optionnel de l'utilisateur
 */
export function buildUserMessage(
  images: Array<AiDraftImageRow & { base64Data: string }>,
  userMessage?: string,
  locale: AiLocale = DEFAULT_AI_LOCALE,
): ClaudeMessage {
  const content: ClaudeContentBlock[] = []

  // Trier par position
  const sorted = [...images].sort((a, b) => a.position - b.position)

  // Ajouter chaque image comme bloc image
  for (const img of sorted) {
    const source: ClaudeImageSource = {
      type: 'base64',
      media_type: toClaudeMediaType(img.mime_type),
      data: img.base64Data,
    }
    content.push({ type: 'image', source })
  }

  // Texte d'instruction (localisé pour ne pas biaiser la langue de sortie)
  // + message utilisateur optionnel.
  const count = images.length
  const instruction: Record<AiLocale, string> = {
    fr: `Analyse ${count === 1 ? 'cette photo' : `ces ${count} photos`} et retourne le JSON structuré de l'objet.`,
    en: `Analyze ${count === 1 ? 'this photo' : `these ${count} photos`} and return the structured JSON for the item.`,
    es: `Analiza ${count === 1 ? 'esta foto' : `estas ${count} fotos`} y devuelve el JSON estructurado del objeto.`,
    de: `Analysiere ${count === 1 ? 'dieses Foto' : `diese ${count} Fotos`} und gib das strukturierte JSON des Objekts zurück.`,
    'pt-BR': `Analise ${count === 1 ? 'esta foto' : `estas ${count} fotos`} e retorne o JSON estruturado do objeto.`,
    'pt-PT': `Analise ${count === 1 ? 'esta fotografia' : `estas ${count} fotografias`} e devolva o JSON estruturado do objeto.`,
  }
  let textContent = instruction[locale] ?? instruction[DEFAULT_AI_LOCALE]

  if (userMessage && userMessage.trim().length > 0) {
    textContent += `\n\nNote de l'utilisateur : "${userMessage.trim()}"`
  }

  content.push({ type: 'text', text: textContent })

  return {
    role: 'user',
    content,
  }
}

/**
 * Valide et parse la réponse JSON de Claude.
 * Lève une erreur descriptive si le JSON est invalide ou incomplet.
 */
export function parseClaudeResponse(rawText: string): {
  title: string
  description: string
  status: 'owned' | 'stored' | 'loaned' | 'sold' | 'given' | 'lost'
  location_note: string | null
  attributes: Record<string, string | number | boolean | null>
  assistant_message: string
} {
  // Nettoyer le texte : Claude peut parfois ajouter des backticks malgré les instructions
  const cleaned = rawText
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error(`Réponse Claude non-JSON : ${cleaned.slice(0, 200)}`)
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Réponse Claude : objet JSON attendu')
  }

  const obj = parsed as Record<string, unknown>

  // Validation des champs obligatoires
  if (typeof obj.title !== 'string' || obj.title.trim().length === 0) {
    throw new Error('Réponse Claude : "title" manquant ou vide')
  }
  if (typeof obj.description !== 'string') {
    throw new Error('Réponse Claude : "description" manquant')
  }
  if (typeof obj.assistant_message !== 'string') {
    throw new Error('Réponse Claude : "assistant_message" manquant')
  }

  // Validation status
  const validStatuses = ['owned', 'stored', 'loaned', 'sold', 'given', 'lost'] as const
  const status = (obj.status as string) ?? 'owned'
  if (!validStatuses.includes(status as (typeof validStatuses)[number])) {
    throw new Error(`Réponse Claude : status invalide "${status}"`)
  }

  // Validation attributes : objet plat
  const attributes = obj.attributes ?? {}
  if (typeof attributes !== 'object' || Array.isArray(attributes)) {
    throw new Error('Réponse Claude : "attributes" doit être un objet')
  }

  // Filtrer les valeurs non-scalaires pour robustesse
  const flatAttributes: Record<string, string | number | boolean | null> = {}
  for (const [key, val] of Object.entries(attributes as Record<string, unknown>)) {
    if (
      val === null ||
      typeof val === 'string' ||
      typeof val === 'number' ||
      typeof val === 'boolean'
    ) {
      flatAttributes[key] = val as string | number | boolean | null
    }
    // Ignorer silencieusement les valeurs imbriquées (objets/tableaux)
  }

  return {
    title: obj.title.trim().slice(0, 80),
    description: (obj.description as string).trim(),
    status: status as (typeof validStatuses)[number],
    location_note: typeof obj.location_note === 'string' ? obj.location_note : null,
    attributes: flatAttributes,
    assistant_message: (obj.assistant_message as string).trim(),
  }
}
