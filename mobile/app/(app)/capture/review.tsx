import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, Image, TextInput, FlatList,
  TouchableOpacity, ActivityIndicator, Alert, Animated, Modal,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { X, Trash2, RotateCw, Plus } from 'lucide-react-native'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'
import { Screen, Colors, Typography, Spacing, Radius } from '@/components/ui'
import {
  beginBatch, extendBatch, runBatch, retryItem, confirmBatch,
  applyEditedTitles, compressImages,
  type BatchImage, type BatchItem,
} from '@/services/batchCapture'

// ================================================================
// Écran de review d'un lot — « le ticket de caisse ».
//
// Une ligne = un objet. Les lignes se remplissent au fil des
// analyses, dans un ordre stable (ordre de saisie), pendant que
// l'utilisateur peut déjà corriger les titres du haut de liste.
// ================================================================

type Phase = 'preparing' | 'running' | 'settled' | 'confirming' | 'failed'

interface CollectionRow {
  id: string
  name: string
  emoji: string | null
}

export default function BatchReviewScreen() {
  const {
    images: imagesParam,
    runId,
    batchMax: batchMaxParam,
    collectionId: presetCollectionId,
  } = useLocalSearchParams<{
    images: string
    runId?: string
    batchMax?: string
    /** Lot lancé depuis une collection : la destination est déjà connue. */
    collectionId?: string
  }>()
  const batchMax = Number(batchMaxParam ?? 10)
  const { t } = useTranslation()
  const { user } = useAuth()
  const router = useRouter()

  const [phase, setPhase] = useState<Phase>('preparing')
  const [batchId, setBatchId] = useState<string | null>(null)
  const [items, setItems] = useState<BatchItem[]>([])
  const [titles, setTitles] = useState<Record<number, string>>({})
  const [removed, setRemoved] = useState<Set<number>>(new Set())
  const [fatalError, setFatalError] = useState<string | null>(null)

  const [pickerVisible, setPickerVisible] = useState(false)
  const [collections, setCollections] = useState<CollectionRow[] | null>(null)

  const progressAnim = useRef(new Animated.Value(0)).current

  /**
   * Jeton du lot en cours. Chaque nouveau lot l'incrémente : les
   * callbacks du lot précédent se voient périmés et cessent d'écrire
   * dans l'état. Un simple booléen « annulé » ne suffit pas — le
   * remettre à false pour le nouveau lot ressusciterait l'ancien.
   */
  const runToken = useRef(0)
  const runFor = useRef<string | null>(null)

  // ── Démarrage du lot ───────────────────────────────────────────

  useEffect(() => {
    if (!imagesParam || !user) return

    const key = runId ?? imagesParam
    if (runFor.current === key) return
    runFor.current = key

    const token = ++runToken.current
    const isStale = () => token !== runToken.current

    // Nouveau lot = état vierge. Sans cette remise à zéro, l'écran
    // réaffiche le lot précédent, déjà confirmé.
    setBatchId(null)
    setItems([])
    setTitles({})
    setRemoved(new Set())
    setFatalError(null)
    setPhase('preparing')
    progressAnim.setValue(0)

    const images: BatchImage[] = JSON.parse(imagesParam)

    ;(async () => {
      try {
        const { batchId: id, items: created } = await beginBatch(images)
        if (isStale()) return

        setBatchId(id)
        setItems(created)
        setPhase('running')

        await runBatch(
          created,
          user.id,
          (position, patch) => {
            if (isStale()) return
            setItems(prev =>
              prev.map(it => (it.position === position ? { ...it, ...patch } : it)),
            )
          },
          isStale,
        )

        if (!isStale()) setPhase('settled')
      } catch (e: unknown) {
        if (isStale()) return
        setFatalError(e instanceof Error ? e.message : String(e))
        setPhase('failed')
      }
    })()

    // Au démontage, on périme le lot courant sans en démarrer d'autre.
    return () => { runToken.current++ }
  }, [imagesParam, runId, user])

  // ── Collections disponibles (chargées à l'ouverture du sélecteur) ──

  useEffect(() => {
    if (!pickerVisible || collections !== null) return
    supabase
      .from('collections')
      .select('id, name, emoji')
      .order('updated_at', { ascending: false })
      .then(({ data }) => setCollections((data ?? []) as CollectionRow[]))
  }, [pickerVisible, collections])

  // ── Progression ────────────────────────────────────────────────

  const settledCount = useMemo(
    () => items.filter(i => i.status === 'done' || i.status === 'error').length,
    [items],
  )

  const visibleItems = useMemo(
    () => items.filter(i => !removed.has(i.position)),
    [items, removed],
  )

  const readyCount = useMemo(
    () => visibleItems.filter(i => i.status === 'done').length,
    [visibleItems],
  )

  const isBusy = phase === 'preparing' || phase === 'running' || phase === 'confirming'

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: items.length ? settledCount / items.length : 0,
      duration: 300,
      useNativeDriver: false,
    }).start()
  }, [settledCount, items.length])

  // ── Actions de ligne ───────────────────────────────────────────

  function displayTitle(item: BatchItem): string {
    if (titles[item.position] !== undefined) return titles[item.position]
    return item.data?.title ?? ''
  }

  const handleRemove = useCallback(async (item: BatchItem) => {
    setRemoved(prev => new Set(prev).add(item.position))
    await supabase.rpc('discard_draft', { p_draft_id: item.draftId })
  }, [])

  const handleRetry = useCallback(async (item: BatchItem) => {
    if (!user) return
    await retryItem(item, user.id, (position, patch) => {
      setItems(prev =>
        prev.map(it => (it.position === position ? { ...it, ...patch } : it)),
      )
    })
  }, [user])

  // ── Allonger le lot ────────────────────────────────────────────

  /**
   * Places restantes dans le lot. Les lignes retirées comptent quand
   * même : leur analyse a déjà consommé du quota.
   */
  const remainingSlots = Math.max(0, batchMax - items.length)

  async function handleAddMore() {
    if (remainingSlots === 0 || !batchId || !user) return

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert(t('capture.permissionDeniedTitle'), t('capture.permissionLibrary'))
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.9,
      selectionLimit: remainingSlots,
    })
    if (result.canceled) return

    const token = runToken.current
    const isStale = () => token !== runToken.current

    try {
      setPhase('running')
      const picked = await compressImages(result.assets)
      const added = await extendBatch(batchId, picked)
      if (isStale()) return

      setItems(prev => [...prev, ...added])

      await runBatch(
        added,
        user.id,
        (position, patch) => {
          if (isStale()) return
          setItems(prev =>
            prev.map(it => (it.position === position ? { ...it, ...patch } : it)),
          )
        },
        isStale,
      )
      if (!isStale()) setPhase('settled')
    } catch (e: unknown) {
      if (isStale()) return
      setPhase('settled')
      Alert.alert(t('common.error'), e instanceof Error ? e.message : String(e))
    }
  }

  // ── Sortie ─────────────────────────────────────────────────────

  function handleAbandon() {
    Alert.alert(
      t('batch.abandonTitle'),
      t('batch.abandonMessage', { count: visibleItems.length }),
      [
        { text: t('batch.abandonNo'), style: 'cancel' },
        {
          text: t('batch.abandonYes'),
          style: 'destructive',
          onPress: () => {
            // Périme le lot en cours : les analyses encore en vol
            // cesseront d'écrire dans l'état.
            runToken.current++
            router.replace('/(app)')
          },
        },
      ],
    )
  }

  // ── Validation ─────────────────────────────────────────────────

  /**
   * La destination est demandée ici, juste avant la création : à ce
   * stade l'utilisateur vient de voir ce qu'il ajoute, et le choix de
   * la collection est la dernière décision qui reste.
   */
  async function runConfirm(collectionId: string | null) {
    if (!batchId) return
    setPickerVisible(false)
    setPhase('confirming')
    try {
      const rows = await confirmBatch(batchId, collectionId)

      const created = rows.filter(r => r.object_id)
      const failed = rows.filter(r => !r.object_id)

      // Report des titres corrigés à la main sur les objets créés
      const edits = created
        .map(row => {
          const item = items.find(i => i.draftId === row.draft_id)
          if (!item) return null
          const edited = titles[item.position]
          if (edited === undefined || edited.trim() === '') return null
          if (edited === item.data?.title) return null
          return { objectId: row.object_id as string, title: edited.trim() }
        })
        .filter((e): e is { objectId: string; title: string } => e !== null)

      if (edits.length) await applyEditedTitles(edits)

      if (failed.length) {
        Alert.alert(
          t('batch.partialTitle'),
          t('batch.partialMessage', {
            created: created.length,
            failed: failed.length,
          }),
        )
      }

      router.replace(
        collectionId
          ? { pathname: '/collections/[id]', params: { id: collectionId } }
          : '/(app)',
      )
    } catch (e: unknown) {
      setPhase('settled')
      Alert.alert(
        t('common.error'),
        e instanceof Error ? e.message : String(e),
      )
    }
  }

  // ── Rendu d'une ligne ──────────────────────────────────────────

  const renderItem = useCallback(({ item }: { item: BatchItem }) => {
    const isLoading = item.status !== 'done' && item.status !== 'error'
    const attrs = item.data?.attributes

    return (
      <View style={styles.row}>
        <Image source={{ uri: item.image.uri }} style={styles.thumb} resizeMode="cover" />

        <View style={styles.rowBody}>
          {isLoading && (
            <>
              <View style={[styles.skeleton, styles.skeletonTitle]} />
              <Text style={styles.rowStatus}>
                {item.status === 'uploading' ? t('batch.statusUploading') : t('batch.statusAnalyzing')}
              </Text>
            </>
          )}

          {item.status === 'error' && (
            <>
              <Text style={styles.rowError} numberOfLines={2}>
                {t('batch.rowFailed')}
              </Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => handleRetry(item)}>
                <RotateCw size={13} color={Colors.accent} strokeWidth={2} />
                <Text style={styles.retryText}>{t('batch.retry')}</Text>
              </TouchableOpacity>
            </>
          )}

          {item.status === 'done' && (
            <>
              <TextInput
                style={styles.titleInput}
                value={displayTitle(item)}
                onChangeText={text =>
                  setTitles(prev => ({ ...prev, [item.position]: text }))
                }
                placeholder={t('batch.titlePlaceholder')}
                placeholderTextColor={Colors.textTertiary}
                returnKeyType="next"
              />
              <Text style={styles.rowMeta} numberOfLines={1}>
                {[attrs?.category, attrs?.brand].filter(Boolean).join(' · ') || t('batch.noMeta')}
              </Text>
            </>
          )}
        </View>

        <TouchableOpacity
          onPress={() => handleRemove(item)}
          style={styles.removeBtn}
          hitSlop={8}
        >
          <Trash2 size={17} color={Colors.textTertiary} strokeWidth={1.6} />
        </TouchableOpacity>
      </View>
    )
  }, [titles, t, handleRemove, handleRetry])

  // ── Écran ──────────────────────────────────────────────────────

  if (phase === 'failed') {
    return (
      <Screen edges={['top', 'bottom']}>
        <View style={styles.center}>
          <Text style={styles.errorTitle}>{t('batch.fatalTitle')}</Text>
          <Text style={styles.errorBody}>{fatalError}</Text>
          <TouchableOpacity style={styles.btnPrimary} onPress={() => router.replace('/(app)')}>
            <Text style={styles.btnPrimaryText}>{t('common.back')}</Text>
          </TouchableOpacity>
        </View>
      </Screen>
    )
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleAbandon} hitSlop={10} style={styles.closeBtn}>
          <X size={22} color={Colors.textPrimary} strokeWidth={1.8} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>{t('batch.reviewTitle')}</Text>
          <Text style={styles.subtitle}>
            {settledCount < items.length
              ? t('batch.progress', { done: settledCount, total: items.length })
              : t('batch.readyCount', { count: readyCount })}
          </Text>
        </View>
      </View>

      {settledCount < items.length && (
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
      )}

      <FlatList
        data={visibleItems}
        keyExtractor={item => item.draftId}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListFooterComponent={
          /* En pied de liste plutôt qu'en en-tête : on prolonge la
             saisie dans le sens de lecture, sans concurrencer le CTA. */
          <TouchableOpacity
            style={[styles.addMore, remainingSlots === 0 && styles.addMoreDisabled]}
            onPress={handleAddMore}
            disabled={remainingSlots === 0 || isBusy}
            activeOpacity={0.7}
          >
            <Plus
              size={18}
              color={remainingSlots === 0 ? Colors.textTertiary : Colors.accent}
              strokeWidth={2}
            />
            <Text
              style={[
                styles.addMoreText,
                remainingSlots === 0 && styles.addMoreTextDisabled,
              ]}
            >
              {remainingSlots === 0
                ? t('batch.addMoreFull', { max: batchMax })
                : t('batch.addMore', { count: remainingSlots })}
            </Text>
          </TouchableOpacity>
        }
      />

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.btnPrimary, (isBusy || readyCount === 0) && styles.btnDisabled]}
          onPress={() => presetCollectionId
            ? runConfirm(presetCollectionId)
            : setPickerVisible(true)
          }
          disabled={isBusy || readyCount === 0}
          activeOpacity={0.85}
        >
          {phase === 'confirming'
            ? <ActivityIndicator size="small" color={Colors.textInverse} />
            : <Text style={styles.btnPrimaryText}>
                {t('batch.confirmCta', { count: readyCount })}
              </Text>
          }
        </TouchableOpacity>
      </View>

      {/* Destination du lot — dernière décision avant création */}
      <Modal
        visible={pickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setPickerVisible(false)}
        />
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{t('batch.destinationTitle')}</Text>
          <Text style={styles.sheetSub}>
            {t('batch.destinationSub', { count: readyCount })}
          </Text>

          {collections === null ? (
            <ActivityIndicator style={styles.sheetLoader} color={Colors.accent} />
          ) : (
            <FlatList
              data={collections}
              keyExtractor={c => c.id}
              style={styles.sheetList}
              ListHeaderComponent={
                <TouchableOpacity
                  style={styles.sheetRow}
                  onPress={() => runConfirm(null)}
                >
                  <Text style={styles.sheetEmoji}>📥</Text>
                  <Text style={styles.sheetRowLabel}>{t('batch.noCollection')}</Text>
                </TouchableOpacity>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.sheetRow}
                  onPress={() => runConfirm(item.id)}
                >
                  <Text style={styles.sheetEmoji}>{item.emoji ?? '🗂'}</Text>
                  <Text style={styles.sheetRowLabel} numberOfLines={1}>{item.name}</Text>
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.sheetSep} />}
            />
          )}

          <TouchableOpacity
            style={styles.sheetCancel}
            onPress={() => setPickerVisible(false)}
          >
            <Text style={styles.sheetCancelText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  closeBtn: { padding: Spacing.xs },
  headerText: { flex: 1 },
  title: {
    fontSize: Typography.lg, fontWeight: Typography.semibold, color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: Typography.sm, color: Colors.textSecondary, marginTop: 2,
  },

  progressTrack: {
    height: 3, backgroundColor: Colors.borderLight,
    marginHorizontal: Spacing.md, borderRadius: Radius.full, overflow: 'hidden',
  },
  progressFill: { height: 3, backgroundColor: Colors.accent },

  list: { padding: Spacing.md, paddingBottom: Spacing.xl },
  sep: { height: Spacing.sm },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.sm,
  },
  thumb: {
    width: 56, height: 56, borderRadius: Radius.sm, backgroundColor: Colors.surfaceWarm,
  },
  rowBody: { flex: 1, justifyContent: 'center', minHeight: 56 },

  titleInput: {
    fontSize: Typography.base, fontWeight: Typography.medium,
    color: Colors.textPrimary, padding: 0, margin: 0,
  },
  rowMeta: {
    fontSize: Typography.sm, color: Colors.textSecondary, marginTop: 3,
  },
  rowStatus: {
    fontSize: Typography.xs, color: Colors.textTertiary, marginTop: 6,
  },
  rowError: { fontSize: Typography.sm, color: Colors.error },
  retryBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.xs,
  },
  retryText: {
    fontSize: Typography.sm, color: Colors.accent, fontWeight: Typography.medium,
  },

  addMore: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed',
  },
  addMoreDisabled: { opacity: 0.5 },
  addMoreText: {
    fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.accent,
  },
  addMoreTextDisabled: { color: Colors.textTertiary },

  skeleton: { backgroundColor: Colors.surfaceWarm, borderRadius: Radius.sm },
  skeletonTitle: { height: 13, width: '70%' },

  removeBtn: { padding: Spacing.sm },

  footer: {
    padding: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  btnPrimary: {
    backgroundColor: Colors.accent, borderRadius: Radius.md,
    paddingVertical: Spacing.md, alignItems: 'center', justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.4 },
  btnPrimaryText: {
    color: Colors.textInverse, fontSize: Typography.md, fontWeight: Typography.semibold,
  },

  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    maxHeight: '75%',
    backgroundColor: Colors.background,
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    paddingTop: Spacing.lg, paddingBottom: Spacing.xl, paddingHorizontal: Spacing.md,
  },
  sheetTitle: {
    fontSize: Typography.lg, fontWeight: Typography.semibold, color: Colors.textPrimary,
  },
  sheetSub: {
    fontSize: Typography.sm, color: Colors.textSecondary,
    marginTop: 2, marginBottom: Spacing.md,
  },
  sheetLoader: { paddingVertical: Spacing.xl },
  sheetList: { flexGrow: 0 },
  sheetRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.md,
  },
  sheetEmoji: { fontSize: 20 },
  sheetRowLabel: {
    flex: 1, fontSize: Typography.base, fontWeight: Typography.medium,
    color: Colors.textPrimary,
  },
  sheetSep: { height: Spacing.sm },
  sheetCancel: { paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.sm },
  sheetCancelText: { fontSize: Typography.base, color: Colors.textSecondary },

  center: { flex: 1, justifyContent: 'center', padding: Spacing.lg, gap: Spacing.md },
  errorTitle: {
    fontSize: Typography.lg, fontWeight: Typography.semibold, color: Colors.textPrimary,
  },
  errorBody: { fontSize: Typography.base, color: Colors.textSecondary },
})
