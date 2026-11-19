import { useCallback, useMemo, useSyncExternalStore } from 'react'
import * as Haptics from 'expo-haptics'
import * as Network from 'expo-network'
import { supabase } from '@/lib/supabase'
import { Motion } from '@/components/ui/tokens'
import { UploadCancelled, UploadError, uploadToStorage, type StorageUpload, type UploadHandle } from './transport'

/**
 * File d'envoi des photos — une seule pour toute l'app.
 *
 * Les écrans ne font plus l'envoi eux-mêmes : ils déposent une demande
 * (`add`) et affichent ce que la file leur dit. La file vit hors des
 * écrans, si bien qu'un envoi continue quand on quitte la fiche : c'est ce
 * qui permet d'enregistrer un objet sans attendre la fin des photos.
 *
 * Chaque photo a son propre état :
 *   preparing → queued → uploading → done
 *                         ↘ offline (en attente du réseau, reprise seule)
 *                         ↘ error   (bouton Réessayer, la photo reste là)
 * `analyzing` est un état d'affichage : la photo est envoyée et Torix la
 * regarde (voir `setAnalyzing`).
 */

export type UploadStatus =
  | 'preparing'
  | 'queued'
  | 'uploading'
  | 'analyzing'
  | 'done'
  | 'error'
  | 'offline'

export interface UploadRequest {
  /** Regroupe les envois d'un même parcours : `object:<id>`, `draft:<id>`… */
  group: string
  /** La photo telle qu'elle a été choisie : affichée tout de suite. */
  uri: string
  bucket?: string
  contentType?: string
  /** Compression / redimensionnement. Rend l'URI du fichier à envoyer. */
  prepare?: (uri: string) => Promise<string>
  /** Chemin dans le Storage, calculé une fois, au premier essai. */
  path: () => string | Promise<string>
  /** Enregistrement en base, une fois le fichier arrivé. */
  commit?: (storagePath: string, preparedUri: string) => Promise<void>
  /** Garder la vignette visible une fois envoyée (sinon elle s'efface après la coche). */
  keepWhenDone?: boolean
  /** Transport de remplacement (page de démonstration : réseau simulé). */
  send?: (upload: StorageUpload) => UploadHandle
}

export interface UploadJob {
  id: string
  group: string
  uri: string
  status: UploadStatus
  /** Fraction envoyée, de 0 à 1. */
  progress: number
  /** Raison lisible du dernier échec. */
  error?: string
  /** Chemin dans le Storage, une fois le fichier arrivé. */
  storagePath?: string
}

export interface UploadSummary {
  total: number
  done: number
  failed: number
  offline: number
  /** En préparation, en file ou en cours d'envoi. */
  active: number
  /** Progression d'ensemble, de 0 à 1. */
  progress: number
  analyzing: boolean
  /** Plus rien ne bouge : tout est envoyé, ou ce qui reste attend un geste. */
  settled: boolean
}

/** Deux ou trois envois à la fois : au-delà, chacun ralentit l'autre. */
export const MAX_PARALLEL = 3
/** Reprises automatiques avant de demander un geste. */
const AUTO_RETRIES = { network: 2, server: 1 } as const
const RETRY_DELAY_MS = [1000, 3000]
/** Temps laissé à la coche avant que la vignette s'efface. */
const DONE_LINGER_MS = Motion.duration.finish + 900

interface Internal extends UploadJob {
  request: UploadRequest
  attempts: number
  preparedUri?: string
  committed?: boolean
  handle?: UploadHandle
  cancelled?: boolean
  /** Reprise automatique différée : pas avant cet instant. */
  notBefore?: number
  timer?: ReturnType<typeof setTimeout>
}

type Listener = () => void

class UploadStore {
  private jobs = new Map<string, Internal>()
  private order: string[] = []
  private listeners = new Set<Listener>()
  private analyzingGroups = new Set<string>()
  private running = 0
  private online = true
  private watchingNetwork = false
  private seq = 0
  private version = 0
  private cache = new Map<string, { version: number; jobs: UploadJob[] }>()

  subscribe = (l: Listener) => {
    this.listeners.add(l)
    return () => { this.listeners.delete(l) }
  }

  private emit() {
    this.version++
    for (const l of this.listeners) l()
  }

  /** Instantané stable d'un groupe (même tableau tant que rien ne change). */
  snapshot(group: string): UploadJob[] {
    const hit = this.cache.get(group)
    if (hit && hit.version === this.version) return hit.jobs
    const analyzing = this.analyzingGroups.has(group)
    const jobs: UploadJob[] = []
    for (const id of this.order) {
      const j = this.jobs.get(id)!
      if (j.group !== group) continue
      jobs.push({
        id: j.id,
        group: j.group,
        uri: j.uri,
        status: analyzing && j.status === 'done' ? 'analyzing' : j.status,
        progress: j.progress,
        error: j.error,
        storagePath: j.storagePath,
      })
    }
    // Rien n'a changé pour ce groupe : on garde le même tableau, React ne
    // redessine pas l'écran pour la progression d'un autre groupe.
    if (hit && sameJobs(hit.jobs, jobs)) {
      hit.version = this.version
      return hit.jobs
    }
    this.cache.set(group, { version: this.version, jobs })
    return jobs
  }

  add(requests: UploadRequest[]): string[] {
    this.watchNetwork()
    const ids: string[] = []
    for (const request of requests) {
      const id = `up_${Date.now().toString(36)}_${(this.seq++).toString(36)}`
      this.jobs.set(id, {
        id, group: request.group, uri: request.uri, request,
        status: 'queued', progress: 0, attempts: 0,
      })
      this.order.push(id)
      ids.push(id)
    }
    this.emit()
    this.pump()
    return ids
  }

  retry(id: string) {
    const j = this.jobs.get(id)
    if (!j || (j.status !== 'error' && j.status !== 'offline')) return
    j.attempts = 0
    j.error = undefined
    j.status = 'queued'
    this.emit()
    this.pump()
  }

  retryGroup(group: string) {
    for (const j of this.jobs.values()) {
      if (j.group === group && (j.status === 'error' || j.status === 'offline')) {
        j.attempts = 0
        j.error = undefined
        j.status = 'queued'
      }
    }
    this.emit()
    this.pump()
  }

  /** Annule un envoi (ou retire une photo en échec). Le fichier déjà arrivé est retiré. */
  cancel(id: string) {
    const j = this.jobs.get(id)
    if (!j) return
    j.cancelled = true
    if (j.timer) clearTimeout(j.timer)
    j.handle?.cancel()
    if (j.storagePath && !j.committed) {
      supabase.storage.from(j.request.bucket ?? 'object-images').remove([j.storagePath]).catch(() => {})
    }
    this.drop(id)
  }

  /** Oublie les vignettes envoyées d'un groupe (l'écran les montre désormais lui-même). */
  clearDone(group: string) {
    for (const j of [...this.jobs.values()]) {
      if (j.group === group && j.status === 'done') this.drop(j.id)
    }
  }

  setAnalyzing(group: string, on: boolean) {
    if (on) this.analyzingGroups.add(group)
    else this.analyzingGroups.delete(group)
    this.emit()
  }

  private drop(id: string) {
    const j = this.jobs.get(id)
    if (j?.timer) clearTimeout(j.timer)
    this.jobs.delete(id)
    this.order = this.order.filter(x => x !== id)
    this.emit()
  }

  private watchNetwork() {
    if (this.watchingNetwork) return
    this.watchingNetwork = true
    Network.getNetworkStateAsync().then(s => this.setOnline(isOnline(s))).catch(() => {})
    Network.addNetworkStateListener(s => this.setOnline(isOnline(s)))
  }

  /** Démonstration : simule une coupure ou un retour du réseau. */
  simulateNetwork(online: boolean) {
    this.setOnline(online)
  }

  private setOnline(online: boolean) {
    const was = this.online
    this.online = online
    if (online && !was) {
      // Retour du réseau : tout ce qui attendait repart seul.
      for (const j of this.jobs.values()) {
        if (j.status === 'offline') { j.status = 'queued'; j.attempts = 0 }
      }
      this.emit()
    }
    this.pump()
  }

  private pump() {
    for (const j of this.jobs.values()) {
      if (this.running >= MAX_PARALLEL) return
      if (j.status !== 'queued') continue
      if (j.notBefore && j.notBefore > Date.now()) continue
      if (!this.online) {
        j.status = 'offline'
        this.emit()
        continue
      }
      this.running++
      this.run(j).finally(() => {
        this.running--
        this.pump()
      })
    }
  }

  private setProgress(j: Internal, p: number) {
    const clamped = Math.max(0, Math.min(1, p))
    // Un rendu tous les 2 % suffit : l'anneau glisse de l'un à l'autre.
    if (clamped < 1 && clamped - j.progress < 0.02) return
    j.progress = clamped
    this.emit()
  }

  private async run(j: Internal) {
    const r = j.request
    try {
      if (!j.preparedUri) {
        j.status = 'preparing'
        this.emit()
        j.preparedUri = r.prepare ? await r.prepare(j.uri) : j.uri
        if (j.cancelled) return
      }
      if (!j.storagePath) {
        const path = await r.path()
        if (j.cancelled) return
        j.status = 'uploading'
        j.progress = 0
        this.emit()
        j.handle = (r.send ?? uploadToStorage)({
          bucket: r.bucket ?? 'object-images',
          path,
          fileUri: j.preparedUri,
          contentType: r.contentType ?? 'image/jpeg',
          onProgress: p => { if (!j.cancelled) this.setProgress(j, p * 0.95) },
        })
        await j.handle.promise
        j.handle = undefined
        if (j.cancelled) return
        j.storagePath = path
      }
      // Le fichier est arrivé ; reste l'enregistrement en base (5 % de l'anneau).
      j.status = 'uploading'
      this.setProgress(j, 0.95)
      if (r.commit && !j.committed) await r.commit(j.storagePath, j.preparedUri)
      if (j.cancelled) return
      j.committed = true
      j.progress = 1
      j.status = 'done'
      j.error = undefined
      this.emit()
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
      if (!r.keepWhenDone) j.timer = setTimeout(() => this.drop(j.id), DONE_LINGER_MS)
    } catch (e) {
      j.handle = undefined
      if (j.cancelled || e instanceof UploadCancelled) return
      this.fail(j, e)
    }
  }

  private async fail(j: Internal, e: unknown) {
    const kind = e instanceof UploadError ? e.kind : 'rejected'
    j.error = e instanceof Error ? e.message : String(e)
    if (kind === 'network') {
      const state = this.online ? await Network.getNetworkStateAsync().catch(() => null) : null
      if (!this.online || (state && !isOnline(state))) {
        // Coupure : la photo attend le réseau, sans rien demander.
        this.online = false
        j.status = 'offline'
        this.emit()
        return
      }
    }
    const max = kind === 'network' ? AUTO_RETRIES.network : kind === 'server' ? AUTO_RETRIES.server : 0
    if (j.attempts < max) {
      const delay = RETRY_DELAY_MS[Math.min(j.attempts, RETRY_DELAY_MS.length - 1)]
      j.attempts++
      j.status = 'queued'
      j.progress = j.storagePath ? 0.95 : 0
      j.notBefore = Date.now() + delay
      this.emit()
      j.timer = setTimeout(() => this.pump(), delay)
      return
    }
    j.status = 'error'
    this.emit()
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {})
  }
}

function isOnline(s: Network.NetworkState): boolean {
  // `isInternetReachable` peut rester inconnu (undefined) : seul un `false` franc compte.
  return s.isConnected !== false && s.isInternetReachable !== false
}

function sameJobs(a: UploadJob[], b: UploadJob[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i]
    if (x.id !== y.id || x.status !== y.status || x.progress !== y.progress || x.error !== y.error || x.storagePath !== y.storagePath) return false
  }
  return true
}

export const uploadStore = new UploadStore()

export function summarize(jobs: UploadJob[], analyzing = false): UploadSummary {
  let done = 0, failed = 0, offline = 0, active = 0, sum = 0
  for (const j of jobs) {
    if (j.status === 'done' || j.status === 'analyzing') done++
    else if (j.status === 'error') failed++
    else if (j.status === 'offline') offline++
    else active++
    sum += j.status === 'done' || j.status === 'analyzing' ? 1 : j.progress
  }
  return {
    total: jobs.length, done, failed, offline, active,
    progress: jobs.length ? sum / jobs.length : 0,
    analyzing: analyzing || jobs.some(j => j.status === 'analyzing'),
    settled: active === 0 && offline === 0,
  }
}

/**
 * La file d'envoi, vue d'un groupe : ses photos, leur état, et les gestes
 * (ajouter, réessayer, annuler).
 */
export function useUploadQueue(group: string) {
  const jobs = useSyncExternalStore(
    uploadStore.subscribe,
    () => uploadStore.snapshot(group),
    () => uploadStore.snapshot(group),
  )
  const summary = useMemo(() => summarize(jobs), [jobs])

  const add = useCallback(
    (requests: Omit<UploadRequest, 'group'>[]) => uploadStore.add(requests.map(r => ({ ...r, group }))),
    [group],
  )
  const retry = useCallback((id: string) => uploadStore.retry(id), [])
  const retryAll = useCallback(() => uploadStore.retryGroup(group), [group])
  const cancel = useCallback((id: string) => uploadStore.cancel(id), [])
  const clearDone = useCallback(() => uploadStore.clearDone(group), [group])
  const setAnalyzing = useCallback((on: boolean) => uploadStore.setAnalyzing(group, on), [group])

  return { jobs, summary, add, retry, retryAll, cancel, clearDone, setAnalyzing }
}
