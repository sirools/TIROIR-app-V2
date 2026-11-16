// Les profils proposés à l'inscription, rangés par familles. La liste
// n'est pas exhaustive : « autre » mène au profil de base. Le profil ne
// sert qu'à choisir les cartes du tableau de bord (lib/dashboard.ts) ; il
// est gardé dans profiles.persona et se change dans « Profil ».
//
// Santé : le profil se choisit, mais il renvoie vers un contact pour
// l'offre Business sur mesure. Un inventaire lié à des patients relève des
// données de santé (hébergement certifié HDS) : rien de tel n'est stocké
// dans Tiroir aujourd'hui.

export const PERSONA_FAMILIES = [
  { key: 'home', personas: ['particulier', 'collectionneur', 'famille'] },
  { key: 'creation', personas: ['costumiere', 'decoratrice', 'videaste', 'photographe', 'musicien'] },
  { key: 'trades', personas: ['mecano', 'artisan', 'cuisinier'] },
  { key: 'commerce', personas: ['brocanteur', 'antiquaire', 'revendeur'] },
  { key: 'health', personas: ['infirmiere_coordinatrice', 'chirurgien', 'service_hospitalier'] },
  { key: 'other', personas: ['autre'] },
] as const

export type PersonaFamily = (typeof PERSONA_FAMILIES)[number]['key']
export type Persona = (typeof PERSONA_FAMILIES)[number]['personas'][number]

export const PERSONAS: readonly Persona[] = PERSONA_FAMILIES.flatMap(f => [...f.personas])

export const isPersona = (v: unknown): v is Persona => (PERSONAS as readonly unknown[]).includes(v)

export function familyOf(persona: string | null | undefined): PersonaFamily | null {
  return PERSONA_FAMILIES.find(f => (f.personas as readonly string[]).includes(persona ?? ''))?.key ?? null
}

/** Profils de santé : un contact pour l'offre Business, pas d'inventaire lié à des patients. */
export const needsBusinessContact = (persona: string | null | undefined) => familyOf(persona) === 'health'
