/**
 * Découpage des objets d'une scène.
 *
 * Le modèle rend une boîte par objet quand il juge le découpage lisible.
 * Une fiche mérite mieux qu'une photo d'étagère entière partagée par ses
 * vingt voisines : le recadrage est la seule façon de donner à chacune une
 * image d'elle-même — et il ne coûte rien, tout se passe sur l'appareil.
 *
 * Rien n'est inventé ici : c'est la photo de l'utilisateur, recadrée.
 */
import * as ImageManipulator from 'expo-image-manipulator'
import * as FileSystem from 'expo-file-system/legacy'

export interface SceneCrop {
  uri: string
  width: number
  height: number
}

/**
 * Le modèle cadre au plus juste. Un socle rogné au ras ou une bannière
 * coupée se lisent mal en vignette : on desserre.
 */
const PADDING = 0.1

/**
 * Côté maximal de la vignette produite. Jamais agrandie au-delà de ce que
 * la source contient : une figurine qui occupe 176 px sur la photo ne
 * gagne rien à être étirée sur 480, elle y perd juste en poids.
 */
const THUMB_MAX = 640

/**
 * En dessous, la boîte ne couvre pas assez de pixels pour donner autre
 * chose qu'une bouillie agrandie. Mieux vaut pas de vignette qu'une
 * vignette illisible — c'est le cas que la génération IA doit rattraper.
 */
const MIN_SIDE_PX = 96

/**
 * Ramène la photo de scène sur le disque local.
 *
 * Fraîchement prise, elle y est déjà. Rejouée depuis l'historique, elle
 * vit dans le Storage : il faut la descendre avant de pouvoir la découper.
 */
export async function ensureLocalScenePhoto(
  localUri: string | null,
  remoteUrl: string | null,
  cacheKey: string,
): Promise<string | null> {
  if (localUri) return localUri
  if (!remoteUrl) return null

  const dest = `${FileSystem.cacheDirectory}scene-${cacheKey}.jpg`
  const info = await FileSystem.getInfoAsync(dest)
  if (info.exists) return dest

  try {
    const { uri } = await FileSystem.downloadAsync(remoteUrl, dest)
    return uri
  } catch {
    return null
  }
}

/**
 * Boîte normalisée [x, y, largeur, hauteur] → rectangle carré en pixels.
 *
 * Carré parce que la vignette l'est : recadrer au format de la boîte puis
 * l'écraser dans un carré déformerait l'objet. On étend le côté court
 * autour du centre, quitte à mordre sur les voisins — un objet un peu
 * entouré reste plus lisible qu'un objet déformé.
 */
function squareRect(bbox: number[], width: number, height: number) {
  const [nx, ny, nw, nh] = bbox
  if (![nx, ny, nw, nh].every(v => typeof v === 'number' && isFinite(v))) return null
  if (nw <= 0 || nh <= 0) return null

  const cx = (nx + nw / 2) * width
  const cy = (ny + nh / 2) * height
  const side = Math.max(nw * width, nh * height) * (1 + PADDING * 2)

  // Une boîte plus grande que l'image après marge : on retombe sur l'image.
  const clamped = Math.min(side, width, height)
  if (clamped < MIN_SIDE_PX) return null

  const originX = Math.round(Math.min(Math.max(cx - clamped / 2, 0), width - clamped))
  const originY = Math.round(Math.min(Math.max(cy - clamped / 2, 0), height - clamped))

  return { originX, originY, width: Math.round(clamped), height: Math.round(clamped) }
}

/**
 * Découpe chaque objet et rend sa vignette au fil de l'eau.
 *
 * Au fil de l'eau et non en bloc : sur une vitrine de vingt-et-un objets,
 * attendre la dernière découpe pour montrer la première ferait patienter
 * plusieurs secondes devant une liste vide.
 */
export async function cropSceneObjects(
  sourceUri: string,
  boxes: { index: number; bbox: number[] }[],
  onCrop: (index: number, crop: SceneCrop) => void,
  isStale: () => boolean,
): Promise<void> {
  if (boxes.length === 0) return

  // Un seul contexte pour toutes les découpes. reset() le ramène à l'image
  // d'origine sans la redécoder : sur une vitrine de vingt-et-un objets,
  // repartir du fichier à chaque fois paierait vingt fois le même décodage.
  //
  // Et on découpe dans la pleine résolution, pas dans une copie réduite :
  // une figurine qui occupe 11 % d'une photo de 4 000 px rend 440 px de
  // détail, contre 176 si on avait d'abord ramené la scène à 1 600.
  const context = ImageManipulator.ImageManipulator.manipulate(sourceUri)

  const source = await context.renderAsync()
  const { width, height } = source

  for (const { index, bbox } of boxes) {
    if (isStale()) return

    const rect = squareRect(bbox, width, height)
    if (!rect) continue

    try {
      const step = context.reset().crop(rect)
      if (rect.width > THUMB_MAX) step.resize({ width: THUMB_MAX })

      const rendered = await step.renderAsync()
      const saved = await rendered.saveAsync({
        compress: 0.85,
        format: ImageManipulator.SaveFormat.JPEG,
      })

      if (isStale()) return
      onCrop(index, { uri: saved.uri, width: saved.width, height: saved.height })
    } catch {
      // Une découpe ratée n'est pas une analyse ratée : la fiche prendra
      // la photo de scène entière.
    }
  }
}
