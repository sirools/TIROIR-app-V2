// ================================================================
// chat-turn/types.ts
// Types internes de l'Edge Function chat-turn.
// Alignés sur le schéma Tiroir V2 (migrations 002, 003, 004).
// ================================================================

// ── Requête entrante ─────────────────────────────────────────────

export interface ChatTurnRequest {
  /** UUID du draft en statut 'uploading' à analyser */
  draft_id: string
  /**
   * Message optionnel de l'utilisateur accompagnant les photos.
   * Ex : "C'est une perceuse Bosch achetée en 2022"
   */
  user_message?: string
}

// ── Réponse sortante ─────────────────────────────────────────────

export interface ChatTurnResponse {
  ok: true
  draft_id: string
  proposed_data: ProposedData
  /** Message de l'assistant affiché dans l'UI */
  assistant_message: string
}

export interface ChatTurnErrorResponse {
  ok: false
  error: string
  /** Code machine pour le client */
  code: ChatTurnErrorCode
}

export type ChatTurnErrorCode =
  | 'UNAUTHORIZED'
  | 'INVALID_BODY'
  | 'DRAFT_NOT_FOUND'
  | 'DRAFT_WRONG_STATUS'
  | 'NO_IMAGES'
  | 'CLAUDE_ERROR'
  | 'INTERNAL_ERROR'

// ── Données proposées par l'IA ───────────────────────────────────
// Miroir de DraftProposedData dans mobile/src/types/database.ts

export type ObjectStatus = 'owned' | 'stored' | 'loaned' | 'sold' | 'given' | 'lost'

export interface ProposedData {
  title: string
  description: string
  status: ObjectStatus
  location_note: string | null
  attributes: FlatJsonObject
}

/** Objet JSON plat : valeurs scalaires uniquement (miroir de is_flat_json_object) */
export type FlatJsonObject = Record<string, string | number | boolean | null>

// ── Lignes de base de données ────────────────────────────────────

export interface AiDraftRow {
  id: string
  user_id: string
  conversation_id: string | null
  proposed_data: Record<string, unknown>
  status: 'uploading' | 'pending' | 'confirmed' | 'rejected' | 'expired'
  expires_at: string
  created_at: string
  updated_at: string
}

export interface AiDraftImageRow {
  id: string
  draft_id: string
  user_id: string
  storage_path: string
  mime_type: string
  size_bytes: number | null
  position: number
  created_at: string
}

// ── Claude API ───────────────────────────────────────────────────

export interface ClaudeImageSource {
  type: 'base64'
  media_type: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
  data: string
}

export interface ClaudeImageBlock {
  type: 'image'
  source: ClaudeImageSource
}

export interface ClaudeTextBlock {
  type: 'text'
  text: string
}

export type ClaudeContentBlock = ClaudeImageBlock | ClaudeTextBlock

export interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: ClaudeContentBlock[] | string
}

export interface ClaudeRequest {
  model: string
  max_tokens: number
  system: string
  messages: ClaudeMessage[]
}

export interface ClaudeTextContent {
  type: 'text'
  text: string
}

export interface ClaudeResponse {
  id: string
  type: 'message'
  role: 'assistant'
  content: ClaudeTextContent[]
  model: string
  stop_reason: string
  usage: {
    input_tokens: number
    output_tokens: number
  }
}

// ── Réponse JSON attendue de Claude ─────────────────────────────

export interface ClaudeAnalysisResult {
  title: string
  description: string
  status: ObjectStatus
  location_note: string | null
  attributes: FlatJsonObject
  assistant_message: string
}
