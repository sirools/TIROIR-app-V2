// Généré par design/generate.mjs depuis design/i18n/email/ (section checkout) — ne pas modifier à la main.
/** Case de rétractation du Checkout Stripe et mention des factures, par langue d'e-mail. */
export interface CheckoutConsentTexts {
  consentSubscription: string
  consentCredits: string
  invoiceNote: string
}

export const CHECKOUT_TEXTS: Partial<Record<string, CheckoutConsentTexts>> = {
  "fr": {
    "consentSubscription": "Je demande l’accès immédiat à mon abonnement et je reconnais perdre mon droit de rétractation de 14 jours (art. L221-28 du Code de la consommation). J’accepte les [conditions générales]({cgu}).",
    "consentCredits": "Je demande l’accès immédiat à mes crédits et je reconnais perdre mon droit de rétractation de 14 jours (art. L221-28 du Code de la consommation). J’accepte les [conditions générales]({cgu}).",
    "invoiceNote": "Accès immédiat demandé par le client : renonciation au droit de rétractation (art. L221-28 du Code de la consommation)."
  },
  "en": {
    "consentSubscription": "I ask for immediate access to my subscription and acknowledge that I lose my 14-day right of withdrawal. I accept the [terms and conditions]({cgu}).",
    "consentCredits": "I ask for immediate access to my credits and acknowledge that I lose my 14-day right of withdrawal. I accept the [terms and conditions]({cgu}).",
    "invoiceNote": "Immediate access requested by the customer: right of withdrawal waived."
  },
  "es": {
    "consentSubscription": "Solicito el acceso inmediato a mi suscripción y reconozco que pierdo mi derecho de desistimiento de 14 días. Acepto las [condiciones generales]({cgu}).",
    "consentCredits": "Solicito el acceso inmediato a mis créditos y reconozco que pierdo mi derecho de desistimiento de 14 días. Acepto las [condiciones generales]({cgu}).",
    "invoiceNote": "Acceso inmediato solicitado por el cliente: renuncia al derecho de desistimiento."
  },
  "de": {
    "consentSubscription": "Ich verlange den sofortigen Zugang zu meinem Abonnement und bestätige, dass ich mein 14-tägiges Widerrufsrecht verliere. Ich akzeptiere die [AGB]({cgu}).",
    "consentCredits": "Ich verlange den sofortigen Zugang zu meinen Credits und bestätige, dass ich mein 14-tägiges Widerrufsrecht verliere. Ich akzeptiere die [AGB]({cgu}).",
    "invoiceNote": "Sofortiger Zugang auf Wunsch des Kunden: Verzicht auf das Widerrufsrecht."
  },
  "pt-BR": {
    "consentSubscription": "Solicito o acesso imediato à minha assinatura e reconheço que perco meu direito de arrependimento de 14 dias. Aceito os [termos e condições]({cgu}).",
    "consentCredits": "Solicito o acesso imediato aos meus créditos e reconheço que perco meu direito de arrependimento de 14 dias. Aceito os [termos e condições]({cgu}).",
    "invoiceNote": "Acesso imediato solicitado pelo cliente: renúncia ao direito de arrependimento."
  },
  "pt-PT": {
    "consentSubscription": "Solicito o acesso imediato à minha subscrição e reconheço que perco o meu direito de livre resolução de 14 dias. Aceito os [termos e condições]({cgu}).",
    "consentCredits": "Solicito o acesso imediato aos meus créditos e reconheço que perco o meu direito de livre resolução de 14 dias. Aceito os [termos e condições]({cgu}).",
    "invoiceNote": "Acesso imediato solicitado pelo cliente: renúncia ao direito de livre resolução."
  },
  "da": {
    "consentSubscription": "Jeg anmoder om øjeblikkelig adgang til mit abonnement og anerkender, at jeg mister min fortrydelsesret på 14 dage. Jeg accepterer [vilkårene]({cgu}).",
    "consentCredits": "Jeg anmoder om øjeblikkelig adgang til mine kreditter og anerkender, at jeg mister min fortrydelsesret på 14 dage. Jeg accepterer [vilkårene]({cgu}).",
    "invoiceNote": "Øjeblikkelig adgang efter kundens ønske: afkald på fortrydelsesretten."
  }
}
