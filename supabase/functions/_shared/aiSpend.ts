// Toute dépense IA passe par ici : le quota du mois d'abord, puis les
// crédits achetés (strategie/offres.md ; SQL : spend_ai et refund_ai_spend
// dans supabase/migrations/20261108143238_ai_credits_spend.sql).
//
// Dépenser se fait avec le client de l'utilisateur (auth.uid()). Rendre une
// dépense se fait avec le client SERVICE : le compte ne peut plus se
// rembourser lui-même (c'était un trou : il remettait ses quotas à zéro).
//
// Tant que ce SQL n'est pas appliqué en prod, spend_ai n'existe pas : on
// retombe alors sur les anciens quotas, sans rien casser.

export type AiFeature =
  | 'detect_scene' | 'describe_object' | 'chat_turn'
  | 'enhance_photo' | 'scene_thumbnail'
  | 'estimate_value'

export type AiSpend = {
  ok: boolean
  source?: 'quota' | 'credits'
  spend_id?: string
  units: number
  /** Refus : quota épuisé et crédits insuffisants, ou fonction réservée. */
  reason?: 'QUOTA_EXCEEDED' | 'NOT_PREMIUM'
  credits?: number
  cost?: number
  /** Dépense faite par l'ancien quota (SQL pas encore appliqué). */
  legacy?: boolean
  feature?: AiFeature
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

const KIND: Record<AiFeature, 'analysis' | 'photo' | 'estimate'> = {
  detect_scene: 'analysis',
  describe_object: 'analysis',
  chat_turn: 'analysis',
  enhance_photo: 'photo',
  scene_thumbnail: 'photo',
  estimate_value: 'estimate',
}

/** Dépense pour `feature`. `error` : échec technique (répondre 500). */
export async function spendAi(
  user: RpcClient,
  feature: AiFeature,
  units = 1,
): Promise<{ spend: AiSpend | null; error: string | null }> {
  const { data, error } = await user.rpc('spend_ai', { p_feature: feature, p_units: units })
  if (!error) return { spend: { ...(data as AiSpend), feature }, error: null }
  if (!isMissingFunction(error)) return { spend: null, error: error.message }

  // Repli : anciens quotas, tant que le SQL n'est pas appliqué.
  const kind = KIND[feature]
  if (kind === 'analysis') {
    const r = await user.rpc('consume_ai_quota', { p_units: units })
    if (r.error) return { spend: null, error: r.error.message }
    return { spend: { ok: r.data === true, source: 'quota', units, legacy: true, feature, reason: r.data === true ? undefined : 'QUOTA_EXCEEDED' }, error: null }
  }
  const fn = kind === 'photo' ? 'check_and_increment_photo_enhance_quota' : 'check_and_increment_value_estimate_quota'
  const r = await user.rpc(fn)
  if (r.error) return { spend: null, error: r.error.message }
  const ok = r.data === 'OK'
  return {
    spend: { ok, source: 'quota', units: 1, legacy: true, feature, reason: ok ? undefined : (r.data as AiSpend['reason']) },
    error: null,
  }
}

/**
 * Rend une dépense quand le modèle n'a rien produit. Jamais bloquant.
 * `service` : client avec la clé service ; `user` : seulement pour le repli.
 */
export async function refundAi(
  clients: { service: RpcClient; user: RpcClient },
  spend: AiSpend | null,
): Promise<void> {
  if (!spend?.ok) return
  if (spend.spend_id) {
    const { error } = await clients.service.rpc('refund_ai_spend', { p_spend_id: spend.spend_id })
    if (error) console.error('[aiSpend] remboursement', error.message)
    return
  }
  if (!spend.legacy || !spend.feature) return
  const kind = KIND[spend.feature]
  if (kind === 'analysis') await clients.user.rpc('refund_ai_quota_units', { p_units: spend.units })
  else if (kind === 'photo') await clients.user.rpc('refund_photo_enhance_quota')
  else await clients.user.rpc('refund_value_estimate_quota')
}

/** Codes de refus d'une dépense IA, renvoyés tels quels à l'app. */
export type RefusalCode = 'PREMIUM_REQUIRED' | 'QUOTA_EXCEEDED'

/** Réponse de refus : statut HTTP, code et message. */
export function refusal(spend: AiSpend | null): { status: number; code: RefusalCode; message: string } {
  if (spend?.reason === 'NOT_PREMIUM') {
    return {
      status: 403,
      code: 'PREMIUM_REQUIRED',
      message: `Réservé aux abonnés Premium, ou ${spend.cost ?? 4} crédits avec un pack.`,
    }
  }
  const credits = spend?.credits ?? 0
  const cost = spend?.cost ?? spend?.units ?? 1
  return {
    status: 429,
    code: 'QUOTA_EXCEEDED',
    message: credits > 0
      ? `Quota du mois atteint et crédits insuffisants (${credits} restants, ${cost} nécessaires).`
      : 'Quota du mois atteint. Un pack de crédits permet de continuer.',
  }
}
