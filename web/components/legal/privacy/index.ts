// Corps de la politique de confidentialité par langue. Le français fait
// foi ; les autres langues en sont des traductions, signalées en tête de page (LegalPage).
import type { ComponentType } from 'react'
import type { Locale } from '../../../lib/localeRouting'
import FrBody from './FrBody'
import EnBody from './EnBody'
import DaBody from './DaBody'
import DeBody from './DeBody'
import EsBody from './EsBody'

/** Date de la dernière mise à jour du texte français (AAAA-MM-JJ). */
export const PRIVACY_UPDATED = '2026-06-25'

export const PRIVACY_BODIES: Record<Locale, ComponentType> = {
  fr: FrBody, en: EnBody, da: DaBody, de: DeBody, es: EsBody,
}
