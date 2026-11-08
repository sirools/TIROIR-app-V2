// Renoncement au droit de rétractation (art. L221-28 du Code de la
// consommation), recueilli DANS le Checkout Stripe : une case obligatoire,
// non pré-cochée (consent_collection.terms_of_service), avec notre texte
// (custom_text.terms_of_service_acceptance). Stripe renvoie l'accord dans
// la session terminée ; le webhook l'enregistre (checkout_consents).
//
// Textes : design/i18n/email/<langue>.json, section checkout (seule
// source), générés dans web/locales/checkout.generated.ts.
//
// Prérequis Stripe : l'adresse des conditions d'utilisation posée dans le
// tableau de bord (Paramètres › Informations publiques), en test comme en
// réel ; sans elle, Stripe refuse de créer la session.
//
// Module pur, testable.
import { CHECKOUT_TEXTS, type CheckoutConsentTexts } from '../locales/checkout.generated'

/** Version du texte affiché, gardée avec chaque accord. À changer avec le texte. */
export const CONSENT_TEXT_VERSION = '2026-11-08'

export type ConsentKind = 'subscription' | 'credits'

/** Langue des textes : celle du site, sinon le français. */
function texts(locale: string): CheckoutConsentTexts {
  return CHECKOUT_TEXTS[locale] ?? CHECKOUT_TEXTS.fr!
}

/** Paramètres de la session Checkout : case obligatoire + texte. */
export function consentParams(kind: ConsentKind, locale: string, cguUrl: string) {
  const t = texts(locale)
  const message = (kind === 'subscription' ? t.consentSubscription : t.consentCredits).replace('{cgu}', cguUrl)
  return {
    consent_collection: { terms_of_service: 'required' },
    custom_text: { terms_of_service_acceptance: { message } },
  }
}

/** Mention de bas de facture (factures en français). */
export function invoiceConsentNote(locale = 'fr'): string {
  return texts(locale).invoiceNote
}

type Obj = Record<string, unknown>
const obj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {})
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null)

export type ConsentRecord = {
  sessionId: string
  userId: string | null
  kind: ConsentKind
  item: string | null
  locale: string | null
  livemode: boolean
  acceptedAt: Date
  /** Version du texte affiché lors de cet achat (métadonnée de la session). */
  textVersion: string
}

/**
 * Accord à enregistrer pour une session Checkout terminée, ou null si la
 * session n'en porte pas (session créée avant la case, ou autre usage).
 */
export function consentFromSession(session: unknown, completedAt?: Date): ConsentRecord | null {
  const s = obj(session)
  if (obj(s.consent).terms_of_service !== 'accepted') return null
  const sessionId = str(s.id)
  if (!sessionId) return null
  const meta = obj(s.metadata)
  const kind: ConsentKind = meta.kind === 'credits' ? 'credits' : 'subscription'
  return {
    sessionId,
    userId: str(s.client_reference_id) ?? str(meta.user_id),
    kind,
    item: str(meta.pack) ?? str(meta.plan),
    locale: str(s.locale),
    livemode: s.livemode === true,
    acceptedAt: completedAt ?? new Date(),
    textVersion: str(meta.consent_version) ?? CONSENT_TEXT_VERSION,
  }
}
