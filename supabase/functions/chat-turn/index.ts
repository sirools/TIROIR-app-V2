// ================================================================
// chat-turn/index.ts
// Edge Function principale : analyse les photos d'un draft via
// Claude Vision et passe le draft de 'uploading' à 'pending'.
//
// Flux :
//   POST /functions/v1/chat-turn
//   Body : { draft_id: string, user_message?: string }
//
//   1. Authentification JWT (anon key côté client)
//   2. Validation du draft (statut 'uploading', appartenance user)
//   3. Récupération des images depuis Supabase Storage
//   4. Appel Claude Vision (claude-haiku-4-5-20251001)
//   5. Mise à jour du draft : status='pending', proposed_data rempli
//   6. Retour de proposed_data + assistant_message
//
// Sécurité :
//   - service_role uniquement côté Edge Function (jamais exposé au client)
//   - Vérification user_id sur chaque requête DB
//   - Validation stricte du body entrant
// ================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { callClaude, ClaudeError, extractTextFromResponse, CLAUDE_MODEL } from './claude.ts'
import { SYSTEM_PROMPT, buildUserMessage, parseClaudeResponse } from './prompt.ts'
import type {
  ChatTurnRequest,
  ChatTurnResponse,
  ChatTurnErrorResponse,
  ChatTurnErrorCode,
  AiDraftRow,
  AiDraftImageRow,
  ClaudeRequest,
} from './types.ts'

// ── CORS ─────────────────────────────────────────────────────────

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ── Helpers de réponse ───────────────────────────────────────────

function jsonResponse(body: ChatTurnResponse | ChatTurnErrorResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

function errorResponse(
  code: ChatTurnErrorCode,
  message: string,
  status: number,
): Response {
  const body: ChatTurnErrorResponse = { ok: false, error: message, code }
  return jsonResponse(body, status)
}

// ── Validation du body ───────────────────────────────────────────

function validateBody(raw: unknown): ChatTurnRequest {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new ValidationError('Body JSON invalide : objet attendu', 'INVALID_BODY')
  }
  const obj = raw as Record<string, unknown>

  if (typeof obj.draft_id !== 'string' || obj.draft_id.trim().length === 0) {
    throw new ValidationError('"draft_id" requis (string UUID)', 'INVALID_BODY')
  }

  // Validation UUID basique
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(obj.draft_id)) {
    throw new ValidationError('"draft_id" doit être un UUID valide', 'INVALID_BODY')
  }

  const userMessage =
    typeof obj.user_message === 'string' ? obj.user_message.slice(0, 500) : undefined

  return { draft_id: obj.draft_id.trim(), user_message: userMessage }
}

class ValidationError extends Error {
  constructor(
    message: string,
    public readonly code: ChatTurnErrorCode,
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

// ── Handler principal ────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  // Preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }

  // Méthode
  if (req.method !== 'POST') {
    return errorResponse('INVALID_BODY', 'Méthode non autorisée : POST requis', 405)
  }

  // ── Variables d'environnement ──────────────────────────────────
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')

  if (!supabaseUrl || !serviceKey || !anonKey) {
    console.error('[chat-turn] Variables Supabase manquantes')
    return errorResponse('INTERNAL_ERROR', 'Configuration serveur incomplète', 500)
  }
  if (!anthropicApiKey) {
    console.error('[chat-turn] ANTHROPIC_API_KEY manquante')
    return errorResponse('INTERNAL_ERROR', 'Clé API IA non configurée', 500)
  }

  // ── Authentification ───────────────────────────────────────────
  const authHeader = req.headers.get('Authorization')
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return errorResponse('UNAUTHORIZED', 'Authorization Bearer requis', 401)
  }

  // Client utilisateur : vérifie l'identité sans service_role
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser()

  if (userError || !user) {
    return errorResponse('UNAUTHORIZED', 'Token invalide ou expiré', 401)
  }

  // Client admin : service_role pour bypasser RLS sur ai_drafts et Storage
  // JAMAIS exposé au client mobile
  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  // ── Parsing du body ────────────────────────────────────────────
  let request: ChatTurnRequest
  try {
    const rawBody = await req.json()
    request = validateBody(rawBody)
  } catch (err) {
    if (err instanceof ValidationError) {
      return errorResponse(err.code, err.message, 400)
    }
    return errorResponse('INVALID_BODY', 'Body JSON malformé', 400)
  }

  const { draft_id, user_message } = request

  console.log(`[chat-turn] user=${user.id} draft=${draft_id}`)

  // ── Récupération et validation du draft ───────────────────────
  const { data: draft, error: draftError } = await adminClient
    .from('ai_drafts')
    .select('id, user_id, status, expires_at, conversation_id')
    .eq('id', draft_id)
    .eq('user_id', user.id) // Sécurité : vérification propriétaire
    .single<AiDraftRow>()

  if (draftError || !draft) {
    console.warn(`[chat-turn] Draft introuvable : ${draft_id} pour user ${user.id}`)
    return errorResponse('DRAFT_NOT_FOUND', 'Draft introuvable ou accès refusé', 404)
  }

  if (draft.status !== 'uploading') {
    console.warn(`[chat-turn] Draft statut invalide : ${draft.status}`)
    return errorResponse(
      'DRAFT_WRONG_STATUS',
      `Draft déjà traité (statut actuel : ${draft.status})`,
      409,
    )
  }

  // Vérifier expiration
  if (new Date(draft.expires_at) < new Date()) {
    await adminClient
      .from('ai_drafts')
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('id', draft_id)
    return errorResponse('DRAFT_WRONG_STATUS', 'Ce draft a expiré', 410)
  }

  // ── Vérification quota IA ─────────────────────────────────────
  const { data: quotaOk, error: quotaError } = await userClient.rpc('check_and_increment_ai_quota')
  if (quotaError) {
    console.error(`[chat-turn] Erreur quota : ${quotaError.message}`)
    return errorResponse('INTERNAL_ERROR', 'Impossible de vérifier le quota', 500)
  }
  if (!quotaOk) {
    console.warn(`[chat-turn] Quota épuisé pour user ${user.id}`)
    return errorResponse('QUOTA_EXCEEDED', 'Quota IA du mois atteint (30 analyses)', 429)
  }

  // ── Récupération des images du draft ──────────────────────────
  const { data: draftImages, error: imagesError } = await adminClient
    .from('ai_draft_images')
    .select('id, draft_id, user_id, storage_path, mime_type, size_bytes, position, created_at')
    .eq('draft_id', draft_id)
    .eq('user_id', user.id)
    .order('position', { ascending: true })

  if (imagesError) {
    console.error(`[chat-turn] Erreur récupération images : ${imagesError.message}`)
    return errorResponse('INTERNAL_ERROR', 'Erreur lors de la récupération des images', 500)
  }

  const images = (draftImages ?? []) as AiDraftImageRow[]

  if (images.length === 0) {
    return errorResponse(
      'NO_IMAGES',
      'Aucune image trouvée pour ce draft. Uploadez au moins une photo.',
      422,
    )
  }

  console.log(`[chat-turn] ${images.length} image(s) à analyser`)

  // ── Téléchargement des images depuis Storage ──────────────────
  const imagesWithData: Array<AiDraftImageRow & { base64Data: string }> = []

  for (const img of images) {
    const { data: fileData, error: downloadError } = await adminClient.storage
      .from('object-images')
      .download(img.storage_path)

    if (downloadError || !fileData) {
      console.error(`[chat-turn] Erreur download ${img.storage_path}: ${downloadError?.message}`)
      // On continue avec les autres images plutôt que d'échouer complètement
      continue
    }

    // Convertir Blob → base64
    const arrayBuffer = await fileData.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    let binary = ''
    for (let i = 0; i < uint8Array.length; i++) {
      binary += String.fromCharCode(uint8Array[i])
    }
    const base64Data = btoa(binary)

    imagesWithData.push({ ...img, base64Data })
  }

  if (imagesWithData.length === 0) {
    console.error('[chat-turn] Aucune image téléchargeable depuis Storage')
    return errorResponse(
      'NO_IMAGES',
      'Impossible de télécharger les images. Réessayez.',
      422,
    )
  }

  // ── Appel Claude Vision ───────────────────────────────────────
  const userMessage = buildUserMessage(imagesWithData, user_message)

  const claudeRequest: ClaudeRequest = {
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [userMessage],
  }

  let proposedData: {
    title: string
    description: string
    status: 'owned' | 'stored' | 'loaned' | 'sold' | 'given' | 'lost'
    location_note: string | null
    attributes: Record<string, string | number | boolean | null>
    assistant_message: string
  }

  try {
    console.log(`[chat-turn] Appel Claude ${CLAUDE_MODEL}...`)
    const claudeResponse = await callClaude(claudeRequest, anthropicApiKey)
    const rawText = extractTextFromResponse(claudeResponse)

    console.log(
      `[chat-turn] Claude OK — tokens: ${claudeResponse.usage.input_tokens}in / ${claudeResponse.usage.output_tokens}out`,
    )

    proposedData = parseClaudeResponse(rawText)
  } catch (err) {
    if (err instanceof ClaudeError) {
      console.error(`[chat-turn] ClaudeError: ${err.message} (status: ${err.statusCode})`)
      return errorResponse(
        'CLAUDE_ERROR',
        `Erreur IA : ${err.message}`,
        502,
      )
    }
    console.error(`[chat-turn] Erreur inattendue Claude: ${String(err)}`)
    return errorResponse('CLAUDE_ERROR', 'Erreur lors de l\'analyse IA', 502)
  }

  // ── Mise à jour du draft en base ──────────────────────────────
  const { assistant_message, ...proposedDataWithoutMessage } = proposedData

  const { error: updateError } = await adminClient
    .from('ai_drafts')
    .update({
      status: 'pending',
      proposed_data: proposedDataWithoutMessage,
      updated_at: new Date().toISOString(),
    })
    .eq('id', draft_id)
    .eq('user_id', user.id) // Double vérification propriétaire

  if (updateError) {
    console.error(`[chat-turn] Erreur mise à jour draft: ${updateError.message}`)
    return errorResponse('INTERNAL_ERROR', 'Erreur lors de la sauvegarde de l\'analyse', 500)
  }

  console.log(`[chat-turn] Draft ${draft_id} → pending ✓`)

  // ── Réponse succès ────────────────────────────────────────────
  const responseBody: ChatTurnResponse = {
    ok: true,
    draft_id,
    proposed_data: proposedDataWithoutMessage,
    assistant_message,
  }

  return jsonResponse(responseBody, 200)
})
