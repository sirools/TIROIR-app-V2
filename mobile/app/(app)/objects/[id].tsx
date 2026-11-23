import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Image,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
  TextInput,
  Modal,
  Platform,
  Animated,
  PanResponder,
} from 'react-native'
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import * as FileSystem from 'expo-file-system/legacy'
import * as Clipboard from 'expo-clipboard'
import * as WebBrowser from 'expo-web-browser'
import { decode } from 'base64-arraybuffer'
import { Plus, Minus, Pencil, Trash2, ArrowLeft, MoreHorizontal, ChevronRight, ChevronUp, ChevronDown, MapPin, Share2, Sparkles, Star, Info, CalendarDays, UserRound, ExternalLink } from 'lucide-react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { supabase } from '@/lib/supabase'
import { LEGACY_AI_ENABLED, invokeAI } from '@/services/legacyAI'
import { functionError } from '@/lib/functionError'
import { isCreditsRefusal, offerCredits } from '@/lib/buyCredits'
import { useAuth } from '@/features/auth/AuthContext'
import { hasPhotoZoom, isPaidPlan } from '@/lib/plan'
import { STANDARD_WIDTH, queueZoomCopy, zoomPathFor } from '@/services/zoomCopy'
import {
  Screen, FormScreen, FormScrollView, FormSheet, SheetScrollView, focusNextField,
  Colors, Typography, Spacing, Radius, ActionSheet, Checkbox, useToast,
  CollectionPickerSheet, PickedCollection, TorixMark,
} from '@/components/ui'
import { SharePanel } from '@/components/SharePanel'
import PhotoViewer from '@/components/PhotoViewer'
import { DocumentsSection, ObjectDocument } from '@/components/DocumentsSection'
import { InsurancesSection } from '@/components/InsurancesSection'
import { TiroirObject, ObjectImage, Collection } from '@/types/database'
import { isLot, lotTotal, clampQuantity, QUANTITY_MIN, QUANTITY_MAX } from '@/features/objects/quantity'

const SCREEN_WIDTH = Dimensions.get('window').width
const HERO_HEIGHT = 240
const THUMB_SIZE = 52

// ── Labels ───────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: string; labelKey: string }[] = [
  { value: 'stored', labelKey: 'object.statusOptions.stored' },
  { value: 'owned',  labelKey: 'object.statusOptions.owned' },
  { value: 'loaned', labelKey: 'object.statusOptions.loaned' },
  { value: 'lost',   labelKey: 'object.statusOptions.lost' },
  { value: 'sold',   labelKey: 'object.statusOptions.sold' },
  { value: 'given',  labelKey: 'object.statusOptions.given' },
]

const STATUS_COLOR: Record<string, { bg: string; text: string; dot: string }> = {
  stored:  { bg: '#F0FDF4', text: '#16A34A', dot: '#22C55E' }, // vert
  owned:   { bg: '#F0F9FF', text: '#0284C7', dot: '#38BDF8' }, // bleu ciel
  loaned:  { bg: '#FDF2F8', text: '#C026D3', dot: '#E879F9' }, // rose
  lost:    { bg: '#F3F4F6', text: '#6B7280', dot: '#9CA3AF' }, // gris
  // « En vente » : posé par le site (tiroir.app, « Mettre en vente sur Leboncoin »).
  for_sale: { bg: '#FFF7ED', text: '#C2410C', dot: '#F97316' }, // orange
  sold:    { bg: '#FFFBEB', text: '#D97706', dot: '#FBBF24' }, // ambre
  given:   { bg: '#FFF1F2', text: '#E11D48', dot: '#FB7185' }, // rouge
}

// Attributs pilotés par le statut « prêté » — masqués de la section Caractéristiques.
/** Gouttière unique de la grille d'informations (horizontale et verticale). */
const GRID_GAP = Spacing.sm

const LOAN_ATTR_KEYS = ['loaned_to', 'loan_return_date'] as const

// Attributs connus → clé i18n du libellé (sert aussi de filtre de présence).
const ATTR_LABELS: Record<string, string> = {
  brand:           'object.attrLabels.brand',
  model:           'object.attrLabels.model',
  category:        'object.attrLabels.category',
  serial_number:   'object.attrLabels.serial_number',
  estimated_value: 'object.attrLabels.estimated_value',
  currency:        'object.attrLabels.currency',
  color:           'object.attrLabels.color',
  material:        'object.attrLabels.material',
  dimensions:      'object.attrLabels.dimensions',
  voltage:         'object.attrLabels.voltage',
}

const ATTR_PRESETS: { key: string; labelKey: string }[] = [
  { key: 'brand',         labelKey: 'object.attrLabels.brand' },
  { key: 'model',         labelKey: 'object.attrLabels.model' },
  { key: 'color',         labelKey: 'object.attrLabels.color' },
  { key: 'material',      labelKey: 'object.attrLabels.material' },
  { key: 'condition',     labelKey: 'object.attrLabels.condition' },
  { key: 'size',          labelKey: 'object.attrLabels.size' },
  { key: 'weight',        labelKey: 'object.attrLabels.weight' },
  { key: 'dimensions',    labelKey: 'object.attrLabels.dimensions' },
  { key: 'year',          labelKey: 'object.attrLabels.year' },
  { key: 'serial_number', labelKey: 'object.attrLabels.serial_number' },
  { key: 'voltage',       labelKey: 'object.attrLabels.voltage' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function parseBricks(locationNote: string | null): string[] {
  if (!locationNote) return []
  return locationNote.split(' > ').map(s => s.trim()).filter(Boolean)
}

function joinBricks(bricks: string[]): string | null {
  const joined = bricks.map(s => s.trim()).filter(Boolean).join(' > ')
  return joined || null
}

// ── ImageSlider ───────────────────────────────────────────────────────────────

interface ImageSliderProps {
  images: ObjectImage[]
  objectId: string
  onImagesChange: (images: ObjectImage[]) => void
}

type ShadowKey = 'none' | 'soft' | 'diffuse' | 'strong'

/**
 * Fonds proposés pour un détourage.
 *
 * Une palette fermée plutôt qu'un sélecteur libre : sur une photo produit,
 * les fonds qui fonctionnent sont peu nombreux et une teinte saturée
 * choisie au hasard abîme l'objet qu'elle est censée mettre en valeur.
 * Le blanc d'abord — c'est ce qu'attendent les places de marché.
 */
const STUDIO_BACKGROUNDS = [
  { hex: '#FFFFFF', key: 'white' },
  { hex: '#F5F1EA', key: 'ivory' },
  { hex: '#E8ECF0', key: 'slate' },
  { hex: '#E8F0E0', key: 'sage' },
  { hex: '#DCF0F7', key: 'sky' },
  { hex: '#F7E8EC', key: 'rose' },
  { hex: '#FAE8DC', key: 'peach' },
  { hex: '#1A1612', key: 'ink' },
]

const SHADOW_KEYS: ShadowKey[] = ['none', 'soft', 'diffuse', 'strong']

/** Feuille de choix du picto violet : détourer, ou embellir. */
function PhotoStudioSheet({ visible, busy, onCutout, onEnhance, onClose }: {
  visible: boolean
  busy: boolean
  onCutout: (background: string, shadow: ShadowKey) => void
  onEnhance: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [background, setBackground] = useState(STUDIO_BACKGROUNDS[0].hex)
  const [shadow, setShadow] = useState<ShadowKey>('soft')

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={ps.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={ps.sheet}>
        <View style={ps.handle} />

        <Text style={ps.title}>{t('object.photo.studioTitle')}</Text>

        {/* ── Détourage ── */}
        <View style={ps.block}>
          <Text style={ps.blockTitle}>{t('object.photo.cutoutTitle')}</Text>
          <Text style={ps.blockSub}>{t('object.photo.cutoutSub')}</Text>

          <Text style={ps.fieldLabel}>{t('object.photo.background')}</Text>
          <View style={ps.swatchRow}>
            {STUDIO_BACKGROUNDS.map(c => (
              <TouchableOpacity
                key={c.hex}
                onPress={() => setBackground(c.hex)}
                style={[
                  ps.swatch,
                  { backgroundColor: c.hex },
                  background === c.hex && ps.swatchActive,
                ]}
                activeOpacity={0.8}
                accessibilityLabel={t(`object.photo.colors.${c.key}`)}
              />
            ))}
          </View>

          <Text style={ps.fieldLabel}>{t('object.photo.shadow')}</Text>
          <View style={ps.shadowRow}>
            {SHADOW_KEYS.map(k => (
              <TouchableOpacity
                key={k}
                onPress={() => setShadow(k)}
                style={[ps.shadowChip, shadow === k && ps.shadowChipActive]}
                activeOpacity={0.8}
              >
                <Text style={[ps.shadowChipText, shadow === k && ps.shadowChipTextActive]}>
                  {t(`object.photo.shadows.${k}`)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[ps.primaryBtn, busy && ps.btnOff]}
            onPress={() => onCutout(background, shadow)}
            disabled={busy}
            activeOpacity={0.85}
          >
            <Text style={ps.primaryBtnText}>{t('object.photo.cutoutCta')}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Embellissement ── */}
        <View style={ps.block}>
          <Text style={ps.blockTitle}>{t('object.photo.enhanceTitle')}</Text>
          <Text style={ps.blockSub}>{t('object.photo.enhanceSub')}</Text>
          <TouchableOpacity
            style={[ps.secondaryBtn, busy && ps.btnOff]}
            onPress={onEnhance}
            disabled={busy}
            activeOpacity={0.85}
          >
            <Text style={ps.secondaryBtnText}>{t('object.photo.enhanceCta')}</Text>
          </TouchableOpacity>
        </View>

        <Text style={ps.footnote}>{t('object.photo.studioFootnote')}</Text>
      </View>
    </Modal>
  )
}

const ps = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.xs },
  title: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },
  block: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 0.5, borderColor: Colors.border,
    padding: Spacing.md, gap: Spacing.sm,
  },
  blockTitle: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  blockSub: { fontSize: Typography.sm, color: Colors.textSecondary, lineHeight: Typography.sm * 1.45 },
  fieldLabel: {
    fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginTop: Spacing.xs,
  },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  swatch: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.12)',
  },
  swatchActive: { borderWidth: 3, borderColor: Colors.accent },
  shadowRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  shadowChip: {
    paddingVertical: 7, paddingHorizontal: Spacing.md,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  shadowChipActive: { borderColor: Colors.accent, backgroundColor: Colors.accentLight },
  shadowChipText: { fontSize: Typography.xs, fontWeight: Typography.medium, color: Colors.textSecondary },
  shadowChipTextActive: { color: Colors.accent, fontWeight: Typography.semibold },
  primaryBtn: {
    backgroundColor: Colors.accent, borderRadius: Radius.md,
    paddingVertical: 13, alignItems: 'center', marginTop: Spacing.xs,
  },
  primaryBtnText: { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.textInverse },
  secondaryBtn: {
    borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.accent,
    paddingVertical: 12, alignItems: 'center', marginTop: Spacing.xs,
  },
  secondaryBtnText: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.accent },
  btnOff: { opacity: 0.5 },
  footnote: { fontSize: Typography.xs, color: Colors.textTertiary, textAlign: 'center' },
})

function ImageSlider({ images, objectId, onImagesChange }: ImageSliderProps) {
  const router = useRouter()
  const { t } = useTranslation()
  const { profile } = useAuth()
  const [activeIndex, setActiveIndex] = useState(0)
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})
  const [uploading, setUploading] = useState(false)
  const [enhancing, setEnhancing] = useState(false)
  const [studioOpen, setStudioOpen] = useState(false)
  const [settingCover, setSettingCover] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const canZoom = hasPhotoZoom(profile?.plan)
  const closeLightbox = useCallback(() => setLightboxIndex(null), [])
  const flatRef = useRef<FlatList>(null)

  // Charger toutes les URLs signées
  React.useEffect(() => {
    if (!images.length) return
    const paths = images.map(i => i.storage_path)
    // Un chemin de copie sans fichier ne reçoit pas d'URL : le plein écran
    // retombe alors sur la photo courante.
    if (canZoom) paths.push(...images.flatMap(i => (i.zoom_path ? [i.zoom_path] : [])))
    supabase.storage.from('object-images').createSignedUrls(paths, 3600).then(({ data }) => {
      if (!data) return
      const map: Record<string, string> = {}
      for (const s of data) { if (s.signedUrl && s.path) map[s.path] = s.signedUrl }
      setSignedUrls(map)
    })
  }, [images.map(i => i.storage_path).join(','), canZoom])

  const safeIndex = Math.min(activeIndex, Math.max(0, images.length - 1))

  async function pickAndUpload() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert(t('capture.permissionDeniedTitle'), t('object.photo.permissionGallery'))
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: false,
    })
    if (result.canceled || !result.assets[0]) return

    setUploading(true)
    try {
      const asset = result.assets[0]
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error(t('documents.notAuthenticated'))
      const userId = session.user.id

      // Même format que la capture : 1200 px pour tous. La haute définition,
      // réservée aux abonnés, passe par la copie de zoom.
      const reduced = await ImageManipulator.manipulateAsync(
        asset.uri,
        asset.width > STANDARD_WIDTH ? [{ resize: { width: STANDARD_WIDTH } }] : [],
        { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG },
      )
      const mimeType = 'image/jpeg'
      // Le Storage attend : {user_id}/{object_id}/{filename}
      const storagePath = `${userId}/${objectId}/${Date.now()}.jpg`
      const source = canZoom ? { uri: asset.uri, width: asset.width, height: asset.height } : null
      const zoomPath = zoomPathFor(storagePath, source)

      // iOS/Android : lecture base64 via expo-file-system → ArrayBuffer (évite le bug Hermes blob)
      let uploadBody: ArrayBuffer | Blob
      if (Platform.OS === 'web') {
        uploadBody = await (await fetch(reduced.uri)).blob()
      } else {
        const base64 = await FileSystem.readAsStringAsync(reduced.uri, {
          encoding: FileSystem.EncodingType.Base64,
        })
        uploadBody = decode(base64)
      }

      const { error: upErr } = await supabase.storage
        .from('object-images')
        .upload(storagePath, uploadBody, { contentType: mimeType })
      if (upErr) throw upErr

      const isFirstImage = images.length === 0

      const { data: inserted, error: insErr } = await supabase
        .from('object_images')
        .insert({
          object_id: objectId,
          user_id: userId,
          storage_path: storagePath,
          zoom_path: zoomPath,
          mime_type: mimeType,
          is_cover: isFirstImage,
          position: images.length,
        })
        .select()
        .single()
      if (insErr) throw insErr
      queueZoomCopy(source, zoomPath)

      const newImages = [...images, inserted as ObjectImage]
      onImagesChange(newImages)
      // Aller à la nouvelle image
      setTimeout(() => {
        flatRef.current?.scrollToIndex({ index: newImages.length - 1, animated: true })
        setActiveIndex(newImages.length - 1)
      }, 100)
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : t('documents.uploadFailed'))
    } finally {
      setUploading(false)
    }
  }

  async function deleteActive() {
    setDeleteConfirm(false)
    const img = images[safeIndex]
    if (!img) return

    // Supprimer storage + DB
    await supabase.storage.from('object-images').remove(img.zoom_path ? [img.storage_path, img.zoom_path] : [img.storage_path])
    await supabase.from('object_images').delete().eq('id', img.id)

    const newImages = images.filter((_, i) => i !== safeIndex)

    // Si on supprimait la cover et qu'il reste des images → la première devient cover
    if (img.is_cover && newImages.length > 0) {
      await supabase.from('object_images').update({ is_cover: true }).eq('id', newImages[0].id)
      newImages[0] = { ...newImages[0], is_cover: true }
    }

    onImagesChange(newImages)
    setActiveIndex(Math.min(safeIndex, Math.max(0, newImages.length - 1)))
  }

  // Alert.alert est un no-op silencieux sur react-native-web : sur web,
  // on retombe sur window.alert/confirm pour garantir un retour visible.
  function crossAlert(title: string, message: string, onConfirm?: () => void, confirmLabel = t('object.photo.seePremium')) {
    if (Platform.OS === 'web') {
      if (onConfirm) {
        if (window.confirm(`${title}\n\n${message}`)) onConfirm()
      } else {
        window.alert(`${title}\n\n${message}`)
      }
      return
    }
    if (onConfirm) {
      Alert.alert(title, message, [
        { text: t('common.cancel'), style: 'cancel' },
        { text: confirmLabel, onPress: onConfirm },
      ])
    } else {
      Alert.alert(title, message)
    }
  }

  /**
   * Le picto violet ouvre un choix, il ne lance plus rien directement.
   *
   * Détourer et embellir sont deux gestes différents : le premier exécute
   * une décision de l'utilisateur (quel fond, quelle ombre), le second
   * décide à sa place. Les confondre derrière un seul bouton obligeait à
   * subir le second quand on voulait le premier.
   */
  function openStudio() {
    if (enhancing) return
    if (!images[safeIndex]) return

    if (!isPaidPlan(profile?.plan)) {
      crossAlert(
        t('object.photo.enhancePremiumTitle'),
        t('object.photo.enhancePremiumMessage'),
        () => router.push('/paywall')
      )
      return
    }
    setStudioOpen(true)
  }

  async function enhanceActive(options?: { mode: 'cutout'; background: string; shadow: ShadowKey }) {
    if (enhancing) return
    const img = images[safeIndex]
    if (!img) return

    setStudioOpen(false)
    setEnhancing(true)
    try {
      const { data, error } = await invokeAI('enhance-object-photo', {
        body: { object_id: objectId, image_id: img.id, ...(options ?? { mode: 'enhance' }) },
      })
      if (error) {
        let code = 'INTERNAL_ERROR'
        let message = t('object.photo.enhanceError')
        try {
          const parsed = await (error as any).context?.json?.()
          if (parsed?.error) {
            code = parsed.error.code ?? code
            message = parsed.error.message ?? message
          }
        } catch {
          // garde le message par défaut
        }
        if (code === 'QUOTA_EXCEEDED') {
          // Quota du mois et crédits épuisés : la sortie, c'est un pack.
          offerCredits(router, t, message)
        } else if (code === 'PREMIUM_REQUIRED') {
          crossAlert(t('object.photo.enhancePremiumTitle'), t('object.photo.premiumRequiredMessage'))
        } else {
          crossAlert(t('common.error'), message)
        }
        return
      }

      const newImages = [...images, data.image as ObjectImage]
      onImagesChange(newImages)
      setTimeout(() => {
        flatRef.current?.scrollToIndex({ index: newImages.length - 1, animated: true })
        setActiveIndex(newImages.length - 1)
      }, 100)
    } catch {
      crossAlert(t('common.error'), t('object.photo.enhanceError'))
    } finally {
      setEnhancing(false)
    }
  }

  async function setAsCover() {
    const img = images[safeIndex]
    if (!img || img.is_cover || settingCover) return

    const reordered = [
      { ...img, is_cover: true },
      ...images.filter(i => i.id !== img.id).map(i => ({ ...i, is_cover: false })),
    ].map((i, idx) => ({ ...i, position: idx }))

    setSettingCover(true)
    onImagesChange(reordered)
    setActiveIndex(0)
    setTimeout(() => flatRef.current?.scrollToIndex({ index: 0, animated: true }), 100)

    try {
      const results = await Promise.all(
        reordered.map(i =>
          supabase.from('object_images').update({ position: i.position, is_cover: i.is_cover }).eq('id', i.id)
        )
      )
      if (results.some(r => r.error)) {
        crossAlert(t('common.error'), t('object.photo.coverError'))
      }
    } finally {
      setSettingCover(false)
    }
  }

  const total = images.length

  return (
    <View style={sl.root}>
      {/* Slider */}
      <FlatList
        ref={flatRef}
        data={images}
        keyExtractor={i => i.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={e => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH)
          setActiveIndex(idx)
        }}
        renderItem={({ item, index }) => {
          const url = signedUrls[item.storage_path]
          return (
            <TouchableOpacity
              style={sl.slide}
              onPress={() => url && setLightboxIndex(index)}
              activeOpacity={0.95}
            >
              {url
                ? <Image source={{ uri: url }} style={sl.img} resizeMode="cover" />
                : <View style={sl.placeholder}><ActivityIndicator color={Colors.textTertiary} /></View>
              }
              {/* Dit sur l'image même, pas dans un réglage : c'est en la
                  regardant qu'on la prend pour une photo de l'objet. */}
              {item.is_illustration && (
                <View style={sl.illusTag}>
                  <Sparkles size={11} color="white" strokeWidth={2.2} />
                  <Text style={sl.illusTagText}>{t('object.illustration')}</Text>
                </View>
              )}
            </TouchableOpacity>
          )
        }}
        ListEmptyComponent={
          <View style={sl.empty}>
            <Text style={sl.emptyIcon}>📷</Text>
            <Text style={sl.emptyText}>{t('object.photoNone')}</Text>
          </View>
        }
      />

      {/* Stepper dots */}
      {total > 1 && (
        <View style={sl.dots}>
          {images.map((_, i) => (
            <View key={i} style={[sl.dot, i === safeIndex && sl.dotActive]} />
          ))}
        </View>
      )}

      {/* Bouton supprimer (visible si image active existe) */}
      {total > 0 && (
        <TouchableOpacity
          style={sl.deleteBtn}
          onPress={() => setDeleteConfirm(true)}
          activeOpacity={0.8}
        >
          <Trash2 size={16} color="white" strokeWidth={2} />
        </TouchableOpacity>
      )}

      <PhotoStudioSheet
        visible={studioOpen}
        busy={enhancing}
        onClose={() => setStudioOpen(false)}
        onEnhance={() => enhanceActive()}
        onCutout={(background, shadow) => enhanceActive({ mode: 'cutout', background, shadow })}
      />

      {/* Bouton favori (photo de garde) — au-dessus du bouton supprimer */}
      {total > 1 && (
        <TouchableOpacity
          style={sl.favoriteBtn}
          onPress={setAsCover}
          disabled={settingCover || images[safeIndex]?.is_cover}
          activeOpacity={0.8}
        >
          {settingCover
            ? <ActivityIndicator size="small" color="white" />
            : <Star
                size={16}
                color={images[safeIndex]?.is_cover ? '#F59E0B' : 'white'}
                fill={images[safeIndex]?.is_cover ? '#F59E0B' : 'transparent'}
                strokeWidth={2}
              />
          }
        </TouchableOpacity>
      )}

      {/* Bouton ajouter */}
      <TouchableOpacity
        style={sl.addBtn}
        onPress={pickAndUpload}
        disabled={uploading}
        activeOpacity={0.8}
      >
        {uploading
          ? <ActivityIndicator size="small" color="white" />
          : <Plus size={18} color="white" strokeWidth={2.5} />
        }
      </TouchableOpacity>

      {/* Bouton améliorer (IA, premium) — absent du build hackathon */}
      {LEGACY_AI_ENABLED && total > 0 && (
        <TouchableOpacity
          style={sl.enhanceBtn}
          onPress={openStudio}
          disabled={enhancing}
          activeOpacity={0.8}
        >
          {enhancing
            ? <ActivityIndicator size="small" color="white" />
            : <Sparkles size={16} color="white" strokeWidth={2} />
          }
        </TouchableOpacity>
      )}

      {/* Confirm suppression */}
      <Modal visible={deleteConfirm} transparent animationType="fade" onRequestClose={() => setDeleteConfirm(false)}>
        <TouchableOpacity style={sl.backdrop} activeOpacity={1} onPress={() => setDeleteConfirm(false)} />
        <View style={sl.confirmSheet}>
          <View style={sl.confirmHandle} />
          <Trash2 size={28} color={Colors.error} strokeWidth={1.5} style={{ alignSelf: 'center', marginBottom: 8 }} />
          <Text style={sl.confirmTitle}>{t('object.photoDeleteTitle')}</Text>
          <Text style={sl.confirmSub}>{t('object.irreversible')}</Text>
          <View style={sl.confirmActions}>
            <TouchableOpacity style={sl.cancelBtn} onPress={() => setDeleteConfirm(false)}>
              <Text style={sl.cancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={sl.confirmBtn} onPress={deleteActive}>
              <Text style={sl.confirmText}>{t('common.delete')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Lightbox plein écran */}
      {lightboxIndex !== null && (
        <PhotoViewer
          items={images.map(i => ({ id: i.id, url: (i.zoom_path && signedUrls[i.zoom_path]) || signedUrls[i.storage_path] }))}
          startIndex={lightboxIndex}
          zoomEnabled={canZoom}
          onClose={closeLightbox}
        />
      )}
    </View>
  )
}

const sl = StyleSheet.create({
  root: { width: SCREEN_WIDTH, height: HERO_HEIGHT, backgroundColor: Colors.surfaceWarm },
  slide: { width: SCREEN_WIDTH, height: HERO_HEIGHT },
  img: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { width: SCREEN_WIDTH, height: HERO_HEIGHT, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyIcon: { fontSize: 36 },
  emptyText: { fontSize: Typography.sm, color: Colors.textTertiary },

  // Image générée : dite sur l'image, jamais seulement en base.
  illusTag: {
    // Sous le bouton retour, qui occupe déjà le coin.
    position: 'absolute', top: 66, left: 14,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingVertical: 4, paddingHorizontal: 9,
    borderRadius: Radius.full, backgroundColor: 'rgba(0,0,0,0.55)',
  },
  illusTagText: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: 'white' },

  // Dots
  dots: {
    position: 'absolute', bottom: 10, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 5,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.45)' },
  dotActive: { backgroundColor: 'white', width: 18, borderRadius: 3 },

  // Bouton supprimer (bas gauche)
  deleteBtn: {
    position: 'absolute', bottom: 10, left: 14,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Bouton favori (au-dessus du bouton supprimer)
  favoriteBtn: {
    position: 'absolute', bottom: 52, left: 14,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Bouton ajouter (bas droite)
  addBtn: {
    position: 'absolute', bottom: 10, right: 14,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },

  // Bouton améliorer IA (au-dessus du bouton ajouter)
  enhanceBtn: {
    position: 'absolute', bottom: 52, right: 14,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#7c3aed',
    alignItems: 'center', justifyContent: 'center',
  },

  // Confirm modal
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.4)' },
  confirmSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: Spacing.lg, paddingBottom: 40, gap: Spacing.sm,
  },
  confirmHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.borderLight,
    alignSelf: 'center', marginBottom: Spacing.sm,
  },
  confirmTitle: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary, textAlign: 'center' },
  confirmSub: { fontSize: Typography.sm, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.sm },
  confirmActions: { flexDirection: 'row', gap: Spacing.sm },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  cancelText: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textSecondary },
  confirmBtn: {
    flex: 1, paddingVertical: 14, borderRadius: Radius.md,
    backgroundColor: Colors.error, alignItems: 'center',
  },
  confirmText: { fontSize: Typography.base, fontWeight: Typography.bold, color: 'white' },
})

// ── SectionTitle ──────────────────────────────────────────────────────────────

function SectionTitle({ label }: { label: string }) {
  return <Text style={s.sectionTitle}>{label}</Text>
}

// ── AttributesSection ─────────────────────────────────────────────────────────

interface AttrEntry { key: string; label: string; value: string }

interface AttributesSectionProps {
  attributes: [string, unknown][]
  onSave: (attrs: Record<string, string>) => void
}

function AttributesSection({ attributes: initialAttrs, onSave }: AttributesSectionProps) {
  const { t } = useTranslation()
  // Tableau ordonné local
  const [entries, setEntries] = useState<AttrEntry[]>(() =>
    initialAttrs.map(([k, v]) => ({ key: k, label: ATTR_LABELS[k] ? t(ATTR_LABELS[k]) : k, value: String(v) }))
  )
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editingField, setEditingField] = useState<'label' | 'value' | null>(null)
  const [draft, setDraft] = useState('')

  // Sheet d'ajout
  const [adding, setAdding] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newValue, setNewValue] = useState('')

  // Drag state
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)
  const rowHeight = 62
  const dragY = useRef(new Animated.Value(0)).current
  const dragStartY = useRef(0)

  function persist(updated: AttrEntry[]) {
    const attrs: Record<string, string> = {}
    updated.forEach(e => { attrs[e.key] = e.value })
    onSave(attrs)
  }

  function commitEdit() {
    if (editingIdx === null || editingField === null) { setEditingIdx(null); setEditingField(null); return }
    const updated = entries.map((e, i) => {
      if (i !== editingIdx) return e
      if (editingField === 'label') return { ...e, label: draft.trim() || e.label, key: draft.trim() ? draft.trim().toLowerCase().replace(/\s+/g, '_') : e.key }
      return { ...e, value: draft.trim() }
    }).filter(e => e.value !== '')
    setEditingIdx(null)
    setEditingField(null)
    setEntries(updated)
    persist(updated)
  }

  function removeEntry(idx: number) {
    const updated = entries.filter((_, i) => i !== idx)
    setEntries(updated)
    persist(updated)
  }

  function addEntry() {
    const label = newLabel.trim()
    const value = newValue.trim()
    if (!label || !value) return
    const key = label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
    const entry: AttrEntry = { key, label, value }
    const updated = [...entries, entry]
    setEntries(updated)
    persist(updated)
    setNewLabel('')
    setNewValue('')
    setAdding(false)
  }

  function startDrag(idx: number, gestureY: number) {
    setDraggingIdx(idx)
    setDragOverIdx(idx)
    dragStartY.current = gestureY
    dragY.setValue(0)
  }

  function onDragMove(gestureY: number) {
    const delta = gestureY - dragStartY.current
    dragY.setValue(delta)
    const over = Math.max(0, Math.min(entries.length - 1, draggingIdx! + Math.round(delta / rowHeight)))
    setDragOverIdx(over)
  }

  function endDrag() {
    if (draggingIdx === null || dragOverIdx === null) { setDraggingIdx(null); return }
    if (draggingIdx !== dragOverIdx) {
      const updated = [...entries]
      const [moved] = updated.splice(draggingIdx, 1)
      updated.splice(dragOverIdx, 0, moved)
      setEntries(updated)
      persist(updated)
    }
    setDraggingIdx(null)
    setDragOverIdx(null)
    dragY.setValue(0)
  }

  return (
    <View>
      <Text style={s.sectionTitle}>{t('object.attrs.title')}</Text>

      <View style={[s.attrsCard, { overflow: 'visible' }]}>
        {entries.map((entry, i) => {
            const isDragging = draggingIdx === i
            const isTarget = dragOverIdx === i && draggingIdx !== null && draggingIdx !== i

            const panResponder = PanResponder.create({
              onStartShouldSetPanResponder: () => true,
              onPanResponderGrant: (_, gs) => startDrag(i, gs.y0),
              onPanResponderMove: (_, gs) => onDragMove(gs.moveY),
              onPanResponderRelease: () => endDrag(),
              onPanResponderTerminate: () => endDrag(),
            })

            return (
              <View key={entry.key + i} style={[
                s.attrRow,
                i > 0 && s.attrSep,
                isTarget && s.attrDragTarget,
              ]}>
                {/* Handle drag — gauche */}
                <View {...panResponder.panHandlers} style={s.attrHandle}>
                  <Text style={s.attrHandleIcon}>⠿</Text>
                </View>

                {/* Contenu — centre */}
                <View style={s.attrContent}>
                  {editingIdx === i && editingField === 'label' ? (
                    <TextInput
                      style={s.attrLabelInput}
                      value={draft}
                      onChangeText={setDraft}
                      onBlur={commitEdit}
                      onSubmitEditing={commitEdit}
                      autoFocus
                      returnKeyType="next"
                      placeholderTextColor={Colors.textTertiary}
                    />
                  ) : (
                    <TouchableOpacity onPress={() => { setDraft(entry.label); setEditingIdx(i); setEditingField('label') }} activeOpacity={0.6}>
                      <Text style={s.attrKey}>{entry.label}</Text>
                    </TouchableOpacity>
                  )}
                  {editingIdx === i && editingField === 'value' ? (
                    <TextInput
                      style={s.attrInput}
                      value={draft}
                      onChangeText={setDraft}
                      onBlur={commitEdit}
                      onSubmitEditing={commitEdit}
                      autoFocus
                      returnKeyType="done"
                    />
                  ) : (
                    <TouchableOpacity onPress={() => { setDraft(entry.value); setEditingIdx(i); setEditingField('value') }} activeOpacity={0.7}>
                      <Text style={s.attrValue}>{entry.value}</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Supprimer — droite */}
                <TouchableOpacity onPress={() => removeEntry(i)} hitSlop={8} activeOpacity={0.7} style={s.attrRemoveBtn}>
                  <Text style={s.attrRemove}>✕</Text>
                </TouchableOpacity>
              </View>
            )
          })}
          {/* Bouton ajout — dans la card, séparé par un divider */}
          {entries.length > 0 && <View style={s.attrSep} />}
          <TouchableOpacity style={s.attrsAddCta} onPress={() => setAdding(true)} activeOpacity={0.8}>
            <Text style={s.attrsAddCtaText}>{t('object.attrs.add')}</Text>
          </TouchableOpacity>
        </View>

      {/* Sheet ajout */}
      <FormSheet visible={adding} animationType="slide" onRequestClose={() => setAdding(false)}>
        <TouchableOpacity style={s.attrBackdrop} activeOpacity={1} onPress={() => setAdding(false)} />
        <View style={s.attrSheet}>
          <View style={s.attrSheetHandle} />
          <Text style={s.attrSheetTitle}>{t('object.attrs.sheetTitle')}</Text>

          {/* Presets */}
          <Text style={s.attrSheetLabel}>{t('object.attrs.suggestions')}</Text>
          <View style={s.attrPresets}>
            {ATTR_PRESETS.filter(p => !entries.find(e => e.key === p.key)).map(p => {
              const presetLabel = t(p.labelKey)
              return (
              <TouchableOpacity
                key={p.key}
                style={[s.attrPresetChip, newLabel === presetLabel && s.attrPresetChipActive]}
                onPress={() => { setNewLabel(presetLabel) }}
                activeOpacity={0.7}
              >
                <Text style={[s.attrPresetChipText, newLabel === presetLabel && s.attrPresetChipTextActive]}>
                  {presetLabel}
                </Text>
              </TouchableOpacity>
              )
            })}
          </View>

          {/* Nom custom */}
          <Text style={s.attrSheetLabel}>{t('object.attrs.nameLabel')}</Text>
          <TextInput
            style={s.attrSheetInput}
            value={newLabel}
            onChangeText={setNewLabel}
            placeholder={t('object.attrs.namePlaceholder')}
            placeholderTextColor={Colors.textTertiary}
            returnKeyType="next"
            submitBehavior="submit"
            onSubmitEditing={focusNextField}
          />

          {/* Valeur */}
          <Text style={s.attrSheetLabel}>{t('object.attrs.valueLabel')}</Text>
          <TextInput
            style={s.attrSheetInput}
            value={newValue}
            onChangeText={setNewValue}
            placeholder={t('object.attrs.valuePlaceholder')}
            placeholderTextColor={Colors.textTertiary}
            returnKeyType="done"
            onSubmitEditing={addEntry}
          />
          <TouchableOpacity
            style={[s.attrSheetBtn, (!newLabel.trim() || !newValue.trim()) && s.attrSheetBtnDisabled]}
            onPress={addEntry}
            disabled={!newLabel.trim() || !newValue.trim()}
            activeOpacity={0.85}
          >
            <Text style={s.attrSheetBtnText}>{t('object.attrs.addBtn')}</Text>
          </TouchableOpacity>
        </View>
      </FormSheet>
    </View>
  )
}

// ── Emplacement ───────────────────────────────────────────────────────────────

/**
 * Cinq niveaux suffisent à décrire où un objet est rangé (« Garage > Étagère
 * du haut > Boîte bleue »). Au-delà, on ne se repère plus : on énumère.
 */
const LOCATION_MAX = 5

interface LocationBricksProps {
  bricks: string[]
  onEdit: () => void
}

/**
 * Affichage seul : la modification passe par le tiroir. Les puces défilent
 * horizontalement sur UNE ligne — un emplacement se lit comme un chemin, et
 * un chemin qui passe à la ligne cesse d'en être un.
 */
function LocationBricks({ bricks, onEdit }: LocationBricksProps) {
  const { t } = useTranslation()

  if (bricks.length === 0) {
    return (
      <TouchableOpacity style={[lb.editBadge, lb.addFull]} onPress={onEdit} activeOpacity={0.85}>
        <Plus size={12} color="#FFFFFF" strokeWidth={2.6} />
        <Text style={lb.editBadgeText}>{t('object.locationAdd')}</Text>
      </TouchableOpacity>
    )
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={lb.row}
    >
      {bricks.map((brick, i) => (
        <React.Fragment key={i}>
          {i > 0 && <Text style={lb.arrow}>›</Text>}
          <View style={lb.brick}>
            <Text style={lb.brickText} numberOfLines={1}>{brick}</Text>
          </View>
        </React.Fragment>
      ))}

      {/* En bout de chaîne plutôt qu'en marge : le badge fait partie du
          chemin qu'on parcourt, et il libère la largeur que le lien
          prenait aux puces. */}
      <TouchableOpacity style={lb.editBadge} onPress={onEdit} activeOpacity={0.85}>
        <Pencil size={11} color="#FFFFFF" strokeWidth={2.4} />
        <Text style={lb.editBadgeText}>{t('object.locationEdit')}</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const lb = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingRight: 2 },
  arrow: { fontSize: Typography.sm, color: Colors.textTertiary },
  brick: {
    backgroundColor: Colors.surfaceWarm, borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 3,
    borderWidth: 0.5, borderColor: Colors.border,
  },
  brickText: {
    fontSize: Typography.sm, color: Colors.textPrimary,
    fontWeight: Typography.semibold, maxWidth: 130,
  },
  // Même hauteur que les puces : bordure comprise, c'est ce qui les aligne.
  editBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#EA580C', borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 3,
    borderWidth: 0.5, borderColor: '#EA580C',
  },
  editBadgeText: { fontSize: Typography.sm, color: '#FFFFFF', fontWeight: Typography.bold },
  // Carte vide : le bouton occupe la largeur, il n'a rien à côté de lui.
  addFull: { alignSelf: 'stretch', justifyContent: 'center', paddingVertical: 5 },
})

// ── Tiroir d'édition de l'emplacement ─────────────────────────────────────────

interface LocationEditorSheetProps {
  visible: boolean
  initial: string[]
  onCancel: () => void
  onSave: (bricks: string[]) => void
}

/**
 * L'ordre porte le sens (du contenant au contenu), il doit donc se
 * réarranger. Des flèches plutôt qu'un glisser-déposer : sur cinq lignes
 * au plus, deux taps valent mieux qu'un geste à apprendre.
 *
 * Rien n'est écrit avant « Valider » : on peut réorganiser, se tromper et
 * annuler sans laisser de trace.
 */
function LocationEditorSheet({ visible, initial, onCancel, onSave }: LocationEditorSheetProps) {
  const { t } = useTranslation()
  const [items, setItems] = useState<string[]>(initial)

  // Rouvrir le tiroir repart toujours de l'état enregistré, jamais du
  // brouillon abandonné la fois précédente.
  useEffect(() => {
    if (visible) setItems(initial.length > 0 ? initial : [''])
  }, [visible])

  function update(idx: number, value: string) {
    setItems(prev => prev.map((v, i) => (i === idx ? value : v)))
  }

  function move(idx: number, delta: number) {
    const target = idx + delta
    if (target < 0 || target >= items.length) return
    setItems(prev => {
      const next = [...prev]
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })
  }

  function remove(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx))
  }

  function add() {
    if (items.length >= LOCATION_MAX) return
    setItems(prev => [...prev, ''])
  }

  function save() {
    onSave(items.map(v => v.trim()).filter(Boolean).slice(0, LOCATION_MAX))
  }

  return (
    <FormSheet visible={visible} animationType="slide" onRequestClose={onCancel}>
      <TouchableOpacity style={les.backdrop} activeOpacity={1} onPress={onCancel} />
      <View style={les.sheet}>
        <View style={les.handle} />
        <Text style={les.title}>{t('object.locationSheet.title')}</Text>
        <Text style={les.help}>{t('object.locationSheet.help')}</Text>

        <SheetScrollView style={les.list}>
          {items.map((item, i) => (
            <View key={i} style={les.row}>
              <Text style={les.rank}>{i + 1}</Text>
              <TextInput
                style={les.input}
                value={item}
                onChangeText={v => update(i, v)}
                placeholder={t('object.locationSheet.placeholder')}
                placeholderTextColor={Colors.textTertiary}
                returnKeyType={i < items.length - 1 ? 'next' : 'done'}
                submitBehavior={i < items.length - 1 ? 'submit' : undefined}
                onSubmitEditing={i < items.length - 1 ? focusNextField : save}
              />
              <View style={les.arrows}>
                <TouchableOpacity
                  onPress={() => move(i, -1)}
                  disabled={i === 0}
                  hitSlop={{ top: 6, bottom: 2, left: 6, right: 6 }}
                >
                  <ChevronUp size={16} color={i === 0 ? Colors.borderLight : Colors.textSecondary} strokeWidth={2.2} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => move(i, 1)}
                  disabled={i === items.length - 1}
                  hitSlop={{ top: 2, bottom: 6, left: 6, right: 6 }}
                >
                  <ChevronDown size={16} color={i === items.length - 1 ? Colors.borderLight : Colors.textSecondary} strokeWidth={2.2} />
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => remove(i)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                <Trash2 size={15} color={Colors.textTertiary} strokeWidth={1.8} />
              </TouchableOpacity>
            </View>
          ))}

          <TouchableOpacity
            style={[les.addRow, items.length >= LOCATION_MAX && les.addRowOff]}
            onPress={add}
            disabled={items.length >= LOCATION_MAX}
            activeOpacity={0.7}
          >
            <Plus size={14} color={items.length >= LOCATION_MAX ? Colors.textTertiary : Colors.accent} strokeWidth={2.4} />
            <Text style={[les.addText, items.length >= LOCATION_MAX && les.addTextOff]}>
              {items.length >= LOCATION_MAX
                ? t('object.locationSheet.full', { max: LOCATION_MAX })
                : t('object.locationSheet.add')}
            </Text>
          </TouchableOpacity>
        </SheetScrollView>

        <View style={les.footer}>
          <TouchableOpacity style={les.btnGhost} onPress={onCancel} activeOpacity={0.8}>
            <Text style={les.btnGhostText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={les.btnPrimary} onPress={save} activeOpacity={0.85}>
            <Text style={les.btnPrimaryText}>{t('common.validate')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </FormSheet>
  )
}

const les = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(26, 22, 18, 0.4)' },
  sheet: {
    maxHeight: '82%',
    backgroundColor: Colors.background,
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    paddingTop: Spacing.sm, paddingBottom: Spacing.lg, paddingHorizontal: Spacing.lg,
  },
  handle: {
    alignSelf: 'center', width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, marginBottom: Spacing.md,
  },
  title: { fontSize: Typography.lg, fontWeight: Typography.semibold, color: Colors.textPrimary },
  help: {
    fontSize: Typography.sm, color: Colors.textSecondary,
    lineHeight: Typography.sm * Typography.relaxed, marginTop: 4,
  },
  list: { marginTop: Spacing.md },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 0.5, borderColor: Colors.border,
    paddingHorizontal: Spacing.sm, paddingVertical: 6,
    marginBottom: Spacing.sm,
  },
  rank: { fontSize: Typography.xs, color: Colors.textTertiary, fontWeight: Typography.bold, width: 12 },
  input: { flex: 1, fontSize: Typography.base, color: Colors.textPrimary, paddingVertical: 6 },
  arrows: { alignItems: 'center' },
  addRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: Spacing.sm + 2, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed',
  },
  addRowOff: { borderColor: Colors.borderLight },
  addText: { fontSize: Typography.sm, color: Colors.accent, fontWeight: Typography.semibold },
  addTextOff: { color: Colors.textTertiary },
  footer: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  btnGhost: {
    flex: 1, paddingVertical: 13, borderRadius: Radius.md, alignItems: 'center',
    backgroundColor: Colors.surface, borderWidth: 0.5, borderColor: Colors.border,
  },
  btnGhostText: { fontSize: Typography.base, color: Colors.textSecondary, fontWeight: Typography.medium },
  btnPrimary: {
    flex: 1, paddingVertical: 13, borderRadius: Radius.md, alignItems: 'center',
    backgroundColor: Colors.accent,
  },
  btnPrimaryText: { fontSize: Typography.base, color: Colors.textInverse, fontWeight: Typography.semibold },
})

// ── DescriptionBlock ──────────────────────────────────────────────────────────

const DESC_COLLAPSED_LINES = 3

function DescriptionBlock({ text, onEdit }: { text: string | null; onEdit: () => void }) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const [isTruncated, setIsTruncated] = useState(false)

  if (!text) {
    return (
      <TouchableOpacity onPress={onEdit} activeOpacity={0.8}>
        <Text style={s.descPlaceholder}>{t('object.descriptionAdd')}</Text>
      </TouchableOpacity>
    )
  }

  return (
    <View>
      <TouchableOpacity onPress={onEdit} activeOpacity={0.8}>
        <Text
          style={s.descText}
          numberOfLines={expanded ? undefined : DESC_COLLAPSED_LINES}
          onTextLayout={e => {
            if (!expanded) setIsTruncated(e.nativeEvent.lines.length >= DESC_COLLAPSED_LINES)
          }}
        >
          {text}
        </Text>
      </TouchableOpacity>
      {(isTruncated || expanded) && (
        <TouchableOpacity onPress={() => setExpanded(p => !p)} activeOpacity={0.7} style={s.showMoreBtn}>
          <Text style={s.showMoreText}>{expanded ? t('object.showLess') : t('object.showMore')}</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

// ── LoanCard — visible uniquement quand le statut est « prêté » ───────────────

interface LoanCardProps {
  loanedTo: string
  returnDate: string        // ISO yyyy-mm-dd, '' si non renseignée
  onSave: (patch: { loanedTo?: string; returnDate?: string }) => void
}

function LoanCard({ loanedTo, returnDate, onSave }: LoanCardProps) {
  const { t } = useTranslation()
  const [editingName, setEditingName] = useState(false)
  const [nameDraft, setNameDraft] = useState(loanedTo)
  const [datePickerOpen, setDatePickerOpen] = useState(false)

  // Resynchronise le brouillon si l'objet est rechargé pendant l'édition.
  useEffect(() => { if (!editingName) setNameDraft(loanedTo) }, [loanedTo, editingName])

  const c = STATUS_COLOR.loaned

  function commitName() {
    setEditingName(false)
    const next = nameDraft.trim()
    if (next !== loanedTo) onSave({ loanedTo: next })
  }

  const isOverdue = returnDate !== '' && new Date(returnDate) < new Date(new Date().toDateString())

  return (
    <View style={[s.loanCard, { backgroundColor: c.bg }]}>
      {/* Prêté à… — libellé ferré à gauche, valeur ferrée à droite */}
      <View style={s.loanRow}>
        <View style={s.loanLabelWrap}>
          <UserRound size={16} color={c.text} strokeWidth={1.75} />
          <Text style={[s.loanLabel, { color: c.text }]}>{t('object.loan.toLabel')}</Text>
        </View>
        {editingName ? (
          <TextInput
            style={s.loanInput}
            value={nameDraft}
            onChangeText={setNameDraft}
            onBlur={commitName}
            onSubmitEditing={commitName}
            placeholder={t('object.loan.toPlaceholder')}
            placeholderTextColor={Colors.textTertiary}
            autoFocus
            returnKeyType="done"
          />
        ) : (
          <TouchableOpacity style={s.loanValueBtn} onPress={() => setEditingName(true)} activeOpacity={0.7}>
            <Text style={[s.loanValue, !loanedTo && s.loanValueEmpty]} numberOfLines={1}>
              {loanedTo || t('object.loan.toPlaceholder')}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Date de retour */}
      <View style={s.loanRow}>
        <View style={s.loanLabelWrap}>
          <CalendarDays size={16} color={c.text} strokeWidth={1.75} />
          <Text style={[s.loanLabel, { color: c.text }]}>{t('object.loan.returnLabel')}</Text>
        </View>
        <TouchableOpacity
          style={s.loanValueBtn}
          // Le tap n'enlève pas le focus du champ nom : on valide sa saisie en cours
          // avant d'ouvrir le picker, sinon elle serait perdue.
          onPress={() => { if (editingName) commitName(); setDatePickerOpen(true) }}
          activeOpacity={0.7}
        >
          <Text
            style={[s.loanValue, !returnDate && s.loanValueEmpty, isOverdue && s.loanValueOverdue]}
            numberOfLines={1}
          >
            {returnDate ? formatDate(returnDate, i18n.language) : t('object.chooseDate')}
          </Text>
        </TouchableOpacity>
        {returnDate ? (
          <TouchableOpacity onPress={() => onSave({ returnDate: '' })} hitSlop={10}>
            <Text style={s.loanClear}>×</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {datePickerOpen && (
        <DateTimePicker
          value={returnDate ? new Date(returnDate) : new Date()}
          mode="date"
          display="spinner"
          locale={i18n.language}
          onChange={(_, selected) => {
            setDatePickerOpen(false)
            if (selected) onSave({ returnDate: selected.toISOString().split('T')[0] })
          }}
        />
      )}
    </View>
  )
}

// ── ValeurCard (fusion Valeur + Assurance) ────────────────────────────────────

const CONFIDENCE_LABEL_KEY = { low: 'object.value.confidenceLow', medium: 'object.value.confidenceMedium', high: 'object.value.confidenceHigh' }
const CONFIDENCE_COLOR = { low: Colors.textTertiary, medium: '#EA580C', high: '#16A34A' }

// ── MarketValueSection — section IA avec show more et suppression ─────────────

interface MarketValueSectionProps {
  object: TiroirObject
  estimating: boolean
  sources: TiroirObject['value_sources']
  confidence: 'low' | 'medium' | 'high'
  currSym: string
  onEstimate: () => void
  onClearMarketValue: () => void
  onUpdateMarketValue: (newValue: number) => Promise<void>
}

/**
 * Ouvre l'annonce dans un navigateur applicatif plutôt que de quitter
 * l'app : on revient à la fiche d'un geste, sans perdre son contexte.
 *
 * L'URL vient du modèle et n'est pas garantie : on refuse tout ce qui
 * n'est pas http(s) plutôt que de laisser passer un schéma inattendu.
 */
async function openSource(url: string) {
  if (!/^https?:\/\//i.test(url)) return
  try {
    await WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET })
  } catch {
    // Une annonce retirée ou une URL malformée ne doit pas faire tomber la fiche.
  }
}

function MarketValueSection({ object, estimating, sources, confidence, currSym, onEstimate, onClearMarketValue, onUpdateMarketValue }: MarketValueSectionProps) {
  const { t, i18n } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)

  async function commit() {
    const parsed = parseFloat(draft.replace(',', '.'))
    setEditing(false)
    if (isNaN(parsed) || parsed <= 0 || parsed === object.market_value) return
    setSaving(true)
    await onUpdateMarketValue(parsed)
    setSaving(false)
  }

  const hasValue = object.market_value != null

  return (
    <View style={[vc.section, { gap: 0 }]}>
      {/* Row compacte, alignée sur les autres valeurs */}
      <View style={vc.amountRow}>
        <View style={vc.amountLabelWrap}>
          <View style={vc.marketLabelWrap}>
            <Text style={vc.amountLabel}>{t('object.value.marketValue')}</Text>
            {hasValue && (
              <TouchableOpacity onPress={() => setInfoOpen(true)} hitSlop={8} style={vc.infoBtn}>
                <Info size={15} color={Colors.textTertiary} strokeWidth={1.8} />
              </TouchableOpacity>
            )}
          </View>
          <TorixMark label={t('object.value.marketHint')} size={11} textStyle={vc.amountHint} style={{ marginTop: 2 }} />
        </View>

        {estimating ? (
          <ActivityIndicator size="small" color={Colors.accent} />
        ) : hasValue ? (
          editing ? (
            <TextInput
              style={vc.amountInput}
              value={draft}
              onChangeText={setDraft}
              onBlur={commit}
              onSubmitEditing={commit}
              keyboardType="decimal-pad"
              autoFocus
              returnKeyType="done"
              selectTextOnFocus
            />
          ) : saving ? (
            <ActivityIndicator size="small" color={Colors.accent} />
          ) : (
            <TouchableOpacity
              style={vc.amountValueWrap}
              onPress={() => { setDraft(String(object.market_value)); setEditing(true) }}
              activeOpacity={0.7}
            >
              <Text style={vc.amountValue}>{object.market_value!.toLocaleString(i18n.language)} {currSym}</Text>
              {/* L'estimation IA porte sur UN exemplaire : le lot s'en déduit. */}
              {isLot(object.quantity) && (
                <Text style={vc.lotTotal}>
                  {t('object.value.lotTotal', {
                    count: object.quantity,
                    unit: object.market_value!.toLocaleString(i18n.language),
                    total: lotTotal(object.market_value, object.quantity)!.toLocaleString(i18n.language),
                    sym: currSym,
                  })}
                </Text>
              )}
            </TouchableOpacity>
          )
        ) : LEGACY_AI_ENABLED ? (
          <TouchableOpacity onPress={onEstimate} activeOpacity={0.8}>
            <Text style={vc.marketEstimateLink}>{t('object.value.estimateAi')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Drawer d'explication */}
      <Modal visible={infoOpen} transparent animationType="slide" onRequestClose={() => setInfoOpen(false)}>
        <TouchableOpacity style={vc.backdrop} activeOpacity={1} onPress={() => setInfoOpen(false)} />
        <View style={vc.infoDrawer}>
          <View style={vc.sheetHandle} />
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.sm, paddingBottom: 8 }}>
            <View style={vc.infoHead}>
              <Text style={vc.infoTitle}>{t('object.value.marketValue')}</Text>
              {sources && (
                <Text style={[vc.confidenceBadge, { color: CONFIDENCE_COLOR[confidence] }]}>
                  {t(CONFIDENCE_LABEL_KEY[confidence])}
                </Text>
              )}
            </View>
            {hasValue && (
              <Text style={vc.infoValue}>{object.market_value!.toLocaleString(i18n.language)} {currSym}</Text>
            )}
            {sources?.ai_value != null && sources.ai_value !== object.market_value && (
              <Text style={vc.iaValueHint}>{t('object.value.aiHint', { value: sources.ai_value.toLocaleString(i18n.language), sym: currSym })}</Text>
            )}
            {sources?.value_min != null && sources?.value_max != null && (
              <Text style={vc.range}>
                {t('object.value.range', { min: sources.value_min.toLocaleString(i18n.language), max: sources.value_max.toLocaleString(i18n.language), sym: currSym })}
              </Text>
            )}
            {sources?.summary ? <Text style={vc.summary}>{sources.summary}</Text> : null}
            {sources?.sources && sources.sources.length > 0 && (
              <View style={vc.sourcesRow}>
                {sources.sources.slice(0, 3).map((src, i) => (
                  /* L'annonce est la preuve de l'estimation : pouvoir
                     l'ouvrir, c'est pouvoir vérifier. Sans URL la pastille
                     reste un simple libellé — mieux qu'un lien mort. */
                  src.url ? (
                    <TouchableOpacity
                      key={i}
                      style={[vc.sourceChip, vc.sourceChipLink]}
                      onPress={() => openSource(src.url!)}
                      activeOpacity={0.7}
                    >
                      <Text style={vc.sourceChipText}>{src.site} · {src.price} {currSym}</Text>
                      <ExternalLink size={11} color={Colors.accent} strokeWidth={2} />
                    </TouchableOpacity>
                  ) : (
                    <View key={i} style={vc.sourceChip}>
                      <Text style={vc.sourceChipText}>{src.site} · {src.price} {currSym}</Text>
                    </View>
                  )
                ))}
              </View>
            )}
            <View style={vc.infoActions}>
              {LEGACY_AI_ENABLED && (
                <TouchableOpacity
                  style={[vc.marketActionBtn, vc.marketActionRefresh]}
                  onPress={() => { setInfoOpen(false); onEstimate() }}
                  activeOpacity={0.75}
                >
                  <Text style={[vc.marketActionText, { color: '#15803D' }]}>{t('object.value.refresh')}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[vc.marketActionBtn, vc.marketActionDelete]}
                onPress={() => { setInfoOpen(false); onClearMarketValue() }}
                activeOpacity={0.75}
              >
                <Text style={[vc.marketActionText, { color: '#DC2626' }]}>{t('object.value.delete')}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  )
}

/**
 * Quantité, en tiers de ligne à côté de l'emplacement.
 *
 * Même carte que Statut, Collection et Emplacement — mêmes marges, même
 * libellé, même poids typographique : c'est une information de la fiche,
 * pas un réglage à part.
 */
function QuantityCard({
  quantity, onChange,
}: { quantity: number; onChange: (next: number) => void }) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  function commit() {
    setEditing(false)
    const parsed = parseInt(draft.replace(/[^0-9]/g, ''), 10)
    if (isNaN(parsed)) return
    onChange(parsed)
  }

  const atMin = quantity <= QUANTITY_MIN
  const atMax = quantity >= QUANTITY_MAX

  return (
    <View style={[s.metricCard, { flex: 1 }]}>
      <Text style={s.metricLabel}>{t('object.value.quantity')}</Text>
      <View style={s.qtyStepper}>
        <TouchableOpacity
          style={[s.qtyBtn, atMin && s.qtyBtnOff]}
          onPress={() => onChange(quantity - 1)}
          disabled={atMin}
          hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
          activeOpacity={0.6}
        >
          <Minus size={14} color={atMin ? Colors.textTertiary : Colors.textPrimary} strokeWidth={2.6} />
        </TouchableOpacity>

        {/* Saisie directe : « 47 fourchettes » ne se compose pas au + */}
        {editing ? (
          <TextInput
            style={s.qtyInput}
            value={draft}
            onChangeText={setDraft}
            onBlur={commit}
            onSubmitEditing={commit}
            keyboardType="number-pad"
            autoFocus
            selectTextOnFocus
            returnKeyType="done"
            maxLength={3}
          />
        ) : (
          <TouchableOpacity
            style={s.qtyValueBtn}
            onPress={() => { setDraft(String(quantity)); setEditing(true) }}
            activeOpacity={0.6}
          >
            <Text style={s.metricValue}>{quantity}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[s.qtyBtn, atMax && s.qtyBtnOff]}
          onPress={() => onChange(quantity + 1)}
          disabled={atMax}
          hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
          activeOpacity={0.6}
        >
          <Plus size={14} color={atMax ? Colors.textTertiary : Colors.textPrimary} strokeWidth={2.6} />
        </TouchableOpacity>
      </View>
    </View>
  )
}

/**
 * Total d'un lot, sous le montant unitaire dont il découle.
 *
 * Dérivé et jamais éditable : un seul sens de calcul. Rendre le total
 * saisissable imposerait de diviser à l'envers, avec des arrondis qui
 * dérivent. Invisible tant que la fiche décrit un seul exemplaire — c'est
 * ce qui garantit que rien ne change pour l'ajout unitaire.
 */
function LotTotalHint({
  unit, quantity, currSym,
}: { unit: number | null | undefined; quantity: number; currSym: string }) {
  const { t, i18n } = useTranslation()
  if (!isLot(quantity) || unit == null) return null
  const total = lotTotal(unit, quantity)!
  return (
    <Text style={vc.lotTotal}>
      {t('object.value.lotTotal', {
        total: total.toLocaleString(i18n.language),
        sym: currSym,
      })}
    </Text>
  )
}

/**
 * Écart en pourcentage, vert au-dessus et rouge en dessous. Un seul gabarit
 * pour « vs estimation IA » et « vs prix d'achat » : ce sont deux lectures
 * du même chiffre, elles ne doivent pas se présenter différemment.
 */
function DiffBadge({ pct, label }: { pct: number; label: string }) {
  const up = pct >= 0
  return (
    <View style={[vc.diffBadge, { backgroundColor: up ? '#DCFCE7' : '#FEE2E2' }]}>
      <Text style={[vc.diffBadgeText, { color: up ? '#16A34A' : '#DC2626' }]}>
        {up ? '▲' : '▼'} {Math.abs(pct)}%
      </Text>
      <Text style={[vc.diffBadgeSubtext, { color: up ? '#16A34A' : '#DC2626' }]}>{label}</Text>
    </View>
  )
}

interface ValeurCardProps {
  object: TiroirObject
  estimating: boolean
  editingUserValue: boolean
  userValueDraft: string
  onEstimate: () => void
  onEditUserValue: () => void
  onUserValueChange: (v: string) => void
  onUserValueCommit: () => void
  onClearMarketValue: () => void
  onUpdateMarketValue: (newValue: number) => Promise<void>
  onUpdatePurchasePrice: (newValue: number | null) => Promise<void>
  onUpdateSalePrice: (newValue: number | null) => Promise<void>
  onUpdateDeposit: (newValue: number | null) => Promise<void>
  onUpdateSalePriceLot: (newValue: number | null) => Promise<void>
  onUpdatePurchaseDate: (date: string) => Promise<void>
}

function ValeurCard({
  object, estimating, editingUserValue, userValueDraft,
  onEstimate, onEditUserValue, onUserValueChange, onUserValueCommit,
  onClearMarketValue, onUpdateMarketValue,
  onUpdatePurchasePrice, onUpdateSalePrice, onUpdateDeposit,
  onUpdateSalePriceLot, onUpdatePurchaseDate,
}: ValeurCardProps) {
  const { t, i18n } = useTranslation()
  const currency = object.value_currency ?? 'EUR'
  const currSym = currency === 'EUR' ? '€' : currency
  const sources = object.value_sources
  const confidence = sources?.confidence ?? 'medium'

  // Prix d'achat / vente / caution (champs libres persistés)
  const [editingPurchase, setEditingPurchase] = useState(false)
  const [purchaseDraft, setPurchaseDraft] = useState('')
  const [savingPurchase, setSavingPurchase] = useState(false)
  const [editingSale, setEditingSale] = useState(false)
  const [saleDraft, setSaleDraft] = useState('')
  const [savingSale, setSavingSale] = useState(false)
  const [editingDeposit, setEditingDeposit] = useState(false)
  const [depositDraft, setDepositDraft] = useState('')
  const [savingDeposit, setSavingDeposit] = useState(false)
  const [editingDiscount, setEditingDiscount] = useState(false)
  const [discountDraft, setDiscountDraft] = useState('')
  const [savingLot, setSavingLot] = useState(false)
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  // Brief V4 : le détail (estimation, achat, valeur marché) se replie.
  const [detailOpen, setDetailOpen] = useState(false)

  async function commitPurchase() {
    setEditingPurchase(false)
    const raw = purchaseDraft.trim()
    const parsed = raw === '' ? null : parseFloat(raw.replace(',', '.'))
    if (parsed !== null && (isNaN(parsed) || parsed < 0)) return
    if (parsed === (object.purchase_price ?? null)) return
    setSavingPurchase(true)
    await onUpdatePurchasePrice(parsed)
    setSavingPurchase(false)
  }

  async function commitSale() {
    setEditingSale(false)
    const raw = saleDraft.trim()
    const parsed = raw === '' ? null : parseFloat(raw.replace(',', '.'))
    if (parsed !== null && (isNaN(parsed) || parsed < 0)) return
    if (parsed === (object.sale_price ?? null)) return
    setSavingSale(true)
    await onUpdateSalePrice(parsed)
    setSavingSale(false)
  }

  /**
   * La remise se saisit, mais c'est le PRIX FINAL du lot qui est stocké.
   * L'unitaire reste intact, et décocher suffit à rendre le total dérivé —
   * il n'y a jamais deux montants qui peuvent se contredire.
   */
  async function commitDiscount() {
    setEditingDiscount(false)
    const raw = discountDraft.trim()
    const parsed = raw === '' ? 0 : parseFloat(raw.replace(',', '.'))
    if (isNaN(parsed) || parsed < 0) return
    const base = lotTotal(object.sale_price, quantity) ?? 0
    const next = Math.max(0, base - parsed)
    if (next === (object.sale_price_lot ?? null)) return
    setSavingLot(true)
    await onUpdateSalePriceLot(next)
    setSavingLot(false)
  }

  async function toggleDiscount() {
    if (object.sale_price == null) return
    setSavingLot(true)
    await onUpdateSalePriceLot(hasDiscount ? null : lotTotal(object.sale_price, quantity) ?? 0)
    setSavingLot(false)
  }

  async function commitDeposit() {
    setEditingDeposit(false)
    const raw = depositDraft.trim()
    const parsed = raw === '' ? null : parseFloat(raw.replace(',', '.'))
    if (parsed !== null && (isNaN(parsed) || parsed < 0)) return
    if (parsed === (object.deposit_amount ?? null)) return
    setSavingDeposit(true)
    await onUpdateDeposit(parsed)
    setSavingDeposit(false)
  }

  const depreciation = (object.user_value != null && object.purchase_price != null && object.purchase_price > 0)
    ? Math.round(((object.user_value - object.purchase_price) / object.purchase_price) * 100)
    : null

  // La quantité se règle en tête de fiche, dans la grille d'informations ;
  // ici elle ne sert plus qu'à dériver les totaux sous chaque montant.
  const quantity = object.quantity ?? 1

  /** Écart à l'estimation IA, en pourcentage. */
  const vsAi = (object.user_value != null && object.market_value != null && object.market_value > 0)
    ? Math.round(((object.user_value - object.market_value) / object.market_value) * 100)
    : null

  /** Prix du lot : dérivé, sauf remise explicite. */
  const lotSale = object.sale_price_lot ?? lotTotal(object.sale_price, quantity) ?? 0
  const hasDiscount = object.sale_price_lot != null
  const discountValue = Math.max(0, (lotTotal(object.sale_price, quantity) ?? 0) - lotSale)

  /** Ancienneté : déduite de la date d'achat, jamais saisie. */
  const age = (() => {
    if (!object.purchase_date) return null
    const months = Math.max(
      0,
      Math.round((Date.now() - new Date(object.purchase_date).getTime()) / (1000 * 60 * 60 * 24 * 30.44)),
    )
    if (months < 1) return t('object.value.ageNew')
    if (months < 12) return t('object.value.ageMonths', { count: months })
    return t('object.value.ageYears', { count: Math.floor(months / 12) })
  })()

  return (
    <>
      <View style={vc.card}>
        {/* ── En tête : le prix de vente définitif (brief V4) ── */}
        <View style={[vc.section, { gap: 0 }]}>
          {/* Prix de vente */}
          <TouchableOpacity
            style={vc.amountRow}
            onPress={() => { setSaleDraft(object.sale_price != null ? String(object.sale_price) : ''); setEditingSale(true) }}
            activeOpacity={0.7}
          >
            <View style={vc.amountLabelWrap}>
              <Text style={vc.amountLabel}>{t('object.value.salePrice')}</Text>
            </View>
            {editingSale ? (
              <TextInput
                style={vc.amountInput}
                value={saleDraft}
                onChangeText={setSaleDraft}
                onBlur={commitSale}
                onSubmitEditing={commitSale}
                keyboardType="decimal-pad"
                autoFocus
                returnKeyType="done"
                placeholder="0"
                placeholderTextColor={Colors.textTertiary}
                selectTextOnFocus
              />
            ) : savingSale ? (
              <ActivityIndicator size="small" color={Colors.accent} />
            ) : object.sale_price != null ? (
              <View style={vc.amountValueWrap}>
                <Text style={vc.amountValue}>{object.sale_price.toLocaleString(i18n.language)} {currSym}</Text>
              </View>
            ) : (
              <Text style={vc.amountPlaceholder}>{t('object.value.enter')}</Text>
            )}
          </TouchableOpacity>

          {/* Prix du lot — dès 2 exemplaires. Calculé par défaut, donc
              toujours affiché : c'est ce que rapporte la vente, pas une
              option. La remise ne se saisit que si on la demande. */}
          {isLot(quantity) && (
            <>
              <View style={vc.amountRow}>
                <View style={vc.amountLabelWrap}>
                  <Text style={vc.amountLabel}>{t('object.value.salePriceLot')}</Text>
                  <Text style={vc.amountHint}>
                    {t('object.value.salePriceLotBase', {
                      count: quantity,
                      unit: (object.sale_price ?? 0).toLocaleString(i18n.language),
                      sym: currSym,
                    })}
                  </Text>
                </View>
                <Text style={vc.amountValue}>
                  {lotSale.toLocaleString(i18n.language)} {currSym}
                </Text>
              </View>

              {/* La remise est stockée comme prix final du lot : l'unitaire
                  n'est jamais réécrit, et décocher rend le calcul dérivé. */}
              <TouchableOpacity
                style={vc.checkRow}
                onPress={toggleDiscount}
                activeOpacity={0.7}
                disabled={object.sale_price == null}
              >
                <Checkbox checked={hasDiscount} onToggle={toggleDiscount} />
                <Text style={[vc.checkLabel, object.sale_price == null && vc.checkLabelOff]}>
                  {t('object.value.applyLotDiscount')}
                </Text>
              </TouchableOpacity>

              {hasDiscount && (
                <TouchableOpacity
                  style={vc.amountRow}
                  onPress={() => { setDiscountDraft(String(discountValue)); setEditingDiscount(true) }}
                  activeOpacity={0.7}
                >
                  <View style={vc.amountLabelWrap}>
                    <Text style={vc.amountLabel}>{t('object.value.lotDiscount')}</Text>
                    <Text style={vc.amountHint}>{t('object.value.lotDiscountHint')}</Text>
                  </View>
                  {editingDiscount ? (
                    <TextInput
                      style={vc.amountInput}
                      value={discountDraft}
                      onChangeText={setDiscountDraft}
                      onBlur={commitDiscount}
                      onSubmitEditing={commitDiscount}
                      keyboardType="decimal-pad"
                      autoFocus
                      returnKeyType="done"
                      placeholder="0"
                      placeholderTextColor={Colors.textTertiary}
                      selectTextOnFocus
                    />
                  ) : savingLot ? (
                    <ActivityIndicator size="small" color={Colors.accent} />
                  ) : (
                    <View style={vc.amountValueWrap}>
                      <Text style={vc.amountValue}>− {discountValue.toLocaleString(i18n.language)} {currSym}</Text>
                      <Text style={vc.lotTotal}>
                        {t('object.value.lotFinal', {
                          total: lotSale.toLocaleString(i18n.language),
                          sym: currSym,
                        })}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        <View style={vc.divider} />

        {/* ── Détail de la valeur : replié par défaut. Il s'ouvre dans le
             flux et pousse la suite vers le bas, sans panneau par-dessus. ── */}
        <TouchableOpacity
          style={vc.amountRow}
          onPress={() => setDetailOpen(o => !o)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityState={{ expanded: detailOpen }}
        >
          <View style={vc.amountLabelWrap}>
            <Text style={vc.amountLabel}>{t('object.value.detail')}</Text>
            <Text style={vc.amountHint}>{t('object.value.detailHint')}</Text>
          </View>
          {detailOpen
            ? <ChevronUp size={18} color={Colors.textSecondary} strokeWidth={2} />
            : <ChevronDown size={18} color={Colors.textSecondary} strokeWidth={2} />}
        </TouchableOpacity>

        {detailOpen && (
          <>
            <View style={vc.divider} />

        {/* ── Section 1 : Valeur estimée (utilisateur) ── */}
        <TouchableOpacity style={vc.estimationRow} onPress={onEditUserValue} activeOpacity={0.7}>
          {/* Gauche : label + diff IA */}
          <View style={vc.estimationLeft}>
            <Text style={vc.amountLabel}>{t('object.value.estimation')}</Text>
            {/* Les deux comparaisons se lisent ensemble : même gabarit,
                empilées, alignées à gauche sous le libellé. */}
            {(vsAi != null || depreciation != null) && (
              <View style={vc.diffStack}>
                {vsAi != null && <DiffBadge pct={vsAi} label={t('object.value.vsAi')} />}
                {depreciation != null && <DiffBadge pct={depreciation} label={t('object.value.vsPurchase')} />}
              </View>
            )}
          </View>

          {/* Droite : montant + badge achat */}
          <View style={vc.estimationRight}>
            {editingUserValue ? (
              <TextInput
                style={vc.valueInput}
                value={userValueDraft}
                onChangeText={onUserValueChange}
                onBlur={onUserValueCommit}
                onSubmitEditing={onUserValueCommit}
                keyboardType="decimal-pad"
                autoFocus
                returnKeyType="done"
                placeholder="0"
                placeholderTextColor={Colors.textTertiary}
              />
            ) : object.user_value != null ? (
              <View style={vc.amountValueWrap}>
                <Text style={vc.valueText}>{object.user_value.toLocaleString(i18n.language)} {currSym}</Text>
                <LotTotalHint unit={object.user_value} quantity={quantity} currSym={currSym} />
              </View>
            ) : (
              <Text style={vc.valuePlaceholder}>{t('object.value.enter')}</Text>
            )}
          </View>
        </TouchableOpacity>

        <View style={vc.divider} />

        {/* ── Section 2 : Achat (prix, date, ancienneté) ──
             Remontée avant la valeur marché : c'est le point de départ
             chronologique de l'objet, et la référence à laquelle
             l'estimation se compare. */}
        <View style={[vc.section, { gap: 0 }]}>
          <TouchableOpacity
            style={vc.amountRow}
            onPress={() => { setPurchaseDraft(object.purchase_price != null ? String(object.purchase_price) : ''); setEditingPurchase(true) }}
            activeOpacity={0.7}
          >
            <View style={vc.amountLabelWrap}>
              <Text style={vc.amountLabel}>{t('object.value.purchasePrice')}</Text>
            </View>
            {editingPurchase ? (
              <TextInput
                style={vc.amountInput}
                value={purchaseDraft}
                onChangeText={setPurchaseDraft}
                onBlur={commitPurchase}
                onSubmitEditing={commitPurchase}
                keyboardType="decimal-pad"
                autoFocus
                returnKeyType="done"
                placeholder="0"
                placeholderTextColor={Colors.textTertiary}
                selectTextOnFocus
              />
            ) : savingPurchase ? (
              <ActivityIndicator size="small" color={Colors.accent} />
            ) : object.purchase_price != null ? (
              <View style={vc.amountValueWrap}>
                <Text style={vc.amountValue}>{object.purchase_price.toLocaleString(i18n.language)} {currSym}</Text>
              </View>
            ) : (
              <Text style={vc.amountPlaceholder}>{t('object.value.enter')}</Text>
            )}
          </TouchableOpacity>

          {/* Date d'achat */}
          <TouchableOpacity style={vc.amountRow} onPress={() => setDatePickerOpen(true)} activeOpacity={0.7}>
            <View style={vc.amountLabelWrap}>
              <Text style={vc.amountLabel}>{t('object.value.purchaseDate')}</Text>
            </View>
            <View style={vc.amountValueWrap}>
              {object.purchase_date ? (
                <>
                  <Text style={vc.amountValueSm}>{formatDate(object.purchase_date, i18n.language)}</Text>
                  {/* L'ancienneté n'est pas une donnée : elle se déduit,
                      donc elle se lit comme une conséquence de la date. */}
                  {age && <Text style={vc.lotTotal}>{t('object.value.agePrefix', { age })}</Text>}
                </>
              ) : (
                <Text style={vc.amountPlaceholder}>{t('object.value.enter')}</Text>
              )}
            </View>
          </TouchableOpacity>
        </View>

        <View style={vc.divider} />

        {/* ── Section 3 : Valeur marché (IA) ── */}
        <MarketValueSection
          object={object}
          estimating={estimating}
          sources={sources}
          confidence={confidence}
          currSym={currSym}
          onEstimate={onEstimate}
          onClearMarketValue={onClearMarketValue}
          onUpdateMarketValue={onUpdateMarketValue}
        />

          </>
        )}

        <View style={vc.divider} />

        {/* ── Section 5 : Caution ── */}
        <View style={[vc.section, { gap: 0 }]}>
          {/* Caution */}
          <TouchableOpacity
            style={vc.amountRow}
            onPress={() => { setDepositDraft(object.deposit_amount != null ? String(object.deposit_amount) : ''); setEditingDeposit(true) }}
            activeOpacity={0.7}
          >
            <View style={vc.amountLabelWrap}>
              <Text style={vc.amountLabel}>
                {isLot(quantity) ? t('object.value.depositPerItem') : t('object.value.deposit')}
              </Text>
              <Text style={vc.amountHint}>{t('object.value.depositHint')}</Text>
            </View>
            {editingDeposit ? (
              <TextInput
                style={vc.amountInput}
                value={depositDraft}
                onChangeText={setDepositDraft}
                onBlur={commitDeposit}
                onSubmitEditing={commitDeposit}
                keyboardType="decimal-pad"
                autoFocus
                returnKeyType="done"
                placeholder="0"
                placeholderTextColor={Colors.textTertiary}
                selectTextOnFocus
              />
            ) : savingDeposit ? (
              <ActivityIndicator size="small" color={Colors.accent} />
            ) : object.deposit_amount != null ? (
              <View style={vc.amountValueWrap}>
                <Text style={vc.amountValue}>{object.deposit_amount.toLocaleString(i18n.language)} {currSym}</Text>
              </View>
            ) : (
              <Text style={vc.amountPlaceholder}>{t('object.value.enter')}</Text>
            )}
          </TouchableOpacity>

          {/* Caution du lot : dérivée, non saisissable. Personne ne négocie
              une caution dégressive — si le besoin apparaît, ce sera une
              colonne dédiée, comme pour le prix du lot. */}
          {isLot(quantity) && object.deposit_amount != null && (
            <View style={vc.amountRow}>
              <View style={vc.amountLabelWrap}>
                <Text style={vc.amountLabel}>{t('object.value.depositLot')}</Text>
                <Text style={vc.amountHint}>
                  {t('object.value.depositLotHint', {
                    count: quantity,
                    unit: object.deposit_amount.toLocaleString(i18n.language),
                    sym: currSym,
                  })}
                </Text>
              </View>
              <Text style={vc.amountValue}>
                {lotTotal(object.deposit_amount, quantity)!.toLocaleString(i18n.language)} {currSym}
              </Text>
            </View>
          )}
        </View>

        {datePickerOpen && (
          <DateTimePicker
            value={object.purchase_date ? new Date(object.purchase_date) : new Date()}
            mode="date"
            display="spinner"
            locale={i18n.language}
            maximumDate={new Date()}
            onChange={(_, selected) => {
              setDatePickerOpen(false)
              if (selected) onUpdatePurchaseDate(selected.toISOString().split('T')[0])
            }}
          />
        )}
      </View>
    </>
  )
}


const vc = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: Spacing.sm },

  section: { paddingHorizontal: Spacing.md, gap: Spacing.xs },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  clearBtn: { fontSize: Typography.sm, color: Colors.textTertiary, paddingHorizontal: 2 },
  showMore: { fontSize: Typography.xs, color: Colors.accent, fontWeight: Typography.medium, marginTop: 2 },
  sectionLabel: { fontSize: Typography.xs, color: Colors.textTertiary, fontWeight: Typography.semibold, letterSpacing: 0.5, textTransform: 'uppercase' },
  editLink: { fontSize: Typography.sm, color: Colors.accent, fontWeight: Typography.semibold },
  confidenceBadge: { fontSize: Typography.xs, fontWeight: Typography.medium },

  // Valeur estimée
  // Estimation row (label gauche / montant droite sur même ligne)
  // Même rythme vertical que `amountRow` : la ligne d'estimation n'est pas
  // une section à part, c'est la première ligne de la carte.
  estimationRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
  },
  estimationLeft: { flex: 1, gap: 4 },
  estimationRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  diffStack: { alignSelf: 'flex-start', gap: 3 },

  manualRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  manualHint: { flex: 1, fontSize: Typography.sm, color: Colors.textSecondary },
  valueText: { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary },
  valuePlaceholder: { fontSize: Typography.base, color: Colors.textTertiary, fontStyle: 'italic' },
  valueInput: {
    fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary,
    borderBottomWidth: 2, borderBottomColor: Colors.accent,
    paddingVertical: 2, minWidth: 80, textAlign: 'right',
  },
  diffBadge: {
    flexDirection: 'row', alignItems: 'baseline', gap: 4,
    alignSelf: 'flex-start',
    borderRadius: Radius.sm, paddingHorizontal: 6, paddingVertical: 3,
  },
  diffBadgeText: { fontSize: Typography.xs, fontWeight: Typography.bold },
  diffBadgeSubtext: { fontSize: 9, fontWeight: Typography.medium, opacity: 0.75 },
  diffHint: { fontSize: Typography.xs, fontWeight: Typography.medium },

  // IA
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 4 },
  loadingText: { fontSize: Typography.sm, color: Colors.textSecondary, fontStyle: 'italic' },
  iaValue: { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary },
  iaValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm, flexWrap: 'wrap' },
  iaValueHint: { fontSize: Typography.xs, color: Colors.textTertiary },
  marketValueInput: {
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.accent,
    minWidth: 80,
    paddingVertical: 2,
  },
  range: { fontSize: Typography.xs, color: Colors.textTertiary },
  summary: { fontSize: Typography.sm, color: Colors.textSecondary, lineHeight: Typography.sm * 1.5 },
  sourcesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  sourceChip: {
    backgroundColor: Colors.background, borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  sourceChipLink: { flexDirection: 'row', alignItems: 'center', gap: 5, borderColor: Colors.accentLight },
  sourceChipText: { fontSize: Typography.xs, color: Colors.textSecondary },
  footerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, marginTop: 4 },
  footerDeleteBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  refreshText: { fontSize: Typography.sm, color: Colors.textTertiary },
  deleteText: { fontSize: Typography.sm, color: Colors.error },
  marketActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  marketActionBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: Radius.md,
  },
  marketActionEdit: { backgroundColor: '#DBEAFE' },
  marketActionRefresh: { backgroundColor: '#DCFCE7' },
  marketActionDelete: { backgroundColor: '#FEE2E2' },
  marketActionText: { fontSize: Typography.xs, fontWeight: Typography.semibold },

  // Valeur marché — compacte + drawer
  marketLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoBtn: { padding: 2 },
  marketEstimateLink: { fontSize: Typography.sm, color: Colors.accent, fontWeight: Typography.semibold },
  infoDrawer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: Spacing.lg, paddingBottom: 40, maxHeight: '80%',
  },
  infoHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  infoTitle: { fontSize: Typography.md, fontWeight: Typography.bold, color: Colors.textPrimary },
  infoValue: { fontSize: Typography.xxl, fontWeight: Typography.bold, color: Colors.textPrimary },
  infoActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },

  // Prix de vente / caution
  amountRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: Spacing.sm, paddingVertical: Spacing.sm,
  },
  amountLabelWrap: { flex: 1 },
  amountLabel: { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: Typography.medium },
  amountHint: { fontSize: Typography.xs, color: Colors.textTertiary, marginTop: 2 },
  amountValue: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },
  amountValueWrap: { alignItems: 'flex-end', gap: 1 },
  checkRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  checkLabel: { flex: 1, fontSize: Typography.sm, color: Colors.textSecondary },
  checkLabelOff: { color: Colors.textTertiary },
  // Une date n'est pas un montant : même ligne, poids moindre.
  amountValueSm: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },

  // ── Quantité ──────────────────────────────────────────────────────────────
  /** Total du lot : dérivé, donc visuellement subordonné au montant unitaire. */
  lotTotal: {
    fontSize: Typography.xs,
    color: Colors.textTertiary,
    fontWeight: Typography.regular,
  },
  amountPlaceholder: { fontSize: Typography.base, color: Colors.textTertiary, fontStyle: 'italic' },
  amountInput: {
    fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary,
    borderBottomWidth: 1.5, borderBottomColor: Colors.accent,
    minWidth: 80, paddingVertical: 2, textAlign: 'right',
  },

  // CTA
  estimateBtn: {
    backgroundColor: Colors.accentLight, borderRadius: Radius.md,
    paddingVertical: 11, alignItems: 'center', marginTop: 4,
  },
  estimateBtnText: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.accent },

  // Assurance rows
  rows: { gap: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLabel: { fontSize: Typography.sm, color: Colors.textSecondary },
  rowValue: { fontSize: Typography.sm, color: Colors.textPrimary, fontWeight: Typography.medium, textAlign: 'right', flex: 1, marginLeft: Spacing.sm },

  // Sheet
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: { backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, maxHeight: '85%' },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginTop: 12, marginBottom: 4 },
  sheetContent: { padding: Spacing.lg, gap: Spacing.sm, paddingBottom: 40 },
  sheetTitle: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  fieldLabel: { fontSize: Typography.xs, color: Colors.textTertiary, fontWeight: Typography.semibold, letterSpacing: 0.5, marginTop: Spacing.xs },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    fontSize: Typography.base, color: Colors.textPrimary, backgroundColor: Colors.background,
  },
  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 10, backgroundColor: Colors.background,
  },
  dateBtnText: { flex: 1, fontSize: Typography.base, color: Colors.textPrimary },
  datePlaceholder: { color: Colors.textTertiary },
  dateClear: { fontSize: 18, color: Colors.textTertiary, lineHeight: 20 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.xs },
  saveBtn: { backgroundColor: Colors.accent, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center', marginTop: Spacing.md },
  saveBtnText: { color: 'white', fontSize: Typography.base, fontWeight: Typography.bold },
})

// ── Écran principal ───────────────────────────────────────────────────────────

export default function ObjectScreen() {
  /**
   * `focusTitle` : la fiche vient d'être créée sans IA. Le titre est le seul
   * champ qui manque encore, on ouvre donc directement sa saisie.
   */
  const { id, focusTitle } = useLocalSearchParams<{ id: string; focusTitle?: string }>()
  const router = useRouter()
  const { t, i18n } = useTranslation()
  const { showToast } = useToast()

  const [object, setObject] = useState<TiroirObject | null>(null)
  // Miroir de `object` — voir saveField. Resynchronisé après chaque rendu pour couvrir
  // les setObject qui ne passent pas par saveField (chargement, valeur, assurance…).
  const objectRef = useRef<TiroirObject | null>(null)
  useEffect(() => { objectRef.current = object }, [object])
  const [images, setImages] = useState<ObjectImage[]>([])
  const [documents, setDocuments] = useState<ObjectDocument[]>([])
  const [allCollections, setAllCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Titre
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const titleFocusHandled = useRef(false)

  // Une seule fois, à l'arrivée depuis une création sans IA : le clavier
  // s'ouvre sur le titre dès que l'objet est chargé.
  useEffect(() => {
    if (focusTitle !== '1' || !object || titleFocusHandled.current) return
    titleFocusHandled.current = true
    startEditTitle(true)
  }, [focusTitle, object])

  // Description
  const [editingDesc, setEditingDesc] = useState(false)
  const [descDraft, setDescDraft] = useState('')

  // Attributs
  const [editingAttrKey, setEditingAttrKey] = useState<string | null>(null)
  const [attrDraft, setAttrDraft] = useState('')

  // Valeur
  const [estimating, setEstimating] = useState(false)
  const [editingUserValue, setEditingUserValue] = useState(false)
  const [userValueDraft, setUserValueDraft] = useState('')
  const [menuVisible, setMenuVisible] = useState(false)
  const [sharePanelVisible, setSharePanelVisible] = useState(false)

  // Statut / Collection
  const [showStatusPicker, setShowStatusPicker] = useState(false)
  /** La collection se choisit en feuille basse — même composant que les
   *  parcours d'ajout, donc la même liste, le même tri, la même création
   *  à la volée. Un dropdown de puces ne montrait ni les icônes ni les
   *  compteurs, et devenait illisible passé une dizaine de collections. */
  const [collectionSheetOpen, setCollectionSheetOpen] = useState(false)
  const [statusPickerMounted, setStatusPickerMounted] = useState(false)
  const statusPickerAnim = useRef(new Animated.Value(0)).current
  const [metricsRowHeight, setMetricsRowHeight] = useState(0)

  // Les dropdowns sont en position absolue et débordent sous la rangée : tant qu'ils sont
  // montés ils captent les taps des cartes du dessous. On les démonte en fin de fermeture.
  function animatePicker(
    anim: Animated.Value,
    opening: boolean,
    setMounted: (v: boolean) => void,
  ) {
    if (opening) setMounted(true)
    Animated.spring(anim, { toValue: opening ? 1 : 0, useNativeDriver: true, damping: 22, mass: 0.8 })
      .start(({ finished }) => { if (!opening && finished) setMounted(false) })
  }

  function toggleStatusPicker() {
    const opening = !showStatusPicker
    setShowStatusPicker(opening)
    animatePicker(statusPickerAnim, opening, setStatusPickerMounted)
  }

  // Emplacement
  const [locationBricks, setLocationBricks] = useState<string[]>([])
  const [locationSheetOpen, setLocationSheetOpen] = useState(false)

  useFocusEffect(
    useCallback(() => {
      if (!id) return
      loadObject(id)
    }, [id])
  )

  async function loadObject(objectId: string) {
    setLoading(true)
    const [objRes, imgRes, docRes, colRes] = await Promise.all([
      supabase.from('objects').select('*').eq('id', objectId).single(),
      supabase.from('object_images').select('*').eq('object_id', objectId).order('position'),
      supabase.from('object_documents').select('*').eq('object_id', objectId).order('position'),
      supabase.from('collections').select('*').order('name'),
    ])
    if (objRes.error) { setLoading(false); return }
    const obj = objRes.data as TiroirObject
    setObject(obj)
    setImages((imgRes.data as ObjectImage[]) ?? [])
    setDocuments((docRes.data as ObjectDocument[]) ?? [])
    setAllCollections((colRes.data as Collection[]) ?? [])
    setLocationBricks(parseBricks(obj.location_note))
    setLoading(false)
  }

  // ── Save helper ─────────────────────────────────────────────────────────────

  async function saveField(updates: Partial<TiroirObject>, silentObj?: TiroirObject): Promise<boolean> {
    // objectRef, tenu à jour de façon synchrone, sert de base : deux saveField enchaînés
    // avant le retour du RPC (ex. nom du prêt puis date de retour) partageraient sinon
    // le même `object` périmé, et le second écraserait le premier.
    const base = silentObj ?? objectRef.current ?? object
    if (!base) return false
    const merged: TiroirObject = { ...base, ...updates }
    objectRef.current = merged
    setSaving(true)
    const { error } = await supabase.rpc('patch_object', {
      p_object_id: merged.id,
      p_title: merged.title,
      p_description: merged.description ?? null,
      p_location_note: merged.location_note ?? null,
      p_collection_id: merged.collection_id ?? null,
      p_status: merged.status,
      p_attributes: merged.attributes ?? {},
    })
    setSaving(false)
    if (error) {
      Alert.alert(t('common.error'), error.message)
      return false
    }
    setObject(merged)
    return true
  }

  // ── Description ─────────────────────────────────────────────────────────────

  /**
   * `blank` : on part d'un champ vide plutôt que du titre provisoire
   * (« Nouvel objet »), pour que l'utilisateur tape au lieu d'effacer.
   * Un champ laissé vide est ignoré par commitTitle, le titre provisoire
   * survit donc si l'utilisateur passe son chemin.
   */
  function startEditTitle(blank = false) {
    setTitleDraft(blank ? '' : object?.title ?? '')
    setEditingTitle(true)
  }

  function commitTitle() {
    setEditingTitle(false)
    const val = titleDraft.trim()
    if (!val || val === object?.title) return // titre obligatoire : on ignore le vide
    saveField({ title: val })
  }

  function startEditDesc() {
    setDescDraft(object?.description ?? '')
    setEditingDesc(true)
  }

  /**
   * Actions du bloc « Résumé IA ».
   *
   * Toutes passent par le menu : ouvrir puis choisir est déjà un geste
   * délibéré, inutile d'y ajouter une confirmation — sauf pour la
   * suppression, seule action qui ne laisse rien derrière elle.
   */
  const [describing, setDescribing] = useState(false)
  const [summaryMenuVisible, setSummaryMenuVisible] = useState(false)

  async function copyDescription() {
    const text = object?.description?.trim()
    if (!text) return
    await Clipboard.setStringAsync(text)
    showToast(t('object.summaryCopied'))
  }

  function deleteDescription() {
    Alert.alert(t('object.summaryDeleteTitle'), t('object.summaryDeleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => saveField({ description: null }),
      },
    ])
  }

  /** Options du menu, réduites à ce qui a du sens : sans description,
   *  copier, modifier et supprimer n'ont rien sur quoi agir. */
  function summaryMenuOptions() {
    const hasDescription = Boolean(object?.description?.trim())
    // Build hackathon : pas de rédaction par l'IA historique.
    const ai = (label: string) => (LEGACY_AI_ENABLED ? [{ label, onPress: runDescribe }] : [])
    if (!hasDescription) {
      return [
        ...ai(t('object.summaryGenerate')),
        { label: t('object.summaryWrite'), onPress: startEditDesc },
        { label: t('common.cancel'), onPress: () => {}, cancel: true },
      ]
    }
    return [
      ...ai(t('object.summaryRegenerate')),
      { label: t('object.summaryCopy'), onPress: copyDescription },
      { label: t('object.summaryEdit'), onPress: startEditDesc },
      { label: t('object.summaryDelete'), onPress: deleteDescription, destructive: true },
      { label: t('common.cancel'), onPress: () => {}, cancel: true },
    ]
  }

  async function runDescribe() {
    setDescribing(true)
    try {
      const { data, error: fnError } = await invokeAI('describe-object', {
        body: { object_id: id, locale: i18n.language },
      })
      if (fnError) throw await functionError(fnError)
      if (data?.error) throw new Error(data.error.message ?? data.error.code)

      // La fonction a déjà écrit en base : on aligne l'écran plutôt que
      // de renvoyer une seconde écriture derrière.
      setObject(prev => prev ? ({ ...prev, description: data.description } as TiroirObject) : prev)
    } catch (e) {
      if (isCreditsRefusal(e)) offerCredits(router, t, (e as Error).message)
      else Alert.alert(t('common.error'), e instanceof Error ? e.message : String(e))
    } finally {
      setDescribing(false)
    }
  }

  function commitDesc() {
    setEditingDesc(false)
    const val = descDraft.trim() || null
    if (val === (object?.description ?? null)) return
    saveField({ description: val })
  }

  // ── Attributs ───────────────────────────────────────────────────────────────

  function startEditAttr(key: string) {
    setAttrDraft(String(object?.attributes?.[key] ?? ''))
    setEditingAttrKey(key)
  }

  function commitAttr() {
    if (!editingAttrKey || !object) { setEditingAttrKey(null); return }
    const val = attrDraft.trim()
    const current = String(object.attributes?.[editingAttrKey] ?? '')
    setEditingAttrKey(null)
    if (val === current) return
    const newAttrs = { ...object.attributes }
    if (val === '') {
      delete newAttrs[editingAttrKey]
    } else {
      newAttrs[editingAttrKey] = val
    }
    saveField({ attributes: newAttrs })
  }

  // ── Statut ──────────────────────────────────────────────────────────────────

  function handleStatusChange(value: string) {
    setShowStatusPicker(false)
    if (value === object?.status) return
    saveField({ status: value as TiroirObject['status'] })
  }

  // ── Collection ──────────────────────────────────────────────────────────────

  function handleCollectionChange(picked: PickedCollection | null) {
    setCollectionSheetOpen(false)
    if ((picked?.id ?? null) === (object?.collection_id ?? null)) return

    // La feuille sait créer une collection à la volée : sans ça, la carte
    // afficherait « — » jusqu'au prochain chargement de l'écran.
    if (picked && !allCollections.some(c => c.id === picked.id)) {
      setAllCollections(prev => [...prev, { id: picked.id, name: picked.name } as Collection])
    }

    saveField({ collection_id: picked?.id ?? null }).then(ok => {
      // Après l'écriture, pas avant : la feuille se referme aussitôt, sans
      // ce mot rien ne dirait où l'objet a atterri.
      if (!ok) return
      showToast(picked
        ? t('object.collectionMoved', { name: picked.name })
        : t('object.collectionRemoved'))
    })
  }

  // ── Emplacement ─────────────────────────────────────────────────────────────

  /**
   * Une seule écriture, à la validation du tiroir. L'édition puce par puce
   * enregistrait à chaque frappe : on ne pouvait ni réorganiser ni se
   * raviser sans laisser de trace en base.
   */
  function saveLocation(bricks: string[]) {
    setLocationSheetOpen(false)
    setLocationBricks(bricks)
    const note = joinBricks(bricks)
    if (note !== object?.location_note) saveField({ location_note: note })
  }

  // ── Estimation valeur ────────────────────────────────────────────────────────

  async function requestEstimate() {
    if (!object || estimating) return
    setEstimating(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error(t('documents.notAuthenticated'))
      const res = await invokeAI('estimate-value', {
        body: { object_id: object.id },
      })
      // Le motif vit dans le corps de la réponse : `invoke` ne rend qu'un
      // « non-2xx status code ».
      if (res.error) throw await functionError(res.error)
      if (res.data?.error) throw new Error(res.data.error.message ?? res.data.error.code)
      const est = res.data
      setObject(prev => prev ? {
        ...prev,
        market_value: est.market_value,
        value_currency: est.currency ?? '€',
        value_estimated_at: new Date().toISOString(),
        value_sources: {
          sources: est.sources ?? [],
          confidence: est.confidence ?? 'medium',
          value_min: est.value_min,
          value_max: est.value_max,
          summary: est.summary,
        },
      } : prev)
    } catch (err) {
      const message = err instanceof Error ? err.message : t('object.estimateFailed')
      // Au plafond, l'erreur seule laisserait l'utilisateur sans issue :
      // on lui montre la sortie plutôt que le mur.
      if (isCreditsRefusal(err)) {
        offerCredits(router, t, message)
      } else if (/quota/i.test(message)) {
        Alert.alert(t('object.value.quotaTitle'), t('object.value.quotaBody'), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('object.value.quotaUpgrade'), onPress: () => router.push('/paywall') },
        ])
      } else {
        Alert.alert(t('common.error'), message)
      }
    } finally {
      setEstimating(false)
    }
  }

  async function commitUserValue() {
    setEditingUserValue(false)
    if (!object) return
    const num = parseFloat(userValueDraft.replace(',', '.'))
    if (isNaN(num) || num < 0) return
    const { error } = await supabase.from('objects').update({ user_value: num }).eq('id', object.id)
    if (!error) setObject(prev => prev ? { ...prev, user_value: num } : prev)
  }

  // ── Prix d'achat / assurance ─────────────────────────────────────────────────

  async function updatePurchasePrice(newValue: number | null) {
    if (!object) return
    const { error } = await supabase.from('objects').update({ purchase_price: newValue }).eq('id', object.id)
    if (error) { Alert.alert(t('common.error'), error.message); return }
    setObject(prev => prev ? ({ ...prev, purchase_price: newValue } as TiroirObject) : prev)
  }


  // ── Effacer valeur marché ────────────────────────────────────────────────────

  async function updateMarketValue(newValue: number) {
    if (!object) return
    // Conserver la valeur IA originale dans value_sources avant override
    const existingSources = object.value_sources
    const aiOriginal = existingSources?.ai_value ?? object.market_value ?? newValue
    const updatedSources = existingSources
      ? { ...existingSources, ai_value: aiOriginal }
      : null
    const { error } = await supabase.from('objects')
      .update({ market_value: newValue, value_sources: updatedSources })
      .eq('id', object.id)
    if (error) { Alert.alert(t('common.error'), error.message); return }
    setObject(prev => prev ? ({ ...prev, market_value: newValue, value_sources: updatedSources } as TiroirObject) : prev)
  }

  async function updateSalePrice(newValue: number | null) {
    if (!object) return
    const { error } = await supabase.from('objects').update({ sale_price: newValue }).eq('id', object.id)
    if (error) { Alert.alert(t('common.error'), error.message); return }
    setObject(prev => prev ? ({ ...prev, sale_price: newValue } as TiroirObject) : prev)
  }

  async function updateDeposit(newValue: number | null) {
    if (!object) return
    const { error } = await supabase.from('objects').update({ deposit_amount: newValue }).eq('id', object.id)
    if (error) { Alert.alert(t('common.error'), error.message); return }
    setObject(prev => prev ? ({ ...prev, deposit_amount: newValue } as TiroirObject) : prev)
  }

  /**
   * Écriture directe, comme les autres montants : le RPC patch_object porte
   * les champs descriptifs (titre, description, emplacement…), la quantité
   * appartient au bloc valeur.
   */
  async function updateQuantity(next: number) {
    if (!object) return
    const q = clampQuantity(next)
    if (q === object.quantity) return
    const { error } = await supabase.from('objects').update({ quantity: q }).eq('id', object.id)
    if (error) { Alert.alert(t('common.error'), error.message); return }
    setObject(prev => prev ? ({ ...prev, quantity: q } as TiroirObject) : prev)
  }

  async function updateSalePriceLot(newValue: number | null) {
    if (!object) return
    const { error } = await supabase.from('objects').update({ sale_price_lot: newValue }).eq('id', object.id)
    if (error) { Alert.alert(t('common.error'), error.message); return }
    setObject(prev => prev ? ({ ...prev, sale_price_lot: newValue } as TiroirObject) : prev)
  }

  async function updatePurchaseDate(date: string) {
    if (!object) return
    const { error } = await supabase.from('objects').update({ purchase_date: date }).eq('id', object.id)
    if (error) { Alert.alert(t('common.error'), error.message); return }
    setObject(prev => prev ? ({ ...prev, purchase_date: date } as TiroirObject) : prev)
  }

  async function clearMarketValue() {
    if (!object) return
    // NB : value_currency est NOT NULL en base → ne pas la mettre à null.
    const { error } = await supabase.from('objects')
      .update({ market_value: null, value_estimated_at: null, value_sources: null })
      .eq('id', object.id)
    if (error) { Alert.alert(t('common.error'), error.message); return }
    setObject(prev => prev ? ({ ...prev, market_value: null, value_estimated_at: null, value_sources: null } as TiroirObject) : prev)
  }

  // ── Menu ···  ────────────────────────────────────────────────────────────────

  function handleMoreMenu() {
    setMenuVisible(true)
  }

  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false)

  function confirmDelete() { setDeleteConfirmVisible(true) }

  async function executeDelete() {
    setDeleteConfirmVisible(false)
    const { data, error } = await supabase.rpc('delete_object', { p_object_id: id })
    if (error) { Alert.alert(t('common.error'), error.message); return }
    const paths: string[] = data?.storage_paths_to_delete ?? []
    if (paths.length > 0) await supabase.storage.from('object-images').remove(paths)
    router.back()
  }

  // ── Rendu ────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Screen>
        <View style={s.loader}><ActivityIndicator color={Colors.accent} /></View>
      </Screen>
    )
  }

  if (!object) {
    return (
      <Screen>
        <View style={s.loader}>
          <Text style={s.errorText}>{t('object.notFound')}</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={s.backLink}>{`← ${t('common.back')}`}</Text>
          </TouchableOpacity>
        </View>
      </Screen>
    )
  }

  const category = String(object.attributes?.category ?? '')
  const estimatedValue = object.attributes?.estimated_value
  const currency = String(object.attributes?.currency ?? '€')
  const currentCollection = allCollections.find(c => c.id === object.collection_id)
  const attributes = Object.entries(object.attributes ?? {}).filter(
    ([k, v]) => ATTR_LABELS[k] && v !== null && v !== ''
  )

  // Pas de zone sûre basse : la barre d'onglets applique déjà l'inset, et
  // l'ajouter ici figeait une bande beige qui rognait le défilement.
  return (
    <FormScreen mode="list" edges={['top']}>
      <FormScrollView style={{ flex: 1 }}>

        {/* ── Hero + overlay header ── */}
        <View style={{ position: 'relative' }}>
          <ImageSlider
            images={images}
            objectId={id!}
            onImagesChange={setImages}
          />
          <View style={s.heroOverlay}>
            <TouchableOpacity
              onPress={() => {
                if (object.collection_id) {
                  router.replace({ pathname: '/collections/[id]', params: { id: object.collection_id } })
                } else {
                  router.back()
                }
              }}
              style={s.circleBtn}
            >
              <ArrowLeft size={18} color={Colors.textPrimary} strokeWidth={2} />
            </TouchableOpacity>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
              {saving && <ActivityIndicator color={Colors.accent} size="small" />}
              <TouchableOpacity onPress={handleMoreMenu} style={s.circleBtn}>
                <MoreHorizontal size={18} color={Colors.textPrimary} strokeWidth={2} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={s.body}>

          {/* ── Titre + méta ── */}
          <View style={s.titleBlock}>
            {editingTitle ? (
              <TextInput
                style={s.titleInput}
                value={titleDraft}
                onChangeText={setTitleDraft}
                onBlur={commitTitle}
                onSubmitEditing={commitTitle}
                autoFocus
                multiline
                returnKeyType="done"
                blurOnSubmit
                placeholder={t('objectEdit.titlePlaceholder')}
                placeholderTextColor={Colors.textTertiary}
              />
            ) : (
              <TouchableOpacity onPress={() => startEditTitle()} activeOpacity={0.6}>
                <Text style={s.title}>{object.title}</Text>
              </TouchableOpacity>
            )}
            <View style={s.metaRow}>
              {category ? (
                <View style={s.badgeCat}>
                  <Text style={s.badgeCatText}>{category}</Text>
                </View>
              ) : null}
              <Text style={s.metaDate}>{t('object.addedOn', { date: formatDate(object.created_at, i18n.language) })}</Text>
            </View>
          </View>

          {/* ── Grille d'informations ──
              Résumé, Statut/Collection, Emplacement/Quantité forment une
              seule grille : même gouttière horizontale et verticale, pour
              qu'on lise un bloc et non quatre cartes posées à la suite. */}
          <View style={s.infoGrid}>

          {/* ── Résumé IA ── */}
          <View style={s.card}>
            <View style={s.cardHead}>
              {/* Le ✦ dit ce qu'est le bloc, il ne fait rien. Toutes les
                  actions passent par le ••• : un seul point d'entrée, et
                  plus deux crayons côte à côte qui se ressemblaient sans
                  faire la même chose. */}
              <TorixMark label={t('object.aiSummary')} textStyle={s.cardLabel} style={{ flex: 1 }} />
              <TouchableOpacity
                onPress={() => setSummaryMenuVisible(true)}
                disabled={describing}
                style={[s.summaryMenuBtn, describing && s.summaryMenuBtnOff]}
                hitSlop={8}
              >
                <MoreHorizontal size={16} color={Colors.textTertiary} strokeWidth={2} />
              </TouchableOpacity>
            </View>
            {describing ? (
              /* La rédaction prend trois secondes : le dire là où le texte
                 va apparaître, pas dans un coin de l'en-tête. */
              <View style={s.summaryWriting}>
                <ActivityIndicator size="small" color={Colors.accent} />
                <Text style={s.summaryWritingText}>{t('object.summaryWriting')}</Text>
              </View>
            ) : editingDesc ? (
              <TextInput
                style={s.descInput}
                value={descDraft}
                onChangeText={setDescDraft}
                onBlur={commitDesc}
                multiline
                autoFocus
                placeholder={t('object.descriptionPlaceholder')}
                placeholderTextColor={Colors.textTertiary}
                returnKeyType="done"
                blurOnSubmit
              />
            ) : (
              <DescriptionBlock
                text={object.description}
                onEdit={startEditDesc}
              />
            )}
          </View>


          {/* ── Statut + Collection côte à côte avec dropdowns ── */}
          <View
            style={[s.metricsRow, { zIndex: 10 }]}
            onLayout={e => setMetricsRowHeight(e.nativeEvent.layout.height)}
          >
            {/* Statut */}
            <TouchableOpacity
              style={[
                s.metricCard,
                { flex: 1, backgroundColor: STATUS_COLOR[object.status]?.bg ?? Colors.surface },
                // Statut « prêté » : la carte se prolonge dans le bloc de prêt juste dessous.
                object.status === 'loaned' && s.metricCardConnected,
              ]}
              onPress={toggleStatusPicker}
              activeOpacity={0.7}
            >
              <Text style={s.metricLabel}>{t('object.statusLabel')}</Text>
              <View style={s.statusValueRow}>
                <View style={[s.statusDot, { backgroundColor: STATUS_COLOR[object.status]?.dot ?? Colors.accent }]} />
                <Text style={[s.metricValue, { color: STATUS_COLOR[object.status]?.text ?? Colors.accent, flex: 1 }]}>
                  {t(`object.statusOptions.${object.status}`, { defaultValue: object.status })}
                </Text>
                {/* Le chevron prend la couleur du statut, comme la pastille
                    et le libellé : les trois disent la même chose. */}
                {showStatusPicker
                  ? <ChevronUp size={16} color={STATUS_COLOR[object.status]?.text ?? Colors.accent} strokeWidth={2} />
                  : <ChevronDown size={16} color={STATUS_COLOR[object.status]?.text ?? Colors.accent} strokeWidth={2} />}
              </View>
            </TouchableOpacity>

            {/* Collection */}
            <TouchableOpacity
              style={[
                s.metricCard,
                { flex: 1 },
                // Le bloc de prêt remonte sous le Statut sur toute la largeur :
                // sans ce retrait, il viendrait coller le bas de cette carte.
                object.status === 'loaned' && s.metricCardDetached,
              ]}
              onPress={() => setCollectionSheetOpen(true)}
              activeOpacity={0.8}
            >
              <Text style={s.metricLabel}>{t('object.collectionLabel')}</Text>
              <View style={s.statusValueRow}>
                <Text style={[s.metricValue, { flex: 1 }]} numberOfLines={1}>
                  {currentCollection?.name ?? '—'}
                </Text>
                {/* La feuille couvre l'écran : le chevron ne bascule plus,
                    il n'y a rien à replier derrière elle. */}
                <ChevronDown size={16} color={Colors.textPrimary} strokeWidth={2} />
              </View>
            </TouchableOpacity>

            {/* Dropdown statut — absolu pleine largeur, monté seulement le temps de l'ouverture */}
            {statusPickerMounted && (
            <Animated.View
              pointerEvents={showStatusPicker ? 'auto' : 'none'}
              style={[s.dropdownAbsolute, {
                top: metricsRowHeight,
                opacity: statusPickerAnim,
                transform: [{ translateY: statusPickerAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
              }]}>
              <View style={s.chipRow}>
                {STATUS_OPTIONS.map(opt => {
                  const c = STATUS_COLOR[opt.value]
                  const isActive = object.status === opt.value
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[s.chip, isActive && { borderColor: c?.text, backgroundColor: c?.bg }]}
                      onPress={() => { handleStatusChange(opt.value); toggleStatusPicker() }}
                      activeOpacity={0.7}
                    >
                      {c && <View style={[s.chipDot, { backgroundColor: c.dot }]} />}
                      <Text style={[s.chipText, isActive && { color: c?.text, fontWeight: Typography.semibold }]}>
                        {t(opt.labelKey)}
                      </Text>
                    </TouchableOpacity>
                  )
                })}
              </View>
            </Animated.View>
            )}

          </View>

          {/* ── Prêt (statut « prêté ») ── */}
          {object.status === 'loaned' && (
            <LoanCard
              loanedTo={String(object.attributes?.loaned_to ?? '')}
              returnDate={String(object.attributes?.loan_return_date ?? '')}
              onSave={patch => {
                const attrs = { ...(object.attributes ?? {}) }
                if (patch.loanedTo !== undefined) {
                  if (patch.loanedTo) attrs.loaned_to = patch.loanedTo
                  else delete attrs.loaned_to
                }
                if (patch.returnDate !== undefined) {
                  if (patch.returnDate) attrs.loan_return_date = patch.returnDate
                  else delete attrs.loan_return_date
                }
                saveField({ attributes: attrs })
              }}
            />
          )}

          {/* ── Quantité (1/3) + Emplacement (2/3) ── */}
          <View style={s.metricsRow}>
            <QuantityCard quantity={object.quantity ?? 1} onChange={updateQuantity} />

            {/* Pas de tap sur la carte : il avalait le défilement
                horizontal des puces. Seul le badge ouvre le tiroir. */}
            <View style={[s.metricCard, { flex: 2 }]}>
              <Text style={s.metricLabel}>
                {t('object.locationLabel', { count: locationBricks.length, max: LOCATION_MAX })}
              </Text>
              <LocationBricks
                bricks={locationBricks}
                onEdit={() => setLocationSheetOpen(true)}
              />
            </View>
          </View>

          </View>{/* fin de la grille d'informations */}

          {/* ── Caractéristiques ── */}
          <AttributesSection
            attributes={Object.entries(object.attributes ?? {}).filter(
              ([k, v]) => v !== null && v !== '' && !LOAN_ATTR_KEYS.includes(k as typeof LOAN_ATTR_KEYS[number])
            )}
            // Les clés de prêt sont pilotées par LoanCard : on les réinjecte pour ne pas les perdre.
            onSave={attrs => {
              const preserved: Record<string, string | number | boolean | null> = {}
              for (const k of LOAN_ATTR_KEYS) {
                const v = object.attributes?.[k]
                if (v !== undefined && v !== null && v !== '') preserved[k] = v
              }
              saveField({ attributes: { ...attrs, ...preserved } })
            }}
          />

          {/* ── Valeur ── */}
          <View>
            <SectionTitle label={t('object.value.sectionTitle')} />
            <ValeurCard
              object={object}
              estimating={estimating}
              editingUserValue={editingUserValue}
              userValueDraft={userValueDraft}
              onEstimate={requestEstimate}
              onEditUserValue={() => {
                setUserValueDraft(String(object.user_value ?? object.market_value ?? ''))
                setEditingUserValue(true)
              }}
              onUserValueChange={setUserValueDraft}
              onUserValueCommit={commitUserValue}
              onClearMarketValue={clearMarketValue}
              onUpdateMarketValue={updateMarketValue}
              onUpdatePurchasePrice={updatePurchasePrice}
              onUpdateSalePrice={updateSalePrice}
              onUpdateDeposit={updateDeposit}
              onUpdateSalePriceLot={updateSalePriceLot}
              onUpdatePurchaseDate={updatePurchaseDate}
            />
          </View>

          {/* ── Documents ── */}
          <DocumentsSection
            objectId={object.id}
            documents={documents}
            onDocumentsChange={setDocuments}
          />

          {/* ── Assurances ──
              Sortie de la carte Performances : une assurance n'est pas une
              valeur de l'objet, c'est un contrat qui s'y rattache. */}
          <View>
            <SectionTitle label={t('object.insurance.sectionTitle')} />
            <InsurancesSection
              objectId={object.id}
              currencySymbol={(object.value_currency ?? 'EUR') === 'EUR' ? '€' : (object.value_currency ?? 'EUR')}
              documents={documents}
              onDocumentsChange={setDocuments}
            />
          </View>

          {/* ── Actions bas de page ── */}
          <View style={s.bottomActions}>
            <View style={s.bottomDivider} />
            <View style={s.bottomRow}>
              <TouchableOpacity style={s.bottomLink} onPress={() => setSharePanelVisible(true)} activeOpacity={0.7}>
                <Share2 size={15} color={Colors.textSecondary} strokeWidth={1.8} />
                <Text style={s.bottomLinkText}>{t('object.share')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.bottomLink} onPress={confirmDelete} activeOpacity={0.7}>
                <Trash2 size={15} color={Colors.error} strokeWidth={1.8} />
                <Text style={[s.bottomLinkText, { color: Colors.error }]}>{t('common.delete')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ height: Spacing.xl }} />
        </View>
      </FormScrollView>

      {/* ── Menu ··· ActionSheet ── */}
      <ActionSheet
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        options={[
          { label: t('object.editTitle'), onPress: () => router.push(`/objects/edit/${id}`) },
          { label: t('object.share'), onPress: () => setSharePanelVisible(true) },
          { label: t('common.delete'), onPress: confirmDelete, destructive: true },
          { label: t('common.cancel'), onPress: () => {}, cancel: true },
        ]}
      />

      {/* ── Choix de collection ── */}
      <CollectionPickerSheet
        visible={collectionSheetOpen}
        title={t('collectionPicker.title')}
        helper={t('collectionPicker.helperManual')}
        onSelect={handleCollectionChange}
        onDismiss={() => setCollectionSheetOpen(false)}
      />

      {/* ── Menu du bloc Résumé IA ── */}
      <ActionSheet
        visible={summaryMenuVisible}
        onClose={() => setSummaryMenuVisible(false)}
        options={summaryMenuOptions()}
      />

      {/* ── Emplacement ── */}
      <LocationEditorSheet
        visible={locationSheetOpen}
        initial={locationBricks}
        onCancel={() => setLocationSheetOpen(false)}
        onSave={saveLocation}
      />

      {/* ── Partage ── */}
      {object && (
        <SharePanel
          visible={sharePanelVisible}
          selectedObjects={[object]}
          collectionName={object.title}
          onClose={() => setSharePanelVisible(false)}
          onDone={() => setSharePanelVisible(false)}
        />
      )}

      {/* ── Confirmation suppression ── */}
      {deleteConfirmVisible && (
        <View style={s.deleteOverlay}>
          <TouchableOpacity style={s.deleteOverlayBg} activeOpacity={1} onPress={() => setDeleteConfirmVisible(false)} />
          <View style={s.deleteSheet}>
            <Text style={s.deleteSheetTitle}>{t('object.deleteObjectTitle')}</Text>
            <Text style={s.deleteSheetBody}>{t('object.irreversible')}</Text>
            <View style={s.deleteSheetActions}>
              <TouchableOpacity style={s.deleteSheetCancel} onPress={() => setDeleteConfirmVisible(false)}>
                <Text style={s.deleteSheetCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.deleteSheetConfirm} onPress={executeDelete}>
                <Text style={s.deleteSheetConfirmText}>{t('common.delete')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

    </FormScreen>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  errorText: { fontSize: Typography.base, color: Colors.textSecondary },
  backLink: { color: Colors.accent, fontSize: Typography.base },

  heroOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingTop: Spacing.md,
  },
  circleBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.88)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Navigation header
  navHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    backgroundColor: Colors.background,
  },
  navBtn: {
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
  },
  navTitle: {
    flex: 1, textAlign: 'center',
    fontSize: Typography.base, fontWeight: Typography.bold,
    color: Colors.textPrimary, marginHorizontal: Spacing.sm,
  },

  // Image slider contenu (arrondi, marges)
  sliderWrapper: {
    marginHorizontal: Spacing.lg,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceWarm,
  },

  body: { padding: Spacing.lg, gap: Spacing.lg },

  titleBlock: { gap: Spacing.xs },
  title: {
    fontSize: Typography.xxl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    letterSpacing: -0.4,
    lineHeight: Typography.xxl * 1.15,
  },
  titleInput: {
    fontSize: Typography.xxl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    letterSpacing: -0.4,
    lineHeight: Typography.xxl * 1.15,
    padding: 0,
    borderBottomWidth: 2,
    borderBottomColor: Colors.accent,
    textAlignVertical: 'top',
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  badgeCat: {
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 3,
  },
  badgeCatText: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.accent },
  metaDate: { fontSize: Typography.xs, color: Colors.textTertiary },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.sm },
  cardIcon: { fontSize: Typography.sm, color: Colors.accent },
  cardLabel: {
    flex: 1,
    fontSize: Typography.xs, fontWeight: Typography.bold,
    color: Colors.accent, letterSpacing: 0.8,
  },
  // Bouton secondaire discret : le bloc reste une carte de lecture, pas
  // une barre d'outils.
  summaryMenuBtn: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceWarm,
  },
  summaryMenuBtnOff: { opacity: 0.45 },
  summaryWriting: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  summaryWritingText: { fontSize: Typography.sm, color: Colors.textTertiary, fontStyle: 'italic' },
  editIconBtn: { padding: 4 },
  descText: { fontSize: Typography.sm, color: Colors.textSecondary, lineHeight: Typography.sm * 1.6 },
  descPlaceholder: { fontSize: Typography.sm, color: Colors.textTertiary, fontStyle: 'italic' },
  showMoreBtn: { marginTop: 4 },
  showMoreText: { fontSize: Typography.xs, color: Colors.accent, fontWeight: Typography.medium },
  descInput: {
    fontSize: Typography.sm, color: Colors.textPrimary,
    lineHeight: Typography.sm * 1.6,
    minHeight: 80, textAlignVertical: 'top',
    padding: 0,
  },

  /**
   * Gouttière unique de la grille d'informations : la même verticalement
   * entre les lignes et horizontalement entre les cartes. `body` garde son
   * `gap` large pour séparer les grandes sections (Valeur, Caractéristiques).
   */
  infoGrid: { gap: GRID_GAP },
  metricsRow: { flexDirection: 'row', gap: GRID_GAP },
  metricCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 0.5,
    borderColor: Colors.border,
    gap: 4,
  },
  metricCardConnected: { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomWidth: 0 },
  // La carte Collection s'arrête une gouttière plus haut : la même que celle
  // qui la sépare du Statut à sa gauche. Sans elle, le bloc de prêt qui
  // remonte sous le Statut viendrait la toucher.
  metricCardDetached: { marginBottom: GRID_GAP },
  metricLabel: { fontSize: Typography.xs, color: Colors.textTertiary, marginBottom: 4 },
  metricValue: { fontSize: Typography.md, fontWeight: Typography.bold, color: Colors.textPrimary },

  // Stepper de quantité : occupe la largeur de la carte, donc tient dans un
  // tiers de ligne sans réglage en dur.
  qtyStepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qtyBtn: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surfaceWarm,
  },
  qtyBtnOff: { backgroundColor: 'transparent' },
  qtyValueBtn: { flex: 1, alignItems: 'center' },
  qtyInput: {
    flex: 1,
    textAlign: 'center',
    fontSize: Typography.md,
    fontWeight: Typography.bold,
    color: Colors.accent,
    padding: 0,
  },
  metricValueAccent: { fontSize: Typography.md, color: Colors.accent },

  statusValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  chipDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },

  loanCard: {
    borderRadius: Radius.lg,
    borderWidth: 0.5, borderColor: Colors.border,   // même trait que metricCard
    // Même respiration que les autres cartes : le prêt est soudé au Statut,
    // ce n'est pas une raison pour que son contenu soit à l'étroit.
    padding: Spacing.md,
    gap: Spacing.sm,
    // Soudée à la carte Statut : on annule la gouttière de la grille puis on
    // superpose les traits (0.5) pour ne laisser qu'une seule ligne de séparation.
    marginTop: -(GRID_GAP + 0.5),
    borderTopLeftRadius: 0,
  },
  // Libellé ferré à gauche, valeur ferrée à droite.
  loanRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: Spacing.sm, minHeight: 36,
  },
  loanLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  loanLabel: { fontSize: Typography.sm, fontWeight: Typography.semibold },
  loanValueBtn: { flex: 1, alignItems: 'flex-end' },
  loanValue: {
    fontSize: Typography.base, color: Colors.textPrimary,
    fontWeight: Typography.medium, textAlign: 'right',
  },
  loanValueEmpty: { color: Colors.textTertiary, fontWeight: Typography.regular },
  loanValueOverdue: { color: '#E11D48', fontWeight: Typography.semibold },
  loanInput: {
    flex: 1, fontSize: Typography.base, color: Colors.textPrimary,
    fontWeight: Typography.medium, textAlign: 'right', padding: 0,
  },
  loanClear: { fontSize: 20, color: Colors.textTertiary, lineHeight: 22 },

  dropdownAbsolute: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.border,
    padding: Spacing.sm,
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  pickerCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    minHeight: 44,
    borderRadius: Radius.full, borderWidth: 1.5,
    borderColor: Colors.border, backgroundColor: Colors.background,
  },
  chipActive: { borderColor: Colors.accent, backgroundColor: Colors.accentLight },
  chipText: { fontSize: Typography.base, color: Colors.textSecondary, fontWeight: Typography.medium },
  chipTextActive: { color: Colors.accent, fontWeight: Typography.semibold },

  sectionTitle: {
    fontSize: Typography.xs, fontWeight: Typography.bold,
    color: Colors.textTertiary, textTransform: 'uppercase',
    letterSpacing: 0.8, marginBottom: Spacing.xs,
  },

  collectionName: { fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.textPrimary },
  chevron: { fontSize: Typography.xs, color: Colors.textTertiary },

  attrsCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  attrRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
  },
  attrSep: { borderTopWidth: 0.5, borderTopColor: Colors.borderLight },
  attrContent: { flex: 1, marginRight: Spacing.sm },
  attrKey: {
    fontSize: Typography.xs, color: Colors.textTertiary,
    fontWeight: Typography.medium, marginBottom: 3,
  },
  attrValue: {
    fontSize: Typography.base, color: Colors.textPrimary,
    fontWeight: Typography.semibold,
  },
  attrSubtext: {
    fontSize: Typography.xs, color: Colors.textTertiary, marginTop: 3,
  },
  attrLocationRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2,
  },
  attrInput: {
    fontSize: Typography.base, color: Colors.textPrimary, fontWeight: Typography.semibold,
    borderBottomWidth: 1.5, borderBottomColor: Colors.accent,
    paddingVertical: 2, minWidth: 120,
  },

  deleteBtn: {
    borderWidth: 1.5, borderColor: Colors.error,
    borderRadius: Radius.lg, paddingVertical: Spacing.md + 2,
    alignItems: 'center',
  },
  deleteBtnText: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.error },

  deleteOverlay: { ...StyleSheet.absoluteFill, justifyContent: 'flex-end' },
  deleteOverlayBg: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.4)' },
  deleteSheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: Spacing.xl, gap: Spacing.md, paddingBottom: 40,
  },
  deleteSheetTitle: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },
  deleteSheetBody: { fontSize: Typography.sm, color: Colors.textSecondary },
  deleteSheetActions: { flexDirection: 'row', gap: Spacing.sm },
  deleteSheetCancel: {
    flex: 1, paddingVertical: 12, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  deleteSheetCancelText: { fontSize: Typography.base, color: Colors.textSecondary },
  deleteSheetConfirm: {
    flex: 1, paddingVertical: 12, borderRadius: Radius.md,
    backgroundColor: Colors.error, alignItems: 'center',
  },
  deleteSheetConfirmText: { fontSize: Typography.base, color: 'white', fontWeight: Typography.semibold },

  // Caractéristiques
  attrsSectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  attrsAddBtn: { fontSize: Typography.sm, color: Colors.accent, fontWeight: Typography.semibold },
  attrsAddCta: {
    paddingVertical: 11,
    margin: Spacing.sm,
    borderRadius: Radius.md,
    alignItems: 'center',
    backgroundColor: Colors.accentLight,
  },
  attrsAddCtaText: { fontSize: Typography.sm, color: Colors.accent, fontWeight: Typography.semibold },

  // Actions bas de page
  bottomActions: { gap: Spacing.sm },
  bottomDivider: { height: 1, backgroundColor: Colors.border },
  bottomRow: { flexDirection: 'row', justifyContent: 'space-between' },
  bottomLink: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: Spacing.xs },
  bottomLinkText: { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: Typography.medium },
  attrDragTarget: { backgroundColor: Colors.accentLight },
  attrActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  attrRemoveBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  attrRemove: { fontSize: 15, color: Colors.textTertiary },
  attrHandle: { paddingLeft: 4, paddingRight: 8, paddingVertical: 4 },
  attrHandleIcon: { fontSize: 18, color: Colors.textTertiary, letterSpacing: 1 },
  attrLabelInput: {
    fontSize: Typography.xs, color: Colors.textTertiary, fontWeight: Typography.medium,
    borderBottomWidth: 1, borderBottomColor: Colors.accent, paddingVertical: 1, marginBottom: 3,
  },
  attrsEmpty: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 0.5, borderColor: Colors.border,
    paddingVertical: 14, alignItems: 'center',
  },
  attrsEmptyText: { fontSize: Typography.sm, color: Colors.accent, fontWeight: Typography.semibold },

  // Presets
  attrPresets: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.xs },
  attrPresetChip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  attrPresetChipActive: { borderColor: Colors.accent, backgroundColor: '#DCFCE7' },
  attrPresetChipText: { fontSize: Typography.sm, color: Colors.textSecondary },
  attrPresetChipTextActive: { color: '#15803D', fontWeight: Typography.semibold },

  // Sheet ajout caractéristique
  attrBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  attrSheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    padding: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: 56, gap: Spacing.sm,
  },
  attrSheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.sm },
  attrSheetTitle: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary, marginBottom: Spacing.xs },
  attrSheetLabel: { fontSize: Typography.xs, color: Colors.textTertiary, fontWeight: Typography.semibold, letterSpacing: 0.5, marginTop: Spacing.xs },
  attrSheetInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    fontSize: Typography.base, color: Colors.textPrimary, backgroundColor: Colors.background,
  },
  attrSheetBtn: {
    backgroundColor: Colors.accent, borderRadius: Radius.md,
    paddingVertical: 14, alignItems: 'center', marginTop: Spacing.md,
  },
  attrSheetBtnDisabled: { opacity: 0.45 },
  attrSheetBtnText: { color: 'white', fontSize: Typography.base, fontWeight: Typography.bold },
})
