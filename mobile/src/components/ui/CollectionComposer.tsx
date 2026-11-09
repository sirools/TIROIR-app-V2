import React, { useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Animated, Easing,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { Colors, Typography, Spacing, Radius } from './tokens'
import { EmojiKeyboardSheet } from './EmojiKeyboardSheet'
import { dismissKeyboard } from './keyboard'

export const COLLECTION_EMOJIS = [
  '📦', '👗', '👟', '🧸', '📚', '🎸', '🏡', '🖼️', '💻', '⌚', '🧴', '🎮', '🪴', '🍳',
]

export const COLLECTION_COLORS = [
  '#E8F0E0', '#FAE8DC', '#DCF0F7', '#EDE8F5',
  '#F7E8EC', '#F5EDD6', '#DCF5EC', '#E8ECF0',
]

const DEFAULT_EMOJI = '📦'
const DEFAULT_COLOR = '#E8F0E0'

interface CollectionComposerProps {
  /**
   * `first` : l'utilisateur n'a encore aucune collection — la carte
   * explique à quoi ça sert. `add` : forme compacte en bas de liste.
   */
  variant: 'first' | 'add'
  /** Retourne true si la création a réussi (la carte se referme alors). */
  onCreate: (name: string, emoji: string, color: string) => Promise<boolean>
}

/**
 * Carte de création de collection, éditable sur place.
 *
 * Plutôt qu'un écran d'onboarding qui décrit la marche à suivre, la carte
 * est déjà là, à sa future place dans la liste : on tape le nom dans la
 * carte, on choisit sa pastille, elle devient la collection.
 */
export function CollectionComposer({ variant, onCreate }: CollectionComposerProps) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState(DEFAULT_EMOJI)
  const [color, setColor] = useState(DEFAULT_COLOR)
  const [saving, setSaving] = useState(false)
  const [keyboardSheet, setKeyboardSheet] = useState(false)
  const inputRef = useRef<TextInput>(null)

  const appear = useRef(new Animated.Value(0)).current
  const pop = useRef(new Animated.Value(1)).current

  useEffect(() => {
    Animated.timing(appear, {
      toValue: editing ? 1 : 0,
      duration: editing ? 260 : 160,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [editing])

  /** Petit rebond de la pastille : le choix d'icône doit se sentir. */
  function bounce() {
    pop.setValue(0.82)
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, damping: 8, mass: 0.5 }).start()
  }

  function open(prefill?: string) {
    setName(prefill ?? '')
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 120)
  }

  function close() {
    dismissKeyboard()
    setEditing(false)
    setName('')
    setEmoji(DEFAULT_EMOJI)
    setColor(DEFAULT_COLOR)
  }

  async function submit() {
    const trimmed = name.trim()
    if (!trimmed || saving) return
    setSaving(true)
    const ok = await onCreate(trimmed, emoji, color)
    setSaving(false)
    if (ok) close()
  }

  const canSubmit = name.trim().length > 0 && !saving

  // ── Repos ─────────────────────────────────────────────────────────────────

  if (!editing) {
    if (variant === 'add') {
      return (
        <TouchableOpacity style={s.addCard} onPress={() => open()} activeOpacity={0.7}>
          <View style={s.addPlus}><Text style={s.addPlusText}>+</Text></View>
          <Text style={s.addLabel}>{t('collectionComposer.addLabel')}</Text>
        </TouchableOpacity>
      )
    }

    return (
      <TouchableOpacity style={s.inviteCard} onPress={() => open()} activeOpacity={0.85}>
        <View style={s.inviteIcon}>
          <Text style={s.inviteEmoji}>🗂️</Text>
        </View>
        <Text style={s.inviteTitle}>{t('collectionComposer.inviteTitle')}</Text>
        <Text style={s.inviteBody}>{t('collectionComposer.inviteBody')}</Text>

        {/* Exemples : un nom à soi vaut mieux qu'une case vide. */}
        <View style={s.suggestions}>
          {['suggestion1', 'suggestion2', 'suggestion3'].map(key => (
            <TouchableOpacity
              key={key}
              style={s.suggestionChip}
              onPress={() => open(t(`collectionComposer.${key}`))}
              activeOpacity={0.7}
            >
              <Text style={s.suggestionText}>{t(`collectionComposer.${key}`)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={s.inviteCta}>
          <Text style={s.inviteCtaText}>{t('collectionComposer.inviteCta')}</Text>
        </View>
      </TouchableOpacity>
    )
  }

  // ── Édition ───────────────────────────────────────────────────────────────

  return (
    <Animated.View
      style={[
        s.editCard,
        {
          opacity: appear,
          transform: [{ translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
        },
      ]}
    >
      <View style={s.editHead}>
        <Animated.View style={[s.editIcon, { backgroundColor: color, transform: [{ scale: pop }] }]}>
          <Text style={s.editIconEmoji}>{emoji}</Text>
        </Animated.View>

        <TextInput
          ref={inputRef}
          value={name}
          onChangeText={setName}
          style={s.editInput}
          placeholder={t('collectionComposer.namePlaceholder')}
          placeholderTextColor={Colors.textTertiary}
          returnKeyType="done"
          maxLength={60}
          onSubmitEditing={submit}
          blurOnSubmit={false}
        />
      </View>

      {/* Icône */}
      <Text style={s.pickerLabel}>{t('collectionComposer.iconLabel')}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.pickerRow}
      >
        {COLLECTION_EMOJIS.map(e => (
          <TouchableOpacity
            key={e}
            style={[s.emojiCell, emoji === e && s.emojiCellActive]}
            onPress={() => { setEmoji(e); bounce() }}
            activeOpacity={0.7}
          >
            <Text style={s.emojiCellText}>{e}</Text>
          </TouchableOpacity>
        ))}
        {/* Tout le clavier emoji, au-delà des propositions */}
        <TouchableOpacity
          style={s.emojiMore}
          onPress={() => setKeyboardSheet(true)}
          activeOpacity={0.7}
        >
          <Text style={s.emojiMoreText}>+</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Couleur */}
      <Text style={s.pickerLabel}>{t('collectionComposer.colorLabel')}</Text>
      <View style={s.colorRow}>
        {COLLECTION_COLORS.map(c => (
          <TouchableOpacity
            key={c}
            style={[s.colorCell, { backgroundColor: c }, color === c && s.colorCellActive]}
            onPress={() => { setColor(c); bounce() }}
            activeOpacity={0.8}
          />
        ))}
      </View>

      <View style={s.editActions}>
        <TouchableOpacity style={s.cancelBtn} onPress={close} activeOpacity={0.7} disabled={saving}>
          <Text style={s.cancelText}>{t('common.cancel')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.saveBtn, !canSubmit && s.saveBtnDisabled]}
          onPress={submit}
          disabled={!canSubmit}
          activeOpacity={0.88}
        >
          {saving
            ? <ActivityIndicator size="small" color={Colors.textInverse} />
            : <Text style={s.saveText}>{t('collectionComposer.create')}</Text>
          }
        </TouchableOpacity>
      </View>

      <EmojiKeyboardSheet
        visible={keyboardSheet}
        previewColor={color}
        onPick={picked => { setEmoji(picked); setKeyboardSheet(false); bounce() }}
        onClose={() => setKeyboardSheet(false)}
      />
    </Animated.View>
  )
}

const s = StyleSheet.create({
  // ── Invite (première collection) ──
  inviteCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    padding: Spacing.lg,
    gap: Spacing.sm,
    alignItems: 'flex-start',
  },
  inviteIcon: {
    width: 64, height: 64,
    borderRadius: Radius.lg,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  inviteEmoji: { fontSize: 32, lineHeight: 40 },
  inviteTitle: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  inviteBody: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    lineHeight: 21,
  },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.xs },
  suggestionChip: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  suggestionText: { fontSize: Typography.xs, color: Colors.textSecondary, fontWeight: Typography.medium },
  inviteCta: {
    marginTop: Spacing.sm,
    alignSelf: 'stretch',
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: 13,
    alignItems: 'center',
  },
  inviteCtaText: {
    fontSize: Typography.base,
    fontWeight: Typography.bold,
    color: Colors.textInverse,
  },

  // ── Ajout compact ──
  addCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  addPlus: {
    width: 56, height: 56,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPlusText: { fontSize: 26, lineHeight: 30, color: Colors.accent, fontWeight: Typography.bold },
  addLabel: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textSecondary },

  // ── Édition ──
  editCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.accent,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  editHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  editIcon: {
    width: 56, height: 56,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editIconEmoji: { fontSize: 28, lineHeight: 36 },
  editInput: {
    flex: 1,
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
    paddingVertical: 6,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.borderLight,
  },
  pickerLabel: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    color: Colors.textTertiary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: Spacing.xs,
  },
  pickerRow: { gap: Spacing.xs, paddingRight: Spacing.md },
  emojiCell: {
    width: 40, height: 40,
    borderRadius: Radius.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  emojiCellActive: { borderColor: Colors.accent, backgroundColor: Colors.accentLight },
  emojiCellText: { fontSize: 20, lineHeight: 26 },
  emojiMore: {
    width: 40, height: 40,
    borderRadius: Radius.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.border,
  },
  emojiMoreText: { fontSize: 20, lineHeight: 24, color: Colors.accent, fontWeight: Typography.bold },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  colorCell: {
    width: 34, height: 34,
    borderRadius: Radius.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorCellActive: { borderColor: Colors.accent },
  editActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  cancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  cancelText: { fontSize: Typography.base, color: Colors.textSecondary, fontWeight: Typography.medium },
  saveBtn: {
    flex: 1.4, paddingVertical: 12, borderRadius: Radius.md,
    backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.35 },
  saveText: { fontSize: Typography.base, color: Colors.textInverse, fontWeight: Typography.bold },
})
