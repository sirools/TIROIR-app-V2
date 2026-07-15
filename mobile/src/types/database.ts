// Types TypeScript alignés sur le schéma Supabase V2
// Généré manuellement — tenir synchronisé avec les migrations

export type ObjectStatus = 'owned' | 'stored' | 'loaned' | 'sold' | 'given' | 'lost'
export type DraftStatus = 'uploading' | 'pending' | 'confirmed' | 'rejected' | 'expired'
export type MessageRole = 'user' | 'assistant' | 'tool_call' | 'tool_result'
export type ProposalStatus = 'pending' | 'confirmed' | 'rejected'

export interface Profile {
  id: string
  display_name: string | null
  avatar_url: string | null
  plan: 'free' | 'premium'
  created_at: string
  updated_at: string
}

export interface Drawer {
  id: string
  user_id: string
  name: string
  created_at: string
  updated_at: string
}

export interface Collection {
  id: string
  user_id: string
  drawer_id: string
  name: string
  description: string | null
  location: string | null
  cover_image_path: string | null
  emoji: string
  icon_color: string
  created_at: string
  updated_at: string
}

export interface ValueSource {
  site: string
  price: number
  url?: string | null
  title?: string
}

export interface TiroirObject {
  id: string
  user_id: string
  collection_id: string | null
  title: string
  description: string | null
  status: ObjectStatus
  location_note: string | null
  attributes: Record<string, string | number | boolean | null>
  created_at: string
  updated_at: string
  // Valeur marchande
  market_value: number | null
  user_value: number | null
  value_currency: string
  value_estimated_at: string | null
  value_sources: {
    sources: ValueSource[]
    confidence: 'low' | 'medium' | 'high'
    value_min?: number
    value_max?: number
    summary?: string
    ai_value?: number  // valeur originale IA avant override utilisateur
  } | null
  // Prix de vente / caution
  sale_price: number | null
  deposit_amount: number | null
  // Prix d'achat
  purchase_price: number | null
  purchase_currency: string
  purchase_date: string | null
  // Assurance
  insured: boolean
  insurance_type: string | null
  insurance_coverage: number | null
  insurance_policy_ref: string | null
  insurance_provider: string | null
  insurance_expires_at: string | null
}

export interface ObjectInsurance {
  id: string
  object_id: string
  user_id: string
  label: string | null
  price: number | null
  billing_period: 'monthly' | 'yearly'
  coverage: number | null
  date: string | null // échéance du contrat (optionnelle)
  position: number
  created_at: string
  updated_at: string
}

export interface ObjectImage {
  id: string
  object_id: string
  user_id: string
  storage_path: string
  mime_type: string
  size_bytes: number | null
  position: number
  is_cover: boolean
  created_at: string
}

export interface AiDraft {
  id: string
  user_id: string
  conversation_id: string | null
  proposed_data: DraftProposedData
  status: DraftStatus
  confirmed_object_id: string | null
  confirmed_at: string | null
  expires_at: string
  created_at: string
  updated_at: string
}

export interface DraftProposedData {
  title?: string
  description?: string
  status?: ObjectStatus
  location_note?: string
  attributes?: Record<string, string | number | boolean | null>
}

export interface AiDraftImage {
  id: string
  draft_id: string
  user_id: string
  storage_path: string
  mime_type: string
  size_bytes: number | null
  position: number
  created_at: string
}

// Résultat de search_objects RPC
export interface SearchResult {
  id: string
  title: string
  description: string | null
  location_note: string | null
  status: ObjectStatus
  collection_id: string | null
  attributes: Record<string, string | number | boolean | null>
  rank: number
}
