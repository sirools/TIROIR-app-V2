// Région d'estimation — distincte de la langue de l'interface.
//
// La langue dit comment l'app parle ; la région dit sur quel marché Torix
// estime la valeur des objets (devise, annonces locales). Un Brésilien qui
// vit à Lisbonne peut lire l'app en pt-BR et estimer en euros.
//
// Par défaut « auto » : la région de l'appareil si Tiroir sait y estimer,
// sinon la France — le seul marché que l'estimation couvre aujourd'hui
// (supabase/functions/estimate-value). Le serveur ne lit pas encore ce
// réglage : voir V4_PLAN.md, chantier 1.
import { getLocales } from 'expo-localization'
import AsyncStorage from '@react-native-async-storage/async-storage'

export const REGION_CURRENCY = {
  FR: 'EUR',
  BE: 'EUR',
  LU: 'EUR',
  CH: 'CHF',
  DE: 'EUR',
  AT: 'EUR',
  ES: 'EUR',
  PT: 'EUR',
  BR: 'BRL',
  GB: 'GBP',
  US: 'USD',
  CA: 'CAD',
} as const

export type Region = keyof typeof REGION_CURRENCY
export type RegionPreference = Region | 'auto'

export const SUPPORTED_REGIONS = Object.keys(REGION_CURRENCY) as Region[]
export const DEFAULT_REGION: Region = 'FR'

const STORAGE_KEY = 'app-region'

const isRegion = (code: string | null | undefined): code is Region =>
  !!code && code in REGION_CURRENCY

/** Région de l'appareil si Tiroir sait y estimer, sinon la région par défaut. */
export function deviceRegion(): Region {
  try {
    const code = getLocales()[0]?.regionCode?.toUpperCase()
    if (isRegion(code)) return code
  } catch {
    /* getLocales indisponible */
  }
  return DEFAULT_REGION
}

export async function getRegionPreference(): Promise<RegionPreference> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY)
    return isRegion(stored) ? stored : 'auto'
  } catch {
    return 'auto'
  }
}

export async function setRegionPreference(pref: RegionPreference) {
  try {
    if (pref === 'auto') await AsyncStorage.removeItem(STORAGE_KEY)
    else await AsyncStorage.setItem(STORAGE_KEY, pref)
  } catch {
    /* sans conséquence */
  }
}

/** Région effective : le choix de l'utilisateur, sinon celle de l'appareil. */
export async function currentRegion(): Promise<Region> {
  const pref = await getRegionPreference()
  return pref === 'auto' ? deviceRegion() : pref
}

/** « Brésil · BRL » dans la langue de l'app ; le code seul si Intl.DisplayNames manque. */
export function regionLabel(region: Region, language: string): string {
  let name: string = region
  try {
    name = new Intl.DisplayNames([language], { type: 'region' }).of(region) ?? region
  } catch {
    /* moteur JS sans Intl.DisplayNames */
  }
  return `${name} · ${REGION_CURRENCY[region]}`
}
