import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { Colors, Typography, Spacing, Radius } from './tokens'
import { EmojiKeyboardSheet } from './EmojiKeyboardSheet'

export const EMOJI_LIST = [
  '📦','🏠','🎮','💻','📱','🎵','📸','🚗','👕','📚',
  '🔧','🎨','🏋️','✈️','💎','🍳','🌱','🎭','🔑','💡',
  '🧸','🪑','🛋️','🖼️','⌚','👟','🎸','🧴','🪴','🎁',
  '📷','🔭','🎯','🏆','🧰','🎀','🪆','🎪','🛡️','🪩',
]

export const COLOR_LIST = [
  { hex: '#E8F0E0', name: 'Sauge' },
  { hex: '#F5EDD6', name: 'Sable' },
  { hex: '#DCF0F7', name: 'Ciel' },
  { hex: '#EDE8F5', name: 'Lavande' },
  { hex: '#F7E8EC', name: 'Rose' },
  { hex: '#FAE8DC', name: 'Pêche' },
  { hex: '#DCF5EC', name: 'Menthe' },
  { hex: '#E8ECF0', name: 'Ardoise' },
]

interface IconPickerProps {
  visible: boolean
  currentEmoji: string
  currentColor: string
  onSave: (emoji: string, color: string) => void
  onClose: () => void
}

export function IconPicker({ visible, currentEmoji, currentColor, onSave, onClose }: IconPickerProps) {
  const { t } = useTranslation()
  const [emoji, setEmoji] = useState(currentEmoji)
  const [color, setColor] = useState(currentColor)
  const [keyboardSheet, setKeyboardSheet] = useState(false)

  React.useEffect(() => {
    if (visible) {
      setEmoji(currentEmoji)
      setColor(currentColor)
    }
  }, [visible, currentEmoji, currentColor])

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.handle} />

        {/* Aperçu */}
        <View style={s.preview}>
          <View style={[s.previewIcon, { backgroundColor: color }]}>
            <Text style={s.previewEmoji}>{emoji}</Text>
          </View>
          <Text style={s.previewLabel}>{t('iconPicker.preview')}</Text>
        </View>

        {/* Couleurs */}
        <Text style={s.sectionLabel}>{t('iconPicker.backgroundColor')}</Text>
        <View style={s.colorRow}>
          {COLOR_LIST.map(c => (
            <TouchableOpacity
              key={c.hex}
              onPress={() => setColor(c.hex)}
              style={[s.colorSwatch, { backgroundColor: c.hex }, color === c.hex && s.colorSwatchActive]}
              activeOpacity={0.8}
            />
          ))}
        </View>

        {/* Emojis */}
        <Text style={s.sectionLabel}>{t('iconPicker.icon')}</Text>
        <View style={s.emojiGrid}>
          {EMOJI_LIST.map(e => (
            <TouchableOpacity
              key={e}
              onPress={() => setEmoji(e)}
              style={[s.emojiCell, emoji === e && s.emojiCellActive]}
              activeOpacity={0.7}
            >
              <Text style={s.emojiText}>{e}</Text>
            </TouchableOpacity>
          ))}
          {/* Sortie vers le clavier système : la grille propose, elle n'enferme pas. */}
          <TouchableOpacity
            onPress={() => setKeyboardSheet(true)}
            style={[s.emojiCell, s.emojiCellMore, !EMOJI_LIST.includes(emoji) && s.emojiCellActive]}
            activeOpacity={0.7}
          >
            <Text style={s.emojiMoreText}>+</Text>
          </TouchableOpacity>
        </View>

        <EmojiKeyboardSheet
          visible={keyboardSheet}
          previewColor={color}
          onPick={picked => { setEmoji(picked); setKeyboardSheet(false) }}
          onClose={() => setKeyboardSheet(false)}
        />

        <TouchableOpacity style={s.saveBtn} onPress={() => onSave(emoji, color)} activeOpacity={0.85}>
          <Text style={s.saveBtnText}>{t('iconPicker.apply')}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  )
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 40,
    paddingTop: Spacing.sm,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  preview: { alignItems: 'center', marginBottom: Spacing.lg },
  previewIcon: {
    width: 64, height: 64, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  previewEmoji: { fontSize: 32 },
  previewLabel: { fontSize: Typography.xs, color: Colors.textTertiary },
  sectionLabel: {
    fontSize: Typography.xs, fontWeight: Typography.bold,
    color: Colors.textTertiary, textTransform: 'uppercase',
    letterSpacing: 0.7, marginBottom: Spacing.sm, marginTop: Spacing.xs,
  },
  colorRow: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.md, flexWrap: 'wrap' },
  colorSwatch: {
    width: 32, height: 32, borderRadius: 10,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  colorSwatchActive: { borderColor: Colors.accent, transform: [{ scale: 1.15 }] },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.lg },
  emojiCell: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  emojiCellActive: {
    backgroundColor: Colors.accentLight,
    borderWidth: 1.5, borderColor: Colors.accent,
  },
  emojiText: { fontSize: 24 },
  emojiCellMore: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.border,
  },
  emojiMoreText: { fontSize: 22, lineHeight: 26, color: Colors.accent, fontWeight: Typography.bold },
  saveBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  saveBtnText: { color: Colors.textInverse, fontSize: Typography.base, fontWeight: Typography.semibold },
})
