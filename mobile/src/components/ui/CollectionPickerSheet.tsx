import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { FormSheet, SheetFlatList } from './keyboard'
import { Inbox, Pin } from 'lucide-react-native'
import { supabase } from '@/lib/supabase'
import { fetchOwnDrawerId } from '@/features/collections/ownDrawer'
import { applyIconOverride } from '@/utils/collectionIconCache'
import {
  CollectionSort, DEFAULT_COLLECTION_SORT,
  loadCollectionSort, saveCollectionSort, sortCollections,
} from '@/features/collections/sort'
import { CollectionSortButton } from '@/components/CollectionSortButton'
import { Colors, Typography, Spacing, Radius } from './tokens'
import { CollectionComposer } from './CollectionComposer'

export interface PickedCollection {
  id: string
  name: string
}

interface CollectionPickerSheetProps {
  visible: boolean
  title: string
  /** Une phrase pour dire ce qui est attendu, pas ce qu'on fait. */
  helper?: string
  /** Grise la feuille pendant la création qui suit le choix. */
  busy?: boolean
  /** `null` = l'utilisateur choisit explicitement de ne pas ranger. */
  onSelect: (collection: PickedCollection | null) => void
  /** Absent : la feuille ne peut pas être refermée sans choisir. */
  onDismiss?: () => void
}

interface CollectionRow {
  id: string
  name: string
  emoji: string | null
  icon_color: string | null
  created_at: string
  pinned_at: string | null
  object_count: number
}

/**
 * Choix de la collection de destination, présenté en feuille basse.
 *
 * Mutualisé entre l'ajout unitaire et l'ajout par lot : la question est la
 * même, elle doit se poser de la même façon. « Aucune collection » est un
 * choix de premier rang, pas un abandon — ranger ne doit jamais devenir un
 * péage sur le parcours le plus rapide.
 */
export function CollectionPickerSheet({
  visible, title, helper, busy = false, onSelect, onDismiss,
}: CollectionPickerSheetProps) {
  const { t } = useTranslation()
  const [collections, setCollections] = useState<CollectionRow[] | null>(null)
  const [sort, setSort] = useState<CollectionSort>(DEFAULT_COLLECTION_SORT)

  const load = useCallback(async () => {
    // Même source que l'écran des collections : mêmes compteurs, mêmes
    // épinglages, donc le même ordre à l'écran.
    const { data } = await supabase.rpc('list_collections_with_counts')
    const rows = ((data ?? []) as CollectionRow[]).map(row => ({
      ...row,
      ...applyIconOverride(row.id, row.emoji ?? '📦', row.icon_color ?? '#E8F0E0'),
    }))
    setCollections(rows)
  }, [])

  // Chargées à la première ouverture seulement : la feuille est montée en
  // amont du parcours et n'a pas à interroger la base tant qu'elle dort.
  useEffect(() => {
    if (!visible || collections !== null) return
    load()
    loadCollectionSort().then(setSort)
  }, [visible, collections, load])

  /**
   * Le tri est une préférence d'affichage partagée avec l'écran des
   * collections : le changer ici le change partout, sinon l'utilisateur
   * verrait deux ordres différents pour la même liste.
   */
  function changeSort(next: CollectionSort) {
    setSort(next)
    saveCollectionSort(next)
  }

  // Épinglées en tête, le tri choisi ne s'appliquant qu'au reste.
  const ordered = useMemo(
    () => sortCollections(collections ?? [], sort),
    [collections, sort],
  )

  async function handleCreate(name: string, emoji: string, color: string): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser()
    const drawerId = user ? await fetchOwnDrawerId(user.id) : null
    if (!drawerId || !user) return false

    const { data, error } = await supabase
      .from('collections')
      .insert({ name, drawer_id: drawerId, user_id: user.id, emoji, icon_color: color })
      .select('id, name, emoji, icon_color, created_at, pinned_at')
      .single()
    if (error || !data) return false

    setCollections(prev => [...(prev ?? []), { ...data, object_count: 0 }])
    // Créer une collection ici, c'est vouloir y ranger l'objet en cours :
    // on enchaîne sans redemander.
    onSelect({ id: data.id, name: data.name })
    return true
  }

  const isEmpty = collections !== null && collections.length === 0

  return (
    <FormSheet
      visible={visible}
      animationType="slide"
      onRequestClose={() => onDismiss?.()}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={() => onDismiss?.()}
        disabled={!onDismiss || busy}
      />
      <View style={styles.sheet}>
        <View style={styles.grabber} />
        <Text style={styles.title}>{title}</Text>
        {helper && <Text style={styles.helper}>{helper}</Text>}

        {collections === null ? (
          <ActivityIndicator style={styles.loader} color={Colors.accent} />
        ) : (
          <SheetFlatList
            data={ordered}
            keyExtractor={c => c.id}
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <>
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => onSelect(null)}
                  disabled={busy}
                  activeOpacity={0.7}
                >
                  <View style={styles.rowIcon}>
                    <Inbox size={17} color={Colors.textSecondary} strokeWidth={1.8} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowLabel}>{t('collectionPicker.none')}</Text>
                    <Text style={styles.rowSub}>{t('collectionPicker.noneHint')}</Text>
                  </View>
                </TouchableOpacity>

                {/* Ne pas ranger n'est pas une collection parmi d'autres :
                    la ligne se détache du reste de la liste. */}
                <View style={styles.divider} />

                {ordered.length > 0 && (
                  <View style={styles.sortRow}>
                    <CollectionSortButton sort={sort} onChange={changeSort} />
                  </View>
                )}
              </>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.row}
                onPress={() => onSelect({ id: item.id, name: item.name })}
                disabled={busy}
                activeOpacity={0.7}
              >
                <Text style={styles.rowEmoji}>{item.emoji ?? '🗂'}</Text>
                <View style={styles.rowTextInline}>
                  <Text style={styles.rowLabel} numberOfLines={1}>{item.name}</Text>
                  {/* Le volume aide à reconnaître une collection aussi
                      sûrement que son nom. */}
                  <Text style={styles.rowCount}>({item.object_count})</Text>
                </View>
                {/* Dit pourquoi cette collection est en tête de liste. */}
                {item.pinned_at && (
                  <Pin size={13} color={Colors.textTertiary} strokeWidth={2} />
                )}
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
            ListFooterComponent={
              <View style={styles.footer}>
                <CollectionComposer
                  variant={isEmpty ? 'first' : 'add'}
                  onCreate={handleCreate}
                />
              </View>
            }
          />
        )}

        {onDismiss && (
          <TouchableOpacity style={styles.cancel} onPress={onDismiss} disabled={busy}>
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </FormSheet>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(26, 22, 18, 0.35)',
  },
  sheet: {
    maxHeight: '78%',
    backgroundColor: Colors.background,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  grabber: {
    alignSelf: 'center',
    width: 36, height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: Typography.lg,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
    paddingHorizontal: Spacing.lg,
  },
  helper: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    lineHeight: Typography.sm * Typography.relaxed,
    paddingHorizontal: Spacing.lg,
    marginTop: 4,
  },
  loader: { marginVertical: Spacing.xl },
  list: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  rowIcon: {
    width: 26, height: 26,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceWarm,
    alignItems: 'center', justifyContent: 'center',
  },
  rowEmoji: { fontSize: 20, width: 26, textAlign: 'center' },
  rowText: { flex: 1, gap: 1 },
  // Nom et volume sur la même ligne, alignés sur la ligne de base : le
  // nom se tronque, le compteur ne se fait jamais pousser hors du cadre.
  rowTextInline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  rowCount: {
    fontSize: Typography.sm,
    fontWeight: Typography.regular,
    color: Colors.textTertiary,
  },
  rowLabel: {
    flexShrink: 1,
    fontSize: Typography.base,
    fontWeight: Typography.medium,
    color: Colors.textPrimary,
  },
  rowSub: { fontSize: Typography.xs, color: Colors.textTertiary },
  sep: { height: Spacing.sm },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.md,
    marginHorizontal: Spacing.xs,
  },
  sortRow: {
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.xs,
    paddingBottom: Spacing.sm,
  },
  footer: { marginTop: Spacing.sm },
  cancel: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    marginTop: Spacing.xs,
  },
  cancelText: {
    fontSize: Typography.base,
    fontWeight: Typography.medium,
    color: Colors.textSecondary,
  },
})
