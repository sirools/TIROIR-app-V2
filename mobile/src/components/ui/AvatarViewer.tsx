import React from 'react'
import {
  View, Text, Image, Modal, Pressable, TouchableOpacity, StyleSheet, useWindowDimensions,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react-native'
import { useSignedAvatarUrl } from './UserAvatar'
import { Colors, Typography, Spacing, Radius } from './tokens'

interface Props {
  visible: boolean
  /** Chemin de la photo dans object-images (profiles.avatar_path). */
  avatarPath: string | null | undefined
  onClose: () => void
  onChange: () => void
}

/**
 * La photo de profil en grand, comme sur le site (web/pages/profil.tsx) :
 * la croix, « Fermer » ou un toucher à côté la referment.
 */
export function AvatarViewer({ visible, avatarPath, onClose, onChange }: Props) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const { width, height } = useWindowDimensions()
  const uri = useSignedAvatarUrl(visible ? avatarPath : null)
  const side = Math.min(width - Spacing.lg * 2, height * 0.6, 640)

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('profile.photoClose')}>
        <TouchableOpacity
          style={[styles.close, { top: insets.top + Spacing.sm }]}
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={t('profile.photoClose')}
        >
          <X size={20} color="white" strokeWidth={2} />
        </TouchableOpacity>

        {/* Le toucher sur la photo ou les boutons ne ferme pas la vue. */}
        <Pressable onPress={() => {}}>
          {uri
            ? <Image source={{ uri }} style={[styles.image, { width: side, height: side }]} resizeMode="cover" />
            : <View style={[styles.image, { width: side, height: side }]} />}
        </Pressable>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.primary} onPress={onChange} activeOpacity={0.85}>
            <Text style={styles.primaryText}>{t('profile.photoChangeShort')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghost} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.ghostText}>{t('profile.photoClose')}</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(26, 22, 18, 0.96)',
    alignItems: 'center', justifyContent: 'center',
    gap: Spacing.lg,
    padding: Spacing.lg,
  },
  close: {
    position: 'absolute', right: Spacing.md,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center', justifyContent: 'center',
  },
  image: { borderRadius: 20, backgroundColor: '#2A241F' },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  primary: {
    backgroundColor: Colors.accent, borderRadius: Radius.md,
    paddingHorizontal: 18, paddingVertical: 11,
  },
  primaryText: { color: 'white', fontSize: Typography.sm, fontWeight: Typography.bold },
  ghost: {
    backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: Radius.md,
    paddingHorizontal: 18, paddingVertical: 11,
  },
  ghostText: { color: 'white', fontSize: Typography.sm, fontWeight: Typography.bold },
})
