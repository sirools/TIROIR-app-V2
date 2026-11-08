import { Platform } from 'react-native'
import * as FileSystem from 'expo-file-system/legacy'
import * as ImageManipulator from 'expo-image-manipulator'
import type * as ImagePicker from 'expo-image-picker'
import { supabase } from '@/lib/supabase'
import { assistantService } from '@/services/assistant'
import { type PhotoSource, queueZoomCopy, zoomPathFor } from '@/services/zoomCopy'
import type { DraftProposedData } from '@/types/database'

// ================================================================
// Ajout multiple d'objets — orchestration d'un lot.
//
// Un lot = N drafts partageant un batch_id (cf. migration
// 20260723210000_batch_capture.sql). Une image = un objet.
//
// Chaque item est traité indépendamment : upload puis analyse.
// Un échec isole l'item concerné, le reste du lot continue.
// ================================================================

export interface BatchImage {
  uri: string
  mimeType: string
  fileName: string
  source?: PhotoSource
}

export type BatchItemStatus =
  | 'queued'      // en attente d'un worker
  | 'uploading'   // photo en cours d'envoi
  | 'analyzing'   // photo envoyée, IA en cours
  | 'done'        // proposed_data reçue
  | 'error'       // upload ou analyse en échec

export interface BatchItem {
  draftId: string
  position: number
  image: BatchImage
  status: BatchItemStatus
  data: DraftProposedData | null
  error: string | null
}

/**
 * Nombre d'analyses simultanées. Au-delà de ~4 on gagne peu (le
 * goulot devient l'upload) et on multiplie les risques de timeout
 * sur réseau mobile.
 */
const CONCURRENCY = 4

/**
 * Décalage au lancement de chaque worker. Les latences d'analyse
 * étant homogènes, ce décalage suffit à faire remonter les résultats
 * à peu près dans l'ordre de saisie — la cascade visuelle de haut en
 * bas — sans aucune logique de séquencement.
 */
const STAGGER_MS = 300

/**
 * Redimensionne et compresse avant envoi. Mêmes réglages que l'écran
 * de capture : 1200 px de large suffisent à l'analyse et divisent le
 * poids par ~10 sur réseau mobile.
 */
export async function compressImages(
  assets: ImagePicker.ImagePickerAsset[],
  withZoomCopy = false,
): Promise<BatchImage[]> {
  return Promise.all(
    assets.map(async asset => {
      const result = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG },
      )
      return {
        uri: result.uri,
        mimeType: 'image/jpeg',
        fileName: `photo_${Date.now()}.jpg`,
        ...(withZoomCopy ? { source: { uri: asset.uri, width: asset.width, height: asset.height } } : {}),
      }
    }),
  )
}

interface BeginBatchRow {
  batch_id: string
  draft_id: string
  batch_position: number
}

/**
 * Ouvre un lot : crée N drafts vides côté serveur.
 * L'image d'indice i est rattachée au draft de batch_position = i.
 */
export async function beginBatch(
  images: BatchImage[],
): Promise<{ batchId: string; items: BatchItem[] }> {
  const { data, error } = await supabase.rpc('begin_batch_capture', {
    p_size: images.length,
  })

  if (error) throw new Error(error.message)

  const rows = (data ?? []) as BeginBatchRow[]
  if (rows.length !== images.length) {
    throw new Error(
      `Lot incomplet : ${rows.length} brouillons créés pour ${images.length} photos.`,
    )
  }

  const items: BatchItem[] = rows
    .slice()
    .sort((a, b) => a.batch_position - b.batch_position)
    .map(row => ({
      draftId: row.draft_id,
      position: row.batch_position,
      image: images[row.batch_position],
      status: 'queued' as BatchItemStatus,
      data: null,
      error: null,
    }))

  return { batchId: rows[0].batch_id, items }
}

/**
 * Rattache de nouvelles photos à un lot déjà ouvert. Les positions
 * continuent la numérotation existante, pour que l'ordre de la liste
 * reste celui de la saisie.
 */
export async function extendBatch(
  batchId: string,
  images: BatchImage[],
): Promise<BatchItem[]> {
  const { data, error } = await supabase.rpc('extend_batch_capture', {
    p_batch_id: batchId,
    p_size: images.length,
  })

  if (error) throw new Error(error.message)

  const rows = ((data ?? []) as BeginBatchRow[])
    .slice()
    .sort((a, b) => a.batch_position - b.batch_position)

  if (rows.length !== images.length) {
    throw new Error(
      `Extension incomplète : ${rows.length} brouillons créés pour ${images.length} photos.`,
    )
  }

  // Les positions ne repartent pas de 0 : on apparie par rang, pas
  // par valeur de batch_position.
  return rows.map((row, i) => ({
    draftId: row.draft_id,
    position: row.batch_position,
    image: images[i],
    status: 'queued' as BatchItemStatus,
    data: null,
    error: null,
  }))
}

/** Envoie une image dans le bucket puis l'enregistre sur son draft. */
async function uploadImage(
  item: BatchItem,
  userId: string,
): Promise<void> {
  const ext = item.image.mimeType === 'image/jpeg' ? 'jpg' : 'png'
  const storagePath = `${userId}/drafts/${item.draftId}/0.${ext}`

  let uploadData: Blob | Uint8Array
  if (Platform.OS === 'web') {
    const response = await fetch(item.image.uri)
    uploadData = await response.blob()
  } else {
    const base64 = await FileSystem.readAsStringAsync(item.image.uri, {
      encoding: FileSystem.EncodingType.Base64,
    })
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j)
    uploadData = bytes
  }

  const { error: storageError } = await supabase.storage
    .from('object-images')
    .upload(storagePath, uploadData, {
      contentType: item.image.mimeType,
      upsert: false,
    })
  if (storageError) throw new Error(storageError.message)

  const zoomPath = zoomPathFor(storagePath, item.image.source)
  const { error: dbError } = await supabase.from('ai_draft_images').insert({
    draft_id: item.draftId,
    user_id: userId,
    storage_path: storagePath,
    zoom_path: zoomPath,
    mime_type: item.image.mimeType,
    position: 0,
  })
  if (dbError) throw new Error(dbError.message)
  queueZoomCopy(item.image.source, zoomPath)
}

export type BatchProgressHandler = (
  position: number,
  patch: Partial<BatchItem>,
) => void

/** Upload puis analyse d'un seul item. Ne relance jamais d'exception. */
async function processItem(
  item: BatchItem,
  userId: string,
  onProgress: BatchProgressHandler,
  isCancelled: () => boolean,
): Promise<void> {
  if (isCancelled()) return

  try {
    onProgress(item.position, { status: 'uploading' })
    await uploadImage(item, userId)

    if (isCancelled()) return

    onProgress(item.position, { status: 'analyzing' })
    const { proposedData } = await assistantService.analyzeDraft(item.draftId)

    if (isCancelled()) return

    onProgress(item.position, { status: 'done', data: proposedData, error: null })
  } catch (e: unknown) {
    if (isCancelled()) return
    const message = e instanceof Error ? e.message : String(e)
    onProgress(item.position, { status: 'error', error: message })
  }
}

/**
 * Traite tout le lot avec un pool de workers décalés au lancement.
 * Résout quand chaque item est en 'done' ou 'error'.
 */
export async function runBatch(
  items: BatchItem[],
  userId: string,
  onProgress: BatchProgressHandler,
  isCancelled: () => boolean = () => false,
): Promise<void> {
  const cursor = { next: 0 }

  async function worker(startDelayMs: number): Promise<void> {
    if (startDelayMs > 0) {
      await new Promise(r => setTimeout(r, startDelayMs))
    }
    while (!isCancelled()) {
      const index = cursor.next++
      if (index >= items.length) return
      await processItem(items[index], userId, onProgress, isCancelled)
    }
  }

  const workerCount = Math.min(CONCURRENCY, items.length)
  await Promise.all(
    Array.from({ length: workerCount }, (_, k) => worker(k * STAGGER_MS)),
  )
}

/** Relance un seul item en échec (bouton « Réessayer » d'une ligne). */
export async function retryItem(
  item: BatchItem,
  userId: string,
  onProgress: BatchProgressHandler,
): Promise<void> {
  // L'upload a pu réussir avant que l'analyse échoue : on ne renvoie
  // la photo que si le draft n'a encore aucune image.
  const { count } = await supabase
    .from('ai_draft_images')
    .select('id', { count: 'exact', head: true })
    .eq('draft_id', item.draftId)

  const needsUpload = (count ?? 0) === 0

  try {
    if (needsUpload) {
      onProgress(item.position, { status: 'uploading', error: null })
      await uploadImage(item, userId)
    }
    onProgress(item.position, { status: 'analyzing', error: null })
    const { proposedData } = await assistantService.analyzeDraft(item.draftId)
    onProgress(item.position, { status: 'done', data: proposedData, error: null })
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    onProgress(item.position, { status: 'error', error: message })
  }
}

export interface ConfirmBatchRow {
  draft_id: string
  object_id: string | null
  error_message: string | null
}

/**
 * Finalise le lot. Chaque draft est confirmé dans sa propre
 * sous-transaction côté base : un échec (quota objets atteint)
 * n'annule pas les objets déjà créés.
 */
export async function confirmBatch(
  batchId: string,
  collectionId: string | null,
): Promise<ConfirmBatchRow[]> {
  const { data, error } = await supabase.rpc('confirm_batch', {
    p_batch_id: batchId,
    p_collection_id: collectionId,
  })
  if (error) throw new Error(error.message)
  return (data ?? []) as ConfirmBatchRow[]
}

/**
 * Applique les titres corrigés à la main sur les objets créés.
 * Les drafts ne sont pas modifiables par le client (RLS en SELECT
 * seul) : on patche donc après confirmation, sur `objects`.
 */
export async function applyEditedTitles(
  edits: Array<{ objectId: string; title: string }>,
): Promise<void> {
  await Promise.all(
    edits.map(({ objectId, title }) =>
      supabase.from('objects').update({ title }).eq('id', objectId),
    ),
  )
}
