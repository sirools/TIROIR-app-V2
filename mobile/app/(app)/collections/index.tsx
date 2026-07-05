import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Keyboard,
} from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { Screen, EmptyState, IconPicker, Colors, Typography, Spacing, Radius } from '@/components/ui'
import { Collection } from '@/types/database'
import { setIconOverride, applyIconOverride } from '@/utils/collectionIconCache'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CollectionWithCount extends Collection {
  object_count: number
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function CollectionsScreen() {
  const router = useRouter()
  const { t } = useTranslation()
  const [collections, setCollections] = useState<CollectionWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [pickerTarget, setPickerTarget] = useState<CollectionWithCount | null>(null)

  const loadRef = useRef<() => Promise<void>>(async () => {})

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('collections')
      .select('*, objects(count)')
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('[Collections] load error:', error)
      setLoading(false)
      setRefreshing(false)
      return
    }

    const mapped: CollectionWithCount[] = (data ?? []).map(
      (row: Collection & { objects: { count: number }[] }) => {
        const { emoji, icon_color } = applyIconOverride(row.id, row.emoji ?? '📦', row.icon_color ?? '#E8F0E0')
        return {
          ...row,
          emoji,
          icon_color,
          object_count: row.objects?.[0]?.count ?? 0,
        }
      }
    )

    setCollections(mapped)
    setLoading(false)
    setRefreshing(false)
  }, [])

  // Toujours pointer vers la dernière version de load
  useEffect(() => { loadRef.current = load }, [load])

  // useFocusEffect avec deps vides garantit l'exécution à chaque focus
  // (évite le bug de double-memoization stable qui peut sauter des re-focus)
  useFocusEffect(useCallback(() => { loadRef.current() }, []))

  function onRefresh() {
    setRefreshing(true)
    load()
  }

  // ── Sauvegarde icône ────────────────────────────────────────────────────────

  async function handleIconSave(emoji: string, color: string) {
    if (!pickerTarget) return
    const targetId = pickerTarget.id

    // Mise à jour optimiste immédiate — visible avant même le retour réseau
    setIconOverride(targetId, emoji, color)
    setCollections(prev =>
      prev.map(c => c.id === targetId ? { ...c, emoji, icon_color: color } : c)
    )
    setPickerTarget(null)

    const { error } = await supabase
      .from('collections')
      .update({ emoji, icon_color: color, updated_at: new Date().toISOString() })
      .eq('id', targetId)

    if (error) Alert.alert(t('common.error'), error.message)
  }

  // ── Renommer ────────────────────────────────────────────────────────────────

  async function handleRename(collection: CollectionWithCount, newName: string) {
    const trimmed = newName.trim()
    if (!trimmed || trimmed === collection.name) return

    const { error } = await supabase
      .from('collections')
      .update({ name: trimmed, updated_at: new Date().toISOString() })
      .eq('id', collection.id)

    if (error) { Alert.alert('Erreur', error.message); return }

    setCollections(prev =>
      prev.map(c => c.id === collection.id ? { ...c, name: trimmed } : c)
    )
  }

  // ── Supprimer ───────────────────────────────────────────────────────────────

  function handleDelete(collection: CollectionWithCount) {
    const subtitle = collection.object_count > 0
      ? t('collections.deleteWithObjects', { count: collection.object_count })
      : t('collections.deleteIrreversible')

    Alert.alert(t('collections.deleteTitle', { name: collection.name }), subtitle, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase
            .from('collections')
            .delete()
            .eq('id', collection.id)
          if (error) { Alert.alert('Erreur', error.message); return }
          setCollections(prev => prev.filter(c => c.id !== collection.id))
        },
      },
    ])
  }

  // ── Rendu ────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Screen>
        <View style={styles.loader}><ActivityIndicator color={Colors.accent} /></View>
      </Screen>
    )
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('collections.title')}</Text>
      </View>

      <FlatList
        data={collections}
        keyExtractor={c => c.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <EmptyState
            title={t('collections.emptyTitle')}
            subtitle={t('collections.emptySubtitle')}
          />
        }
        renderItem={({ item }) => (
          <CollectionRow
            collection={item}
            onPress={() => router.push({ pathname: '/collections/[id]', params: { id: item.id } })}
            onRename={newName => handleRename(item, newName)}
            onDelete={() => handleDelete(item)}
            onIconPress={() => setPickerTarget(item)}
          />
        )}
      />

      <IconPicker
        visible={!!pickerTarget}
        currentEmoji={pickerTarget?.emoji ?? '📦'}
        currentColor={pickerTarget?.icon_color ?? '#E8F0E0'}
        onSave={handleIconSave}
        onClose={() => setPickerTarget(null)}
      />
    </Screen>
  )
}

// ── CollectionRow ─────────────────────────────────────────────────────────────

interface CollectionRowProps {
  collection: CollectionWithCount
  onPress: () => void
  onRename: (newName: string) => void
  onDelete: () => void
  onIconPress: () => void
}

function CollectionRow({ collection, onPress, onRename, onDelete, onIconPress }: CollectionRowProps) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(collection.name)
  const inputRef = useRef<TextInput>(null)

  function startEdit() {
    setDraftName(collection.name)
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function commitEdit() {
    Keyboard.dismiss()
    setEditing(false)
    onRename(draftName)
  }

  function cancelEdit() {
    Keyboard.dismiss()
    setDraftName(collection.name)
    setEditing(false)
  }

  return (
    <View style={rowStyles.container}>
      {/* Ligne principale : icône + contenu côte à côte, mais touchables séparés */}
      <View style={rowStyles.main}>
        {/* Icône — touchable indépendant, hors du touchable de navigation */}
        <TouchableOpacity
          onPress={onIconPress}
          activeOpacity={0.75}
          style={[rowStyles.icon, { backgroundColor: collection.icon_color ?? '#E8F0E0' }]}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Text style={rowStyles.iconEmoji}>{collection.emoji ?? '📦'}</Text>
        </TouchableOpacity>

        {/* Contenu + chevron — touchable de navigation */}
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={0.7}
          style={rowStyles.mainInner}
          disabled={editing}
        >
          <View style={rowStyles.info}>
            {editing ? (
              <TextInput
                ref={inputRef}
                value={draftName}
                onChangeText={setDraftName}
                onSubmitEditing={commitEdit}
                onBlur={commitEdit}
                style={rowStyles.nameInput}
                returnKeyType="done"
                selectTextOnFocus
                maxLength={80}
              />
            ) : (
              <Text style={rowStyles.name} numberOfLines={1}>{collection.name}</Text>
            )}
            <Text style={rowStyles.count}>{t('common.objects', { count: collection.object_count })}</Text>
          </View>
          {!editing && <Text style={rowStyles.chevron}>›</Text>}
        </TouchableOpacity>
      </View>

      {/* Actions */}
      {editing ? (
        <View style={rowStyles.actions}>
          <TouchableOpacity onPress={cancelEdit} style={rowStyles.actionBtn} hitSlop={8}>
            <Text style={rowStyles.actionCancel}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={commitEdit} style={rowStyles.actionBtn} hitSlop={8}>
            <Text style={rowStyles.actionSave}>{t('collections.ok')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={rowStyles.actions}>
          <TouchableOpacity onPress={startEdit} style={rowStyles.actionBtn} hitSlop={8}>
            <Text style={rowStyles.actionEdit}>{t('collections.rename')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} style={rowStyles.actionBtn} hitSlop={8}>
            <Text style={rowStyles.actionDelete}>{t('common.delete')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  headerTitle: {
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  list: { paddingBottom: Spacing.xxl, flexGrow: 1 },
  separator: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginLeft: Spacing.lg + 44 + Spacing.md,
  },
})

const rowStyles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  main: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  mainInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    width: 44, height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconEmoji: { fontSize: 22 },
  info: { flex: 1, gap: 2 },
  name: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
  },
  nameInput: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.accent,
    paddingVertical: 2,
    paddingHorizontal: 0,
  },
  count: { fontSize: Typography.sm, color: Colors.textTertiary },
  chevron: { fontSize: Typography.lg, color: Colors.textTertiary, marginRight: -Spacing.xs },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  actionBtn: { paddingVertical: Spacing.xs },
  actionEdit: { fontSize: Typography.sm, color: Colors.accent, fontWeight: Typography.medium },
  actionDelete: { fontSize: Typography.sm, color: Colors.error, fontWeight: Typography.medium },
  actionSave: { fontSize: Typography.sm, color: Colors.accent, fontWeight: Typography.semibold },
  actionCancel: { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: Typography.medium },
})
