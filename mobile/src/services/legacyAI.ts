// Porte unique vers les fonctions d'IA historiques de Tiroir (Edge
// Functions Supabase, hors Firebase). Dans le build hackathon, elle est
// fermée : toute l'IA de ce build passe par Firebase AI Logic
// (services/hybridAI). Hors hackathon, rien ne change.
//
// Tout appel à l'une de ces fonctions passe par `invokeAI` — le test
// web/__tests__/hybridAI.test.ts casse si un écran les appelle en direct.
import { supabase } from '@/lib/supabase'
import { HACKATHON_BUILD } from '@/services/hybridAI/config'

/** Faux dans le build hackathon : les fonctions d'IA historiques sont masquées. */
export const LEGACY_AI_ENABLED = !HACKATHON_BUILD

/** Les sept fonctions d'IA hors Firebase (supabase/functions). */
export const LEGACY_AI_FUNCTIONS = [
  'chat-turn',
  'describe-object',
  'detect-scene',
  'estimate-value',
  'assistant-chat',
  'enhance-object-photo',
  'scene-thumbnail',
] as const
export type LegacyAIFunction = (typeof LEGACY_AI_FUNCTIONS)[number]

export class LegacyAIDisabledError extends Error {
  constructor(name: string) {
    super(`Fonction d'IA « ${name} » absente de ce build (hackathon : Firebase AI Logic seulement).`)
    this.name = 'LegacyAIDisabledError'
  }
}

/** Lève si les fonctions d'IA historiques sont fermées. */
export function assertLegacyAI(name: LegacyAIFunction): void {
  if (!LEGACY_AI_ENABLED) throw new LegacyAIDisabledError(name)
}

/** `supabase.functions.invoke` pour une fonction d'IA, fermé dans le build hackathon. */
export async function invokeAI(
  name: LegacyAIFunction,
  options?: Parameters<typeof supabase.functions.invoke>[1],
) {
  assertLegacyAI(name)
  return supabase.functions.invoke(name, options)
}
