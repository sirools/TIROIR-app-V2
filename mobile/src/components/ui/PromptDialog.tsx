import React, { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Pressable,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { Colors, Typography, Spacing, Radius } from './tokens'
import { FormSheet } from './keyboard'

interface PromptDialogProps {
  visible: boolean
  title: string
  placeholder?: string
  initialValue?: string
  confirmLabel: string
  onConfirm: (value: string) => void
  onClose: () => void
}

/** Saisie d'une ligne de texte : renommer, titrer. Rien de plus. */
export function PromptDialog({
  visible, title, placeholder, initialValue = '', confirmLabel, onConfirm, onClose,
}: PromptDialogProps) {
  const { t } = useTranslation()
  const [value, setValue] = useState(initialValue)
  const inputRef = useRef<TextInput>(null)

  useEffect(() => {
    if (visible) {
      setValue(initialValue)
      const id = setTimeout(() => inputRef.current?.focus(), 150)
      return () => clearTimeout(id)
    }
  }, [visible, initialValue])

  function submit() {
    const trimmed = value.trim()
    if (!trimmed) return
    onConfirm(trimmed)
  }

  return (
    <FormSheet visible={visible} animationType="fade" onRequestClose={onClose} containerStyle={s.overlay}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={s.card}>
        <Text style={s.title}>{title}</Text>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={setValue}
          style={s.input}
          placeholder={placeholder}
          placeholderTextColor={Colors.textTertiary}
          returnKeyType="done"
          maxLength={80}
          selectTextOnFocus
          onSubmitEditing={submit}
        />
        <View style={s.actions}>
          <TouchableOpacity style={s.cancelBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={s.cancelText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.confirmBtn, !value.trim() && s.confirmDisabled]}
            onPress={submit}
            disabled={!value.trim()}
            activeOpacity={0.85}
          >
            <Text style={s.confirmText}>{confirmLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </FormSheet>
  )
}

const s = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.lg },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  title: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },
  input: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: Typography.base,
    color: Colors.textPrimary,
  },
  actions: { flexDirection: 'row', gap: Spacing.sm },
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
