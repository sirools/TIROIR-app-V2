import React, { useState } from 'react'
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image } from 'react-native'
import { Redirect, useRouter } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { ArrowLeft } from 'lucide-react-native'
import {
  Screen, Colors, Typography, Spacing, Radius,
  PhotoUploadTile, ProgressRing, UploadStatusBar,
} from '@/components/ui'
import { uploadStore, useUploadQueue, type UploadStatus } from '@/features/uploads'
import { UploadCancelled, UploadError, type StorageUpload, type UploadHandle } from '@/features/uploads/transport'

/**
 * Page de démonstration (développement seulement) : chaque état de
 * <PhotoUploadTile>, et une file simulée — réseau lent, coupure en cours
 * d'envoi, échec serveur, 5 photos, grosse photo — sans rien envoyer au
 * serveur. Ouvrir : tiroir://dev/uploads (ou router.push('/dev/uploads')).
 */

const SAMPLE = Image.resolveAssetSource(require('../../../assets/icon.png')).uri
const STATES: { status: UploadStatus; progress: number; label: string }[] = [
  { status: 'preparing', progress: 0, label: 'Préparation' },
  { status: 'queued', progress: 0, label: 'En file' },
  { status: 'uploading', progress: 0.4, label: 'Envoi 40 %' },
  { status: 'analyzing', progress: 1, label: 'Analyse Torix' },
  { status: 'done', progress: 1, label: 'Réussite' },
  { status: 'error', progress: 0.6, label: 'Échec' },
  { status: 'offline', progress: 0.3, label: 'Hors connexion' },
]

type Scenario = 'slow' | 'cut' | 'server' | 'big' | 'fast'

/** Transport simulé : progression par paquets, comme un vrai réseau. */
function fakeSend(scenario: Scenario, index: number) {
  let failedOnce = false
  return (job: StorageUpload): UploadHandle => {
    let timer: ReturnType<typeof setInterval> | undefined
    let reject: (e: Error) => void = () => {}
    const durationMs = scenario === 'big' ? 14000 : scenario === 'slow' ? 6000 + index * 900 : 1800
    const promise = new Promise<void>((resolve, rej) => {
      reject = rej
      const start = Date.now()
      timer = setInterval(() => {
        const p = Math.min(1, (Date.now() - start) / durationMs)
        job.onProgress?.(p)
        if (scenario === 'cut' && index === 1 && p > 0.45 && !failedOnce) {
          failedOnce = true
          clearInterval(timer)
          uploadStore.simulateNetwork(false)
          rej(new UploadError('network', 'NETWORK'))
          setTimeout(() => uploadStore.simulateNetwork(true), 4000)
          return
        }
        if (scenario === 'server' && index === 2 && p > 0.7) {
          clearInterval(timer)
          rej(new UploadError('server', 'HTTP 503', 503))
          return
        }
        if (p >= 1) { clearInterval(timer); resolve() }
      }, 120)
    })
    return {
      promise,
      cancel: () => { if (timer) clearInterval(timer); reject(new UploadCancelled()) },
    }
  }
}

export default function UploadsDemo() {
  const router = useRouter()
  const queue = useUploadQueue('dev:demo')
  const [replay, setReplay] = useState(0)
  const [photos, setPhotos] = useState<string[]>([])
  const [ring, setRing] = useState(0.35)

  if (!__DEV__) return <Redirect href="/" />

  const uri = (i: number) => photos[i % Math.max(1, photos.length)] ?? SAMPLE

  async function pick() {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, selectionLimit: 5 })
    if (!res.canceled) setPhotos(res.assets.map(a => a.uri))
  }

  function run(scenario: Scenario, count: number) {
    for (const j of queue.jobs) queue.cancel(j.id)
    queue.add(Array.from({ length: count }, (_, i) => ({
      uri: uri(i),
      keepWhenDone: true,
      prepare: async (u: string) => { await new Promise(r => setTimeout(r, 600)); return u },
      path: () => `demo/${i}.jpg`,
      send: fakeSend(scenario, i),
    })))
  }

  function analyze() {
    queue.setAnalyzing(true)
    setTimeout(() => queue.setAnalyzing(false), 4000)
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Retour">
          <ArrowLeft size={20} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.h1}>Envoi des photos</Text>

        <Text style={styles.h2}>États de la vignette</Text>
        <View style={styles.grid} key={replay}>
          {STATES.map(s => (
            <View key={s.status} style={styles.cell}>
              <PhotoUploadTile
                source={uri(0)}
                status={s.status}
                progress={s.progress}
                size={96}
                onRetry={() => {}}
                onCancel={() => {}}
              />
              <Text style={styles.caption}>{s.label}</Text>
            </View>
          ))}
        </View>
        <View style={styles.grid} key={`s${replay}`}>
          {STATES.map(s => (
            <PhotoUploadTile key={s.status} source={uri(1)} status={s.status} progress={s.progress} size={56} onRetry={() => {}} onCancel={() => {}} />
          ))}
        </View>
        <View style={styles.row}>
          <Btn label="Rejouer les entrées" onPress={() => setReplay(r => r + 1)} />
          <Btn label="Choisir des photos" onPress={pick} />
        </View>

        <Text style={styles.h2}>File simulée (aucun envoi réel)</Text>
        <View style={styles.row}>
          <Btn label="5 photos, réseau lent" onPress={() => run('slow', 5)} />
          <Btn label="Coupure en cours d'envoi" onPress={() => run('cut', 3)} />
          <Btn label="Échec serveur" onPress={() => run('server', 3)} />
          <Btn label="Grosse photo" onPress={() => run('big', 1)} />
          <Btn label="Analyse Torix" onPress={analyze} />
        </View>
        <UploadStatusBar summary={queue.summary} onRetryAll={queue.retryAll} />
        <View style={styles.grid}>
          {queue.jobs.map(j => (
            <PhotoUploadTile
              key={j.id}
              source={j.uri}
              status={j.status}
              progress={j.progress}
              size={72}
              onRetry={() => queue.retry(j.id)}
              onCancel={() => queue.cancel(j.id)}
            />
          ))}
        </View>

        <Text style={styles.h2}>{'<ProgressRing>'} générique (crédits, quotas)</Text>
        <View style={styles.row}>
          <ProgressRing progress={ring} size={64} strokeWidth={6}>
            <Text style={styles.ringText}>{Math.round(ring * 100)}</Text>
          </ProgressRing>
          <ProgressRing indeterminate size={32} />
          <Btn label="+ 15 %" onPress={() => setRing(r => (r >= 1 ? 0 : Math.min(1, r + 0.15)))} />
        </View>
      </ScrollView>
    </Screen>
  )
}

function Btn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.btn} onPress={onPress} accessibilityRole="button">
      <Text style={styles.btnText}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  content: { padding: Spacing.lg, gap: Spacing.md },
  back: { width: 44, height: 44, justifyContent: 'center' },
  h1: { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary },
  h2: { fontSize: Typography.md, fontWeight: Typography.semibold, color: Colors.textPrimary, marginTop: Spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, paddingTop: Spacing.xs },
  cell: { alignItems: 'center', gap: Spacing.xs },
  caption: { fontSize: Typography.xs, color: Colors.textSecondary },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, alignItems: 'center' },
  btn: {
    minHeight: 44, justifyContent: 'center',
    paddingHorizontal: Spacing.md, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  btnText: { fontSize: Typography.sm, color: Colors.textPrimary, fontWeight: Typography.medium },
  ringText: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary },
})
