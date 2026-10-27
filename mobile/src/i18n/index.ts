import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { getLocales } from 'expo-localization'
import AsyncStorage from '@react-native-async-storage/async-storage'

import fr from './locales/fr.json'
import en from './locales/en.json'
import es from './locales/es.json'
import de from './locales/de.json'
import ptBR from './locales/pt-BR.json'
// pt-PT ne contient que les clés qui diffèrent du brésilien : le reste
// vient de pt-BR par le repli déclaré dans FALLBACKS.
import ptPT from './locales/pt-PT.json'

export const SUPPORTED_LANGUAGES = ['fr', 'en', 'es', 'de', 'pt-BR', 'pt-PT'] as const
export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number]

/** « auto » : suivre la langue de l'appareil (réglage système ou réglage par app d'iOS / Android). */
export type LanguagePreference = AppLanguage | 'auto'

// Anglais par défaut : couvre le plus grand nombre des 175 pays de l'App Store.
export const DEFAULT_LANGUAGE: AppLanguage = 'en'

const STORAGE_KEY = 'app-language'

// Chaque langue écrite dans sa langue (jamais traduite).
export const LANGUAGE_LABELS: Record<AppLanguage, string> = {
  fr: 'Français',
  en: 'English',
  es: 'Español',
  de: 'Deutsch',
  'pt-BR': 'Português (Brasil)',
  'pt-PT': 'Português (Portugal)',
}

// Repli clé par clé : une clé absente de pt-PT est lue en pt-BR, puis en anglais.
export const FALLBACKS = {
  'pt-PT': ['pt-BR', DEFAULT_LANGUAGE],
  default: [DEFAULT_LANGUAGE],
}

const resources = {
  fr: { translation: fr },
  en: { translation: en },
  es: { translation: es },
  de: { translation: de },
  'pt-BR': { translation: ptBR },
  'pt-PT': { translation: ptPT },
}

function isSupported(code: string | null | undefined): code is AppLanguage {
  return !!code && (SUPPORTED_LANGUAGES as readonly string[]).includes(code)
}

// Pays où l'on écrit le portugais européen ; partout ailleurs, brésilien.
const PT_PT_REGIONS = new Set(['PT', 'AO', 'MZ', 'CV', 'GW', 'ST', 'TL', 'MO'])

/** Langue de l'app pour une locale de l'appareil (« pt-PT », « pt_BR », « de-AT »…). */
export function resolveLanguage(languageCode?: string | null, regionCode?: string | null): AppLanguage {
  const lang = languageCode?.toLowerCase()
  if (lang === 'pt') return PT_PT_REGIONS.has((regionCode ?? '').toUpperCase()) ? 'pt-PT' : 'pt-BR'
  return isSupported(lang) ? lang : DEFAULT_LANGUAGE
}

// Langue de l'appareil (suit les réglages OS / région du téléphone, et le
// réglage « Langue » propre à Tiroir dans les Réglages d'iOS et d'Android 13+).
export function deviceLanguage(): AppLanguage {
  try {
    // Première langue de l'appareil que Tiroir sait parler.
    for (const l of getLocales()) {
      const lang = l.languageCode?.toLowerCase()
      if (lang === 'pt' || isSupported(lang)) return resolveLanguage(lang, l.regionCode)
    }
  } catch {
    /* getLocales indisponible : on tombe sur la langue par défaut */
  }
  return DEFAULT_LANGUAGE
}

i18n.use(initReactI18next).init({
  resources,
  lng: deviceLanguage(),
  fallbackLng: FALLBACKS,
  supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
  // Ne charger que la langue exacte (pas de « pt » générique, absent des ressources).
  load: 'currentOnly',
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

// Langue à donner au compte (user_metadata.locale, lue par les e-mails et
// le site) : le choix mémorisé, sinon celle de l'app. Lit le stockage, au
// cas où loadStoredLanguage n'aurait pas encore fini.
export async function preferredLanguage(): Promise<AppLanguage> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY)
    if (isSupported(stored)) return stored
  } catch {
    /* AsyncStorage indisponible : langue courante */
  }
  return isSupported(i18n.language) ? i18n.language : DEFAULT_LANGUAGE
}

/** Préférence enregistrée : une langue choisie, ou « auto » (rien d'enregistré). */
export async function getLanguagePreference(): Promise<LanguagePreference> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY)
    return isSupported(stored) ? stored : 'auto'
  } catch {
    return 'auto'
  }
}

// Change la langue et mémorise le choix de l'utilisateur. « auto » efface le
// choix : l'app suit de nouveau la langue de l'appareil.
export async function setAppLanguage(pref: LanguagePreference) {
  await i18n.changeLanguage(pref === 'auto' ? deviceLanguage() : pref)
  try {
    if (pref === 'auto') await AsyncStorage.removeItem(STORAGE_KEY)
    else await AsyncStorage.setItem(STORAGE_KEY, pref)
  } catch {
    /* sans conséquence */
  }
}

export default i18n
