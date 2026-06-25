// ================================================================
// estimate-value/index.ts
// Estime la valeur marchande d'un objet via Claude + web_search.
// Cherche des annonces similaires sur leboncoin, Vinted, etc.
//
// POST /functions/v1/estimate-value
// Body : { object_id: string }
// Auth : JWT utilisateur
//
// Flux :
//   1. Auth + récupération de l'objet
//   2. Appel Claude avec outil web_search (boucle tool_use)
//   3. Parse du résultat (valeur min/max/median + sources)
//   4. Sauvegarde en base (market_value, value_sources)
//   5. Retour { market_value, currency, sources, summary }
// ================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages'
const CLAUDE_MODEL = 'claude-sonnet-4-6'
const ANTHROPIC_VERSION = '2023-06-01'
const ANTHROPIC_BETA = 'web-search-2025-03-05'

// ── Handler principal ─────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  try {
    // ── Auth ──────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return errorResponse(401, 'AUTH_MISSING', 'Token manquant')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) return errorResponse(401, 'AUTH_INVALID', 'Authentification invalide')

    // ── Validation body ───────────────────────────────────────────
    const body = await req.json().catch(() => null)
    if (!body?.object_id) return errorResponse(400, 'MISSING_OBJECT_ID', 'object_id requis')

    // ── Récupération objet ────────────────────────────────────────
    const { data: obj, error: objError } = await supabase
      .from('objects')
      .select('id, title, description, attributes, status')
      .eq('id', body.object_id)
      .eq('user_id', user.id)
      .single()

    if (objError || !obj) return errorResponse(404, 'OBJECT_NOT_FOUND', 'Objet introuvable')

    // ── Construction du prompt ────────────────────────────────────
    const attrs = obj.attributes ?? {}
    const parts: string[] = [`Objet : ${obj.title}`]
    if (attrs.brand)     parts.push(`Marque : ${attrs.brand}`)
    if (attrs.model)     parts.push(`Modèle : ${attrs.model}`)
    if (attrs.category)  parts.push(`Catégorie : ${attrs.category}`)
    if (attrs.color)     parts.push(`Couleur : ${attrs.color}`)
    if (attrs.condition) parts.push(`État : ${attrs.condition}`)
    if (obj.description) parts.push(`Description : ${obj.description}`)

    const objectDescription = parts.join('\n')

    const systemPrompt = `Tu es un expert en estimation de valeur marchande d'objets d'occasion en France.
Tu dois chercher des annonces de vente similaires sur leboncoin, Vinted, Facebook Marketplace, eBay France et sites spécialisés.
Tu dois retourner UNIQUEMENT un JSON valide avec cette structure :
{
  "market_value": <nombre, valeur médiane estimée en euros, SANS symbole>,
  "value_min": <nombre, valeur basse>,
  "value_max": <nombre, valeur haute>,
  "currency": "€",
  "confidence": "low" | "medium" | "high",
  "sources": [
    { "site": "leboncoin", "price": <nombre>, "url": "<url ou null>", "title": "<titre annonce>" }
  ],
  "summary": "<1-2 phrases expliquant l'estimation>"
}
Ne retourne rien d'autre que ce JSON.`

    const userMessage = `Estime la valeur marchande actuelle de cet objet d'occasion en France, en cherchant des annonces similaires en vente :

${objectDescription}

Cherche sur leboncoin, Vinted, Facebook Marketplace et eBay France. Retourne le JSON demandé.`

    // ── Appel Claude avec web_search (boucle tool_use) ────────────
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) return errorResponse(500, 'CONFIG_ERROR', 'Clé API manquante')

    const messages: Array<{ role: string; content: unknown }> = [
      { role: 'user', content: userMessage }
    ]

    let finalText = ''
    let iterations = 0
    const MAX_ITERATIONS = 5

    while (iterations < MAX_ITERATIONS) {
      iterations++

      const response = await fetch(CLAUDE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
          'anthropic-beta': ANTHROPIC_BETA,
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: 1024,
          system: systemPrompt,
          tools: [{
            type: 'web_search_20250305',
            name: 'web_search',
            max_uses: 4,
          }],
          messages,
        }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(`Claude API ${response.status}: ${err?.error?.message ?? response.statusText}`)
      }

      const claudeRes = await response.json()
      const stopReason = claudeRes.stop_reason

      // Ajouter la réponse de l'assistant aux messages
      messages.push({ role: 'assistant', content: claudeRes.content })

      if (stopReason === 'end_turn') {
        // Récupérer le dernier bloc texte
        const textBlock = claudeRes.content?.find((b: { type: string }) => b.type === 'text')
        if (textBlock) finalText = textBlock.text
        break
      }

      if (stopReason === 'tool_use') {
        // Traiter chaque appel d'outil
        const toolResults: Array<{
          type: string; tool_use_id: string; content: string
        }> = []

        for (const block of claudeRes.content ?? []) {
          if (block.type !== 'tool_use') continue
          // Le résultat web_search est injecté automatiquement par l'API Anthropic
          // On ajoute un résultat vide pour continuer la boucle si besoin
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: block.content ?? '',
          })
        }

        if (toolResults.length > 0) {
          messages.push({ role: 'user', content: toolResults })
        }
        continue
      }

      // stop_reason inattendu
      break
    }

    // ── Parse du JSON retourné ────────────────────────────────────
    let parsed: {
      market_value: number
      value_min?: number
      value_max?: number
      currency: string
      confidence: string
      sources?: Array<{ site: string; price: number; url?: string; title?: string }>
      summary?: string
    }

    try {
      // Extraire le JSON même s'il est entouré de texte
      const jsonMatch = finalText.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('Aucun JSON trouvé')
      parsed = JSON.parse(jsonMatch[0])
      if (!parsed.market_value || typeof parsed.market_value !== 'number') {
        throw new Error('market_value manquant')
      }
    } catch {
      return errorResponse(422, 'PARSE_ERROR', `Impossible de parser la réponse: ${finalText.slice(0, 200)}`)
    }

    // ── Sauvegarde en base ────────────────────────────────────────
    await supabase
      .from('objects')
      .update({
        market_value: parsed.market_value,
        value_currency: parsed.currency ?? '€',
        value_sources: {
          sources: parsed.sources ?? [],
          confidence: parsed.confidence ?? 'medium',
          value_min: parsed.value_min,
          value_max: parsed.value_max,
          summary: parsed.summary,
        },
        value_estimated_at: new Date().toISOString(),
      })
      .eq('id', body.object_id)
      .eq('user_id', user.id)

    // ── Réponse ───────────────────────────────────────────────────
    return new Response(JSON.stringify({
      market_value: parsed.market_value,
      value_min: parsed.value_min,
      value_max: parsed.value_max,
      currency: parsed.currency ?? '€',
      confidence: parsed.confidence ?? 'medium',
      sources: parsed.sources ?? [],
      summary: parsed.summary ?? '',
    }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    console.error('estimate-value error:', err)
    return errorResponse(500, 'INTERNAL_ERROR', err instanceof Error ? err.message : String(err))
  }
})

// ── Helpers ───────────────────────────────────────────────────────

function errorResponse(status: number, code: string, message: string) {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}
