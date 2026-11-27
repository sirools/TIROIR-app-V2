import React, { useCallback, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, Alert, Linking,
} from 'react-native'
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as Haptics from 'expo-haptics'
import { X } from 'lucide-react-native'
import { useAuth } from '@/features/auth/AuthContext'
import { hasPhotoZoom } from '@/lib/plan'
import { Colors, Typography, Spacing, Radius } from '@/components/ui'
import { startBatch, type BatchAsset } from '@/features/batch/batchStore'

// ================================================================
// Rafale — l'appareil photo reste ouvert, une photo = un objet.
//
// Rien ne part pendant la prise de vue : les photos restent sur
// l'appareil, dans la pellicule du bas. « Terminer » les confie à
// l'import multiple (features/batch), qui affiche le lot aussitôt.
// ================================================================

/** À partir de combien de places restantes on prévient de la limite. */
const NEAR_LIMIT = 5

export default function BurstCaptureScreen() {
  const { batchMax: batchMaxParam, collectionId } = useLocalSearchParams<{
    batchMax?: string
    collectionId?: string
  }>()
  const max = Math.max(1, Number(batchMaxParam ?? 10))
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { user, profile } = useAuth()
  const [permission, requestPermission] = useCameraPermissions()

  const camera = useRef<CameraView>(null)
  const strip = useRef<ScrollView>(null)
  const [photos, setPhotos] = useState<BatchAsset[]>([])
  const [focused, setFocused] = useState(false)
  const [ready, setReady] = useState(false)
  const shooting = useRef(false)

  // Les onglets gardent les écrans montés : la caméra ne tourne que
  // lorsque l'écran est réellement affiché, et chaque entrée repart de zéro.
  useFocusEffect(useCallback(() => {
    setPhotos([])
    setReady(false)
    setFocused(true)
    return () => setFocused(false)
  }, []))

  const remaining = max - photos.length
  const full = remaining <= 0

  async function shoot() {
    if (shooting.current || full || !ready) return
    shooting.current = true
    try {
      // Avant la photo et sans l'attendre : le doigt sent le déclenchement
      // au moment où il a lieu, pas une fois le fichier écrit.
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
      const picture = await camera.current?.takePictureAsync({ quality: 0.9 })
      if (picture?.uri) {
        setPhotos(prev => [...prev, { uri: picture.uri, width: picture.width, height: picture.height }])
        requestAnimationFrame(() => strip.current?.scrollToEnd({ animated: true }))
      }
    } catch {
      // Une prise ratée ne casse pas la série : on peut redéclencher.
    } finally {
      shooting.current = false
    }
  }

  function leave() {
    router.replace(
      collectionId ? { pathname: '/collections/[id]', params: { id: collectionId } } : '/capture',
    )
  }

  function close() {
    if (photos.length === 0) { leave(); return }
    Alert.alert(t('burst.discardTitle'), t('burst.discardMessage', { count: photos.length }), [
      { text: t('burst.discardNo'), style: 'cancel' },
      { text: t('burst.discardYes'), style: 'destructive', onPress: leave },
    ])
  }

  function finish() {
    if (photos.length === 0 || !user) return
    startBatch({
      assets: photos,
      userId: user.id,
      withZoom: hasPhotoZoom(profile?.plan),
      batchMax: max,
      collectionId: collectionId ?? null,
    })
    router.replace('/capture/review')
  }

  // ── Accès à l'appareil photo ───────────────────────────────────

  if (!permission) return <View style={styles.root} />

  if (!permission.granted) {
    return (
      <View style={[styles.root, styles.permission, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <Text style={styles.permissionTitle}>{t('burst.permissionTitle')}</Text>
        <Text style={styles.permissionBody}>{t('capture.permissionCamera')}</Text>
        <TouchableOpacity
          style={styles.permissionBtn}
          onPress={() => (permission.canAskAgain ? requestPermission() : Linking.openSettings())}
          activeOpacity={0.85}
        >
          <Text style={styles.permissionBtnText}>{t('burst.permissionCta')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={leave} hitSlop={10}>
          <Text style={styles.permissionBack}>{t('common.back')}</Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.root}>
      {focused && (
        <CameraView
          ref={camera}
          style={StyleSheet.absoluteFill}
          facing="back"
          animateShutter
          onCameraReady={() => setReady(true)}
        />
      )}

      {/* Haut : fermer, compteur */}
      <View style={[styles.top, { paddingTop: insets.top + Spacing.sm }]}>
        <TouchableOpacity onPress={close} style={styles.roundBtn} hitSlop={10} accessibilityLabel={t('batch.close')}>
          <X size={22} color="#fff" strokeWidth={2} />
        </TouchableOpacity>
        <View style={styles.counter}>
          <Text style={styles.counterText}>{t('burst.counter', { taken: photos.length, max })}</Text>
        </View>
        <View style={styles.roundSpacer} />
      </View>

      {/* Bas : limite, pellicule, déclencheur, Terminer */}
      <View style={[styles.bottom, { paddingBottom: insets.bottom + Spacing.md }]}>
        {remaining <= NEAR_LIMIT && (
          <Text style={styles.limit}>
            {full ? t('burst.limitReached', { max }) : t('burst.nearLimit', { count: remaining })}
          </Text>
        )}

        {photos.length > 0 ? (
          <ScrollView
            ref={strip}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.strip}
          >
            {photos.map((photo, i) => (
              <TouchableOpacity
                key={photo.uri}
                onPress={() => setPhotos(prev => prev.filter((_, j) => j !== i))}
                activeOpacity={0.7}
                accessibilityLabel={t('burst.removePhoto', { index: i + 1 })}
              >
                <Image source={{ uri: photo.uri }} style={styles.stripThumb} />
                <View style={styles.stripRemove}>
                  <X size={10} color="#fff" strokeWidth={3} />
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <Text style={styles.hint}>{t('burst.hint')}</Text>
        )}

        <View style={styles.controls}>
          <View style={styles.side} />
          <TouchableOpacity
            onPress={shoot}
            disabled={full}
            activeOpacity={0.7}
            style={[styles.shutter, full && styles.shutterDisabled]}
            accessibilityLabel={t('capture.takePhoto')}
          >
            <View style={styles.shutterInner} />
          </TouchableOpacity>
          <View style={styles.side}>
            {photos.length > 0 && (
              <TouchableOpacity style={styles.finish} onPress={finish} activeOpacity={0.85}>
                <Text style={styles.finishText} numberOfLines={1}>{t('burst.finish')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </View>
  )
}

const SCRIM = 'rgba(0,0,0,0.45)'

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },

  top: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
  },
  roundBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: SCRIM,
    alignItems: 'center', justifyContent: 'center',
  },
  roundSpacer: { width: 40 },
  counter: {
    backgroundColor: SCRIM, borderRadius: Radius.full,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
  },
  counterText: { color: '#fff', fontSize: Typography.base, fontWeight: Typography.semibold },

  bottom: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: SCRIM, paddingTop: Spacing.sm, gap: Spacing.sm,
  },
  limit: { color: '#fff', fontSize: Typography.sm, textAlign: 'center', paddingHorizontal: Spacing.md },
  hint: {
    color: 'rgba(255,255,255,0.8)', fontSize: Typography.sm, textAlign: 'center',
    height: 56, textAlignVertical: 'center', paddingTop: 18,
  },
  strip: { paddingHorizontal: Spacing.md, gap: Spacing.sm, paddingTop: 6 },
  stripThumb: { width: 50, height: 50, borderRadius: Radius.sm, backgroundColor: '#222' },
  stripRemove: {
    position: 'absolute', top: -5, right: -5,
    width: 18, height: 18, borderRadius: 9, backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center', justifyContent: 'center',
  },

  controls: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md },
  side: { flex: 1, alignItems: 'flex-end' },
  shutter: {
    width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
  },
  shutterDisabled: { opacity: 0.35 },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#fff' },
  finish: {
    backgroundColor: Colors.accent, borderRadius: Radius.full,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
  },
  finishText: { color: Colors.textInverse, fontSize: Typography.base, fontWeight: Typography.semibold },

  permission: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.lg, gap: Spacing.md },
  permissionTitle: { color: '#fff', fontSize: Typography.lg, fontWeight: Typography.semibold, textAlign: 'center' },
  permissionBody: { color: 'rgba(255,255,255,0.8)', fontSize: Typography.base, textAlign: 'center' },
  permissionBtn: {
    backgroundColor: Colors.accent, borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, marginTop: Spacing.sm,
  },
  permissionBtnText: { color: Colors.textInverse, fontSize: Typography.md, fontWeight: Typography.semibold },
  permissionBack: { color: 'rgba(255,255,255,0.8)', fontSize: Typography.base, marginTop: Spacing.sm },
})
