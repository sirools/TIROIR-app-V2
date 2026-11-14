// Le type de profil choisi à l'onboarding (profiles.user_profile) : une
// question, trois réponses. Il règle le ton (tu / vous), les exemples et
// les offres suggérées ; il ne déclenche jamais de paiement et se change
// dans « Profil ». Même liste dans l'app (mobile/src/features/profile/userProfile.ts)
// et en base (supabase/drafts/essai_sans_compte.sql).
//
// Le métier précis (profiles.persona, lib/personas.ts) reste facultatif,
// dans « Profil » : il affine les cartes de l'accueil.
import { familyOf, type PersonaFamily } from './personas'

export const USER_PROFILES = ['personal', 'creative', 'business'] as const
export type UserProfile = (typeof USER_PROFILES)[number]

export const isUserProfile = (v: unknown): v is UserProfile => (USER_PROFILES as readonly unknown[]).includes(v)

export type Tone = 'tu' | 'vous'

/**
 * Règle du fondateur (web/locales/README.md) : tutoiement pour le grand
 * public, vouvoiement pour ce qui relève de Premium, Pro et Business. Un
 * profil pas encore choisi est traité comme le grand public.
 */
export const toneOf = (profile: string | null | undefined): Tone =>
  profile === 'creative' || profile === 'business' ? 'vous' : 'tu'

/**
 * Les textes d'une section au ton voulu. Une section qui existe aux deux
 * tons porte une sous-clé `formal` : seulement les textes qui changent au
 * vouvoiement. Le reste est commun.
 */
export function toned<T extends { formal?: Partial<Omit<T, 'formal'>> }>(section: T, tone: Tone): T {
  return tone === 'vous' && section.formal ? { ...section, ...section.formal } : section
}

/** Famille de cartes de l'accueil pour un profil sans métier précis (lib/dashboard.ts). */
export const PROFILE_FAMILY: Record<UserProfile, PersonaFamily | null> = {
  personal: null,
  creative: 'creation',
  business: 'trades',
}

/** Type de profil d'un compte qui a déjà dit son métier (même règle que le rattrapage SQL). */
export function profileFromPersona(persona: string | null | undefined): UserProfile | null {
  const family = familyOf(persona)
  if (family === 'home') return 'personal'
  if (family === 'creation') return 'creative'
  if (family === 'trades' || family === 'commerce' || family === 'health') return 'business'
  return null
}

/** Offre à suggérer à un compte gratuit, selon son profil (jamais de paiement déclenché). */
export const suggestedOffer = (profile: string | null | undefined, plan: string): 'creative' | 'business' | null =>
  plan === 'free' && (profile === 'creative' || profile === 'business') ? profile : null
