/**
 * Refus « quota du mois atteint, crédits insuffisants » d'une fonction IA
 * (code QUOTA_EXCEEDED, supabase/functions/_shared/aiSpend.ts) : on propose
 * d'acheter des crédits, par l'achat intégré de l'écran Premium.
 *
 * Règle des stores (strategie/paiements-stripe.md, décision du 26/10/2026) :
 * dans l'app, l'achat passe UNIQUEMENT par l'achat intégré. Jamais de lien,
 * de prix ni de mention du site pour acheter.
 *
 * OBJECT_QUOTA_EXCEEDED (plafond d'objets d'un compte gratuit) n'est pas un
 * refus de crédits : il reste traité par l'écran de capture.
 */
import { Alert, Platform } from 'react-native'
import { FunctionError } from './functionError'

/** Écran d'achat, ouvert directement sur les packs de crédits. */
export const BUY_CREDITS_ROUTE = { pathname: '/paywall', params: { section: 'credits' } } as const

export function isCreditsRefusal(e: unknown): boolean {
  return e instanceof FunctionError && e.code === 'QUOTA_EXCEEDED'
}

type Router = { push: (href: typeof BUY_CREDITS_ROUTE) => void }

/**
 * Explique le refus et propose « Acheter des crédits ». Sur le web
 * (react-native-web), Alert.alert ne fait rien : on passe par confirm().
 */
export function offerCredits(router: Router, t: (key: string) => string, message?: string) {
  const title = t('credits.outTitle')
  const body = message || t('credits.outBody')
  const buy = () => router.push(BUY_CREDITS_ROUTE)
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${body}`)) buy()
    return
  }
  Alert.alert(title, body, [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('credits.buy'), onPress: buy },
  ])
}
