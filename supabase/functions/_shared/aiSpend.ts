// Dépense d'une analyse IA : le quota du mois d'abord, puis les crédits
// achetés (strategie/offres.md, marche 2 ; SQL : spend_ai_units dans
// supabase/drafts/ai_credits_spend.sql).
//
// Tant que ce SQL n'est pas appliqué en prod, spend_ai_units n'existe pas :
// on retombe alors sur l'ancien quota (consume_ai_quota), sans rien casser.

export type AiSpend = {
  ok: boolean
  source?: 'quota' | 'credits'
  units: number
  ledger_id?: string
  /** Solde de crédits, renvoyé en cas de refus. */
  credits?: number
}

type RpcClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{
    data: unknown
    error: { message: string; code?: string } | null
  }>
}

function isMissingFunction(error: { message: string; code?: string }): boolean {
  return error.code === 'PGRST202' || /could not find the function/i.test(error.message)
}

/** Dépense `units` unités. `error` : échec technique (répondre 500). */
export async function spendAi(
  client: RpcClient,
  units: number,
  feature: string,
): Promise<{ spend: AiSpend | null; error: string | null }> {
  const { data, error } = await client.rpc('spend_ai_units', { p_units: units, p_feature: feature })
  if (!error) return { spend: data as AiSpend, error: null }
  if (!isMissingFunction(error)) return { spend: null, error: error.message }

  // Repli : ancien quota mensuel seul.
  const legacy = await client.rpc('consume_ai_quota', { p_units: units })
  if (legacy.error) return { spend: null, error: legacy.error.message }
  return { spend: { ok: legacy.data === true, source: 'quota', units }, error: null }
}

/** Rend une dépense quand le modèle n'a rien produit. Jamais bloquant. */
export async function refundAi(client: RpcClient, spend: AiSpend | null): Promise<void> {
  if (!spend?.ok) return
  const { error } = await client.rpc('refund_ai_spend', { p_spend: spend })
  if (error && isMissingFunction(error) && spend.source === 'quota') {
    await client.rpc('refund_ai_quota_units', { p_units: spend.units })
  }
}

/** Message de refus : propose les crédits quand le quota est épuisé. */
export function quotaMessage(spend: AiSpend | null): string {
  const credits = spend?.credits ?? 0
  return credits > 0
    ? `Quota du mois atteint et crédits insuffisants (${credits} restants, ${spend?.units ?? 1} nécessaires).`
    : 'Quota du mois atteint. Un pack de crédits permet de continuer.'
}
