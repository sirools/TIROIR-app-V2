import * as ImageManipulator from 'expo-image-manipulator'
import { STANDARD_WIDTH } from '@/services/zoomCopy'

/**
 * Préparation commune avant envoi : JPEG, largeur plafonnée. C'est l'étape
 * « préparation » de la vignette (voile léger + petit loader).
 */
export function prepareJpeg(maxWidth = STANDARD_WIDTH, compress = 0.82) {
  return async (uri: string): Promise<string> => {
    const out = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: maxWidth } }],
      { compress, format: ImageManipulator.SaveFormat.JPEG },
    )
    return out.uri
  }
}
