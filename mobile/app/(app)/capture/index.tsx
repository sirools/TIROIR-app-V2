import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  ScrollView, Alert, Animated, ActivityIndicator, Platform,
} from 'react-native'
import { Camera, Images, Layers, ChevronRight } from 'lucide-react-native'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import * as FileSystem from 'expo-file-system/legacy'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { useFocusEffect } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'
import { isPaidPlan, Plan } from '@/lib/plan'
import {
  Screen, Colors, Typography, Spacing, Radius,
  CollectionPickerSheet, PickedCollection, useToast,
} from '@/components/ui'

interface PickedImage {
  uri: string
  mimeType: string
  fileName: string
}

/**
 * Plafonds du mode « plusieurs objets ». Une photo = un objet, donc
 * ces plafonds bornent aussi la consommation de quota IA d'un lot.
 * À déplacer dans app_settings quand le mode sortira de la V1.
 */
const BATCH_MAX_FREE = 10
const BATCH_MAX_PREMIUM = 10

export default function CaptureScreen() {
  const router = useRouter()
  const { t } = useTranslation()
  const { user } = useAuth()
  const { showToast } = useToast()
  /**
   * `intent` : la source de photo a déjà été choisie ailleurs (invite d'une
   * collection vide) — on ouvre directement le bon sélecteur.
   * `collectionId` : destination imposée, l'objet créé y atterrit sans que
   * l'utilisateur ait à la re-choisir en fin de parcours.
   */
  const { intent, collectionId } = useLocalSearchParams<{
    intent?: 'camera' | 'library' | 'batch'
    collectionId?: string
  }>()
  const [images, setImages] = useState<PickedImage[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingManual, setLoadingManual] = useState(false)
  const [manualPickerVisible, setManualPickerVisible] = useState(false)
  const [quotaUsed, setQuotaUsed] = useState(0)
  const [quotaLimit, setQuotaLimit] = useState<number | null>(null)
  const [quotaExhausted, setQuotaExhausted] = useState(false)
  const [quotaRemaining, setQuotaRemaining] = useState<number | null>(null)
  const [quotaLoaded, setQuotaLoaded] = useState(false)
  const [plan, setPlan] = useState<Plan>('free')
  const autoStarted = useRef(false)

  useFocusEffect(useCallback(() => {
    setImages([])
    setLoading(false)
    setLoadingManual(false)
    setManualPickerVisible(false)
  }, []))

  useEffect(() => {
    supabase.rpc('get_ai_quota').then(({ data }) => {
      if (data && data[0]) {
        const { used, quota } = data[0]
        setQuotaUsed(used)
        setQuotaLimit(quota)
        setQuotaExhausted(quota !== null && used >= quota)
        setQuotaRemaining(quota === null ? null : Math.max(0, quota - used))
      }
      setQuotaLoaded(true)
    })
    supabase
      .from('profiles')
      .select('plan')
      .eq('id', user!.id)
      .single()
      .then(({ data }) => { if (data?.plan) setPlan(data.plan) })
  }, [user])

  /**
   * Taille maximale d'un lot : plafond du plan, borné par le quota IA
   * réellement restant. Vérifié ici, à l'entrée du mode, plutôt qu'au
   * milieu de l'analyse — l'utilisateur ne doit pas découvrir une
   * limite après avoir fait le travail.
   */
  const batchMax = useMemo(() => {
    const planMax = isPaidPlan(plan) ? BATCH_MAX_PREMIUM : BATCH_MAX_FREE
    return quotaRemaining === null ? planMax : Math.min(planMax, quotaRemaining)
  }, [plan, quotaRemaining])

  /** Un lot n'a de sens qu'à partir de 2 objets. */
  const batchAvailable = batchMax >= 2

  function explainBatchBlocked() {
    Alert.alert(
      t('batch.blockedTitle'),
      t('batch.blockedMessage', { remaining: quotaRemaining ?? 0 }),
    )
  }

  /**
   * Ouverture automatique du sélecteur quand la source est déjà décidée.
   * On attend le quota : sans lui, `batchMax` vaut le plafond du plan et
   * le mode lot s'ouvrirait alors qu'il ne reste peut-être rien.
   */
  useEffect(() => {
    if (!intent || autoStarted.current || !quotaLoaded) return
    autoStarted.current = true
    if (intent === 'camera') pickFromCamera()
    else if (intent === 'library') pickFromLibrary()
    else if (intent === 'batch') batchAvailable ? pickMultipleObjects() : explainBatchBlocked()
  }, [intent, quotaLoaded, batchAvailable])

  async function pickFromLibrary() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert(t('capture.permissionDeniedTitle'), t('capture.permissionLibrary'))
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
      Alert.alert(t('capture.permissionDeniedTitle'), t('capture.permissionCamera'))
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

  /**
   * Mode « plusieurs objets » depuis la photothèque : chaque photo
   * sélectionnée devient un objet distinct, pas une photo de plus
   * sur le même objet.
   */
  async function pickMultipleObjects() {
    if (batchMax < 2) {
      Alert.alert(t('capture.quotaExhausted', { used: quotaUsed, limit: quotaLimit }))
      return
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert(t('capture.permissionDeniedTitle'), t('capture.permissionLibrary'))
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.9,
      selectionLimit: batchMax,
    })
    if (result.canceled) return

    const picked = await compressAll(result.assets)
    goToBatchReview(picked)
  }

  /** Bascule la sélection courante en lot : une photo = un objet. */
  function convertSelectionToBatch() {
    goToBatchReview(images.slice(0, batchMax))
  }

  function goToBatchReview(picked: PickedImage[]) {
    if (picked.length === 0) return
    // runId distinct à chaque lancement : l'écran de review réutilise
    // la même route, c'est ce jeton qui lui dit qu'il s'agit d'un
    // nouveau lot et non du précédent, déjà confirmé.
    router.push({
      pathname: '/capture/review',
      params: {
        images: JSON.stringify(picked),
        runId: String(Date.now()),
        batchMax: String(batchMax),
        ...(collectionId ? { collectionId } : {}),
      },
    })
  }

  async function handleNext() {
    if (images.length === 0) {
      Alert.alert(t('capture.needPhotoTitle'), t('capture.needPhotoMessage'))
      return
    }
    setLoading(true)
    const { data: draftId, error: draftError } = await supabase.rpc('begin_draft_capture')
    setLoading(false)
    if (draftError || !draftId) {
      Alert.alert(t('common.error'), draftError?.message ?? t('capture.startCaptureError'))
      return
    }
    router.push({
      pathname: '/capture/uploading',
      params: {
        draftId,
        images: JSON.stringify(images),
        ...(collectionId ? { collectionId } : {}),
      },
    })
  }

  /**
   * Saisie sans IA : aucune analyse, donc aucun temps mort où glisser la
   * question du rangement. On la pose donc avant, et la création suit
   * immédiatement le choix.
   */
  function handleManual() {
    if (images.length === 0) return
    if (collectionId) {
      // Destination imposée par le parcours d'origine.
      createManual({ id: collectionId, name: '' })
      return
    }
    setManualPickerVisible(true)
  }

  async function createManual(dest: PickedCollection | null) {
    setManualPickerVisible(false)
    setLoadingManual(true)
    try {
      const { data: objectId, error: createError } = await supabase.rpc('create_empty_object')
      if (createError || !objectId) throw new Error(createError?.message ?? t('capture.createError'))

      if (dest) {
        await supabase.from('objects').update({ collection_id: dest.id }).eq('id', objectId)
      }

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

      let name = dest?.name
      if (dest && !name) {
        const { data } = await supabase
          .from('collections').select('name').eq('id', dest.id).single()
        name = data?.name ?? undefined
      }
      showToast(name ? t('capture.createdIn', { name }) : t('capture.created'))

      // Le rangement vient d'être choisi et le reste se remplit sur la fiche :
      // on saute l'écran d'édition et on arrive directement sur le titre,
      // clavier ouvert, seul champ qui manque encore.
      router.replace({
        pathname: '/objects/[id]',
        params: { id: objectId, focusTitle: '1' },
      })
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message ?? t('capture.genericError'))
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
          <Text style={styles.title}>{t('capture.title')}</Text>
          <Text style={styles.subtitle}>{t('capture.subtitle')}</Text>
          <Text style={[styles.quotaCounter, quotaExhausted && styles.quotaCounterExhausted]}>
            {quotaLimit === null
              ? t('capture.quotaUnlimited')
              : quotaExhausted
                ? t('capture.quotaExhausted', { used: quotaUsed, limit: quotaLimit })
                : t('capture.quotaRemaining', { count: quotaLimit - quotaUsed })
            }
          </Text>
        </View>

        {/* Deux sources de photo, à parité, en tête d'écran : elles
            remplacent l'ancienne zone hero. Position stable qu'il y ait
            des photos ou non. */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.btnAction} onPress={pickFromCamera} activeOpacity={0.8}>
            <Camera size={28} color={Colors.textPrimary} strokeWidth={1.5} />
            <Text style={styles.btnActionLabel}>{t('capture.takePhoto')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.btnAction} onPress={pickFromLibrary} activeOpacity={0.8}>
            <Images size={28} color={Colors.textPrimary} strokeWidth={1.5} />
            <Text style={styles.btnActionLabel}>{t('capture.library')}</Text>
          </TouchableOpacity>
        </View>

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
          <>
            <View style={styles.tip}>
              <Text style={styles.tipIcon}>💡</Text>
              <Text style={styles.tipText}>
                {t('capture.tip')}
              </Text>
            </View>

            {/* Entrée « plusieurs objets » — formulée comme une question
                sur la situation de l'utilisateur, pas comme un nom de
                fonctionnalité. Toujours visible : une affordance qui
                disparaît en silence est introuvable et inexplicable. */}
            <BatchEntry
              title={t('batch.entryTitle')}
              subtitle={batchAvailable ? t('batch.entrySub', { max: batchMax }) : t('batch.entryBlocked')}
              enabled={batchAvailable}
              onPress={batchAvailable ? pickMultipleObjects : explainBatchBlocked}
            />
          </>
        )}

        {/* Dès la 2e photo, l'ambiguïté « photo de plus / objet de plus »
            devient réelle : on la lève ici, dans un bloc distinct de la
            grille de photos. */}
        {images.length >= 2 && (
          <BatchEntry
            title={t('batch.addAnotherTitle')}
            subtitle={batchAvailable ? t('batch.addAnotherSub') : t('batch.entryBlocked')}
            enabled={batchAvailable}
            onPress={batchAvailable ? convertSelectionToBatch : explainBatchBlocked}
          />
        )}

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
            {loading ? t('capture.preparing') : hasImages ? t('capture.analyzeCta', { count: images.length }) : t('capture.addPhotoToContinue')}
          </Text>
        </TouchableOpacity>

        {/* Lien recharge — visible quand quota épuisé et photos sélectionnées */}
        {hasImages && quotaExhausted && (
          <View style={styles.quotaBanner}>
            <Text style={styles.quotaText}>
              <Text style={styles.quotaLink}>{/* TODO: onPress → écran recharge */}{t('capture.rechargeQuota')}</Text>
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
                  {t('capture.createEmpty')}
                </Text>
            }
          </TouchableOpacity>
        )}
      </ScrollView>

      <CollectionPickerSheet
        visible={manualPickerVisible}
        title={t('collectionPicker.title')}
        helper={t('collectionPicker.helperManual')}
        busy={loadingManual}
        onSelect={createManual}
        onDismiss={() => setManualPickerVisible(false)}
      />
    </Screen>
  )
}

// ── Entrée « plusieurs objets » ───────────────────────────────────────────────
// Poids secondaire : visible sans concurrencer le CTA d'analyse, et surtout
// jamais masquée — quand elle est indisponible elle le dit au lieu de
// disparaître.

function BatchEntry({
  title, subtitle, enabled, onPress,
}: {
  title: string
  subtitle: string
  enabled: boolean
  onPress: () => void
}) {
  return (
    <TouchableOpacity
      style={[styles.batchEntry, !enabled && styles.batchEntryDisabled]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Layers
        size={20}
        color={enabled ? Colors.accent : Colors.textTertiary}
        strokeWidth={1.6}
      />
      <View style={styles.batchEntryText}>
        <Text style={[styles.batchEntryTitle, !enabled && styles.batchEntryTitleDisabled]}>
          {title}
        </Text>
        <Text style={styles.batchEntrySub}>{subtitle}</Text>
      </View>
      <ChevronRight size={18} color={Colors.textTertiary} strokeWidth={1.6} />
    </TouchableOpacity>
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

  batchEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  batchEntryDisabled: { opacity: 0.55 },
  batchEntryText: { flex: 1 },
  batchEntryTitle: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
  },
  batchEntryTitleDisabled: { color: Colors.textSecondary },
  batchEntrySub: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },

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
  // Vrai bouton secondaire, et non un lien discret : la saisie sans IA
  // est une voie légitime, pas un repli honteux.
  btnManual: {
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 14,
  },
  btnManualText: {
    fontSize: Typography.base,
    fontWeight: Typography.medium,
    color: Colors.textPrimary,
  },
  // Quota épuisé : c'est la seule voie restante, elle passe en avant.
  btnManualProminent: {
    backgroundColor: Colors.accentLight,
    borderColor: Colors.accent,
  },
  btnManualTextProminent: {
    fontWeight: Typography.semibold,
    color: Colors.accent,
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
