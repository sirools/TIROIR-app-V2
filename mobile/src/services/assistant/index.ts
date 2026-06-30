import { AssistantService } from './types'
import { MockAssistantService } from './MockAssistantService'
import { SupabaseAssistantService } from './SupabaseAssistantService'

/**
 * Interrupteur de service IA :
 *   EXPO_PUBLIC_USE_MOCK_ASSISTANT=true  → MockAssistantService (données simulées)
 *   EXPO_PUBLIC_USE_MOCK_ASSISTANT=false → SupabaseAssistantService (Edge Function chat-turn)
 *   (valeur absente)                     → SupabaseAssistantService par défaut
 *
 * Le mock reste disponible pour les tests et le développement offline.
 */
const useMock = process.env.EXPO_PUBLIC_USE_MOCK_ASSISTANT === 'true'

export const assistantService: AssistantService = useMock
  ? new MockAssistantService()
  : new SupabaseAssistantService()

export type { AssistantService } from './types'
