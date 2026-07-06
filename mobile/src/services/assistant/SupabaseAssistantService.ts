import { supabase } from '@/lib/supabase'
import { DraftProposedData } from '@/types/database'
import { AssistantService } from './types'
import i18n, { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, type AppLanguage } from '@/i18n'

/**
 * Langue active de l'app à transmettre à l'IA pour qu'elle rédige la fiche
 * dans la bonne langue. i18n.language peut être une variante régionale
 * (ex: 'en-US') : on ne garde que le code base et on retombe sur la langue
 * par défaut si non supporté.
 */
function currentAiLocale(): AppLanguage {
  const base = i18n.language?.split('-')[0]?.toLowerCase()
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(base ?? '')
    ? (base as AppLanguage)
    : DEFAULT_LANGUAGE
}

/**
 * Réponse brute de l'Edge Function chat-turn.
 * Le champ `proposed_data` peut être absent si le tour n'a pas encore
 * produit de proposition (ex. : tour de clarification).
 */
interface ChatTurnResponse {
  ok: boolean
  draft_id: string
  proposed_data?: DraftProposedData
  assistant_message?: string
  error?: string
}

export class SupabaseAssistantService implements AssistantService {
  /**
   * Appelle l'Edge Function `chat-turn` avec le draft_id fourni.
   * L'Edge Function est responsable de :
   *   - appeler Claude Vision sur les images du draft
   *   - remplir proposed_data
   *   - passer le statut du draft de 'uploading' → 'pending'
   *
   * @throws Error si la session est expirée, si le réseau échoue,
   *         ou si l'Edge Function retourne ok: false.
   */
  async analyzeDraft(
    draftId: string,
  ): Promise<{ draftId: string; proposedData: DraftProposedData }> {
    // 1. Récupérer le token JWT de l'utilisateur courant
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) {
      throw new Error('Session expirée — veuillez vous reconnecter.')
    }

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
    const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !anonKey) {
      throw new Error(
        'Variables EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY manquantes.',
      )
    }

    // 2. Appel POST /functions/v1/chat-turn
    const endpoint = `${supabaseUrl}/functions/v1/chat-turn`

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 90_000)

    let response: Response
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
          apikey: anonKey,
        },
        body: JSON.stringify({ draft_id: draftId, locale: currentAiLocale() }),
        signal: controller.signal,
      })
    } catch (networkError) {
      if (networkError instanceof Error && networkError.name === 'AbortError') {
        throw new Error("L'analyse IA a pris trop de temps. Réessayez.")
      }
      throw new Error(
        `Impossible de joindre le serveur IA. Vérifiez votre connexion. (${String(networkError)})`,
      )
    } finally {
      clearTimeout(timer)
    }

    // 3. Parser la réponse JSON
    let payload: ChatTurnResponse
    try {
      payload = (await response.json()) as ChatTurnResponse
    } catch {
      throw new Error(
        `Réponse inattendue du serveur IA (HTTP ${response.status}).`,
      )
    }

    // 4. Vérifier le statut HTTP et le champ ok
    if (!response.ok || !payload.ok) {
      const message = payload.error ?? response.statusText
      throw new Error(`Analyse IA échouée : ${message}`)
    }

    // 5. Vérifier que proposed_data est présent
    if (!payload.proposed_data) {
      throw new Error(
        "L'IA n'a pas retourné de données proposées pour ce draft.",
      )
    }

    return {
      draftId: payload.draft_id,
      proposedData: payload.proposed_data,
    }
  }
}
