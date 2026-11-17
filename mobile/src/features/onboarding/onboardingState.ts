import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types/database'
import { METIER_AUTRE, webPersonaFor, type Usage } from './metiers'

/**
 * L'onboarding s'affiche quand le profil dit qu'il n'a jamais été
 * présenté : `onboarding_completed_at` vaut NULL. `undefined` (la colonne
 * n'existe pas encore dans la base à laquelle l'app parle) ne l'affiche
 * pas : l'app peut sortir avant la migration sans rien ouvrir.
 */
export const needsOnboarding = (profile: Profile | null): boolean =>
  !!profile && profile.onboarding_completed_at === null

// Mémoire locale : si l'écriture du profil échoue (réseau), l'onboarding
// ne doit pas pour autant revenir à chaque ouverture.
const seenKey = (userId: string) => `tiroir.onboarding.seen.${userId}`

export async function wasOnboardingSeen(userId: string): Promise<boolean> {
  try { return (await AsyncStorage.getItem(seenKey(userId))) !== null } catch { return false }
}

async function rememberOnboardingSeen(userId: string) {
  try { await AsyncStorage.setItem(seenKey(userId), new Date().toISOString()) } catch { /* sans gravité */ }
}

export interface OnboardingAnswers {
  usage: Usage | null
  metier: string | null
  metierAutre: string
}

/**
 * Termine l'onboarding — au bout, ou par « Passer » / « Plus tard » : ce
 * qui a été choisi jusque-là est gardé, et la date posée. N'échoue
 * jamais : une erreur d'écriture ne doit pas retenir l'utilisateur.
 */
export async function completeOnboarding(profile: Profile | null, userId: string, answers: OnboardingAnswers) {
  await rememberOnboardingSeen(userId)

  const autre = answers.metier === METIER_AUTRE ? answers.metierAutre.trim().slice(0, 80) : ''
  const patch: Record<string, string | null> = {
    onboarding_completed_at: new Date().toISOString(),
  }
  // Rien de choisi (« Passer » dès le premier écran, ou depuis les
  // Paramètres) : on ne touche pas aux réponses déjà gardées.
  if (answers.usage) {
    patch.usage = answers.usage
    patch.metier = answers.metier
    patch.metier_autre = autre || null
    // Le site pose la même question (profiles.persona) : on y répond pour
    // lui quand il ne l'a pas encore, sans jamais écraser son choix.
    const persona = webPersonaFor(answers.metier)
    if (persona && profile && profile.persona == null) patch.persona = persona
  }

  try {
    const { error } = await supabase.from('profiles').update(patch).eq('id', userId)
    if (error) console.warn('[onboarding] profil non enregistré', error.message)
  } catch (e) {
    console.warn('[onboarding] profil non enregistré', e)
  }
}
