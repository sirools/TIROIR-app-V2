// ================================================================
// _shared/aiUsage.ts
// Tarifs des modèles, coût réel d'un appel, et poids d'une analyse
// dans le quota mensuel.
//
// Mutualisé parce que six fonctions Edge en ont besoin : recopier la
// grille tarifaire six fois, c'est se garantir qu'un jour cinq d'entre
// elles seront à jour et pas la sixième — et que le coût affiché à
// l'admin sera faux sans que personne ne s'en aperçoive.
// ================================================================

/**
 * Dollars par MILLION de tokens, au 2026-08-07.
 *
 * Codés ici et non en base : le coût est calculé À L'ÉCRITURE, donc un
 * changement de tarif ne réécrit jamais l'historique déjà mesuré.
 *
 * NB : Sonnet 5 est à 2 $/10 $ en tarif d'introduction jusqu'au
 * 2026-08-31. On retient le tarif plein — sous-estimer un coût est plus
 * dangereux que le surestimer quand il sert de garde-fou budgétaire.
 */
export const PRICING: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5': { input: 1.0, output: 5.0 },
  'claude-haiku-4-5-20251001': { input: 1.0, output: 5.0 },
  'claude-sonnet-5': { input: 3.0, output: 15.0 },
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'claude-opus-5': { input: 5.0, output: 25.0 },
  // Gemini image : la sortie est facturée en tokens, 1290 par image.
  'gemini-2.5-flash-image': { input: 0.30, output: 30.0 },
}

export interface TokenUsage {
  input_tokens?: number
  output_tokens?: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
}

/**
 * Un modèle inconnu ne coûte pas zéro.
 *
 * Rendre 0 pour un modèle absent de la grille ferait disparaître sa
 * dépense du tableau de bord : on retombe sur le tarif le plus cher,
 * qui se remarque et se corrige.
 */
export function costUsd(model: string, usage: TokenUsage): number {
  const price = PRICING[model] ?? PRICING['claude-opus-5']
  const input = usage.input_tokens ?? 0
  const output = usage.output_tokens ?? 0
  // Les tokens de cache lus sont facturés à 10 % de l'entrée chez
  // Anthropic, l'écriture à 125 %. Approximation assumée : tant qu'aucune
  // fonction n'utilise le cache, ces deux termes valent zéro.
  const cacheRead = (usage.cache_read_input_tokens ?? 0) * 0.1
  const cacheWrite = (usage.cache_creation_input_tokens ?? 0) * 1.25

  return ((input + cacheRead + cacheWrite) / 1_000_000) * price.input
       + (output / 1_000_000) * price.output
}

/**
 * Poids d'un appel dans le quota mensuel d'analyses.
 *
 * L'unité est l'analyse mono, à ~1 c. Les valeurs viennent des coûts
 * MESURÉS dans ai_usage, arrondis au supérieur :
 *
 *   detect_scene · Haiku   0,74 c →  1
 *   detect_scene · Sonnet  4,23 c →  4
 *   detect_scene · Opus   12,52 c → 13
 *
 * Un utilisateur gratuit (10 analyses/mois) peut donc faire dix scènes
 * en Haiku, ou aucune en Opus — ce qui est exactement le comportement
 * voulu : le modèle cher se mérite.
 */
const UNIT_COST_USD = 0.01

const MEASURED_COST: Record<string, number> = {
  'detect_scene:claude-haiku-4-5': 0.0074,
  'detect_scene:claude-sonnet-5': 0.0423,
  'detect_scene:claude-opus-5': 0.1252,
  'describe_object:claude-haiku-4-5': 0.0015,
}

export function quotaUnits(feature: string, model: string): number {
  const measured = MEASURED_COST[`${feature}:${model}`]
  if (measured === undefined) return 1
  return Math.max(1, Math.ceil(measured / UNIT_COST_USD))
}

interface LogParams {
  userId: string
  feature: string
  model: string
  usage: TokenUsage
  durationMs: number
  meta?: Record<string, unknown>
}

/**
 * Écriture de télémétrie, jamais bloquante : elle ne doit pas faire
 * échouer une analyse que l'utilisateur a déjà payée en tokens.
 */
export function logAiUsage(
  admin: { from: (t: string) => { insert: (row: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null }> } },
  { userId, feature, model, usage, durationMs, meta }: LogParams,
): void {
  admin.from('ai_usage').insert({
    user_id: userId,
    feature,
    model,
    input_tokens: usage.input_tokens ?? 0,
    output_tokens: usage.output_tokens ?? 0,
    cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
    cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
    cost_usd: costUsd(model, usage),
    duration_ms: durationMs,
    meta: meta ?? {},
  }).then(({ error }) => {
    if (error) console.error(`[${feature}] ai_usage`, error.message)
  })
}
