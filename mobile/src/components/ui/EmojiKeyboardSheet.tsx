import React, { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, Modal, TextInput, TouchableOpacity,
  KeyboardAvoidingView, Platform, Pressable,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { Colors, Typography, Spacing, Radius } from './tokens'
import { extractLastEmoji } from '@/utils/emoji'

interface EmojiKeyboardSheetProps {
  visible: boolean
  /** Couleur de fond de l'aperçu — reprend celle de la collection en cours. */
  previewColor?: string
  onPick: (emoji: string) => void
  onClose: () => void
}

/**
 * Saisie d'un emoji libre au clavier système.
 *
 * Aucune API ne permet d'ouvrir directement le clavier emoji : on ouvre
 * un champ texte et l'utilisateur bascule dessus (touche 😀 / 🌐). On ne
 * garde que le dernier emoji tapé, et on refuse le texte ordinaire.
 */
export function EmojiKeyboardSheet({ visible, previewColor, onPick, onClose }: EmojiKeyboardSheetProps) {
  const { t } = useTranslation()
  const [raw, setRaw] = useState('')
  const [picked, setPicked] = useState<string | null>(null)
  const inputRef = useRef<TextInput>(null)

  useEffect(() => {
    if (visible) {
      setRaw('')
      setPicked(null)
      // Laisse le temps à la modale de se poser avant de demander le focus.
      const id = setTimeout(() => inputRef.current?.focus(), 180)
      return () => clearTimeout(id)
    }
  }, [visible])

  function handleChange(text: string) {
    const emoji = extractLastEmoji(text)
    if (emoji) {
      setPicked(emoji)
      setRaw(emoji)
    } else {
      setPicked(null)
      setRaw(text)
    }
  }

  const showHelp = raw.length > 0 && !picked

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={s.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={s.backdrop} onPress={onClose} />

        <View style={s.card}>
          <Text style={s.title}>{t('emojiKeyboard.title')}</Text>
          <Text style={s.hint}>{t('emojiKeyboard.hint')}</Text>

          <View style={[s.preview, { backgroundColor: previewColor ?? Colors.accentLight }]}>
            <Text style={s.previewEmoji}>{picked ?? '⌨️'}</Text>
          </View>

          <TextInput
            ref={inputRef}
            value={raw}
            onChangeText={handleChange}
            style={[s.input, showHelp && s.inputError]}
            placeholder={t('emojiKeyboard.placeholder')}
            placeholderTextColor={Colors.textTertiary}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="done"
            onSubmitEditing={() => picked && onPick(picked)}
          />

          {showHelp && <Text style={s.error}>{t('emojiKeyboard.notAnEmoji')}</Text>}

          <View style={s.actions}>
            <TouchableOpacity style={s.cancelBtn} onPress={onClose} activeOpacity={0.7}>
              <Text style={s.cancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.confirmBtn, !picked && s.confirmDisabled]}
              onPress={() => picked && onPick(picked)}
              disabled={!picked}
              activeOpacity={0.85}
            >
              <Text style={s.confirmText}>{t('emojiKeyboard.use')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.lg },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  title: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },
  hint: { fontSize: Typography.sm, color: Colors.textSecondary, lineHeight: 20 },
  preview: {
    alignSelf: 'center',
    width: 88, height: 88,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.sm,
  },
  previewEmoji: { fontSize: 46, lineHeight: 56 },
  input: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: 28,
    lineHeight: 36,
    textAlign: 'center',
    color: Colors.textPrimary,
  },
  inputError: { borderColor: Colors.error },
  error: { fontSize: Typography.sm, color: Colors.error, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  cancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  cancelText: { fontSize: Typography.base, color: Colors.textSecondary, fontWeight: Typography.medium },
  confirmBtn: {
    flex: 1, paddingVertical: 13, borderRadius: Radius.md,
    backgroundColor: Colors.accent, alignItems: 'center',
  },
  confirmDisabled: { opacity: 0.4 },
  confirmText: { fontSize: Typography.base, color: Colors.textInverse, fontWeight: Typography.semibold },
})
