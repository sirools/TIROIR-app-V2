import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { getLocales } from 'expo-localization'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Langues et textes : seule source design/i18n/ (design/i18n/README.md).
// Les deux modules ci-dessous sont générés par node design/generate.mjs.
import { LANGUAGE_NAMES, FALLBACKS, REGIONAL_VARIANTS } from './languages.generated'
import { RESOURCES } from './resources.generated'
import {
  SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, isSupported, resolveLanguage, type AppLanguage,
} from './resolve'

export { SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, resolveLanguage, type AppLanguage }

/** « auto » : suivre la langue de l'appareil (réglage système ou réglage par app d'iOS / Android). */
export type LanguagePreference = AppLanguage | 'auto'

const STORAGE_KEY = 'app-language'

// Chaque langue écrite dans sa langue (jamais traduite).
export const LANGUAGE_LABELS = Object.fromEntries(
  SUPPORTED_LANGUAGES.map(l => [l, LANGUAGE_NAMES[l]]),
) as Record<AppLanguage, string>

// Repli clé par clé : une clé absente de pt-PT est lue en pt-BR, puis en anglais.
export { FALLBACKS }

// Langue de l'appareil (suit les réglages OS / région du téléphone, et le
// réglage « Langue » propre à Tiroir dans les Réglages d'iOS et d'Android 13+).
export function deviceLanguage(): AppLanguage {
  try {
    // Première langue de l'appareil que Tiroir sait parler.
    for (const l of getLocales()) {
      const lang = l.languageCode?.toLowerCase()
      if ((lang && lang in REGIONAL_VARIANTS) || isSupported(lang)) return resolveLanguage(lang, l.regionCode)
    }
  } catch {
    /* getLocales indisponible : on tombe sur la langue par défaut */
  }
  return DEFAULT_LANGUAGE
}

i18n.use(initReactI18next).init({
  resources: RESOURCES,
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
