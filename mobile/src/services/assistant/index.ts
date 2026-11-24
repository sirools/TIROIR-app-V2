import { AssistantService } from './types'
import { MockAssistantService } from './MockAssistantService'
import { SupabaseAssistantService } from './SupabaseAssistantService'
import { LEGACY_AI_ENABLED, assertLegacyAI } from '@/services/legacyAI'

/**
 * Interrupteur de service IA :
 *   EXPO_PUBLIC_USE_MOCK_ASSISTANT=true  → MockAssistantService (données simulées)
 *   EXPO_PUBLIC_USE_MOCK_ASSISTANT=false → SupabaseAssistantService (Edge Function chat-turn)
 *   (valeur absente)                     → SupabaseAssistantService par défaut
 *
 * Le mock reste disponible pour les tests et le développement offline.
 *
 * Build hackathon : aucun des deux — l'analyse par chat-turn est fermée,
 * la fiche vient de la Fiche express (Firebase AI Logic).
 */
const useMock = process.env.EXPO_PUBLIC_USE_MOCK_ASSISTANT === 'true'

const disabled: AssistantService = {
  async analyzeDraft() {
    assertLegacyAI('chat-turn')
    throw new Error('inatteignable')
  },
}

export const assistantService: AssistantService = !LEGACY_AI_ENABLED
  ? disabled
  : useMock
    ? new MockAssistantService()
    : new SupabaseAssistantService()

export type { AssistantService } from './types'
