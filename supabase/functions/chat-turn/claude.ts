// ================================================================
// chat-turn/claude.ts
// Client Claude Anthropic pour l'Edge Function chat-turn.
// Modèle : claude-haiku-4-5-20251001 (coût réduit MVP).
// Gestion : timeout, retry exponentiel, erreurs typées.
// ================================================================

import type { ClaudeRequest, ClaudeResponse } from './types.ts'

// ── Constantes ───────────────────────────────────────────────────

export const CLAUDE_MODEL = 'claude-haiku-4-5-20251001'
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages'
const ANTHROPIC_VERSION = '2023-06-01'

/** Timeout par appel Claude en ms (Edge Function max = 150s) */
const REQUEST_TIMEOUT_MS = 60_000

/** Nombre de tentatives max en cas d'erreur 5xx ou timeout */
const MAX_RETRIES = 2

/** Délai initial de retry en ms (doublé à chaque tentative) */
const RETRY_BASE_DELAY_MS = 1_000

// ── Erreur typée ─────────────────────────────────────────────────

export class ClaudeError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly claudeType?: string,
  ) {
    super(message)
    this.name = 'ClaudeError'
  }
}

// ── Client principal ─────────────────────────────────────────────

/**
 * Appelle l'API Claude avec retry exponentiel.
 * Lève ClaudeError en cas d'échec définitif.
 *
 * @param request - Corps de la requête Claude
 * @param apiKey - Clé API Anthropic (depuis Deno.env)
 */
export async function callClaude(
  request: ClaudeRequest,
  apiKey: string,
): Promise<ClaudeResponse> {
  let lastError: ClaudeError | null = null

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1)
      await sleep(delay)
    }

    try {
      const response = await fetchWithTimeout(
        CLAUDE_API_URL,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': ANTHROPIC_VERSION,
          },
          body: JSON.stringify(request),
        },
        REQUEST_TIMEOUT_MS,
      )

      // Erreurs 4xx : pas de retry (erreur client)
      if (response.status >= 400 && response.status < 500) {
        const body = await response.json().catch(() => ({ error: { message: response.statusText } }))
        const message = body?.error?.message ?? `Erreur Claude ${response.status}`
        throw new ClaudeError(message, response.status, body?.error?.type)
      }

      // Erreurs 5xx : retry possible
      if (response.status >= 500) {
        const body = await response.json().catch(() => ({ error: { message: response.statusText } }))
        const message = body?.error?.message ?? `Erreur serveur Claude ${response.status}`
        lastError = new ClaudeError(message, response.status, body?.error?.type)
        continue // retry
      }

      // Succès
      const data = await response.json() as ClaudeResponse

      // Vérifier que la réponse contient du texte
      if (!data.content || data.content.length === 0) {
        throw new ClaudeError('Réponse Claude vide (aucun contenu)')
      }

      const textBlock = data.content.find((b) => b.type === 'text')
      if (!textBlock) {
        throw new ClaudeError('Réponse Claude sans bloc texte')
      }

      return data
    } catch (err) {
      // Timeout ou erreur réseau → retry
      if (err instanceof ClaudeError && err.statusCode && err.statusCode < 500) {
        // Erreur 4xx : ne pas retenter
        throw err
      }
      if (err instanceof ClaudeError) {
        lastError = err
        continue
      }
      // Erreur réseau / timeout
      lastError = new ClaudeError(
        err instanceof Error ? err.message : String(err),
      )
    }
  }

  throw lastError ?? new ClaudeError('Échec de l\'appel Claude après plusieurs tentatives')
}

/**
 * Extrait le texte de la première réponse Claude.
 */
export function extractTextFromResponse(response: ClaudeResponse): string {
  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock) {
    throw new ClaudeError('Aucun bloc texte dans la réponse Claude')
  }
  return textBlock.text
}

// ── Utilitaires ──────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * fetch avec AbortController timeout.
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    return response
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ClaudeError(`Timeout Claude après ${timeoutMs}ms`)
    }
    throw err
  } finally {
    clearTimeout(timer)
  }
}
