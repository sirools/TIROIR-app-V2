import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { useRouter, useFocusEffect } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Pin } from 'lucide-react-native'
import { supabase } from '@/lib/supabase'
import { fetchOwnDrawerId } from '@/features/collections/ownDrawer'
import {
  Screen, ActionSheet, CollectionComposer, PromptDialog,
  CollectionEditSheet, EditableCollection, CollectionPatch,
  Colors, Typography, Spacing, Radius,
  FormFlatList,
} from '@/components/ui'
import { CollectionSortButton } from '@/components/CollectionSortButton'
import {
  CollectionSort, DEFAULT_COLLECTION_SORT,
  loadCollectionSort, saveCollectionSort, sortCollections,
} from '@/features/collections/sort'
import { Collection } from '@/types/database'
import { setIconOverride, applyIconOverride } from '@/utils/collectionIconCache'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CollectionWithCount extends Collection {
  object_count: number
}

/** iOS refuse d'empiler deux présentations : on laisse la feuille se fermer. */
function afterSheet(fn: () => void) {
  setTimeout(fn, 220)
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function CollectionsScreen() {
  const router = useRouter()
  const { t } = useTranslation()
  const [collections, setCollections] = useState<CollectionWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [sort, setSort] = useState<CollectionSort>(DEFAULT_COLLECTION_SORT)
  const [pickerTarget, setPickerTarget] = useState<CollectionWithCount | null>(null)
  const [actionTarget, setActionTarget] = useState<CollectionWithCount | null>(null)
  const [renameTarget, setRenameTarget] = useState<CollectionWithCount | null>(null)

  const loadRef = useRef<() => Promise<void>>(async () => {})

  useEffect(() => { loadCollectionSort().then(setSort) }, [])

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('list_collections_with_counts')

    if (error) {
      console.error('[Collections] load error:', error)
      setLoading(false)
      setRefreshing(false)
      return
    }

    const mapped: CollectionWithCount[] = ((data ?? []) as CollectionWithCount[]).map(row => {
      const { emoji, icon_color } = applyIconOverride(row.id, row.emoji ?? '📦', row.icon_color ?? '#E8F0E0')
      return { ...row, emoji, icon_color }
    })

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

  // Épinglées en tête, tri choisi pour le reste.
  const ordered = useMemo(() => sortCollections(collections, sort), [collections, sort])

  function changeSort(next: CollectionSort) {
    setSort(next)
    saveCollectionSort(next)
  }

  // ── Créer ───────────────────────────────────────────────────────────────────

  async function handleCreate(name: string, emoji: string, color: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser()
    const drawerId = user ? await fetchOwnDrawerId(user.id) : null

    if (!drawerId || !user) {
      Alert.alert(t('common.error'), t('home.drawerNotFound'))
      return false
    }

    const { data, error } = await supabase
      .from('collections')
      .insert({ name, drawer_id: drawerId, user_id: user.id, emoji, icon_color: color })
      .select()
      .single()

    if (error) { Alert.alert(t('common.error'), error.message); return false }

    // À la suite des autres, pas en tête : la nouvelle collection reste
    // là où l'utilisateur vient de la saisir.
    setCollections(prev => [...prev, { ...data, object_count: 0 }])
    return true
  }

  // ── Épingler ────────────────────────────────────────────────────────────────

  async function togglePin(collection: CollectionWithCount) {
    const { data, error } = await supabase.rpc('toggle_collection_pin', {
      p_collection_id: collection.id,
    })
    if (error) { Alert.alert(t('common.error'), error.message); return }
    setCollections(prev =>
      prev.map(c => c.id === collection.id ? { ...c, pinned_at: (data as string | null) ?? null } : c)
    )
  }

  // ── Sauvegarde icône ────────────────────────────────────────────────────────

  /** La feuille a déjà écrit en base : on aligne la liste et le cache
   *  d'icônes, sans recharger. */
  function handleCollectionSaved(patch: CollectionPatch) {
    if (!pickerTarget) return
    setIconOverride(pickerTarget.id, patch.emoji, patch.icon_color)
    setCollections(prev =>
      prev.map(c => c.id === pickerTarget.id ? { ...c, ...patch } : c)
    )
  }

  // ── Renommer ────────────────────────────────────────────────────────────────

  async function handleRename(collection: CollectionWithCount, newName: string) {
    setRenameTarget(null)
    if (newName === collection.name) return

    const { error } = await supabase
      .from('collections')
      .update({ name: newName, updated_at: new Date().toISOString() })
      .eq('id', collection.id)

    if (error) { Alert.alert(t('common.error'), error.message); return }

    setCollections(prev =>
      prev.map(c => c.id === collection.id ? { ...c, name: newName } : c)
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
          if (error) { Alert.alert(t('common.error'), error.message); return }
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
        {collections.length > 1 && (
          <CollectionSortButton sort={sort} onChange={changeSort} />
        )}
      </View>

      <FormFlatList
        data={ordered}
        keyExtractor={c => c.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.composerSlot}>
            <CollectionComposer variant="first" onCreate={handleCreate} />
          </View>
        }
        ListFooterComponent={
          collections.length > 0
            ? (
              <View style={styles.composerSlot}>
                <CollectionComposer variant="add" onCreate={handleCreate} />
              </View>
            )
            : null
        }
        renderItem={({ item }) => (
          <CollectionRow
            collection={item}
            onPress={() => router.push({ pathname: '/collections/[id]', params: { id: item.id } })}
            onLongPress={() => setActionTarget(item)}
            onIconPress={() => setPickerTarget(item)}
          />
        )}
      />

      {/* Actions rares : appui long, pour garder la liste nue */}
      <ActionSheet
        visible={!!actionTarget}
        onClose={() => setActionTarget(null)}
        options={actionTarget ? [
          {
            label: actionTarget.pinned_at ? t('collections.unpin') : t('collections.pin'),
            onPress: () => togglePin(actionTarget),
          },
          {
            // Renommer et changer l'icône étaient deux entrées pour la
            // même intention : modifier la collection.
            label: t('collections.edit'),
            onPress: () => afterSheet(() => setPickerTarget(actionTarget)),
          },
          {
            label: t('common.delete'),
            destructive: true,
            onPress: () => afterSheet(() => handleDelete(actionTarget)),
          },
          { label: t('common.cancel'), cancel: true, onPress: () => {} },
        ] : []}
      />

      <PromptDialog
        visible={!!renameTarget}
        title={t('collectionDetail.renameTitle')}
        placeholder={t('collectionDetail.renamePlaceholder')}
        initialValue={renameTarget?.name ?? ''}
        confirmLabel={t('collections.rename')}
        onConfirm={name => renameTarget && handleRename(renameTarget, name)}
        onClose={() => setRenameTarget(null)}
      />

      <CollectionEditSheet
        visible={!!pickerTarget}
        collection={pickerTarget as EditableCollection | null}
        onClose={() => setPickerTarget(null)}
        onSaved={patch => handleCollectionSaved(patch)}
      />
    </Screen>
  )
}

// ── CollectionRow ─────────────────────────────────────────────────────────────

interface CollectionRowProps {
  collection: CollectionWithCount
  onPress: () => void
  onLongPress: () => void
  onIconPress: () => void
}

function CollectionRow({ collection, onPress, onLongPress, onIconPress }: CollectionRowProps) {
  const { t } = useTranslation()

  return (
    <View style={rowStyles.container}>
      {/* Icône — touchable indépendant, hors du touchable de navigation */}
      <TouchableOpacity
        onPress={onIconPress}
        onLongPress={onLongPress}
        delayLongPress={300}
        activeOpacity={0.75}
        style={[rowStyles.icon, { backgroundColor: collection.icon_color ?? '#E8F0E0' }]}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
      >
        <Text style={rowStyles.iconEmoji}>{collection.emoji ?? '📦'}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={300}
        activeOpacity={0.7}
        style={rowStyles.mainInner}
      >
        <View style={rowStyles.info}>
          <View style={rowStyles.nameRow}>
            {collection.pinned_at && (
              <Pin size={12} color={Colors.accent} strokeWidth={2.2} fill={Colors.accent} />
            )}
            <Text style={rowStyles.name} numberOfLines={1}>{collection.name}</Text>
          </View>
          <Text style={rowStyles.count}>{t('common.objects', { count: collection.object_count })}</Text>
        </View>
        <Text style={rowStyles.chevron}>›</Text>
      </TouchableOpacity>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  composerSlot: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  separator: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginLeft: Spacing.lg + 56 + Spacing.md,
  },
})

const rowStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  mainInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    width: 56, height: 56,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconEmoji: { fontSize: 27, lineHeight: 34 },
  info: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  count: { fontSize: Typography.sm, color: Colors.textTertiary },
  chevron: { fontSize: Typography.lg, color: Colors.textTertiary, marginRight: -Spacing.xs },
})
