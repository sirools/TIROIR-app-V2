import { useSyncExternalStore } from 'react'
import { AppState } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as FileSystem from 'expo-file-system/legacy'
import * as ImageManipulator from 'expo-image-manipulator'
import { supabase } from '@/lib/supabase'
import { assistantService } from '@/services/assistant'
import { type PhotoSource, queueZoomCopy, zoomPathFor } from '@/services/zoomCopy'
import type { DraftProposedData } from '@/types/database'
import { StorageUploadError, uploadFileToStorage } from './storageUpload'

// ================================================================
// Import multiple — la file vit ICI, pas dans un écran.
//
// Une photo = un objet. Dès la sélection, le lot existe en mémoire avec
// la vignette locale de chaque photo : l'écran a quelque chose à montrer
// avant le moindre appel réseau. Tout le reste (vérification du lot,
// compression, envoi, analyse, ajout à la collection) se fait ensuite,
// photo par photo, et continue si l'utilisateur change d'écran.
//
// Le lot est recopié sur l'appareil à chaque changement : une app
// fermée ou un réseau perdu ne coûtent aucun objet, l'import reprend
// là où il en était (`restoreBatch`).
// ================================================================

export type BatchItemStatus =
  | 'queued'     // attend son tour
  | 'preparing'  // compression locale
  | 'uploading'  // envoi de la photo
  | 'analyzing'  // analyse par Torix
  | 'done'       // analysé, pas encore ajouté
  | 'added'      // objet créé
  | 'waiting'    // réseau perdu : reprise automatique
  | 'error'      // échec qui demande un geste (Réessayer)

export interface BatchItem {
  key: string
  /** Photo locale, affichée tout de suite. */
  thumbUri: string
  /** Original, pour la copie haute définition des abonnés. */
  source: PhotoSource | null
  /** Photo compressée, prête à partir. */
  preparedUri: string | null
  draftId: string | null
  uploaded: boolean
  /** L'analyse a déjà été demandée : avant de la relancer, on regarde si elle n'a pas abouti. */
  analysisAsked: boolean
  status: BatchItemStatus
  data: DraftProposedData | null
  /** Titre corrigé à la main. */
  title: string | null
  objectId: string | null
  /** Analysé mais refusé à l'ajout (limite d'objets atteinte, brouillon expiré). */
  addFailed: boolean
  attempts: number
}

export type BatchPhase =
  | 'checking'  // vérification du lot
  | 'running'   // envoi et analyse
  | 'ready'     // tout est analysé, il manque la destination
  | 'adding'    // ajout à la collection
  | 'finished'  // enregistré
  | 'failed'    // le lot n'a pas pu démarrer

export interface BatchJob {
  runId: string
  userId: string
  withZoom: boolean
  batchMax: number
  batchId: string | null
  /** Faux tant que personne n'a dit où ranger les objets. */
  destinationChosen: boolean
  collectionId: string | null
  collectionName: string | null
  phase: BatchPhase
  /** Le réseau manque : tout est gardé, on réessaie seul. */
  offline: boolean
  fatal: string | null
  items: BatchItem[]
}

/** Une photo telle que le sélecteur la rend. */
export interface BatchAsset {
  uri: string
  width?: number
  height?: number
  /** Déjà compressée (sélection convertie en lot depuis l'écran de capture). */
  prepared?: boolean
  source?: PhotoSource
}

const STORAGE_KEY = 'tiroir.batchJob.v1'
/** Photos traitées en même temps : au-delà, c'est l'envoi qui sature sur réseau mobile. */
const CONCURRENCY = 4
const RETRY_MS = 8000

let job: BatchJob | null = null
/** Change à chaque nouveau lot ou abandon : le travail en vol de l'ancien lot se tait. */
let epoch = 0
const active = new Set<string>()
const listeners = new Set<() => void>()
let checking = false
let adding = false
let retryTimer: ReturnType<typeof setTimeout> | null = null
let persistTimer: ReturnType<typeof setTimeout> | null = null
let keySeq = 0

// ── Abonnement ────────────────────────────────────────────────────

function set(next: BatchJob | null) {
  job = next
  listeners.forEach(l => l())
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(persist, 250)
}

function persist() {
  persistTimer = null
  const snapshot = job
  const done = !snapshot || snapshot.phase === 'failed'
  ;(done
    ? AsyncStorage.removeItem(STORAGE_KEY)
    : AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  ).catch(() => { /* sans gravité : seule la reprise après fermeture en dépend */ })
}

function patchJob(patch: Partial<BatchJob>) {
  if (job) set({ ...job, ...patch })
}

function patchItem(key: string, patch: Partial<BatchItem>) {
  if (!job) return
  set({ ...job, items: job.items.map(it => (it.key === key ? { ...it, ...patch } : it)) })
}

const itemOf = (key: string) => job?.items.find(it => it.key === key)

export function getBatchJob(): BatchJob | null {
  return job
}

export function useBatchJob(): BatchJob | null {
  return useSyncExternalStore(
    cb => { listeners.add(cb); return () => { listeners.delete(cb) } },
    getBatchJob,
    getBatchJob,
  )
}

// ── Lecture ───────────────────────────────────────────────────────

export type BatchStage = 'checking' | 'uploading' | 'analyzing' | 'adding' | 'finished'

/** Étapes dans l'ordre où elles se déroulent. */
export const BATCH_STAGES: BatchStage[] = ['checking', 'uploading', 'analyzing', 'adding']

export interface BatchStats {
  total: number
  /** Photos dont le sort est connu (analysées, ajoutées ou en échec). */
  settled: number
  ready: number
  added: number
  failed: number
  waiting: number
  stage: BatchStage
  /** Vrai tant qu'il reste du travail en cours. */
  busy: boolean
}

export function batchStats(j: BatchJob): BatchStats {
  let settled = 0, ready = 0, added = 0, failed = 0, waiting = 0, uploaded = 0
  for (const it of j.items) {
    if (it.uploaded) uploaded++
    if (it.status === 'added') { added++; settled++ }
    else if (it.status === 'done') {
      settled++
      if (it.addFailed) failed++; else ready++
    } else if (it.status === 'error') { failed++; settled++ }
    else if (it.status === 'waiting') waiting++
  }
  const total = j.items.length
  const stage: BatchStage =
    j.phase === 'checking' ? 'checking'
    : j.phase === 'finished' ? 'finished'
    : j.phase === 'adding' ? 'adding'
    : uploaded + failed < total ? 'uploading'
    : settled < total ? 'analyzing'
    : j.destinationChosen ? 'adding' : 'analyzing'
  return {
    total, settled, ready, added, failed, waiting, stage,
    busy: j.phase === 'checking' || j.phase === 'running' || j.phase === 'adding',
  }
}

/** Un import occupe-t-il déjà la file ? (Un seul lot à la fois.) */
export function isBatchActive(): boolean {
  return !!job && job.phase !== 'finished' && job.phase !== 'failed'
}

// ── Erreurs ───────────────────────────────────────────────────────

function isNetworkError(e: unknown): boolean {
  if (e instanceof StorageUploadError) return e.network
  const message = e instanceof Error
    ? e.message
    : String((e as { message?: unknown } | null)?.message ?? e)
  return /network|fetch|timed? ?out|abort|connexion|joindre le serveur|trop de temps|offline|internet/i.test(message)
}

function scheduleRetry() {
  if (retryTimer) return
  retryTimer = setTimeout(() => {
    retryTimer = null
    resumeWaiting()
  }, RETRY_MS)
}

/** Remet en file tout ce que le réseau avait laissé en plan. */
function resumeWaiting() {
  if (!job) return
  if (job.items.some(it => it.status === 'waiting')) {
    set({
      ...job,
      items: job.items.map(it => (it.status === 'waiting' ? { ...it, status: 'queued' as const } : it)),
    })
  }
  pump()
}

AppState.addEventListener('change', state => {
  // Au retour dans l'app, les requêtes coupées par la mise en veille
  // repartent tout de suite, sans attendre la prochaine relance.
  if (state === 'active') resumeWaiting()
})

// ── Démarrage ─────────────────────────────────────────────────────

function newItem(asset: BatchAsset, withZoom: boolean): BatchItem {
  const source = asset.source
    ?? (withZoom && !asset.prepared && asset.width && asset.height
      ? { uri: asset.uri, width: asset.width, height: asset.height }
      : null)
  return {
    key: `${Date.now()}-${keySeq++}`,
    thumbUri: asset.uri,
    source,
    preparedUri: asset.prepared ? asset.uri : null,
    draftId: null,
    uploaded: false,
    analysisAsked: false,
    status: 'queued',
    data: null,
    title: null,
    objectId: null,
    addFailed: false,
    attempts: 0,
  }
}

/**
 * Ouvre un lot. Synchrone : au retour, le lot est déjà visible par tous
 * les écrans abonnés — c'est ce qui donne le retour immédiat. Le réseau
 * ne commence qu'après.
 */
export function startBatch(options: {
  assets: BatchAsset[]
  userId: string
  withZoom: boolean
  batchMax: number
  collectionId?: string | null
}): void {
  epoch++
  active.clear()
  checking = false
  adding = false
  const collectionId = options.collectionId ?? null
  set({
    runId: String(Date.now()),
    userId: options.userId,
    withZoom: options.withZoom,
    batchMax: options.batchMax,
    batchId: null,
    // Lancé depuis une collection : la destination est connue, les objets
    // y arriveront seuls à la fin de l'analyse.
    destinationChosen: !!collectionId,
    collectionId,
    collectionName: null,
    phase: 'checking',
    offline: false,
    fatal: null,
    items: options.assets.map(a => newItem(a, options.withZoom)),
  })
  if (collectionId) void loadCollectionName(collectionId, epoch)
  pump()
}

async function loadCollectionName(collectionId: string, e: number) {
  const { data } = await supabase.from('collections').select('name').eq('id', collectionId).single()
  if (e === epoch && job && data?.name) patchJob({ collectionName: data.name })
}

/** Ajoute des photos à un lot déjà ouvert. */
export async function extendBatch(assets: BatchAsset[]): Promise<void> {
  if (!job || !job.batchId) return
  const e = epoch
  const added = assets.map(a => newItem(a, job!.withZoom))
  const keys = new Set(added.map(a => a.key))
  set({ ...job, phase: 'running', items: [...job.items, ...added] })

  const { data, error } = await supabase.rpc('extend_batch_capture', {
    p_batch_id: job.batchId,
    p_size: added.length,
  })
  if (e !== epoch || !job) return

  const rows = ((data ?? []) as { draft_id: string; batch_position: number }[])
    .slice()
    .sort((a, b) => a.batch_position - b.batch_position)
  if (error || rows.length !== added.length) {
    set({ ...job, items: job.items.filter(it => !keys.has(it.key)) })
    pump()
    throw new Error(error?.message ?? 'Extension incomplète')
  }
  let i = 0
  set({
    ...job,
    items: job.items.map(it => (keys.has(it.key) ? { ...it, draftId: rows[i++].draft_id } : it)),
  })
  pump()
}

// ── Moteur ────────────────────────────────────────────────────────

/** Fait avancer le lot : appelé à chaque fois que quelque chose peut bouger. */
function pump() {
  if (!job) return
  const e = epoch
  if (job.items.length === 0) { set(null); return }
  if (job.phase === 'checking') { void checkBatch(e); return }
  if (job.phase === 'failed' || job.phase === 'adding') return

  for (const it of job.items) {
    if (active.size >= CONCURRENCY) break
    if (active.has(it.key) || it.status !== 'queued' || !it.draftId) continue
    active.add(it.key)
    void processItem(it.key, e).finally(() => {
      active.delete(it.key)
      if (e === epoch) pump()
    })
  }
  if (active.size === 0) settle(e)
}

/** Étape 1 — vérification du lot : la place est réservée côté serveur. */
async function checkBatch(e: number) {
  if (checking || !job) return
  checking = true
  try {
    const { data, error } = await supabase.rpc('begin_batch_capture', { p_size: job.items.length })
    if (e !== epoch || !job) return

    if (error) {
      if (isNetworkError(error)) {
        patchJob({ offline: true })
        scheduleRetry()
      } else {
        patchJob({
          phase: 'failed',
          fatal: error.message.includes('OBJECT_QUOTA_EXCEEDED') ? 'OBJECT_QUOTA' : error.message,
        })
      }
      return
    }

    const rows = ((data ?? []) as { batch_id: string; draft_id: string; batch_position: number }[])
      .slice()
      .sort((a, b) => a.batch_position - b.batch_position)
    if (rows.length === 0) {
      patchJob({ phase: 'failed', fatal: 'Lot vide' })
      return
    }
    // Des photos ont pu être retirées pendant la vérification : les
    // brouillons en trop sont rendus.
    const items = job.items.map((it, i) => (rows[i] ? { ...it, draftId: rows[i].draft_id } : it))
    rows.slice(job.items.length).forEach(row => {
      void supabase.rpc('discard_draft', { p_draft_id: row.draft_id })
    })
    set({ ...job, batchId: rows[0].batch_id, phase: 'running', offline: false, items })
  } catch {
    if (e !== epoch || !job) return
    patchJob({ offline: true })
    scheduleRetry()
  } finally {
    checking = false
  }
  if (e === epoch && job && job.phase === 'running') pump()
}

/** La photo est-elle déjà enregistrée sur son brouillon ? */
async function draftHasImage(draftId: string): Promise<boolean> {
  const { count, error } = await supabase
    .from('ai_draft_images')
    .select('id', { count: 'exact', head: true })
    .eq('draft_id', draftId)
  if (error) throw new Error(error.message)
  return (count ?? 0) > 0
}

async function uploadItem(it: BatchItem, userId: string) {
  const draftId = it.draftId as string
  const storagePath = `${userId}/drafts/${draftId}/0.jpg`
  // Une reprise ne renvoie pas une photo déjà arrivée.
  if (it.attempts > 0 && await draftHasImage(draftId)) return

  try {
    await uploadFileToStorage('object-images', storagePath, it.preparedUri as string, 'image/jpeg')
  } catch (e) {
    // « Déjà là » : l'envoi précédent avait abouti, seule sa réponse s'était perdue.
    if (!(e instanceof StorageUploadError && e.alreadyThere)) throw e
    if (await draftHasImage(draftId)) return
  }

  const zoomPath = zoomPathFor(storagePath, it.source)
  const { error } = await supabase.from('ai_draft_images').insert({
    draft_id: draftId,
    user_id: userId,
    storage_path: storagePath,
    zoom_path: zoomPath,
    mime_type: 'image/jpeg',
    position: 0,
  })
  if (error) throw new Error(error.message)
  queueZoomCopy(it.source, zoomPath)
}

/**
 * L'analyse coûte du quota : avant de la redemander, on regarde si la
 * précédente n'a pas abouti pendant que l'app était en veille.
 */
async function analysisAlreadyDone(draftId: string): Promise<DraftProposedData | null> {
  const { data } = await supabase
    .from('ai_drafts')
    .select('status, proposed_data')
    .eq('id', draftId)
    .single()
  return data?.status === 'pending' ? ((data.proposed_data ?? {}) as DraftProposedData) : null
}

/** Compression, envoi puis analyse d'une photo. Ne lève jamais. */
async function processItem(key: string, e: number) {
  const stale = () => e !== epoch || !job || !itemOf(key)
  try {
    let it = itemOf(key)
    if (!it || !job) return
    const userId = job.userId

    if (!it.preparedUri) {
      patchItem(key, { status: 'preparing' })
      // 1200 px de large suffisent à l'analyse et divisent le poids par ~10.
      const result = await ImageManipulator.manipulateAsync(
        it.thumbUri,
        [{ resize: { width: 1200 } }],
        { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG },
      )
      if (stale()) return
      patchItem(key, { preparedUri: result.uri })
    }

    it = itemOf(key) as BatchItem
    if (!it.uploaded) {
      patchItem(key, { status: 'uploading' })
      await uploadItem(it, userId)
      if (stale()) return
      patchItem(key, { uploaded: true })
    }

    it = itemOf(key) as BatchItem
    patchItem(key, { status: 'analyzing' })
    let data = it.analysisAsked ? await analysisAlreadyDone(it.draftId as string) : null
    if (stale()) return
    if (!data) {
      patchItem(key, { analysisAsked: true })
      data = (await assistantService.analyzeDraft(it.draftId as string)).proposedData
      if (stale()) return
    }
    patchItem(key, { status: 'done', data, addFailed: false })
  } catch (err) {
    if (stale()) return
    const it = itemOf(key) as BatchItem
    if (isNetworkError(err)) {
      // Rien n'est perdu : la photo attend le retour du réseau.
      patchItem(key, { status: 'waiting', attempts: it.attempts + 1 })
      scheduleRetry()
    } else if (it.attempts < 1) {
      // Un raté isolé du serveur : une seconde chance avant de déranger.
      patchItem(key, { status: 'queued', attempts: it.attempts + 1 })
    } else {
      patchItem(key, { status: 'error', attempts: it.attempts + 1 })
    }
  }
}

/** Plus rien en vol : on décide de la suite. */
function settle(e: number) {
  if (!job || e !== epoch) return
  if (job.items.length === 0) { set(null); return }
  if (job.items.some(it => it.status === 'waiting' || it.status === 'queued')) return

  const toAdd = job.items.some(it => it.status === 'done' && !it.addFailed)
  if (toAdd && job.destinationChosen) { void addToCollection(e); return }
  if (toAdd) { if (job.phase !== 'ready') patchJob({ phase: 'ready' }); return }

  const next: BatchPhase = job.items.some(it => it.status === 'added') ? 'finished' : 'ready'
  if (job.phase !== next) patchJob({ phase: next })
}

/** Dernière étape — les objets analysés entrent dans la collection. */
async function addToCollection(e: number) {
  if (adding || !job || !job.batchId) return
  adding = true
  let confirmed = false
  try {
    patchJob({ phase: 'adding' })
    // Chaque brouillon est confirmé dans sa propre sous-transaction : un
    // refus (limite d'objets) n'annule pas ceux déjà créés. Seuls les
    // brouillons analysés sont pris : on peut donc rappeler sans doublon.
    const { data, error } = await supabase.rpc('confirm_batch', {
      p_batch_id: job.batchId,
      p_collection_id: job.collectionId,
    })
    if (e !== epoch || !job) return

    if (error) {
      if (isNetworkError(error)) {
        patchJob({ phase: 'running', offline: true })
        scheduleRetry()
      } else {
        patchJob({
          phase: 'ready',
          items: job.items.map(it => (it.status === 'done' ? { ...it, addFailed: true } : it)),
        })
      }
      return
    }

    const rows = (data ?? []) as { draft_id: string; object_id: string | null }[]
    const byDraft = new Map(rows.map(r => [r.draft_id, r]))
    const edits: { objectId: string; title: string }[] = []
    const items = job.items.map(it => {
      const row = it.draftId ? byDraft.get(it.draftId) : undefined
      if (it.status !== 'done' || !row) return it
      if (!row.object_id) return { ...it, addFailed: true }
      const title = it.title?.trim()
      if (title && title !== it.data?.title) edits.push({ objectId: row.object_id, title })
      return { ...it, status: 'added' as const, objectId: row.object_id, addFailed: false }
    })
    set({ ...job, offline: false, phase: 'running', items })
    confirmed = true

    // Les brouillons ne sont pas modifiables par le client : les titres
    // corrigés se reportent sur les objets, une fois créés.
    await Promise.all(edits.map(({ objectId, title }) =>
      supabase.from('objects').update({ title }).eq('id', objectId),
    ))
  } finally {
    adding = false
  }
  if (confirmed && e === epoch && job) {
    // Un brouillon analysé que le serveur n'a pas rendu : marqué comme
    // refusé, pour que la boucle s'arrête au lieu de le redemander sans fin.
    const pending = job.items.some(it => it.status === 'done' && !it.addFailed)
    if (pending) patchJob({ phase: 'ready', items: job.items.map(it => (it.status === 'done' ? { ...it, addFailed: true } : it)) })
    else settle(e)
  }
}

// ── Gestes de l'utilisateur ───────────────────────────────────────

/** Choisit où ranger. Si tout est déjà analysé, l'ajout part aussitôt. */
export function setBatchDestination(collection: { id: string; name: string } | null) {
  if (!job) return
  patchJob({
    destinationChosen: true,
    collectionId: collection?.id ?? null,
    collectionName: collection?.name ?? null,
  })
  pump()
}

export function setBatchTitle(key: string, title: string) {
  patchItem(key, { title })
}

/** Titre corrigé après l'ajout : il part directement sur l'objet. */
export function commitBatchTitle(key: string) {
  const it = itemOf(key)
  const title = it?.title?.trim()
  if (!it?.objectId || !title) return
  void supabase.from('objects').update({ title }).eq('id', it.objectId)
}

/** Réessaie une photo en échec, ou l'ajout d'un objet refusé. */
export function retryBatchItem(key: string) {
  const it = itemOf(key)
  if (!job || !it) return
  if (it.status === 'done' && it.addFailed) {
    patchItem(key, { addFailed: false })
  } else {
    patchItem(key, { status: 'queued' })
  }
  if (job && (job.phase === 'ready' || job.phase === 'finished')) patchJob({ phase: 'running' })
  pump()
}

/** Retire une photo du lot (avant l'ajout). */
export function removeBatchItem(key: string) {
  const it = itemOf(key)
  if (!job || !it || it.status === 'added') return
  set({ ...job, items: job.items.filter(i => i.key !== key) })
  if (it.draftId) void supabase.rpc('discard_draft', { p_draft_id: it.draftId })
  pump()
}

/** Abandonne ce qui n'est pas encore ajouté. Les objets déjà créés restent. */
export function abandonBatch() {
  if (!job) return
  epoch++
  active.clear()
  job.items.forEach(it => {
    if (it.draftId && it.status !== 'added') void supabase.rpc('discard_draft', { p_draft_id: it.draftId })
  })
  set(null)
}

/** Referme un lot terminé (la confirmation a été vue). */
export function dismissBatch() {
  if (!job || isBatchActive()) return
  epoch++
  set(null)
}

// ── Reprise ───────────────────────────────────────────────────────

let restoredFor: string | null = null

/**
 * Au lancement de l'app : s'il restait un import en cours pour ce
 * compte, il reprend. L'état du serveur fait foi — une analyse arrivée
 * pendant que l'app était fermée n'est pas refaite.
 */
export async function restoreBatch(userId: string): Promise<void> {
  if (restoredFor === userId || job) return
  restoredFor = userId
  let saved: BatchJob | null = null
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY)
    saved = raw ? (JSON.parse(raw) as BatchJob) : null
  } catch {
    saved = null
  }
  if (!saved || job) return
  if (saved.userId !== userId || saved.phase === 'finished' || saved.phase === 'failed') {
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {})
    return
  }

  const e = ++epoch
  const drafts = new Map<string, { status: string; proposed_data: DraftProposedData | null }>()
  if (saved.batchId) {
    const { data } = await supabase
      .from('ai_drafts')
      .select('id, status, proposed_data')
      .eq('batch_id', saved.batchId)
    ;(data ?? []).forEach(d => drafts.set(d.id, d))
  }

  const items: BatchItem[] = []
  /** Photos ajoutées au lot juste avant la fermeture : leur brouillon n'existe pas encore. */
  const orphans: BatchAsset[] = []
  for (const it of saved.items) {
    if (saved.batchId && !it.draftId) {
      orphans.push({
        uri: it.preparedUri ?? it.thumbUri,
        prepared: !!it.preparedUri,
        ...(it.source ? { source: it.source } : {}),
      })
      continue
    }
    if (it.status === 'added') { items.push(it); continue }
    const draft = it.draftId ? drafts.get(it.draftId) : undefined
    if (draft?.status === 'confirmed') { items.push({ ...it, status: 'added' }); continue }
    if (draft?.status === 'rejected') continue
    if (draft?.status === 'pending') {
      items.push({ ...it, uploaded: true, status: 'done', data: draft.proposed_data ?? {} })
      continue
    }
    if (draft?.status === 'expired') { items.push({ ...it, status: 'error', attempts: 2 }); continue }
    // Photo pas encore envoyée : le fichier doit toujours être sur l'appareil.
    let fileOk = it.uploaded
    if (!fileOk) {
      try {
        fileOk = (await FileSystem.getInfoAsync(it.preparedUri ?? it.thumbUri)).exists
      } catch {
        fileOk = false
      }
    }
    items.push(fileOk
      ? { ...it, status: it.status === 'error' ? 'error' : 'queued', attempts: Math.max(it.attempts, 1) }
      : { ...it, status: 'error', attempts: 2 })
  }
  if (e !== epoch || job) return

  set({
    ...saved,
    offline: false,
    phase: saved.batchId ? 'running' : 'checking',
    items,
  })
  pump()
  if (orphans.length) void extendBatch(orphans).catch(() => {})
}

/** Déconnexion : le moteur s'arrête, le lot reste gardé pour le retour du compte. */
export function suspendBatch() {
  if (!job) return
  if (persistTimer) { clearTimeout(persistTimer); persist() }
  epoch++
  active.clear()
  restoredFor = null
  job = null
  listeners.forEach(l => l())
}
