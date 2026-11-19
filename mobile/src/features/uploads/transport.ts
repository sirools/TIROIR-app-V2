import { Platform } from 'react-native'
import * as FileSystem from 'expo-file-system/legacy'
import { supabase } from '@/lib/supabase'

/**
 * Envoi d'un fichier local vers Supabase Storage, avec la VRAIE progression.
 *
 * `supabase.storage.upload()` passe par `fetch`, qui ne dit rien de
 * l'avancement : d'où l'anneau impossible à remplir. Ici, sur iOS et
 * Android, l'envoi passe par la tâche native d'expo-file-system (déjà dans
 * l'app) : le fichier part du disque sans être relu en base64 par le fil JS
 * — une grosse photo ne fige plus l'écran — et chaque paquet envoyé remonte
 * en octets. Sur le web, un XMLHttpRequest fait la même chose.
 *
 * Même point d'entrée que le client Supabase (`/storage/v1/object/…`),
 * mêmes règles d'accès (jeton de la session) : rien ne change côté serveur.
 */

export type UploadErrorKind =
  /** Pas de réseau, ou coupure en cours d'envoi : on réessaie seul. */
  | 'network'
  /** Erreur passagère du serveur (5xx, 408, 429) : on réessaie seul, une fois. */
  | 'server'
  /** Refus définitif (fichier refusé, droits) : il faut un geste. */
  | 'rejected'
  /** Session expirée. */
  | 'auth'

export class UploadError extends Error {
  constructor(public kind: UploadErrorKind, message: string, public status?: number) {
    super(message)
    this.name = 'UploadError'
  }
}

export class UploadCancelled extends Error {
  constructor() {
    super('cancelled')
    this.name = 'UploadCancelled'
  }
}

export interface StorageUpload {
  bucket: string
  path: string
  fileUri: string
  contentType: string
  /** Fraction envoyée, de 0 à 1. */
  onProgress?: (fraction: number) => void
}

export interface UploadHandle {
  promise: Promise<void>
  cancel: () => void
}

function kindForStatus(status: number): UploadErrorKind {
  if (status === 401 || status === 403) return 'auth'
  if (status === 408 || status === 429 || status >= 500) return 'server'
  return 'rejected'
}

function messageFromBody(body: string | undefined, status: number): string {
  try {
    const parsed = JSON.parse(body ?? '')
    if (parsed?.message) return String(parsed.message)
    if (parsed?.error) return String(parsed.error)
  } catch {
    // corps non JSON
  }
  return `HTTP ${status}`
}

function objectUrl(bucket: string, path: string): string {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL!.replace(/\/$/, '')
  const encoded = path.split('/').map(encodeURIComponent).join('/')
  return `${base}/storage/v1/object/${bucket}/${encoded}`
}

async function headers(contentType: string): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new UploadError('auth', 'AUTH')
  return {
    Authorization: `Bearer ${session.access_token}`,
    apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
    'Content-Type': contentType,
    'x-upsert': 'false',
    'cache-control': 'max-age=3600',
  }
}

export function uploadToStorage(job: StorageUpload): UploadHandle {
  let cancelled = false
  let cancelImpl: () => void = () => {}

  const promise = (async () => {
    const h = await headers(job.contentType)
    if (cancelled) throw new UploadCancelled()
    const url = objectUrl(job.bucket, job.path)

    if (Platform.OS === 'web') {
      await new Promise<void>(async (resolve, reject) => {
        const body = await (await fetch(job.fileUri)).blob()
        const xhr = new XMLHttpRequest()
        cancelImpl = () => xhr.abort()
        xhr.open('POST', url)
        for (const [k, v] of Object.entries(h)) xhr.setRequestHeader(k, v)
        xhr.upload.onprogress = e => {
          if (e.lengthComputable && e.total > 0) job.onProgress?.(e.loaded / e.total)
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve()
          else reject(new UploadError(kindForStatus(xhr.status), messageFromBody(xhr.responseText, xhr.status), xhr.status))
        }
        xhr.onerror = () => reject(new UploadError('network', 'NETWORK'))
        xhr.onabort = () => reject(new UploadCancelled())
        xhr.send(body)
      })
      return
    }

    const task = FileSystem.createUploadTask(
      url,
      job.fileUri,
      { httpMethod: 'POST', uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT, headers: h },
      ({ totalBytesSent, totalBytesExpectedToSend }) => {
        if (totalBytesExpectedToSend > 0) job.onProgress?.(totalBytesSent / totalBytesExpectedToSend)
      },
    )
    cancelImpl = () => { task.cancelAsync().catch(() => {}) }
    if (cancelled) { cancelImpl(); throw new UploadCancelled() }

    let result: FileSystem.FileSystemUploadResult | undefined | null
    try {
      result = await task.uploadAsync()
    } catch (e) {
      if (cancelled) throw new UploadCancelled()
      throw new UploadError('network', e instanceof Error ? e.message : 'NETWORK')
    }
    // Une tâche annulée rend `undefined` / `null` au lieu de lever.
    if (cancelled || !result) throw new UploadCancelled()
    if (result.status < 200 || result.status >= 300) {
      throw new UploadError(kindForStatus(result.status), messageFromBody(result.body, result.status), result.status)
    }
  })()

  return {
    promise,
    cancel: () => {
      cancelled = true
      cancelImpl()
    },
  }
}
