// Textes des pages de paiement : français, sinon anglais (voir fr.ts).
import { useCopy } from '..'
import fr, { type BillingCopy } from './fr'
import en from './en'

export function useBillingCopy(): { t: BillingCopy; locale: ReturnType<typeof useCopy>['locale'] } {
  const { locale } = useCopy()
  return { t: locale === 'fr' ? fr : en, locale }
}
