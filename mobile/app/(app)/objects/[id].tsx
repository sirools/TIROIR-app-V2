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
  KeyboardAvoidingView,
  Modal,
  Platform,
  Animated,
  PanResponder,
} from 'react-native'
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import { useTranslation } from 'react-i18next'
import i18n from 'i18next'
import * as ImagePicker from 'expo-image-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { decode } from 'base64-arraybuffer'
import { Plus, Trash2, ArrowLeft, MoreHorizontal, ChevronRight, MapPin, Share2, Sparkles, Star, Info } from 'lucide-react-native'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'
import { Screen, Colors, Typography, Spacing, Radius, ActionSheet } from '@/components/ui'
import { SharePanel } from '@/components/SharePanel'
import { DocumentsSection, ObjectDocument } from '@/components/DocumentsSection'
import { InsurancesSection } from '@/components/InsurancesSection'
import { TiroirObject, ObjectImage, Collection } from '@/types/database'

const SCREEN_WIDTH = Dimensions.get('window').width
const HERO_HEIGHT = 240
const THUMB_SIZE = 52

// ── Labels ───────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: string; labelKey: string }[] = [
  { value: 'owned',  labelKey: 'object.statusOptions.owned' },
  { value: 'stored', labelKey: 'object.statusOptions.stored' },
  { value: 'loaned', labelKey: 'object.statusOptions.loaned' },
  { value: 'lost',   labelKey: 'object.statusOptions.lost' },
  { value: 'sold',   labelKey: 'object.statusOptions.sold' },
  { value: 'given',  labelKey: 'object.statusOptions.given' },
]

const STATUS_COLOR: Record<string, { bg: string; text: string; dot: string }> = {
  owned:   { bg: '#F0FDF4', text: '#16A34A', dot: '#22C55E' }, // vert
  stored:  { bg: '#F0F9FF', text: '#0284C7', dot: '#38BDF8' }, // bleu ciel
  loaned:  { bg: '#FDF2F8', text: '#C026D3', dot: '#E879F9' }, // rose
  lost:    { bg: '#F3F4F6', text: '#6B7280', dot: '#9CA3AF' }, // gris
  sold:    { bg: '#FFFBEB', text: '#D97706', dot: '#FBBF24' }, // ambre
  given:   { bg: '#FFF1F2', text: '#E11D48', dot: '#FB7185' }, // rouge
}

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

function PhotoLightbox({ images, startIndex, signedUrls, onClose }: {
  images: ObjectImage[]
  startIndex: number
  signedUrls: Record<string, string>
  onClose: () => void
}) {
  const [current, setCurrent] = useState(startIndex)
  const flatRef = useRef<FlatList>(null)

  useEffect(() => {
    // Scroll to startIndex after mount
    setTimeout(() => {
      flatRef.current?.scrollToIndex({ index: startIndex, animated: false })
    }, 50)
  }, [])

  return (
    <Modal visible transparent statusBarTranslucent animationType="fade" onRequestClose={onClose}>
      <View style={lbStyles.root}>
        <FlatList
          ref={flatRef}
          data={images}
          keyExtractor={i => i.id}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={startIndex}
          getItemLayout={(_, index) => ({ length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index })}
          onMomentumScrollEnd={e => setCurrent(Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH))}
          renderItem={({ item }) => {
            const url = signedUrls[item.storage_path]
            return (
              <View style={lbStyles.slide}>
                {url
                  ? <Image source={{ uri: url }} style={lbStyles.img} resizeMode="contain" />
                  : <ActivityIndicator color="white" />
                }
              </View>
            )
          }}
        />
        {/* Dots */}
        {images.length > 1 && (
          <View style={lbStyles.dots}>
            {images.map((_, i) => (
              <View key={i} style={[lbStyles.dot, i === current && lbStyles.dotActive]} />
            ))}
          </View>
        )}
        {/* Compteur */}
        {images.length > 1 && (
          <Text style={lbStyles.counter}>{current + 1} / {images.length}</Text>
        )}
        {/* Fermer */}
        <TouchableOpacity style={lbStyles.closeBtn} onPress={onClose} activeOpacity={0.8}>
          <Text style={lbStyles.closeIcon}>✕</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  )
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window')

const lbStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slide: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  img: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT },
  dots: {
    position: 'absolute', bottom: 52, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.35)' },
  dotActive: { backgroundColor: 'white', width: 20 },
  counter: {
    position: 'absolute', bottom: 52, right: 20,
    color: 'rgba(255,255,255,0.5)', fontSize: Typography.sm,
  },
  closeBtn: {
    position: 'absolute', top: 54, right: 20,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  closeIcon: { color: 'white', fontSize: 16, fontWeight: '600' },
})

function ImageSlider({ images, objectId, onImagesChange }: ImageSliderProps) {
  const router = useRouter()
  const { t } = useTranslation()
  const { profile } = useAuth()
  const [activeIndex, setActiveIndex] = useState(0)
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})
  const [uploading, setUploading] = useState(false)
  const [enhancing, setEnhancing] = useState(false)
  const [settingCover, setSettingCover] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const flatRef = useRef<FlatList>(null)

  // Charger toutes les URLs signées
  React.useEffect(() => {
    if (!images.length) return
    const paths = images.map(i => i.storage_path)
    supabase.storage.from('object-images').createSignedUrls(paths, 3600).then(({ data }) => {
      if (!data) return
      const map: Record<string, string> = {}
      for (const s of data) { if (s.signedUrl && s.path) map[s.path] = s.signedUrl }
      setSignedUrls(map)
    })
  }, [images.map(i => i.storage_path).join(',')])

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

      // Dériver l'extension depuis mimeType (fiable sur web et iOS)
      const mimeType = asset.mimeType ?? 'image/jpeg'
      const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg'
      // Le Storage attend : {user_id}/{object_id}/{filename}
      const storagePath = `${userId}/${objectId}/${Date.now()}.${ext}`

      // Web : asset.file disponible directement
      // iOS/Android : lecture base64 via expo-file-system → ArrayBuffer (évite le bug Hermes blob)
      let uploadBody: ArrayBuffer | File
      if (Platform.OS === 'web' && (asset as any).file) {
        uploadBody = (asset as any).file as File
      } else {
        const base64 = await FileSystem.readAsStringAsync(asset.uri, {
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
          mime_type: mimeType,
          is_cover: isFirstImage,
          position: images.length,
        })
        .select()
        .single()
      if (insErr) throw insErr

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
    await supabase.storage.from('object-images').remove([img.storage_path])
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

  async function enhanceActive() {
    if (enhancing) return
    const img = images[safeIndex]
    if (!img) return

    if (profile?.plan !== 'premium') {
      crossAlert(
        t('object.photo.enhancePremiumTitle'),
        t('object.photo.enhancePremiumMessage'),
        () => router.push('/paywall')
      )
      return
    }

    setEnhancing(true)
    try {
      const { data, error } = await supabase.functions.invoke('enhance-object-photo', {
        body: { object_id: objectId, image_id: img.id },
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
          crossAlert(t('object.photo.quotaTitle'), t('object.photo.quotaMessage'))
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

      {/* Bouton améliorer (IA, premium) */}
      {total > 0 && (
        <TouchableOpacity
          style={sl.enhanceBtn}
          onPress={enhanceActive}
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
        <PhotoLightbox
          images={images}
          startIndex={lightboxIndex}
          signedUrls={signedUrls}
          onClose={() => setLightboxIndex(null)}
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
      <Modal visible={adding} transparent animationType="slide" onRequestClose={() => setAdding(false)}>
        <TouchableOpacity style={s.attrBackdrop} activeOpacity={1} onPress={() => setAdding(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.attrSheet}>
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
            onSubmitEditing={() => {}}
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
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

// ── LocationBricks ────────────────────────────────────────────────────────────

interface LocationBricksProps {
  bricks: string[]
  editingIdx: number | null
  draft: string
  onEditStart: (idx: number) => void
  onDraftChange: (v: string) => void
  onEditCommit: () => void
  onRemove: (idx: number) => void
  onAdd: () => void
}

function LocationBricks({
  bricks, editingIdx, draft, onEditStart, onDraftChange, onEditCommit, onRemove, onAdd,
}: LocationBricksProps) {
  const { t } = useTranslation()
  return (
    <View style={lb.row}>
      {bricks.map((brick, i) => (
        <React.Fragment key={i}>
          {i > 0 && <Text style={lb.arrow}>›</Text>}
          {editingIdx === i ? (
            <TextInput
              style={lb.input}
              value={draft}
              onChangeText={onDraftChange}
              onBlur={onEditCommit}
              onSubmitEditing={onEditCommit}
              autoFocus
              returnKeyType="done"
            />
          ) : (
            <TouchableOpacity style={lb.brick} onPress={() => onEditStart(i)} activeOpacity={0.7}>
              <Text style={lb.brickText} numberOfLines={1}>{brick}</Text>
              <TouchableOpacity onPress={() => onRemove(i)} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
                <Text style={lb.remove}>×</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        </React.Fragment>
      ))}
      <TouchableOpacity style={lb.addBtn} onPress={onAdd} activeOpacity={0.85}>
        <Plus size={16} color="#FFFFFF" strokeWidth={2.4} />
        <Text style={lb.addText}>{t('object.locationAdd')}</Text>
      </TouchableOpacity>
    </View>
  )
}

// Puces d'emplacement : typo alignée sur le corps de page (base), avec un
// bouton d'ajout orange lisible mais harmonisé.
const LOCATION_FONT = Typography.base

const lb = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.sm },
  arrow: { fontSize: Typography.md, color: Colors.textTertiary, paddingHorizontal: 2 },
  brick: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.surfaceWarm, borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm + 2, paddingVertical: 6,
    borderWidth: 1, borderColor: Colors.border,
  },
  brickText: { fontSize: LOCATION_FONT, color: Colors.textPrimary, fontWeight: Typography.semibold, maxWidth: 160 },
  remove: { fontSize: Typography.md, color: Colors.textTertiary, lineHeight: 18, marginLeft: 2 },
  input: {
    fontSize: LOCATION_FONT, color: Colors.textPrimary, fontWeight: Typography.semibold,
    backgroundColor: Colors.surface, borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm + 2, paddingVertical: 6,
    borderWidth: 1.5, borderColor: Colors.accent,
    minWidth: 90,
  },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#EA580C', borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm + 4, paddingVertical: 6,
  },
  addText: { fontSize: Typography.sm, color: '#FFFFFF', fontWeight: Typography.bold },
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
          <Text style={vc.amountHint}>{t('object.value.marketHint')}</Text>
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
            <TouchableOpacity onPress={() => { setDraft(String(object.market_value)); setEditing(true) }} activeOpacity={0.7}>
              <Text style={vc.amountValue}>{object.market_value!.toLocaleString(i18n.language)} {currSym}</Text>
            </TouchableOpacity>
          )
        ) : (
          <TouchableOpacity onPress={onEstimate} activeOpacity={0.8}>
            <Text style={vc.marketEstimateLink}>{t('object.value.estimateAi')}</Text>
          </TouchableOpacity>
        )}
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
                  <View key={i} style={vc.sourceChip}>
                    <Text style={vc.sourceChipText}>{src.site} · {src.price} {currSym}</Text>
                  </View>
                ))}
              </View>
            )}
            <View style={vc.infoActions}>
              <TouchableOpacity
                style={[vc.marketActionBtn, vc.marketActionRefresh]}
                onPress={() => { setInfoOpen(false); onEstimate() }}
                activeOpacity={0.75}
              >
                <Text style={[vc.marketActionText, { color: '#15803D' }]}>{t('object.value.refresh')}</Text>
              </TouchableOpacity>
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
  onToggleInsured: (v: boolean) => void
  documents: ObjectDocument[]
  onDocumentsChange: (docs: ObjectDocument[]) => void
}

function ValeurCard({
  object, estimating, editingUserValue, userValueDraft,
  onEstimate, onEditUserValue, onUserValueChange, onUserValueCommit,
  onClearMarketValue, onUpdateMarketValue,
  onUpdatePurchasePrice, onUpdateSalePrice, onUpdateDeposit, onToggleInsured,
  documents, onDocumentsChange,
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

  return (
    <>
      <View style={vc.card}>
        {/* ── Section 1 : Valeur estimée (utilisateur) ── */}
        <TouchableOpacity style={vc.estimationRow} onPress={onEditUserValue} activeOpacity={0.7}>
          {/* Gauche : label + diff IA */}
          <View style={vc.estimationLeft}>
            <Text style={vc.sectionLabel}>{t('object.value.estimation')}</Text>
            {object.user_value != null && object.market_value != null && (() => {
              const diff = object.user_value - object.market_value
              const pct = Math.round((diff / object.market_value) * 100)
              const up = diff >= 0
              return (
                <Text style={[vc.estimationIaDiff, { color: up ? '#16A34A' : '#DC2626' }]}>
                  {up ? '▲' : '▼'} {Math.abs(pct)}% {t('object.value.vsAi')}
                </Text>
              )
            })()}
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
              <Text style={vc.valueText}>{object.user_value.toLocaleString(i18n.language)} {currSym}</Text>
            ) : (
              <Text style={vc.valuePlaceholder}>{t('object.value.enter')}</Text>
            )}
            {depreciation != null && (
              <View style={[vc.diffBadge, { backgroundColor: depreciation >= 0 ? '#DCFCE7' : '#FEE2E2' }]}>
                <Text style={[vc.diffBadgeText, { color: depreciation >= 0 ? '#16A34A' : '#DC2626' }]}>
                  {depreciation >= 0 ? '▲' : '▼'} {Math.abs(depreciation)}%{'\n'}
                  <Text style={vc.diffBadgeSubtext}>{t('object.value.vsPurchase')}</Text>
                </Text>
              </View>
            )}
          </View>
        </TouchableOpacity>

        <View style={vc.divider} />

        {/* ── Section 2 : Valeur marché (IA) ── */}
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

        {/* ── Section 3 : Prix d'achat + vente + Caution ── */}
        <View style={[vc.section, { gap: 0 }]}>
          {/* Prix d'achat */}
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
              <Text style={vc.amountValue}>{object.purchase_price.toLocaleString(i18n.language)} {currSym}</Text>
            ) : (
              <Text style={vc.amountPlaceholder}>{t('object.value.enter')}</Text>
            )}
          </TouchableOpacity>

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
              <Text style={vc.amountValue}>{object.sale_price.toLocaleString(i18n.language)} {currSym}</Text>
            ) : (
              <Text style={vc.amountPlaceholder}>{t('object.value.enter')}</Text>
            )}
          </TouchableOpacity>

          {/* Caution */}
          <TouchableOpacity
            style={vc.amountRow}
            onPress={() => { setDepositDraft(object.deposit_amount != null ? String(object.deposit_amount) : ''); setEditingDeposit(true) }}
            activeOpacity={0.7}
          >
            <View style={vc.amountLabelWrap}>
              <Text style={vc.amountLabel}>{t('object.value.deposit')}</Text>
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
              <Text style={vc.amountValue}>{object.deposit_amount.toLocaleString(i18n.language)} {currSym}</Text>
            ) : (
              <Text style={vc.amountPlaceholder}>{t('object.value.enter')}</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={vc.divider} />

        {/* ── Section 4 : Assurance (multi + contrats PDF) ── */}
        <InsurancesSection
          objectId={object.id}
          insured={object.insured}
          currencySymbol={currSym}
          documents={documents}
          onDocumentsChange={onDocumentsChange}
          onToggleInsured={onToggleInsured}
        />
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
  estimationRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
  },
  estimationLeft: { gap: 3 },
  estimationRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  estimationIaDiff: { fontSize: Typography.xs, fontWeight: Typography.medium },

  manualRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  manualHint: { flex: 1, fontSize: Typography.sm, color: Colors.textSecondary },
  valueText: { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary },
  valuePlaceholder: { fontSize: Typography.base, color: Colors.textTertiary, fontStyle: 'italic' },
  valueInput: {
    fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary,
    borderBottomWidth: 2, borderBottomColor: Colors.accent,
    paddingVertical: 2, minWidth: 80, textAlign: 'right',
  },
  diffBadge: { borderRadius: Radius.md, paddingHorizontal: 8, paddingVertical: 5, alignItems: 'center' },
  diffBadgeText: { fontSize: Typography.xs, fontWeight: Typography.bold, textAlign: 'center' },
  diffBadgeSubtext: { fontSize: 9, fontWeight: Typography.medium, opacity: 0.8 },
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
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { t, i18n } = useTranslation()

  const [object, setObject] = useState<TiroirObject | null>(null)
  const [images, setImages] = useState<ObjectImage[]>([])
  const [documents, setDocuments] = useState<ObjectDocument[]>([])
  const [allCollections, setAllCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Titre
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')

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
  const [showCollectionPicker, setShowCollectionPicker] = useState(false)
  const statusPickerAnim = useRef(new Animated.Value(0)).current
  const collectionPickerAnim = useRef(new Animated.Value(0)).current
  const [metricsRowHeight, setMetricsRowHeight] = useState(0)

  function animatePicker(anim: Animated.Value, opening: boolean) {
    Animated.spring(anim, { toValue: opening ? 1 : 0, useNativeDriver: true, damping: 22, mass: 0.8 }).start()
  }

  function toggleStatusPicker() {
    const opening = !showStatusPicker
    setShowStatusPicker(opening)
    if (opening) setShowCollectionPicker(false)
    animatePicker(statusPickerAnim, opening)
    if (opening) animatePicker(collectionPickerAnim, false)
  }

  function toggleCollectionPicker() {
    const opening = !showCollectionPicker
    setShowCollectionPicker(opening)
    if (opening) setShowStatusPicker(false)
    animatePicker(collectionPickerAnim, opening)
    if (opening) animatePicker(statusPickerAnim, false)
  }

  // Emplacement
  const [locationBricks, setLocationBricks] = useState<string[]>([])
  const [editingBrickIdx, setEditingBrickIdx] = useState<number | null>(null)
  const [brickDraft, setBrickDraft] = useState('')

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

  async function saveField(updates: Partial<TiroirObject>, silentObj?: TiroirObject) {
    const base = silentObj ?? object
    if (!base) return
    const merged: TiroirObject = { ...base, ...updates }
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
    if (error) Alert.alert(t('common.error'), error.message)
    else setObject(merged)
  }

  // ── Description ─────────────────────────────────────────────────────────────

  function startEditTitle() {
    setTitleDraft(object?.title ?? '')
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

  function handleCollectionChange(collectionId: string | null) {
    setShowCollectionPicker(false)
    if (collectionId === object?.collection_id) return
    saveField({ collection_id: collectionId })
  }

  // ── Emplacement ─────────────────────────────────────────────────────────────

  function startEditBrick(idx: number) {
    setBrickDraft(locationBricks[idx])
    setEditingBrickIdx(idx)
  }

  function commitBrick() {
    if (editingBrickIdx === null) return
    const val = brickDraft.trim()
    let newBricks = [...locationBricks]
    if (val === '') {
      newBricks.splice(editingBrickIdx, 1)
    } else {
      newBricks[editingBrickIdx] = val
    }
    setEditingBrickIdx(null)
    setLocationBricks(newBricks)
    const note = joinBricks(newBricks)
    if (note !== object?.location_note) saveField({ location_note: note })
  }

  function removeBrick(idx: number) {
    const newBricks = locationBricks.filter((_, i) => i !== idx)
    setLocationBricks(newBricks)
    const note = joinBricks(newBricks)
    if (note !== object?.location_note) saveField({ location_note: note })
  }

  function addBrick() {
    const newBricks = [...locationBricks, '']
    setLocationBricks(newBricks)
    setBrickDraft('')
    setEditingBrickIdx(newBricks.length - 1)
  }

  // ── Estimation valeur ────────────────────────────────────────────────────────

  async function requestEstimate() {
    if (!object || estimating) return
    setEstimating(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error(t('documents.notAuthenticated'))
      const res = await supabase.functions.invoke('estimate-value', {
        body: { object_id: object.id },
      })
      if (res.error) throw new Error(res.error.message)
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
      Alert.alert(t('common.error'), err instanceof Error ? err.message : t('object.estimateFailed'))
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

  async function toggleInsured(value: boolean) {
    if (!object) return
    const { error } = await supabase.from('objects').update({ insured: value }).eq('id', object.id)
    if (error) { Alert.alert(t('common.error'), error.message); return }
    setObject(prev => prev ? ({ ...prev, insured: value } as TiroirObject) : prev)
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

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

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
                <TouchableOpacity onPress={startEditTitle} activeOpacity={0.6}>
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

            {/* ── Résumé IA ── */}
            <View style={s.card}>
              <View style={s.cardHead}>
                <Text style={s.cardIcon}>✦</Text>
                <Text style={s.cardLabel}>{t('object.aiSummary')}</Text>
                <TouchableOpacity onPress={startEditDesc} style={s.editIconBtn}>
                  <Text style={s.editIconText}>✎</Text>
                </TouchableOpacity>
              </View>
              {editingDesc ? (
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
                style={[s.metricCard, { flex: 1 }, { backgroundColor: STATUS_COLOR[object.status]?.bg ?? Colors.surface }]}
                onPress={toggleStatusPicker}
                activeOpacity={0.7}
              >
                <Text style={s.metricLabel}>{t('object.statusLabel')}</Text>
                <View style={s.statusValueRow}>
                  <View style={[s.statusDot, { backgroundColor: STATUS_COLOR[object.status]?.dot ?? Colors.accent }]} />
                  <Text style={[s.metricValue, { color: STATUS_COLOR[object.status]?.text ?? Colors.accent, flex: 1 }]}>
                    {t(`object.statusOptions.${object.status}`, { defaultValue: object.status })}
                  </Text>
                  <Text style={[s.statusChevron, { color: STATUS_COLOR[object.status]?.text ?? Colors.accent }]}>
                    {showStatusPicker ? '▲' : '▾'}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Collection */}
              <TouchableOpacity
                style={[s.metricCard, { flex: 1 }]}
                onPress={toggleCollectionPicker}
                activeOpacity={0.8}
              >
                <Text style={s.metricLabel}>{t('object.collectionLabel')}</Text>
                <View style={s.statusValueRow}>
                  <Text style={[s.metricValue, { flex: 1 }]} numberOfLines={1}>
                    {currentCollection?.name ?? '—'}
                  </Text>
                  <Text style={s.statusChevron}>{showCollectionPicker ? '▲' : '▾'}</Text>
                </View>
              </TouchableOpacity>

              {/* Dropdown statut — absolu pleine largeur */}
              <Animated.View style={[s.dropdownAbsolute, {
                top: metricsRowHeight,
                opacity: statusPickerAnim,
                transform: [{ translateY: statusPickerAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
                pointerEvents: showStatusPicker ? 'auto' : 'none',
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

              {/* Dropdown collection — absolu pleine largeur */}
              <Animated.View style={[s.dropdownAbsolute, {
                top: metricsRowHeight,
                opacity: collectionPickerAnim,
                transform: [{ translateY: collectionPickerAnim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
                pointerEvents: showCollectionPicker ? 'auto' : 'none',
              }]}>
                <View style={s.chipRow}>
                  <TouchableOpacity
                    style={[s.chip, !object.collection_id && s.chipActive]}
                    onPress={() => { handleCollectionChange(null); toggleCollectionPicker() }}
                  >
                    <Text style={[s.chipText, !object.collection_id && s.chipTextActive]}>{t('object.noCollection')}</Text>
                  </TouchableOpacity>
                  {allCollections.map(col => (
                    <TouchableOpacity
                      key={col.id}
                      style={[s.chip, object.collection_id === col.id && s.chipActive]}
                      onPress={() => { handleCollectionChange(col.id); toggleCollectionPicker() }}
                    >
                      <Text style={[s.chipText, object.collection_id === col.id && s.chipTextActive]}>
                        {col.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </Animated.View>

            </View>

            {/* ── Emplacement ── */}
            <View style={s.metricCard}>
              <Text style={s.metricLabel}>{t('object.locationLabel')}</Text>
              <LocationBricks
                bricks={locationBricks}
                editingIdx={editingBrickIdx}
                draft={brickDraft}
                onEditStart={startEditBrick}
                onDraftChange={setBrickDraft}
                onEditCommit={commitBrick}
                onRemove={removeBrick}
                onAdd={addBrick}
              />
            </View>

            {/* ── Caractéristiques ── */}
            <AttributesSection
              attributes={Object.entries(object.attributes ?? {}).filter(([, v]) => v !== null && v !== '')}
              onSave={attrs => saveField({ attributes: attrs })}
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
                onToggleInsured={toggleInsured}
                documents={documents}
                onDocumentsChange={setDocuments}
              />
            </View>

            {/* ── Documents ── */}
            <DocumentsSection
              objectId={object.id}
              documents={documents}
              onDocumentsChange={setDocuments}
            />

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
        </ScrollView>

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

      </KeyboardAvoidingView>
    </Screen>
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
  editIconBtn: { padding: 4 },
  editIconText: { fontSize: Typography.sm, color: Colors.textTertiary },
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

  metricsRow: { flexDirection: 'row', gap: Spacing.sm },
  metricCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 0.5,
    borderColor: Colors.border,
    gap: 4,
  },
  metricLabel: { fontSize: Typography.xs, color: Colors.textTertiary, marginBottom: 4 },
  metricValue: { fontSize: Typography.md, fontWeight: Typography.bold, color: Colors.textPrimary },
  metricValueAccent: { fontSize: Typography.md, color: Colors.accent },

  statusValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  statusChevron: { fontSize: 14, lineHeight: 18 },
  chipDot: { width: 7, height: 7, borderRadius: 3.5 },

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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: Spacing.sm + 2, paddingVertical: Spacing.xs + 1,
    borderRadius: Radius.full, borderWidth: 1.5,
    borderColor: Colors.border, backgroundColor: Colors.background,
  },
  chipActive: { borderColor: Colors.accent, backgroundColor: Colors.accentLight },
  chipText: { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: Typography.medium },
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
