// Brouillons de la Fiche express dans l'app : mêmes règles que sur le site
// (drafts.ts), rangés dans AsyncStorage.
import AsyncStorage from '@react-native-async-storage/async-storage'
import { DRAFTS_KEY, loadDrafts, saveDrafts, type Draft } from './drafts'

export async function readDrafts(): Promise<Draft[]> {
  const raw = await AsyncStorage.getItem(DRAFTS_KEY).catch(() => null)
  return loadDrafts({ getItem: () => raw, setItem: () => {} })
}

/** Enregistre et renvoie la liste réellement gardée (les plus récents). */
export function writeDrafts(drafts: Draft[]): Draft[] {
  let serialized = '[]'
  const kept = saveDrafts({ getItem: () => null, setItem: (_key, value) => { serialized = value } }, drafts)
  AsyncStorage.setItem(DRAFTS_KEY, serialized).catch(error => console.warn('[fiche-express] brouillons', error))
  return kept
}
