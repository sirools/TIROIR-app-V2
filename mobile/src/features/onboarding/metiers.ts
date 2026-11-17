// L'onboarding : les usages, les métiers proposés pour chacun, et la
// première collection suggérée. Aucune dépendance à React Native : ce
// fichier est aussi lu par le test web/__tests__/onboardingMetiers.test.ts,
// qui vérifie que chaque métier a son nom et sa suggestion dans les textes
// (design/i18n/app/).
//
// Les identifiants sont ceux gardés dans profiles.usage et profiles.metier.
// Quand un métier existe aussi sur le site (web/lib/personas.ts), il porte
// le même identifiant : l'app peut alors remplir profiles.persona.

export const USAGES = ['perso', 'creatif', 'business'] as const
export type Usage = (typeof USAGES)[number]

/** « Autre » : champ libre, gardé dans profiles.metier_autre. */
export const METIER_AUTRE = 'autre'

export const METIERS_BY_USAGE = {
  perso: ['particulier', 'collectionneur', 'famille'],
  creatif: ['videaste', 'photographe', 'styliste', 'costumiere', 'decoratrice', 'musicien'],
  business: ['brocanteur', 'antiquaire', 'revendeur', 'loueur_materiel', 'artisan', 'mecano', 'cuisinier'],
} as const satisfies Record<Usage, readonly string[]>

export type Metier = (typeof METIERS_BY_USAGE)[Usage][number]

export const METIERS: readonly Metier[] = USAGES.flatMap(u => [...METIERS_BY_USAGE[u]])

export const isUsage = (v: unknown): v is Usage => (USAGES as readonly unknown[]).includes(v)
export const isMetier = (v: unknown): v is Metier => (METIERS as readonly unknown[]).includes(v)

/** L'usage auquel un métier appartient (pour repartir d'un profil choisi sur le site). */
export function usageOfMetier(metier: string | null | undefined): Usage | null {
  return USAGES.find(u => (METIERS_BY_USAGE[u] as readonly string[]).includes(metier ?? '')) ?? null
}

/**
 * Métiers que le site connaît aussi (web/lib/personas.ts). `styliste` et
 * `loueur_materiel` n'y sont pas : pour eux, persona reste vide.
 */
const WEB_PERSONAS: readonly string[] = [
  'particulier', 'collectionneur', 'famille',
  'costumiere', 'decoratrice', 'videaste', 'photographe', 'musicien',
  'mecano', 'artisan', 'cuisinier',
  'brocanteur', 'antiquaire', 'revendeur',
  'autre',
]
export const webPersonaFor = (metier: string | null): string | null =>
  metier && WEB_PERSONAS.includes(metier) ? metier : null

// ── Première collection ─────────────────────────────────────────────────────

/** Clés des noms proposés : onboarding.collection.suggestions.<clé>. */
export const SUGGESTIONS = {
  maison: '🏡', collection: '🖼️', famille: '🧸',
  video: '🎥', photo: '📷', vestiaire: '👗', costumes: '🎭', accessoires: '🛋️', instruments: '🎸',
  stock: '📦', parc: '🧰', atelier: '🛠️', cuisine: '🍳',
  materiel: '🧰',
} as const
export type SuggestionKey = keyof typeof SUGGESTIONS

const SUGGESTION_BY_METIER: Record<Metier, SuggestionKey> = {
  particulier: 'maison', collectionneur: 'collection', famille: 'famille',
  videaste: 'video', photographe: 'photo', styliste: 'vestiaire', costumiere: 'costumes',
  decoratrice: 'accessoires', musicien: 'instruments',
  brocanteur: 'stock', antiquaire: 'stock', revendeur: 'stock', loueur_materiel: 'parc',
  artisan: 'atelier', mecano: 'atelier', cuisinier: 'cuisine',
}

/** Sans métier précis (« autre ») : la collection la plus courante de l'usage. */
const SUGGESTION_BY_USAGE: Record<Usage, SuggestionKey> = {
  perso: 'maison', creatif: 'materiel', business: 'stock',
}

export function suggestionFor(usage: Usage | null, metier: string | null): SuggestionKey {
  if (isMetier(metier)) return SUGGESTION_BY_METIER[metier]
  return SUGGESTION_BY_USAGE[usage ?? 'perso']
}
