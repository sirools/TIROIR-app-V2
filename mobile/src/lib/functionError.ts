/**
 * Message d'erreur d'une Edge Function.
 *
 * `supabase.functions.invoke` ne rend qu'un « non-2xx status code » : le
 * motif — quota atteint, abonnement requis, refus du modèle — vit dans le
 * corps de la réponse, et c'est lui que l'utilisateur doit lire.
 */
export async function functionMessage(fnError: unknown): Promise<string> {
  const context = (fnError as { context?: { json?: () => Promise<unknown> } })?.context
  try {
    const body = await context?.json?.() as { error?: { message?: string; code?: string } }
    return body?.error?.message ?? body?.error?.code ?? (fnError as Error).message
  } catch {
    return (fnError as Error)?.message ?? 'Erreur'
  }
}
