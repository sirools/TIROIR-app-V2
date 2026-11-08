import { Platform } from 'react-native'
import * as FileSystem from 'expo-file-system/legacy'
import * as ImageManipulator from 'expo-image-manipulator'
import { decode } from 'base64-arraybuffer'
import { supabase } from '@/lib/supabase'

// ================================================================
// Copie haute définition d'une photo, pour le zoom (abonnés seulement).
//
// La photo courante reste en 1200 px : c'est elle que lisent l'analyse IA et
// les listes. La copie n'est vue que dans le plein écran. Elle part en tâche
// de fond, sans jamais retarder ni faire échouer une capture : si elle manque,
// le plein écran retombe sur la photo courante.
// ================================================================

/** Largeur des photos courantes : en dessous, une copie n'apporterait rien. */
export const STANDARD_WIDTH = 1200
const ZOOM_MAX_EDGE = 3200
const ZOOM_QUALITY = 0.85

export interface PhotoSource {
  uri: string
  width: number
  height: number
}

/** Chemin de la copie, à enregistrer avec la photo ; null s'il n'y en aura pas. */
export function zoomPathFor(storagePath: string, source?: PhotoSource | null): string | null {
  if (!source || source.width <= STANDARD_WIDTH) return null
  return `${storagePath.replace(/\.[^./]+$/, '')}_hd.jpg`
}

async function uploadCopy(source: PhotoSource, zoomPath: string) {
  const resize = source.width >= source.height
    ? { width: Math.min(source.width, ZOOM_MAX_EDGE) }
    : { height: Math.min(source.height, ZOOM_MAX_EDGE) }
  const copy = await ImageManipulator.manipulateAsync(
    source.uri,
    [{ resize }],
    { compress: ZOOM_QUALITY, format: ImageManipulator.SaveFormat.JPEG },
  )
  const body = Platform.OS === 'web'
    ? await (await fetch(copy.uri)).blob()
    : decode(await FileSystem.readAsStringAsync(copy.uri, { encoding: FileSystem.EncodingType.Base64 }))
  const { error } = await supabase.storage
    .from('object-images')
    .upload(zoomPath, body, { contentType: 'image/jpeg', upsert: false })
  if (error) throw error
}

// Une copie à la fois : un lot décodé d'un coup en 3200 px saturerait la mémoire.
let queue: Promise<void> = Promise.resolve()

export function queueZoomCopy(source: PhotoSource | null | undefined, zoomPath: string | null) {
  if (!source || !zoomPath) return
  queue = queue
    .then(() => uploadCopy(source, zoomPath))
    .catch(err => console.warn('[zoomCopy]', err))
}
