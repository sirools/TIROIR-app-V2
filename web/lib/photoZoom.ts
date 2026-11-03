// Calculs du zoom des photos partagées, sans DOM. Les coordonnées partent du
// centre de la scène : c'est aussi l'origine de la transformation de l'image.

export const MIN_SCALE = 1
export const MAX_SCALE = 5
export const DOUBLE_TAP_SCALE = 3

/**
 * Zoom et photos haute définition : réservés aux abonnés. Sur un partage, c'est
 * le palier du propriétaire qui compte. Un Pro échu redevient gratuit, comme
 * dans effective_plan() côté base.
 */
export function hasPhotoZoom(plan?: string | null, proExpiresAt?: string | null) {
  if (plan === 'pro' && proExpiresAt && proExpiresAt < new Date().toISOString().slice(0, 10)) return false
  return plan === 'premium' || plan === 'pro' || plan === 'business'
}

type ImageRow = { storage_path: string; zoom_path?: string | null }
type SignedUrl = { path: string | null; signedUrl: string | null }

/** Chemins à signer pour le zoom, en plus des photos courantes. */
export function zoomPaths(rows: ImageRow[]) {
  return rows.flatMap(r => (r.zoom_path ? [r.zoom_path] : []))
}

/** URL de zoom de chaque photo, alignées sur les photos : la courante si la copie manque. */
export function zoomUrls(rows: ImageRow[], signed: SignedUrl[]) {
  const byPath = new Map(signed.flatMap(s => (s.path && s.signedUrl ? [[s.path, s.signedUrl] as const] : [])))
  return rows.flatMap(r => {
    const url = (r.zoom_path && byPath.get(r.zoom_path)) || byPath.get(r.storage_path)
    return url ? [url] : []
  })
}

export type View = { s: number; x: number; y: number }
export type Bounds = { stageW: number; stageH: number; fitW: number; fitH: number }

export const IDENTITY: View = { s: 1, x: 0, y: 0 }

/** Taille de la photo dans la scène avant zoom (object-fit: contain). */
export function fitSize(naturalW: number, naturalH: number, stageW: number, stageH: number) {
  if (naturalW <= 0 || naturalH <= 0) return { fitW: stageW, fitH: stageH }
  const ratio = Math.min(stageW / naturalW, stageH / naturalH)
  return { fitW: naturalW * ratio, fitH: naturalH * ratio }
}

function bound(value: number, limit: number) {
  return Math.min(limit, Math.max(-limit, value))
}

/** Borne le zoom, et le déplacement pour que la photo ne quitte jamais la scène. */
export function clampView(view: View, b: Bounds): View {
  const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, view.s))
  return {
    s,
    x: bound(view.x, Math.max(0, (b.fitW * s - b.stageW) / 2)),
    y: bound(view.y, Math.max(0, (b.fitH * s - b.stageH) / 2)),
  }
}

/** Zoome en gardant immobile le point de la photo situé sous (fx, fy). */
export function zoomAt(view: View, nextScale: number, fx: number, fy: number, b: Bounds): View {
  const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale))
  const ratio = s / view.s
  return clampView({ s, x: fx - ratio * (fx - view.x), y: fy - ratio * (fy - view.y) }, b)
}

/** Grossissement de la loupe : fort sur la photo entière, plus léger si elle est déjà zoomée. */
export function lensFactor(scale: number) {
  return Math.max(1.5, Math.min(2.5, MAX_SCALE / scale))
}

/** Fond de la loupe : la photo agrandie, le point sous son centre placé au centre. */
export function lensBackground(view: View, b: Bounds, cx: number, cy: number, radius: number, factor = lensFactor(view.s)) {
  const shownW = b.fitW * view.s
  const shownH = b.fitH * view.s
  const u = (cx - (view.x - shownW / 2)) / shownW
  const v = (cy - (view.y - shownH / 2)) / shownH
  const width = shownW * factor
  const height = shownH * factor
  return { width, height, left: radius - u * width, top: radius - v * height }
}
