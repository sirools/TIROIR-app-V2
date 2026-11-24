// « Ajouter à mon Tiroir » : une fiche express devient un objet de
// l'inventaire (Supabase), avec sa photo. Aucun appel d'IA ici.
import { supabase } from '@/lib/supabase'
import { inventoryFields, type Draft } from './drafts'

/** Levée quand le plafond d'objets de l'offre est atteint. */
export class ObjectQuotaError extends Error {}

function bytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

/** Crée l'objet et renvoie son identifiant. Demande du réseau et une session. */
export async function addToInventory(draft: Draft, userId: string): Promise<string> {
  const fields = inventoryFields(draft, new Date())

  const { data: objectId, error: createError } = await supabase.rpc('create_empty_object')
  if (createError || !objectId) {
    if (createError?.message?.includes('OBJECT_QUOTA_EXCEEDED')) throw new ObjectQuotaError(createError.message)
    throw new Error(createError?.message ?? 'Création impossible')
  }

  const { error: updateError } = await supabase.from('objects').update(fields).eq('id', objectId)
  if (updateError) throw new Error(updateError.message)

  const ext = draft.photo.mimeType === 'image/jpeg' ? 'jpg' : 'png'
  const storagePath = `${userId}/${objectId}/${Date.now()}_0.${ext}`
  const { error: storageError } = await supabase.storage
    .from('object-images')
    .upload(storagePath, bytes(draft.photo.base64), { contentType: draft.photo.mimeType, upsert: false })
  if (storageError) throw new Error(storageError.message)

  const { error: imageError } = await supabase.from('object_images').insert({
    object_id: objectId,
    user_id: userId,
    storage_path: storagePath,
    zoom_path: null,
    mime_type: draft.photo.mimeType,
    position: 0,
    is_cover: true,
  })
  if (imageError) throw new Error(imageError.message)

  return objectId as string
}
