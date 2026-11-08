// Généré par design/generate.mjs depuis design/i18n/languages.json — ne pas modifier à la main.
/** Langues proposées dans l'app (iOS et Android), dans l'ordre du sélecteur. */
export const APP_LANGUAGES = ["fr","en","es","de","pt-BR","pt-PT"] as const
/** Langues proposées sur le site. */
export const SITE_LANGUAGES = ["fr","en","es","de"] as const
/** Langues dans lesquelles partent les e-mails. */
export const EMAIL_LANGUAGES = ["fr","en","es","de","pt-BR","pt-PT","da"] as const
/** Langue de référence : toutes les autres suivent ses clés. */
export const REFERENCE_LANGUAGE = "fr"
/** Langue par défaut quand celle de l'appareil n'est pas proposée. */
export const DEFAULT_LANGUAGE = "en"
/** Chaque langue écrite dans sa langue (jamais traduite). */
export const LANGUAGE_NAMES: Record<string, string> = {"fr":"Français","en":"English","es":"Español","de":"Deutsch","pt-BR":"Português (Brasil)","pt-PT":"Português (Portugal)","da":"Dansk"}
/** Balise Intl (formats de prix, de dates, de nombres). */
export const LANGUAGE_INTL: Record<string, string> = {"fr":"fr-FR","en":"en-IE","es":"es-ES","de":"de-DE","pt-BR":"pt-BR","pt-PT":"pt-PT","da":"da-DK"}
/** Repli clé par clé (i18next) : une langue partielle hérite de sa langue mère, puis de la langue par défaut. */
export const FALLBACKS: Record<string, string[]> = {"default":["en"],"pt-PT":["pt-BR","en"]}
/** Langue à variantes (« pt ») : variante par défaut et variante par pays. */
export const REGIONAL_VARIANTS: Record<string, { default: string; byRegion: Record<string, string> }> = {"pt":{"default":"pt-BR","byRegion":{"PT":"pt-PT","AO":"pt-PT","MZ":"pt-PT","CV":"pt-PT","GW":"pt-PT","ST":"pt-PT","TL":"pt-PT","MO":"pt-PT"}}}
