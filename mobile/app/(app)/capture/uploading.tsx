import React, { useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet, Animated, Platform, Image, TouchableOpacity } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import * as FileSystem from 'expo-file-system/legacy'
import { supabase } from '@/lib/supabase'
import { assistantService } from '@/services/assistant'
import { draftCache } from '@/services/draftCache'
import { Screen, Button, Colors, Typography, Spacing, Radius } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthContext'

type Phase = 'uploading' | 'analyzing' | 'error'

interface PickedImage { uri: string; mimeType: string; fileName: string }

// Étapes de la checklist
const STEPS = [
  { key: 'upload',   label: 'Photos reçues',          sub: (p: number) => `${p} %` },
  { key: 'identify', label: 'Objet identifié',         sub: () => 'Analyse visuelle' },
  { key: 'attrs',    label: 'Lecture des attributs',   sub: () => 'Marque, modèle, couleur' },
  { key: 'sheet',    label: 'Génération de la fiche',  sub: () => 'Titre, description, emplacement' },
]
type StepKey = 'upload' | 'identify' | 'attrs' | 'sheet'
type StepStatus = 'pending' | 'active' | 'done'

export default function UploadingScreen() {
  const { draftId, images: imagesParam } = useLocalSearchParams<{ draftId: string; images: string }>()
  const { user } = useAuth()
  const router = useRouter()

  const [phase, setPhase] = useState<Phase>('uploading')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [stepStatuses, setStepStatuses] = useState<Record<StepKey, StepStatus>>({
    upload: 'active', identify: 'pending', attrs: 'pending', sheet: 'pending',
  })
  const [confidence, setConfidence] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [images, setImages] = useState<PickedImage[]>([])
  const [uploadedCount, setUploadedCount] = useState(0)
  const [showManualNav, setShowManualNav] = useState(false)
  const processedDraftId = useRef<string | null>(null)
  const pendingDraftId = useRef<string | null>(null)

  // Animations d'entrée pour chaque item de checklist
  const itemAnims = useRef(STEPS.map(() => new Animated.Value(0))).current
  const confidenceAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    // Stagger d'entrée des items
    Animated.stagger(
      180,
      itemAnims.map(anim =>
        Animated.timing(anim, { toValue: 1, duration: 300, useNativeDriver: true })
      )
    ).start()
  }, [])

  useEffect(() => {
    if (!draftId || !imagesParam || !user) return
    if (processedDraftId.current === draftId) return
    processedDraftId.current = draftId

    // Réinitialiser tout l'état pour ce nouveau draft
    setPhase('uploading')
    setUploadProgress(0)
    setStepStatuses({ upload: 'active', identify: 'pending', attrs: 'pending', sheet: 'pending' })
    setConfidence(0)
    setError(null)
    setImages([])
    setUploadedCount(0)
    setShowManualNav(false)
    pendingDraftId.current = null

    const parsed: PickedImage[] = JSON.parse(imagesParam)
    if (parsed.length === 0) {
      runAnalysisOnly()
    } else {
      setImages(parsed)
      run(parsed)
    }
  }, [draftId, imagesParam, user])

  function setStep(key: StepKey, status: StepStatus) {
    setStepStatuses(prev => ({ ...prev, [key]: status }))
  }

  function animateConfidence(to: number) {
    Animated.timing(confidenceAnim, {
      toValue: to / 100,
      duration: 800,
      useNativeDriver: false,
    }).start()
    setConfidence(to)
  }

  async function run(imgs: PickedImage[]) {
    try {
      // Phase upload
      for (let i = 0; i < imgs.length; i++) {
        await uploadImage(imgs[i], i)
        const pct = Math.round(((i + 1) / imgs.length) * 100)
        setUploadProgress(pct)
        setUploadedCount(i + 1)
      }
      setStep('upload', 'done')
      setStep('identify', 'active')
      setPhase('analyzing')

      // Simuler la progression pendant l'appel IA (durée ~3-6s)
      setTimeout(() => {
        setStep('identify', 'done')
        setStep('attrs', 'active')
        animateConfidence(30)
      }, 1200)
      setTimeout(() => {
        setStep('attrs', 'done')
        setStep('sheet', 'active')
        animateConfidence(72)
      }, 2800)

      await assistantService.analyzeDraft(draftId!)

      setStep('sheet', 'done')
      animateConfidence(87)
      await new Promise(r => setTimeout(r, 500))

      const { data: objectId, error: confirmError } = await supabase.rpc('confirm_draft', {
        p_draft_id: draftId,
        p_collection_id: null,
      })
      if (confirmError) throw new Error(confirmError.message)

      pendingDraftId.current = objectId
      try {
        router.replace({ pathname: '/objects/[id]', params: { id: objectId } })
      } catch {
        setShowManualNav(true)
      }
      setTimeout(() => setShowManualNav(true), 1500)
    } catch (err) {
      console.error('[Upload]', err)
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.')
      setPhase('error')
    }
  }

  async function runAnalysisOnly() {
    try {
      setStep('upload', 'done')
      setStep('identify', 'active')
      setPhase('analyzing')

      setTimeout(() => { setStep('identify', 'done'); setStep('attrs', 'active'); animateConfidence(30) }, 1200)
      setTimeout(() => { setStep('attrs', 'done'); setStep('sheet', 'active'); animateConfidence(72) }, 2800)

      await assistantService.analyzeDraft(draftId!)

      setStep('sheet', 'done')
      animateConfidence(87)
      await new Promise(r => setTimeout(r, 500))

      const { data: objectId, error: confirmError } = await supabase.rpc('confirm_draft', {
        p_draft_id: draftId,
        p_collection_id: null,
      })
      if (confirmError) throw new Error(confirmError.message)

      pendingDraftId.current = objectId
      try {
        router.replace({ pathname: '/objects/[id]', params: { id: objectId } })
      } catch {
        setShowManualNav(true)
      }
      setTimeout(() => setShowManualNav(true), 1500)
    } catch (err) {
      console.error('[Reanalyze]', err)
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.')
      setPhase('error')
    }
  }

  async function uploadImage(img: PickedImage, position: number) {
    const imageId = `${Date.now()}_${position}`
    const ext = img.mimeType === 'image/jpeg' ? 'jpg' : 'png'
    const storagePath = `${user!.id}/drafts/${draftId}/${imageId}.${ext}`

    let uploadData: Blob | Uint8Array
    if (Platform.OS === 'web') {
      const response = await fetch(img.uri)
      uploadData = await response.blob()
    } else {
      const base64 = await FileSystem.readAsStringAsync(img.uri, { encoding: FileSystem.EncodingType.Base64 })
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j)
      uploadData = bytes
    }

    const { error: storageError } = await supabase.storage
      .from('object-images')
      .upload(storagePath, uploadData, { contentType: img.mimeType, upsert: false })
    if (storageError) throw new Error(`Upload image ${position + 1} : ${storageError.message}`)

    const { error: dbError } = await supabase.from('ai_draft_images').insert({
      draft_id: draftId, user_id: user!.id, storage_path: storagePath, mime_type: img.mimeType, position,
    })
    if (dbError) throw new Error(`Enregistrement image ${position + 1} : ${dbError.message}`)
  }

  async function handleRetry() {
    setPhase('uploading')
    setUploadProgress(0)
    setUploadedCount(0)
    setError(null)
    setStepStatuses({ upload: 'active', identify: 'pending', attrs: 'pending', sheet: 'pending' })
    processedDraftId.current = null
    await supabase.rpc('reject_draft', { p_draft_id: draftId })
    router.back()
  }

  if (phase === 'error') {
    return (
      <Screen>
        <View style={styles.errorContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Quelque chose s'est mal passé</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Button label="Réessayer" onPress={handleRetry} style={styles.retryBtn} />
        </View>
      </Screen>
    )
  }

  const confidenceWidth = confidenceAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] })

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.container}>
        {/* Indicateur d'étapes */}
        <View style={styles.steps}>
          <View style={styles.stepDot} />
          <View style={styles.stepLine} />
          <View style={[styles.stepDot, styles.stepActive]} />
          <View style={styles.stepLine} />
          <View style={styles.stepDot} />
        </View>

        {/* Miniatures des photos uploadées */}
        {images.length > 0 && (
          <View style={styles.photoRow}>
            {images.map((img, i) => (
              <View key={i} style={styles.photoThumb}>
                <Image source={{ uri: img.uri }} style={styles.photoImg} resizeMode="cover" />
                {i < uploadedCount && (
                  <View style={styles.photoCheck}>
                    <Text style={styles.photoCheckText}>✓</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Titre */}
        <View style={styles.titleBlock}>
          <Text style={styles.title}>
            {phase === 'uploading' ? 'Envoi des photos…' : 'Analyse en cours…'}
          </Text>
          <Text style={styles.subtitle}>
            {phase === 'uploading'
              ? `${uploadProgress} % — ${uploadedCount} / ${images.length} photo${images.length > 1 ? 's' : ''}`
              : 'Je prépare ta fiche objet'}
          </Text>
        </View>

        {/* Barre de progression upload */}
        {phase === 'uploading' && (
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
          </View>
        )}

        {/* Checklist IA */}
        <View style={styles.checklist}>
          {STEPS.map((step, i) => {
            const status = stepStatuses[step.key as StepKey]
            return (
              <Animated.View
                key={step.key}
                style={[
                  styles.checkItem,
                  {
                    opacity: itemAnims[i],
                    transform: [{ translateY: itemAnims[i].interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
                  },
                ]}
              >
                <View style={[
                  styles.checkDot,
                  status === 'done' && styles.checkDotDone,
                  status === 'active' && styles.checkDotActive,
                ]}>
                  {status === 'done' && <Text style={styles.checkMark}>✓</Text>}
                  {status === 'active' && <View style={styles.checkPulse} />}
                </View>
                <View style={styles.checkText}>
                  <Text style={[styles.checkLabel, status === 'pending' && styles.checkLabelMuted]}>
                    {step.label}
                  </Text>
                  <Text style={styles.checkSub}>
                    {step.key === 'upload' ? step.sub(uploadProgress) : step.sub(0)}
                  </Text>
                </View>
              </Animated.View>
            )
          })}
        </View>

        {/* Barre de confiance IA */}
        {phase === 'analyzing' && (
          <View style={styles.confidenceCard}>
            <View style={styles.confidenceHeader}>
              <Text style={styles.confidenceLabel}>Confiance de l'analyse</Text>
              <Text style={styles.confidenceValue}>{confidence} %</Text>
            </View>
            <View style={styles.confidenceTrack}>
              <Animated.View style={[styles.confidenceFill, { width: confidenceWidth }]} />
            </View>
          </View>
        )}

        {/* Bouton de secours si la navigation automatique ne s'est pas déclenchée */}
        {showManualNav && pendingDraftId.current && (
          <TouchableOpacity
            style={styles.manualNavBtn}
            onPress={() => router.replace({ pathname: '/objects/[id]', params: { id: pendingDraftId.current! } })}
            activeOpacity={0.85}
          >
            <Text style={styles.manualNavText}>Voir la fiche →</Text>
          </TouchableOpacity>
        )}
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  steps: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: Spacing.xs,
  },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  stepActive: { width: 24, borderRadius: 4, backgroundColor: Colors.accent },
  stepLine: { flex: 1, height: 1, backgroundColor: Colors.border, marginHorizontal: Spacing.xs },

  photoRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  photoThumb: {
    flex: 1,
    height: 72,
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceWarm,
    position: 'relative',
  },
  photoImg: { width: '100%', height: '100%' },
  photoCheck: {
    position: 'absolute', top: 6, right: 6,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  photoCheckText: { color: Colors.textInverse, fontSize: 10, fontWeight: Typography.bold },

  titleBlock: { gap: 4 },
  title: {
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  subtitle: { fontSize: Typography.base, color: Colors.textSecondary },

  progressTrack: {
    height: 4,
    backgroundColor: Colors.borderLight,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: Colors.accent, borderRadius: 2 },

  checklist: { gap: Spacing.sm },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  checkDot: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  checkDotDone: { backgroundColor: Colors.accentLight, borderColor: Colors.accent },
  checkDotActive: { borderColor: Colors.accent, borderWidth: 2 },
  checkMark: { fontSize: 12, color: Colors.accent, fontWeight: Typography.bold },
  checkPulse: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Colors.accent,
  },
  checkText: { flex: 1, gap: 2 },
  checkLabel: { fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.textPrimary },
  checkLabelMuted: { color: Colors.textTertiary },
  checkSub: { fontSize: Typography.sm, color: Colors.textTertiary },

  confidenceCard: {
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  confidenceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  confidenceLabel: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.accent },
  confidenceValue: { fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.accent },
  confidenceTrack: {
    height: 6, backgroundColor: Colors.surface,
    borderRadius: 3, overflow: 'hidden',
  },
  confidenceFill: { height: '100%', backgroundColor: Colors.accent, borderRadius: 3 },

  errorContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: Spacing.xl, gap: Spacing.lg,
  },
  errorIcon: { fontSize: 48 },
  errorTitle: { fontSize: Typography.lg, fontWeight: Typography.semibold, color: Colors.textPrimary, textAlign: 'center' },
  errorText: { fontSize: Typography.sm, color: Colors.error, textAlign: 'center', lineHeight: 20 },
  retryBtn: { marginTop: Spacing.md, width: '100%' },
  manualNavBtn: {
    marginTop: Spacing.lg,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.lg,
    backgroundColor: Colors.accent,
  },
  manualNavText: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.textInverse,
  },
})
