import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { GlobalMenu, BurgerIcon } from '@/components/GlobalMenu'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useFocusEffect } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Image } from 'react-native'
import { Pin } from 'lucide-react-native'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'
import {
  ActionSheet, CollectionComposer, PromptDialog, TiroirLoader,
  CollectionEditSheet, EditableCollection, CollectionPatch,
  Colors, Typography, Spacing, Radius,
} from '@/components/ui'
import { CollectionSortButton } from '@/components/CollectionSortButton'
import {
  CollectionSort, DEFAULT_COLLECTION_SORT,
  loadCollectionSort, saveCollectionSort, sortCollections,
} from '@/features/collections/sort'
import { Collection } from '@/types/database'

type CollectionWithCount = Collection & { object_count: number }

/**
 * Enchaîner une feuille d'actions sur une autre modale : iOS refuse de
 * présenter tant que la précédente n'est pas complètement fermée.
 */
function afterSheet(fn: () => void) {
  setTimeout(fn, 220)
}

export default function HomeScreen() {
  const router = useRouter()
  const { t } = useTranslation()
  const { profile } = useAuth()
  const [collections, setCollections] = useState<CollectionWithCount[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [sort, setSort] = useState<CollectionSort>(DEFAULT_COLLECTION_SORT)
  const [actionTarget, setActionTarget] = useState<CollectionWithCount | null>(null)
  const [editTarget, setEditTarget] = useState<CollectionWithCount | null>(null)

  /**
   * Vrai jusqu'à la première réponse. Sans cet état, l'accueil affichait
   * « aucune collection » pendant une seconde à quelqu'un qui en a dix —
   * un état vide affiché à tort annonce une perte.
   */
  const [loading, setLoading] = useState(true)

  /** URLs signées des couvertures, par identifiant de collection. */
  const [covers, setCovers] = useState<Record<string, string>>({})

  useEffect(() => { loadCollectionSort().then(setSort) }, [])

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('list_collections_with_counts')
    if (!error) {
      const rows = (data ?? []) as CollectionWithCount[]
      setCollections(rows)

      const paths = rows.map(c => c.cover_image_path).filter(Boolean) as string[]
      if (paths.length > 0) {
        const { data: signed } = await supabase.storage
          .from('object-images').createSignedUrls(paths, 3600)
        setCovers(Object.fromEntries(
          (signed ?? []).filter(x => x.signedUrl).map(x => [x.path, x.signedUrl]),
        ))
      } else {
        setCovers({})
      }
    }
    setLoading(false)
    setRefreshing(false)
  }, [])

  useFocusEffect(useCallback(() => { load() }, [load]))

  function onRefresh() { setRefreshing(true); load() }

  // Les épinglées en tête, le tri choisi pour le reste.
  const ordered = useMemo(() => sortCollections(collections, sort), [collections, sort])

  function changeSort(next: CollectionSort) {
    setSort(next)
    saveCollectionSort(next)
  }

  /**
   * Création depuis la carte : la nouvelle collection est ajoutée en fin
   * de liste, là où l'utilisateur vient de la saisir, plutôt que projetée
   * en tête où il la perdrait de vue.
   */
  async function handleCreate(name: string, emoji: string, color: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser()
    const { data: drawer } = await supabase.from('drawers').select('id').single()

    if (!drawer || !user) {
      Alert.alert(t('common.error'), t('home.drawerNotFound'))
      return false
    }

    const { data, error } = await supabase
      .from('collections')
      .insert({ name, drawer_id: drawer.id, user_id: user.id, emoji, icon_color: color })
      .select()
      .single()

    if (error) { Alert.alert(t('common.error'), error.message); return false }

    setCollections(prev => [...prev, { ...data, object_count: 0 }])
    return true
  }

  async function togglePin(col: CollectionWithCount) {
    const { data, error } = await supabase.rpc('toggle_collection_pin', { p_collection_id: col.id })
    if (error) { Alert.alert(t('common.error'), error.message); return }
    setCollections(prev =>
      prev.map(c => c.id === col.id ? { ...c, pinned_at: (data as string | null) ?? null } : c)
    )
  }

  /**
   * La feuille a déjà écrit en base : on aligne l'écran plutôt que de
   * recharger toute la liste pour un champ.
   */
  async function applyPatch(id: string, patch: CollectionPatch) {
    setCollections(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))

    // Une couverture qui vient d'être posée n'a pas encore d'URL signée.
    if (patch.cover_image_path && !covers[patch.cover_image_path]) {
      const { data } = await supabase.storage
        .from('object-images').createSignedUrl(patch.cover_image_path, 3600)
      if (data?.signedUrl) {
        setCovers(prev => ({ ...prev, [patch.cover_image_path!]: data.signedUrl }))
      }
    }
  }

  function handleDeleteCollection(col: CollectionWithCount) {
    const msg = col.object_count > 0
      ? t('home.deleteCollectionWithObjects', { count: col.object_count })
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
          {collections.length > 1 && (
            <CollectionSortButton sort={sort} onChange={changeSort} />
          )}
        </View>

        {loading ? (
          <TiroirLoader label={t('home.loading')} />
        ) : (
        <View style={styles.collectionList}>
          {ordered.map(col => (
            <TouchableOpacity
              key={col.id}
              style={styles.collectionCard}
              onPress={() => router.push(`/collections/${col.id}`)}
              onLongPress={() => setActionTarget(col)}
              delayLongPress={300}
              activeOpacity={0.75}
            >
              {/* Photo ou emoji, jamais les deux : deux repères concurrents
                  sur la même vignette se nuisent. */}
              {col.cover_image_path && covers[col.cover_image_path] ? (
                <Image
                  source={{ uri: covers[col.cover_image_path] }}
                  style={styles.collectionIcon}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.collectionIcon, { backgroundColor: col.icon_color ?? '#E8F0E0' }]}>
                  <Text style={styles.collectionIconText}>{col.emoji ?? '📦'}</Text>
                </View>
              )}
              <View style={styles.collectionInfo}>
                <View style={styles.collectionNameRow}>
                  {col.pinned_at && (
                    <Pin size={12} color={Colors.accent} strokeWidth={2.2} fill={Colors.accent} />
                  )}
                  <Text style={styles.collectionName} numberOfLines={1}>{col.name}</Text>
                </View>
                <Text style={styles.collectionCount}>
                  {t('common.objects', { count: col.object_count })}
                </Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))}

          {/* La carte de création vit dans la liste, à la place qu'occupera
              la collection : première fois elle explique, ensuite elle ajoute. */}
          <CollectionComposer
            variant={collections.length === 0 ? 'first' : 'add'}
            onCreate={handleCreate}
          />
        </View>
        )}
      </ScrollView>

      {/* Appui long sur une collection : les actions rares vivent ici,
          la liste reste nue. */}
      <ActionSheet
        visible={!!actionTarget}
        onClose={() => setActionTarget(null)}
        options={actionTarget ? [
          {
            label: actionTarget.pinned_at ? t('collections.unpin') : t('collections.pin'),
            onPress: () => togglePin(actionTarget),
          },
          {
            label: t('collections.edit'),
            onPress: () => afterSheet(() => setEditTarget(actionTarget)),
          },
          {
            label: t('common.delete'),
            destructive: true,
            onPress: () => afterSheet(() => handleDeleteCollection(actionTarget)),
          },
          { label: t('common.cancel'), cancel: true, onPress: () => {} },
        ] : []}
      />

      <CollectionEditSheet
        visible={!!editTarget}
        collection={editTarget as EditableCollection | null}
        onClose={() => setEditTarget(null)}
        onSaved={patch => applyPatch(editTarget!.id, patch)}
      />

      <GlobalMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, gap: Spacing.md, paddingBottom: 96 },

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
  // Pastille volontairement large : c'est elle qui distingue une
  // collection d'une autre d'un coup d'œil, avant même le nom.
  collectionIcon: {
    width: 64,
    height: 64,
    borderRadius: Radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collectionIconText: { fontSize: 30, lineHeight: 38 },
  collectionInfo: { flex: 1, gap: 2 },
  collectionNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  collectionName: {
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  collectionCount: { fontSize: Typography.sm, color: Colors.textSecondary },
  chevron: { fontSize: Typography.xl, color: Colors.textTertiary },
})
