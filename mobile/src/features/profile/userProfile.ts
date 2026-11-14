// Le type de profil choisi à l'onboarding (profiles.user_profile) : une
// question, trois réponses, un tap. Il règle le ton (tu / vous), les
// exemples et les offres suggérées ; il ne déclenche jamais de paiement et
// se change dans Paramètres. Même liste sur le site
// (web/lib/userProfile.ts) et en base (supabase/drafts/essai_sans_compte.sql).
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '@/lib/supabase'

export const USER_PROFILES = ['personal', 'creative', 'business'] as const
export type UserProfile = (typeof USER_PROFILES)[number]

export const isUserProfile = (v: unknown): v is UserProfile => (USER_PROFILES as readonly unknown[]).includes(v)

export type Tone = 'tu' | 'vous'

/**
 * Règle du fondateur : tutoiement pour le grand public, vouvoiement pour ce
 * qui relève de Premium, Pro et Business. Un profil pas encore choisi est
 * traité comme le grand public.
 */
export const toneOf = (profile: string | null | undefined): Tone =>
  profile === 'creative' || profile === 'business' ? 'vous' : 'tu'

/** Clés i18n des trois réponses (design/i18n/app, section profileType). */
export const PROFILE_KEYS: Record<UserProfile, { label: string; hint: string; icon: string }> = {
  personal: { label: 'profileType.personal', hint: 'profileType.personalHint', icon: '🏠' },
  creative: { label: 'profileType.creative', hint: 'profileType.creativeHint', icon: '🎬' },
  business: { label: 'profileType.business', hint: 'profileType.businessHint', icon: '🏢' },
}

export async function saveUserProfile(userId: string, profile: UserProfile): Promise<boolean> {
  const { error } = await supabase.from('profiles').update({ user_profile: profile }).eq('id', userId)
  return !error
}

/**
 * La question doit-elle être posée ? Seulement si le compte n'a pas encore
 * répondu. `undefined` (colonne absente : base pas encore migrée) ne pose
 * pas la question — elle ne pourrait pas être enregistrée.
 */
export const shouldAskProfile = (userProfile: string | null | undefined): boolean => userProfile === null

// « Plus tard » : la question ne revient pas à chaque lancement sur cet
// appareil ; elle reste dans Paramètres.
const laterKey = (userId: string) => `profile-type-later:${userId}`

export async function wasProfileQuestionSkipped(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(laterKey(userId))) === '1'
  } catch {
    return false
  }
}

export async function skipProfileQuestion(userId: string): Promise<void> {
  try {
    await AsyncStorage.setItem(laterKey(userId), '1')
  } catch {
    /* AsyncStorage indisponible : la question reviendra, sans gravité */
  }
}
