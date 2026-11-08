/**
 * Erreur d'une Edge Function.
 *
 * `supabase.functions.invoke` ne rend qu'un « non-2xx status code » : le
 * motif — quota atteint, abonnement requis, refus du modèle — vit dans le
 * corps de la réponse, et c'est lui que l'utilisateur doit lire. Le code
 * (QUOTA_EXCEEDED…) est gardé à côté du message : c'est lui, et non le
 * texte, qui décide de proposer des crédits (lib/buyCredits.ts).
 */
export class FunctionError extends Error {
  constructor(message: string, readonly code: string | null = null) {
    super(message)
    this.name = 'FunctionError'
  }
}

/** Erreur lisible (message et code) d'un appel `functions.invoke` en échec. */
export async function functionError(fnError: unknown): Promise<FunctionError> {
  const context = (fnError as { context?: { json?: () => Promise<unknown> } })?.context
  try {
    const body = await context?.json?.() as { error?: { message?: string; code?: string } }
    const code = body?.error?.code ?? null
    return new FunctionError(body?.error?.message ?? code ?? (fnError as Error).message, code)
  } catch {
    return new FunctionError((fnError as Error)?.message ?? 'Erreur')
  }
}

/** Le seul message, pour les écrans qui n'ont pas besoin du code. */
export async function functionMessage(fnError: unknown): Promise<string> {
  return (await functionError(fnError)).message
}
