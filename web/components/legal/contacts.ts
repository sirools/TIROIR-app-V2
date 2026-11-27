// Adresses de contact citées dans les pages juridiques (identiques dans
// toutes les langues).
export const CONTACT_EMAIL = 'hello@tiroir.app'
export const SUPPORT_EMAIL = 'support@tiroir.app'
export const PRIVACY_EMAIL = 'privacy@tiroir.app'

/**
 * Démarches Business et Pro (devis, souscription, facturation) : l'adresse
 * du fondateur, décision du 2026-11-08. Seule source : la landing, la page
 * Tarifs et les CGU la lisent ici. Jamais d'adresse postale affichée.
 */
export const BUSINESS_EMAIL = 'clement.ougier@gmail.com'
export const BUSINESS_SUBJECT = 'Tiroir Business'
export const BUSINESS_MAILTO = `mailto:${BUSINESS_EMAIL}?subject=${encodeURIComponent(BUSINESS_SUBJECT)}`
