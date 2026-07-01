import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  ScrollView, Alert, Animated, ActivityIndicator, Platform,
} from 'react-native'
import { Camera, Images } from 'lucide-react-native'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import * as FileSystem from 'expo-file-system/legacy'
import { useRouter } from 'expo-router'
import { useFocusEffect } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'
import { Screen, Colors, Typography, Spacing, Radius } from '@/components/ui'

interface PickedImage {
  uri: string
  mimeType: string
  fileName: string
}

export default function CaptureScreen() {
  const router = useRouter()
  const { user } = useAuth()
  const [images, setImages] = useState<PickedImage[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingManual, setLoadingManual] = useState(false)
  const [quotaUsed, setQuotaUsed] = useState(0)
  const [quotaLimit, setQuotaLimit] = useState<number | null>(null)
  const [quotaExhausted, setQuotaExhausted] = useState(false)

  useFocusEffect(useCallback(() => {
    setImages([])
    setLoading(false)
    setLoadingManual(false)
  }, []))

  useEffect(() => {
    supabase.rpc('get_ai_quota').then(({ data }) => {
      if (data && data[0]) {
        const { used, quota } = data[0]
        setQuotaUsed(used)
        setQuotaLimit(quota)
        setQuotaExhausted(quota !== null && used >= quota)
      }
    })
  }, [])

  async function pickFromLibrary() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission refusée', "Autorise l'accès à ta photothèque dans les réglages.")
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.9,
      selectionLimit: 5,
    })
    if (!result.canceled) {
      const picked = await compressAll(result.assets)
      setImages(prev => [...prev, ...picked].slice(0, 5))
    }
  }

  async function pickFromCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission refusée', "Autorise l'accès à l'appareil photo dans les réglages.")
      return
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 })
    if (!result.canceled && result.assets[0]) {
      const compressed = await compress(result.assets[0])
      setImages(prev => [...prev, compressed].slice(0, 5))
    }
  }

  async function compressAll(assets: ImagePicker.ImagePickerAsset[]): Promise<PickedImage[]> {
    return Promise.all(assets.map(compress))
  }

  async function compress(asset: ImagePicker.ImagePickerAsset): Promise<PickedImage> {
    const result = await ImageManipulator.manipulateAsync(
      asset.uri,
      [{ resize: { width: 1200 } }],
      { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG }
    )
    return { uri: result.uri, mimeType: 'image/jpeg', fileName: `photo_${Date.now()}.jpg` }
  }

  function removeImage(index: number) {
    setImages(prev => prev.filter((_, i) => i !== index))
  }

  async function handleNext() {
    if (images.length === 0) {
      Alert.alert('Ajoute au moins une photo', "Une photo est nécessaire pour analyser l'objet.")
      return
    }
    setLoading(true)
    const { data: draftId, error: draftError } = await supabase.rpc('begin_draft_capture')
    setLoading(false)
    if (draftError || !draftId) {
      Alert.alert('Erreur', draftError?.message ?? 'Impossible de démarrer la capture.')
      return
    }
    router.push({ pathname: '/capture/uploading', params: { draftId, images: JSON.stringify(images) } })
  }

  async function handleManual() {
    if (images.length === 0) return
    setLoadingManual(true)
    try {
      const { data: objectId, error: createError } = await supabase.rpc('create_empty_object')
      if (createError || !objectId) throw new Error(createError?.message ?? 'Création impossible')

      for (let i = 0; i < images.length; i++) {
        const img = images[i]
        const ext = img.mimeType === 'image/jpeg' ? 'jpg' : 'png'
        const storagePath = `${user!.id}/${objectId}/${Date.now()}_${i}.${ext}`

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
        if (storageError) throw new Error(storageError.message)

        await supabase.from('object_images').insert({
          object_id: objectId,
          user_id: user!.id,
          storage_path: storagePath,
          mime_type: img.mimeType,
          position: i,
          is_cover: i === 0,
        })
      }

      router.replace(`/objects/edit/${objectId}`)
    } catch (e: any) {
      Alert.alert('Erreur', e.message ?? 'Une erreur est survenue')
    } finally {
      setLoadingManual(false)
    }
  }

  const hasImages = images.length > 0
  const canAddMore = images.length < 5

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Indicateur d'étapes */}
        <View style={styles.steps}>
          <View style={[styles.stepDot, styles.stepActive]} />
          <View style={styles.stepLine} />
          <View style={styles.stepDot} />
          <View style={styles.stepLine} />
          <View style={styles.stepDot} />
        </View>

        {/* Titre */}
        <View style={styles.header}>
          <Text style={styles.title}>Prends une photo</Text>
          <Text style={styles.subtitle}>L'IA analyse jusqu'à 5 photos pour créer la fiche</Text>
          <Text style={[styles.quotaCounter, quotaExhausted && styles.quotaCounterExhausted]}>
            {quotaLimit === null
              ? 'Analyses IA illimitées'
              : quotaExhausted
                ? `Quota IA épuisé · ${quotaUsed}/${quotaLimit} ce mois`
                : `${quotaLimit - quotaUsed} analyse${quotaLimit - quotaUsed > 1 ? 's' : ''} IA restante${quotaLimit - quotaUsed > 1 ? 's' : ''} ce mois`
            }
          </Text>
        </View>

        {/* Zone hero — visible uniquement sans photos */}
        {!hasImages && (
          <TouchableOpacity style={styles.heroZone} onPress={pickFromCamera} activeOpacity={0.8}>
            <View style={styles.heroIconBg}>
              <CameraDrawing />
            </View>
            <Text style={styles.heroLabel}>Appuie pour photographier</Text>
            <Text style={styles.heroSub}>ou glisse depuis ta photothèque</Text>
          </TouchableOpacity>
        )}

        {/* Grille de thumbnails */}
        {hasImages && (
          <View style={styles.thumbGrid}>
            {images.map((img, i) => (
              <View key={i} style={styles.thumb}>
                <Image source={{ uri: img.uri }} style={styles.thumbImg} resizeMode="cover" />
                <TouchableOpacity onPress={() => removeImage(i)} style={styles.thumbRemove} hitSlop={8}>
                  <Text style={styles.thumbRemoveText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
            {canAddMore && (
              <TouchableOpacity style={styles.thumbAdd} onPress={pickFromLibrary} activeOpacity={0.7}>
                <Text style={styles.thumbAddIcon}>+</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Tip contextuel — visible seulement si pas encore de photos */}
        {!hasImages && (
          <View style={styles.tip}>
            <Text style={styles.tipIcon}>💡</Text>
            <Text style={styles.tipText}>
              Plus de photos = fiche plus précise. Essaie face, dos et étiquette.
            </Text>
          </View>
        )}

        {/* Actions secondaires */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.btnAction} onPress={pickFromCamera} activeOpacity={0.8}>
            <Camera size={28} color={Colors.textPrimary} strokeWidth={1.5} />
            <Text style={styles.btnActionLabel}>Prendre une{'\n'}photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnAction} onPress={pickFromLibrary} activeOpacity={0.8}>
            <Images size={28} color={Colors.textPrimary} strokeWidth={1.5} />
            <Text style={styles.btnActionLabel}>Photothèque</Text>
          </TouchableOpacity>
        </View>

        {/* Séparateur */}
        {hasImages && <View style={styles.sep} />}

        {/* CTA principal */}
        <TouchableOpacity
          style={[styles.btnPrimary, (!hasImages || loading || quotaExhausted) && styles.btnPrimaryDisabled]}
          onPress={handleNext}
          activeOpacity={0.85}
          disabled={!hasImages || loading || quotaExhausted}
        >
          <Text style={styles.btnPrimaryText}>
            {loading ? 'Préparation…' : hasImages ? `Analyser ${images.length} photo${images.length > 1 ? 's' : ''} →` : 'Ajoute une photo pour continuer'}
          </Text>
        </TouchableOpacity>

        {/* Lien recharge — visible quand quota épuisé et photos sélectionnées */}
        {hasImages && quotaExhausted && (
          <View style={styles.quotaBanner}>
            <Text style={styles.quotaText}>
              <Text style={styles.quotaLink}>{/* TODO: onPress → écran recharge */}Recharger mon quota →</Text>
            </Text>
          </View>
        )}

        {/* CTA secondaire — créer sans IA */}
        {hasImages && (
          <TouchableOpacity
            style={[
              styles.btnManual,
              quotaExhausted && styles.btnManualProminent,
              loadingManual && styles.btnPrimaryDisabled,
            ]}
            onPress={handleManual}
            activeOpacity={0.7}
            disabled={loadingManual || loading}
          >
            {loadingManual
              ? <ActivityIndicator size="small" color={Colors.textSecondary} />
              : <Text style={[styles.btnManualText, quotaExhausted && styles.btnManualTextProminent]}>
                  Créer une fiche vide sans IA
                </Text>
            }
          </TouchableOpacity>
        )}
      </ScrollView>
    </Screen>
  )
}

// ── Icône caméra dessinée en View ─────────────────────────────────────────────

function CameraDrawing({ size = 24, color = Colors.accent }: { size?: number; color?: string }) {
  const s = size / 24
  return (
    <View style={{ width: size + 4, height: size, position: 'relative' }}>
      <View style={{ position: 'absolute', top: 0, left: (size + 4) / 2 - 5 * s, width: 10 * s, height: 6 * s, borderRadius: 3 * s, backgroundColor: color }} />
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 16 * s, borderRadius: 5 * s, backgroundColor: color }} />
      <View style={{ position: 'absolute', bottom: 3 * s, left: (size + 4) / 2 - 5 * s, width: 10 * s, height: 10 * s, borderRadius: 5 * s, borderWidth: 1.5 * s, borderColor: Colors.background }} />
    </View>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  steps: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: Spacing.xs,
    gap: 0,
  },
  stepDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Colors.border,
  },
  stepActive: {
    width: 24, borderRadius: 4,
    backgroundColor: Colors.accent,
  },
  stepLine: {
    flex: 1, height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.xs,
  },
  header: { gap: Spacing.xs },
  title: {
    fontSize: Typography.xxl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: Typography.base, color: Colors.textSecondary },

  heroZone: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    paddingVertical: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  heroZoneSmall: {
    paddingVertical: Spacing.md,
    borderRadius: Radius.lg,
    borderStyle: 'dashed',
  },
  heroIconBg: {
    width: 64, height: 64,
    borderRadius: Radius.lg,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroLabel: {
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
    marginTop: Spacing.xs,
  },
  heroSub: { fontSize: Typography.sm, color: Colors.textTertiary },
  heroCompact: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  heroCompactText: { fontSize: Typography.base, color: Colors.accent, fontWeight: Typography.medium },

  thumbGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  thumb: {
    width: 88, height: 88,
    borderRadius: Radius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbImg: { width: '100%', height: '100%' },
  thumbRemove: {
    position: 'absolute', top: 4, right: 4,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.52)',
    alignItems: 'center', justifyContent: 'center',
  },
  thumbRemoveText: { color: Colors.surface, fontSize: 15, lineHeight: 20 },
  thumbAdd: {
    width: 88, height: 88,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center', justifyContent: 'center',
  },
  thumbAddIcon: { fontSize: 28, color: Colors.textTertiary, lineHeight: 32 },

  tip: {
    flexDirection: 'row',
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    alignItems: 'flex-start',
  },
  tipIcon: { fontSize: 16, lineHeight: 22 },
  tipText: { flex: 1, fontSize: Typography.sm, color: Colors.accent, lineHeight: 20 },

  actions: { flexDirection: 'row', gap: Spacing.sm },
  btnAction: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.md,
    minHeight: 96,
  },
  btnActionLabel: {
    fontSize: Typography.sm,
    fontWeight: Typography.medium,
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 18,
  },

  sep: { height: 1, backgroundColor: Colors.borderLight },

  btnPrimary: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnPrimaryDisabled: { opacity: 0.45 },
  btnPrimaryText: {
    fontSize: Typography.base,
    fontWeight: Typography.bold,
    color: Colors.textInverse,
    letterSpacing: 0.1,
  },
  btnManual: { alignItems: 'center', paddingVertical: Spacing.sm },
  btnManualText: { fontSize: Typography.sm, color: Colors.textTertiary },
  btnManualProminent: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 14,
  },
  btnManualTextProminent: {
    fontSize: Typography.base,
    fontWeight: Typography.medium,
    color: Colors.textPrimary,
  },
  quotaBanner: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
  },
  quotaCounter: { fontSize: Typography.sm, color: Colors.textTertiary, marginTop: 2 },
  quotaCounterExhausted: { color: Colors.error ?? '#E53935' },
  quotaText: { fontSize: Typography.sm, color: Colors.textSecondary, textAlign: 'center' },
  quotaLink: { color: Colors.accent, fontWeight: Typography.medium },
})
