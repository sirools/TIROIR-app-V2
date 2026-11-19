import { Platform } from 'react-native'
import * as FileSystem from 'expo-file-system/legacy'
import { supabase } from '@/lib/supabase'

/**
 * Envoi d'un fichier local vers Supabase Storage sans le relire en base64.
 *
 * `supabase.storage.upload()` oblige à charger la photo en mémoire puis à
 * la convertir octet par octet sur le fil JS : avec 50 photos, c'est
 * l'interface qui se fige. Ici le fichier part directement du disque par
 * la tâche native d'expo-file-system (déjà dans l'app). Même point
 * d'entrée et même jeton que le client Supabase : rien ne change côté
 * serveur.
 */

export class StorageUploadError extends Error {
  constructor(
    message: string,
    /** Vrai quand la panne vient du réseau : on réessaiera sans rien demander. */
    public network: boolean,
    public status?: number,
  ) {
    super(message)
    this.name = 'StorageUploadError'
  }
  /** Le fichier est déjà en place : un envoi précédent avait abouti. */
  get alreadyThere(): boolean {
    return this.status === 409 || /exist|duplicate/i.test(this.message)
  }
}

function messageFromBody(body: string | undefined, status: number): string {
  try {
    const parsed = JSON.parse(body ?? '')
    const text = parsed?.message ?? parsed?.error
    if (text) return `${String(text)}${parsed?.statusCode ? ` (${parsed.statusCode})` : ''}`
  } catch {
    // corps non JSON
  }
  return `HTTP ${status}`
}

export async function uploadFileToStorage(
  bucket: string,
  path: string,
  fileUri: string,
  contentType: string,
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new StorageUploadError('Session expirée', false, 401)

  const base = process.env.EXPO_PUBLIC_SUPABASE_URL!.replace(/\/$/, '')
  const url = `${base}/storage/v1/object/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`
  const headers = {
    Authorization: `Bearer ${session.access_token}`,
    apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
    'Content-Type': contentType,
    'x-upsert': 'false',
    'cache-control': 'max-age=3600',
  }

  let status: number
  let body: string | undefined

  if (Platform.OS === 'web') {
    try {
      const blob = await (await fetch(fileUri)).blob()
      const res = await fetch(url, { method: 'POST', headers, body: blob })
      status = res.status
      body = await res.text()
    } catch (e) {
      throw new StorageUploadError(e instanceof Error ? e.message : 'NETWORK', true)
    }
  } else {
    let result: FileSystem.FileSystemUploadResult | undefined | null
    try {
      result = await FileSystem.createUploadTask(url, fileUri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers,
      }).uploadAsync()
    } catch (e) {
      throw new StorageUploadError(e instanceof Error ? e.message : 'NETWORK', true)
    }
    if (!result) throw new StorageUploadError('NETWORK', true)
    status = result.status
    body = result.body
  }

  if (status >= 200 && status < 300) return
  // 408, 429 et 5xx : le serveur est momentanément débordé, pas la photo refusée.
  const transient = status === 408 || status === 429 || status >= 500
  throw new StorageUploadError(messageFromBody(body, status), transient, status)
}
