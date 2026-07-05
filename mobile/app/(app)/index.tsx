import React, { useCallback, useRef, useState } from 'react'
import { GlobalMenu, BurgerIcon } from '@/components/GlobalMenu'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useFocusEffect } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'
import { EmptyState, Colors, Typography, Spacing, Radius } from '@/components/ui'
import { Collection, TiroirObject } from '@/types/database'

type CollectionWithCount = Collection & { objectCount: number }

export default function HomeScreen() {
  const router = useRouter()
  const { t } = useTranslation()
  const { profile } = useAuth()
  const [collections, setCollections] = useState<CollectionWithCount[]>([])
  const [recentObjects, setRecentObjects] = useState<TiroirObject[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newEmoji, setNewEmoji] = useState('📦')
  const [newColor, setNewColor] = useState('#E8F0E0')
  const [creating, setCreating] = useState(false)

  const EMOJI_PRESETS = ['📦','👗','👟','🧸','📚','🎸','🏡','🖼️','💻','⌚','🧴','🎮']
  const COLOR_PRESETS = ['#E8F0E0','#FDE8DF','#E8F0FB','#FFF7ED','#F0FDF4','#EEF0FE','#FEF9C3','#FCE7F3']
  const [menuOpen, setMenuOpen] = useState(false)
  const onboardingChecked = useRef(false)

  const load = useCallback(async () => {
    const [colRes, objRes, countRes] = await Promise.all([
      supabase.from('collections').select('*').order('updated_at', { ascending: false }).limit(20),
      supabase.from('objects').select('*').order('created_at', { ascending: false }).limit(6),
      supabase.from('objects').select('collection_id').not('collection_id', 'is', null),
    ])

    if (!objRes.error) setRecentObjects(objRes.data ?? [])

    if (!colRes.error) {
      const countMap: Record<string, number> = {}
      if (!countRes.error) {
        for (const o of countRes.data ?? []) {
          if (o.collection_id) countMap[o.collection_id] = (countMap[o.collection_id] ?? 0) + 1
        }
      }
      setCollections(
        (colRes.data ?? []).map(c => ({ ...c, objectCount: countMap[c.id] ?? 0 }))
      )

      // Rediriger vers l'onboarding uniquement au premier chargement si tout est vide
      if (!onboardingChecked.current) {
        onboardingChecked.current = true
        const isEmpty = (colRes.data ?? []).length === 0 && (objRes.data ?? []).length === 0
        if (isEmpty) router.replace('/(app)/onboarding')
      }
    }

    setRefreshing(false)
  }, [])

  useFocusEffect(useCallback(() => { load() }, [load]))

  function onRefresh() { setRefreshing(true); load() }

  async function handleCreate() {
    const name = newName.trim()
    if (!name) return
    setCreating(true)

    const { data: { user } } = await supabase.auth.getUser()
    const { data: drawer } = await supabase.from('drawers').select('id').single()

    if (!drawer || !user) {
      Alert.alert(t('common.error'), t('home.drawerNotFound'))
      setCreating(false)
      return
    }

    const { data, error } = await supabase
      .from('collections')
      .insert({ name, drawer_id: drawer.id, user_id: user.id, emoji: newEmoji, icon_color: newColor })
      .select()
      .single()

    setCreating(false)
    if (error) { Alert.alert(t('common.error'), error.message); return }

    setCollections(prev => [{ ...data, objectCount: 0 }, ...prev])
    setNewName('')
    setNewEmoji('📦')
    setNewColor('#E8F0E0')
    setShowCreate(false)
  }

  function handleDeleteCollection(col: CollectionWithCount) {
    const msg = col.objectCount > 0
      ? t('home.deleteCollectionWithObjects', { count: col.objectCount })
      : t('home.deleteCollectionIrreversible')

    Alert.alert(t('home.deleteCollectionTitle', { name: col.name }), msg, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.from('collections').delete().eq('id', col.id)
          if (error) { Alert.alert(t('common.error'), error.message); return }
          setCollections(prev => prev.filter(c => c.id !== col.id))
        },
      },
    ])
  }

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 12) return t('home.greetingMorning')
    if (h < 18) return t('home.greetingAfternoon')
    return t('home.greetingEvening')
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
      >
        {/* En-tête */}
        <View style={styles.hero}>
          <TouchableOpacity style={styles.heroLeft} onPress={() => router.push('/profile')} activeOpacity={0.7}>
            <Text style={styles.greeting}>{greeting()}{profile?.display_name ? `, ${profile.display_name}` : ''}</Text>
            <Text style={styles.heroTitle}>{t('home.title')}</Text>
          </TouchableOpacity>
          <BurgerIcon onPress={() => setMenuOpen(true)} />
        </View>

        {/* Barre de recherche */}
        <TouchableOpacity style={styles.searchBar} onPress={() => router.push('/search')} activeOpacity={0.7}>
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={styles.searchPlaceholder}>{t('home.search')}</Text>
        </TouchableOpacity>

        {/* Section collections */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>{t('home.myCollections')}</Text>
        </View>

        {collections.length === 0 ? (
          <Text style={styles.emptyHint}>{t('home.noCollections')}</Text>
        ) : (
          <View style={styles.collectionList}>
            {collections.map(col => (
              <TouchableOpacity
                key={col.id}
                style={styles.collectionCard}
                onPress={() => router.push(`/collections/${col.id}`)}
                onLongPress={() => handleDeleteCollection(col)}
                activeOpacity={0.75}
              >
                <View style={[styles.collectionIcon, { backgroundColor: col.icon_color ?? '#E8F0E0' }]}>
                  <Text style={styles.collectionIconText}>{col.emoji ?? '📦'}</Text>
                </View>
                <View style={styles.collectionInfo}>
                  <Text style={styles.collectionName}>{col.name}</Text>
                  <Text style={styles.collectionCount}>
                    {t('common.objects', { count: col.objectCount })}
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* FAB création collection */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowCreate(true)} activeOpacity={0.85}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Modal création */}
      <Modal visible={showCreate} transparent animationType="fade" onRequestClose={() => setShowCreate(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowCreate(false)} />
          <View style={styles.modalCard}>
            {/* Aperçu */}
            <View style={styles.modalPreviewRow}>
              <View style={[styles.modalPreviewIcon, { backgroundColor: newColor }]}>
                <Text style={styles.modalPreviewEmoji}>{newEmoji}</Text>
              </View>
              <Text style={styles.modalTitle}>{t('home.newCollection')}</Text>
            </View>

            {/* Nom */}
            <TextInput
              style={styles.modalInput}
              value={newName}
              onChangeText={setNewName}
              placeholder={t('home.collectionNamePlaceholder')}
              placeholderTextColor={Colors.textTertiary}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleCreate}
            />

            {/* Emoji */}
            <Text style={styles.modalPickerLabel}>{t('home.iconLabel')}</Text>
            <View style={styles.modalPickerRow}>
              {EMOJI_PRESETS.map(e => (
                <TouchableOpacity
                  key={e}
                  style={[styles.modalEmojiBtn, newEmoji === e && { borderColor: Colors.accent, borderWidth: 2 }]}
                  onPress={() => setNewEmoji(e)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalEmojiText}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Couleur */}
            <Text style={styles.modalPickerLabel}>{t('home.colorLabel')}</Text>
            <View style={styles.modalPickerRow}>
              {COLOR_PRESETS.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[styles.modalColorBtn, { backgroundColor: c }, newColor === c && styles.modalColorBtnActive]}
                  onPress={() => setNewColor(c)}
                  activeOpacity={0.7}
                />
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => { setShowCreate(false); setNewName('') }}>
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, (!newName.trim() || creating) && styles.modalConfirmDisabled]}
                onPress={handleCreate}
                disabled={!newName.trim() || creating}
              >
                {creating
                  ? <ActivityIndicator color="white" size="small" />
                  : <Text style={styles.modalConfirmText}>{t('home.create')}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <GlobalMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, gap: Spacing.md, paddingBottom: 140 },

  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  heroLeft: { gap: 4 },
  greeting: { fontSize: Typography.sm, color: Colors.textSecondary },
  heroTitle: { fontSize: 32, fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5 },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  searchIcon: { fontSize: 16 },
  searchPlaceholder: { fontSize: Typography.base, color: Colors.textTertiary, flex: 1 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.xs },
  sectionLabel: { fontSize: Typography.xs, fontWeight: '600', color: Colors.textTertiary, letterSpacing: 1, textTransform: 'uppercase' },

  emptyHint: { fontSize: Typography.sm, color: Colors.textTertiary, fontStyle: 'italic' },

  collectionList: { gap: Spacing.sm },
  collectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  collectionIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collectionIconText: { fontSize: 20 },
  collectionInfo: { flex: 1, gap: 2 },
  collectionName: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  collectionCount: { fontSize: Typography.sm, color: Colors.textSecondary },
  chevron: { fontSize: Typography.xl, color: Colors.textTertiary },

  fab: {
    position: 'absolute',
    right: Spacing.lg,
    bottom: 32,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: { color: 'white', fontSize: 28, lineHeight: 30, marginTop: -2 },

  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalCard: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.xl,
    gap: Spacing.md,
    paddingBottom: 40,
  },
  modalPreviewRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  modalPreviewIcon: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  modalPreviewEmoji: { fontSize: 24 },
  modalTitle: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },
  modalPickerLabel: { fontSize: Typography.xs, fontWeight: '600', color: Colors.textTertiary, letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 2 },
  modalPickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modalEmojiBtn: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.background, borderWidth: 1.5, borderColor: Colors.border,
  },
  modalEmojiText: { fontSize: 20 },
  modalColorBtn: {
    width: 32, height: 32, borderRadius: 8,
    borderWidth: 2, borderColor: 'transparent',
  },
  modalColorBtnActive: { borderColor: Colors.accent },
  modalInput: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: Typography.base,
    color: Colors.textPrimary,
  },
  modalActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
  modalCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  modalCancelText: { fontSize: Typography.base, color: Colors.textSecondary },
  modalConfirm: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.md,
    backgroundColor: Colors.accent,
    alignItems: 'center',
  },
  modalConfirmDisabled: { opacity: 0.4 },
  modalConfirmText: { fontSize: Typography.base, color: 'white', fontWeight: Typography.semibold },
})
