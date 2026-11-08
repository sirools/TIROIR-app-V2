// Langue de l'app pour une locale de l'appareil. Module pur (sans React
// Native), testé par web/__tests__/i18nCentral.test.ts.
import { APP_LANGUAGES, DEFAULT_LANGUAGE as DEFAULT, REGIONAL_VARIANTS } from './languages.generated'

export const SUPPORTED_LANGUAGES = APP_LANGUAGES
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number]

export const DEFAULT_LANGUAGE = DEFAULT as AppLanguage

export function isSupported(code: string | null | undefined): code is AppLanguage {
  return !!code && (SUPPORTED_LANGUAGES as readonly string[]).includes(code)
}

/** « pt » + PT → pt-PT, « pt » + BR (ou sans pays) → pt-BR, « de » + AT → de, inconnue → langue par défaut. */
export function resolveLanguage(languageCode?: string | null, regionCode?: string | null): AppLanguage {
  const lang = languageCode?.toLowerCase()
  const variants = lang ? REGIONAL_VARIANTS[lang] : undefined
  if (variants) {
    const code = variants.byRegion[(regionCode ?? '').toUpperCase()] ?? variants.default
    if (isSupported(code)) return code
  }
  return isSupported(lang) ? lang : DEFAULT_LANGUAGE
}
