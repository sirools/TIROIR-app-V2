import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { getLocales } from 'expo-localization'
import AsyncStorage from '@react-native-async-storage/async-storage'

import fr from './locales/fr.json'
import en from './locales/en.json'
import es from './locales/es.json'
import de from './locales/de.json'

export const SUPPORTED_LANGUAGES = ['fr', 'en', 'es', 'de'] as const
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number]

// Anglais par défaut : couvre le plus grand nombre des 175 pays de l'App Store.
export const DEFAULT_LANGUAGE: AppLanguage = 'en'

const STORAGE_KEY = 'app-language'

export const LANGUAGE_LABELS: Record<AppLanguage, string> = {
  fr: 'Français',
  en: 'English',
  es: 'Español',
  de: 'Deutsch',
}

const resources = {
  fr: { translation: fr },
  en: { translation: en },
  es: { translation: es },
  de: { translation: de },
}

function isSupported(code: string | null | undefined): code is AppLanguage {
  return !!code && (SUPPORTED_LANGUAGES as readonly string[]).includes(code)
}

// Langue de l'appareil (suit les réglages OS / région du téléphone).
function deviceLanguage(): AppLanguage {
  try {
    const code = getLocales()[0]?.languageCode?.toLowerCase()
    if (isSupported(code)) return code
  } catch {
    /* getLocales indisponible : on tombe sur la langue par défaut */
  }
  return DEFAULT_LANGUAGE
}

i18n.use(initReactI18next).init({
  resources,
  lng: deviceLanguage(),
  fallbackLng: DEFAULT_LANGUAGE,
  supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
})

// Applique la préférence utilisateur persistée (override de la langue de l'appareil).
// À appeler une fois au démarrage, après l'init synchrone ci-dessus.
export async function loadStoredLanguage() {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY)
    if (isSupported(stored) && stored !== i18n.language) {
      await i18n.changeLanguage(stored)
    }
  } catch {
    /* AsyncStorage indisponible : sans conséquence */
  }
}

// Change la langue et mémorise le choix de l'utilisateur.
export async function setAppLanguage(lang: AppLanguage) {
  await i18n.changeLanguage(lang)
  try {
    await AsyncStorage.setItem(STORAGE_KEY, lang)
  } catch {
    /* sans conséquence */
  }
}

export default i18n
