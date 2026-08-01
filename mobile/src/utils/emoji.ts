/**
 * Extraction d'un emoji saisi au clavier système.
 *
 * Le clavier emoji d'iOS/Android envoie du texte comme n'importe quelle
 * touche : on récupère une chaîne, pas un « emoji ». Or un seul emoji
 * visible peut peser plusieurs code points (drapeaux, familles ZWJ,
 * teintes de peau, keycaps). On segmente donc à la main plutôt que de
 * couper au caractère — `text[0]` sur 👨‍👩‍👧 renvoie un bonhomme seul.
 *
 * Intl.Segmenter ferait le travail mais n'est pas garanti sur Hermes
 * selon la build ; cette segmentation couvre les séquences emoji réelles.
 */

const ZWJ = 0x200d
const VS15 = 0xfe0e
const VS16 = 0xfe0f
const KEYCAP = 0x20e3
const SKIN_MIN = 0x1f3fb
const SKIN_MAX = 0x1f3ff
const RI_MIN = 0x1f1e6 // indicateurs régionaux (drapeaux)
const RI_MAX = 0x1f1ff
const TAG_MIN = 0xe0020 // séquences tag (drapeaux régionaux : 🏴󠁧󠁢󠁳󠁣󠁴󠁿)
const TAG_MAX = 0xe007f

function isSkinTone(cp: number) {
  return cp >= SKIN_MIN && cp <= SKIN_MAX
}

function isRegionalIndicator(cp: number) {
  return cp >= RI_MIN && cp <= RI_MAX
}

/** Modificateur qui se colle au code point précédent sans créer un nouvel emoji. */
function isModifier(cp: number) {
  return (
    cp === VS15 ||
    cp === VS16 ||
    cp === KEYCAP ||
    isSkinTone(cp) ||
    (cp >= TAG_MIN && cp <= TAG_MAX)
  )
}

/**
 * Le code point appartient-il à un bloc emoji ?
 * Sert à refuser les lettres et la ponctuation : si l'utilisateur tape
 * « veste » au lieu d'un emoji, on ne veut pas d'un « v » dans la pastille.
 */
export function isEmojiCodePoint(cp: number): boolean {
  return (
    (cp >= 0x1f000 && cp <= 0x1faff) || // pictogrammes, émoticônes, symboles étendus
    (cp >= 0x2600 && cp <= 0x27bf) ||   // divers symboles + dingbats
    (cp >= 0x2190 && cp <= 0x21ff) ||   // flèches
    (cp >= 0x2300 && cp <= 0x23ff) ||   // techniques (⌚, ⏰…)
    (cp >= 0x25a0 && cp <= 0x25ff) ||   // formes géométriques
    (cp >= 0x2b00 && cp <= 0x2bff) ||   // symboles divers (⭐, ⬛…)
    cp === 0x00a9 || cp === 0x00ae ||
    cp === 0x203c || cp === 0x2049 ||
    cp === 0x2122 || cp === 0x2139 ||
    cp === 0x3030 || cp === 0x303d ||
    cp === 0x3297 || cp === 0x3299
  )
}

/** Base d'un keycap (1️⃣, #️⃣) — valide seulement suivie de U+20E3. */
function isKeycapBase(cp: number) {
  return (cp >= 0x0030 && cp <= 0x0039) || cp === 0x0023 || cp === 0x002a
}

/** Découpe une chaîne en emojis visibles (clusters). */
export function splitEmojis(text: string): string[] {
  const cps = Array.from(text).map(c => c.codePointAt(0) ?? 0)
  const clusters: string[] = []
  let i = 0

  while (i < cps.length) {
    const start = i
    const first = cps[i]

    // Drapeau = paire d'indicateurs régionaux
    if (isRegionalIndicator(first) && i + 1 < cps.length && isRegionalIndicator(cps[i + 1])) {
      i += 2
    } else {
      i += 1
      // Modificateurs collés au code point de base
      while (i < cps.length && isModifier(cps[i])) i++
      // Chaînes ZWJ : 👩‍🚀, 👨‍👩‍👧‍👦…
      while (i < cps.length && cps[i] === ZWJ && i + 1 < cps.length) {
        i += 2
        while (i < cps.length && isModifier(cps[i])) i++
      }
    }

    const parts = cps.slice(start, i)
    const cluster = parts.map(cp => String.fromCodePoint(cp)).join('')
    const valid =
      isEmojiCodePoint(first) ||
      isRegionalIndicator(first) ||
      (isKeycapBase(first) && parts.includes(KEYCAP))
    if (valid) clusters.push(cluster)
  }

  return clusters
}

/**
 * Dernier emoji valide d'une saisie, ou null si l'utilisateur n'a rien
 * tapé d'exploitable. On prend le dernier — pas le premier — parce qu'en
 * retapant l'utilisateur corrige son choix, il ne l'ajoute pas.
 */
export function extractLastEmoji(text: string): string | null {
  const clusters = splitEmojis(text)
  return clusters.length > 0 ? clusters[clusters.length - 1] : null
}
