import React, { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Modal,
  Image, ActivityIndicator, ScrollView, Alert,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import * as FileSystem from 'expo-file-system/legacy'
import { Camera, Images, Trash2 } from 'lucide-react-native'
import { supabase } from '@/lib/supabase'
import { Colors, Typography, Spacing, Radius } from './tokens'
import { COLLECTION_EMOJIS, COLLECTION_COLORS } from './CollectionComposer'

export interface EditableCollection {
  id: string
  name: string
  emoji: string | null
  icon_color: string | null
  cover_image_path: string | null
}

export interface CollectionPatch {
  name: string
  emoji: string
  icon_color: string
  cover_image_path: string | null
}

/** Côté de la couverture stockée. Elle s'affiche dans une pastille de
 *  52 px et dans un en-tête de 64 px : au-delà on paierait du transfert
 *  pour des pixels que personne ne verra. */
const COVER_SIZE = 640

interface Props {
  visible: boolean
  collection: EditableCollection | null
  onClose: () => void
  /** Appelé après écriture en base, pour que l'écran appelant se mette à
   *  jour sans recharger toute sa liste. */
  onSaved: (patch: CollectionPatch) => void
}

/**
 * Édition d'une collection : son nom, et son identité visuelle.
 *
 * L'icône et la photo ne cohabitent pas — c'est l'une OU l'autre. Un badge
 * emoji posé sur une photo de dressing n'aide personne à reconnaître son
 * dressing, et deux repères concurrents sur la même vignette se nuisent.
 * Le choix est donc explicite, en deux onglets.
 */
export function CollectionEditSheet({ visible, collection, onClose, onSaved }: Props) {
  const { t } = useTranslation()

  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('📦')
  const [color, setColor] = useState(COLLECTION_COLORS[0])
  const [coverPath, setCoverPath] = useState<string | null>(null)
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [mode, setMode] = useState<'icon' | 'photo'>('icon')
  const [busy, setBusy] = useState(false)

  // Réinitialisé à chaque ouverture : garder l'état d'une collection
  // précédente ferait éditer la mauvaise.
  useEffect(() => {
    if (!visible || !collection) return
    setName(collection.name)
    setEmoji(collection.emoji ?? '📦')
    setColor(collection.icon_color ?? COLLECTION_COLORS[0])
    setCoverPath(collection.cover_image_path)
    setMode(collection.cover_image_path ? 'photo' : 'icon')
    setCoverUrl(null)

    if (collection.cover_image_path) {
      supabase.storage.from('object-images')
        .createSignedUrl(collection.cover_image_path, 3600)
        .then(({ data }) => setCoverUrl(data?.signedUrl ?? null))
    }
  }, [visible, collection?.id])

  async function pickCover(from: 'camera' | 'library') {
    if (!collection) return
    const perm = from === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (perm.status !== 'granted') {
      Alert.alert(t('capture.permissionDeniedTitle'),
        t(from === 'camera' ? 'capture.permissionCamera' : 'capture.permissionLibrary'))
      return
    }

    const res = from === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9, allowsEditing: true, aspect: [1, 1] })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsEditing: true, aspect: [1, 1] })
    if (res.canceled || !res.assets[0]) return

    setBusy(true)
    try {
      const rendered = await ImageManipulator.ImageManipulator
        .manipulate(res.assets[0].uri)
        .resize({ width: COVER_SIZE })
        .renderAsync()
      const saved = await rendered.saveAsync({
        compress: 0.85, format: ImageManipulator.SaveFormat.JPEG,
      })

      const b64 = await FileSystem.readAsStringAsync(saved.uri, {
        encoding: FileSystem.EncodingType.Base64,
      })
      const binary = atob(b64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('AUTH')

      const path = `${user.id}/collections/${collection.id}/${Date.now()}.jpg`
      const { error: upErr } = await supabase.storage
        .from('object-images')
        .upload(path, bytes, { contentType: 'image/jpeg', upsert: false })
      if (upErr) throw new Error(upErr.message)

      // L'ancienne couverture part une fois la nouvelle en place : si
      // l'envoi échoue, on n'a rien perdu.
      if (coverPath && coverPath !== path) {
        await supabase.storage.from('object-images').remove([coverPath])
      }

      setCoverPath(path)
      setCoverUrl(saved.uri)
      setMode('photo')
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function removeCover() {
    if (coverPath) await supabase.storage.from('object-images').remove([coverPath])
    setCoverPath(null)
    setCoverUrl(null)
    setMode('icon')
  }

  async function save() {
    if (!collection) return
    const trimmed = name.trim()
    if (!trimmed) return

    setBusy(true)
    // Le mode choisi décide de ce qui est enregistré : rester sur l'onglet
    // Icône après avoir pris une photo doit retirer la photo, sinon le
    // choix affiché ne serait pas celui appliqué.
    const patch: CollectionPatch = {
      name: trimmed,
      emoji,
      icon_color: color,
      cover_image_path: mode === 'photo' ? coverPath : null,
    }

    const { error } = await supabase
      .from('collections')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', collection.id)
    setBusy(false)

    if (error) { Alert.alert(t('common.error'), error.message); return }
    onSaved(patch)
    onClose()
  }

  if (!collection) return null

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.handle} />
        <Text style={s.title}>{t('collections.editTitle')}</Text>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.body}>
          <Text style={s.fieldLabel}>{t('collections.nameLabel')}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            style={s.input}
            placeholder={t('collections.namePlaceholder')}
            placeholderTextColor={Colors.textTertiary}
            returnKeyType="done"
          />

          <View style={s.tabs}>
            {(['icon', 'photo'] as const).map(k => (
              <TouchableOpacity
                key={k}
                style={[s.tab, mode === k && s.tabActive]}
                onPress={() => setMode(k)}
                activeOpacity={0.8}
              >
                <Text style={[s.tabText, mode === k && s.tabTextActive]}>
                  {t(k === 'icon' ? 'collections.tabIcon' : 'collections.tabPhoto')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {mode === 'icon' ? (
            <>
              <View style={s.emojiGrid}>
                {COLLECTION_EMOJIS.map(e => (
                  <TouchableOpacity
                    key={e}
                    style={[s.emojiCell, emoji === e && s.emojiCellActive]}
                    onPress={() => setEmoji(e)}
                  >
                    <Text style={s.emojiCellText}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={s.colorRow}>
                {COLLECTION_COLORS.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[s.colorCell, { backgroundColor: c }, color === c && s.colorCellActive]}
                    onPress={() => setColor(c)}
                  />
                ))}
              </View>
            </>
          ) : (
            <View style={s.photoBlock}>
              {coverUrl ? (
                <Image source={{ uri: coverUrl }} style={s.preview} resizeMode="cover" />
              ) : (
                <View style={[s.preview, s.previewEmpty]}>
                  <Images size={26} color={Colors.textTertiary} strokeWidth={1.5} />
                  <Text style={s.previewHint}>{t('collections.photoHint')}</Text>
                </View>
              )}

              <View style={s.photoActions}>
                <TouchableOpacity style={s.photoBtn} onPress={() => pickCover('camera')} disabled={busy}>
                  <Camera size={17} color={Colors.textPrimary} strokeWidth={1.7} />
                  <Text style={s.photoBtnText}>{t('capture.takePhoto')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.photoBtn} onPress={() => pickCover('library')} disabled={busy}>
                  <Images size={17} color={Colors.textPrimary} strokeWidth={1.7} />
                  <Text style={s.photoBtnText}>{t('capture.library')}</Text>
                </TouchableOpacity>
              </View>

              {coverPath && (
                <TouchableOpacity style={s.removeBtn} onPress={removeCover} disabled={busy}>
                  <Trash2 size={14} color={Colors.error} strokeWidth={1.8} />
                  <Text style={s.removeBtnText}>{t('collections.photoRemove')}</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </ScrollView>

        <TouchableOpacity
          style={[s.saveBtn, (busy || !name.trim()) && s.saveBtnOff]}
          onPress={save}
          disabled={busy || !name.trim()}
          activeOpacity={0.85}
        >
          {busy
            ? <ActivityIndicator color={Colors.textInverse} />
            : <Text style={s.saveBtnText}>{t('common.save')}</Text>}
        </TouchableOpacity>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.xl,
    maxHeight: '88%',
  },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: Spacing.sm },
  title: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary, marginBottom: Spacing.md },
  body: { gap: Spacing.sm, paddingBottom: Spacing.md },

  fieldLabel: {
    fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 0.5, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    fontSize: Typography.base, color: Colors.textPrimary,
  },

  tabs: { flexDirection: 'row', gap: Spacing.xs, marginTop: Spacing.sm },
  tab: {
    flex: 1, alignItems: 'center', paddingVertical: 9,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  tabActive: { borderColor: Colors.accent, backgroundColor: Colors.accentLight },
  tabText: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textSecondary },
  tabTextActive: { color: Colors.accent, fontWeight: Typography.semibold },

  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.sm },
  emojiCell: {
    width: 46, height: 46, borderRadius: Radius.md,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  emojiCellActive: { borderColor: Colors.accent, backgroundColor: Colors.accentLight },
  emojiCellText: { fontSize: 20, lineHeight: 26 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
  colorCell: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' },
  colorCellActive: { borderWidth: 3, borderColor: Colors.accent },

  photoBlock: { gap: Spacing.sm, marginTop: Spacing.sm },
  preview: { width: '100%', height: 180, borderRadius: Radius.lg, backgroundColor: Colors.surfaceWarm },
  previewEmpty: { alignItems: 'center', justifyContent: 'center', gap: Spacing.xs },
  previewHint: { fontSize: Typography.sm, color: Colors.textTertiary, textAlign: 'center', paddingHorizontal: Spacing.lg },
  photoActions: { flexDirection: 'row', gap: Spacing.sm },
  photoBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs,
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 0.5, borderColor: Colors.border, paddingVertical: 12,
  },
  photoBtnText: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },
  removeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  removeBtnText: { fontSize: Typography.sm, color: Colors.error, fontWeight: Typography.medium },

  saveBtn: {
    backgroundColor: Colors.accent, borderRadius: Radius.md,
    paddingVertical: 14, alignItems: 'center', marginTop: Spacing.sm,
  },
  saveBtnOff: { opacity: 0.5 },
  saveBtnText: { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.textInverse },
})
