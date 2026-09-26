import { supabase } from './supabase'

/** Côté de la photo stockée : comme l'app mobile (mobile/app/(app)/profile.tsx). */
const AVATAR_SIZE = 320

/**
 * Recadre au centre en carré et réduit à AVATAR_SIZE, en JPEG.
 * Lève une erreur si le navigateur ne sait pas décoder le fichier
 * (HEIC hors Safari, par exemple).
 */
export async function squareJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const sx = (bitmap.width - side) / 2
  const sy = (bitmap.height - side) / 2
  const out = Math.min(AVATAR_SIZE, side)

  const canvas = document.createElement('canvas')
  canvas.width = out
  canvas.height = out
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('CANVAS')
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, out, out)
  bitmap.close()

  return new Promise((resolve, reject) => {
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('ENCODE'))), 'image/jpeg', 0.85)
  })
}

/**
 * Envoie la nouvelle photo, l'enregistre sur le profil, puis supprime
 * l'ancienne — dans cet ordre, pour ne rien perdre si une étape échoue.
 * Renvoie le chemin de la nouvelle photo.
 */
export async function uploadAvatar(userId: string, file: File, previousPath: string | null): Promise<string> {
  const jpeg = await squareJpeg(file)
  const path = `${userId}/avatar/${Date.now()}.jpg`

  const { error: upErr } = await supabase.storage
    .from('object-images')
    .upload(path, jpeg, { contentType: 'image/jpeg', upsert: false })
  if (upErr) throw new Error(upErr.message)

  const { error: dbErr } = await supabase
    .from('profiles')
    .update({ avatar_path: path, updated_at: new Date().toISOString() })
    .eq('id', userId)
  if (dbErr) {
    await supabase.storage.from('object-images').remove([path])
    throw new Error(dbErr.message)
  }

  if (previousPath && previousPath !== path) {
    await supabase.storage.from('object-images').remove([previousPath])
  }
  return path
}

export async function removeAvatar(userId: string, path: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ avatar_path: null, updated_at: new Date().toISOString() })
    .eq('id', userId)
  if (error) throw new Error(error.message)
  await supabase.storage.from('object-images').remove([path])
}
