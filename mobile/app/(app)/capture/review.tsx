import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  View, Text, StyleSheet, Image, TextInput,
  TouchableOpacity, ActivityIndicator, Alert, Animated,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { X, Trash2, RotateCw, Plus, Check, WifiOff } from 'lucide-react-native'
import * as ImagePicker from 'expo-image-picker'
import { Screen, FormScreen, FormFlatList, focusNextField, Colors, Typography, Spacing, Radius, CollectionPickerSheet } from '@/components/ui'
import {
  useBatchJob, batchStats, extendBatch, retryBatchItem, removeBatchItem,
  setBatchTitle, commitBatchTitle, setBatchDestination, abandonBatch, dismissBatch,
  BATCH_STAGES, type BatchItem, type BatchItemStatus,
} from '@/features/batch/batchStore'

// ================================================================
// Suivi d'un import multiple — « le ticket de caisse ».
//
// Une ligne = un objet, avec sa photo locale dès la première image.
// L'écran ne fait que montrer la file (features/batch/batchStore) :
// le quitter n'arrête rien, y revenir retrouve le lot où il en est.
// ================================================================

/** Part du chemin parcourue par une photo, pour une barre qui avance sans à-coups. */
const WEIGHT: Record<BatchItemStatus, number> = {
  queued: 0, waiting: 0.1, preparing: 0.1, uploading: 0.3, analyzing: 0.6,
  done: 0.9, added: 1, error: 1,
}

export default function BatchReviewScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const job = useBatchJob()

  const [pickerVisible, setPickerVisible] = useState(false)
  const progressAnim = useRef(new Animated.Value(0)).current

  const stats = job ? batchStats(job) : null
  const fraction = job && job.items.length
    ? job.items.reduce((sum, it) => sum + (job.destinationChosen || it.status !== 'done' ? WEIGHT[it.status] : 1), 0) / job.items.length
    : 0

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: fraction, duration: 300, useNativeDriver: false,
    }).start()
  }, [fraction])

  // Plus de lot (refermé, ou écran rouvert par l'historique) : rien à montrer.
  useEffect(() => {
    if (!job) router.replace('/(app)')
  }, [job === null])

  const leave = useCallback(() => {
    router.replace(
      job?.collectionId
        ? { pathname: '/collections/[id]', params: { id: job.collectionId } }
        : '/(app)',
    )
  }, [job?.collectionId, router])

  // ── Allonger le lot ────────────────────────────────────────────

  const remainingSlots = job ? Math.max(0, job.batchMax - job.items.length) : 0
  const canExtend = !!job?.batchId && (job.phase === 'running' || job.phase === 'ready')

  async function handleAddMore() {
    if (remainingSlots === 0 || !canExtend) return
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert(t('capture.permissionDeniedTitle'), t('capture.permissionLibrary'))
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 1,
      selectionLimit: remainingSlots,
    })
    if (result.canceled) return
    try {
      // Les vignettes apparaissent tout de suite ; la compression suit, photo par photo.
      await extendBatch(result.assets.map(a => ({ uri: a.uri, width: a.width, height: a.height })))
    } catch (e: unknown) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : String(e))
    }
  }

  // ── Sortie ─────────────────────────────────────────────────────

  function handleCancelImport() {
    Alert.alert(t('batch.cancelTitle'), t('batch.cancelMessage'), [
      { text: t('batch.cancelNo'), style: 'cancel' },
      {
        text: t('batch.cancelYes'),
        style: 'destructive',
        onPress: () => { abandonBatch(); router.replace('/(app)') },
      },
    ])
  }

  function handleFinish() {
    const collectionId = job?.collectionId
    dismissBatch()
    router.replace(
      collectionId ? { pathname: '/collections/[id]', params: { id: collectionId } } : '/(app)',
    )
  }

  // ── Rendu d'une ligne ──────────────────────────────────────────

  const renderItem = useCallback(({ item }: { item: BatchItem }) => {
    const attrs = item.data?.attributes
    const analysed = item.status === 'done' || item.status === 'added'
    const failed = item.status === 'error' || (item.status === 'done' && item.addFailed)
    const loadingLabel =
      item.status === 'uploading' ? t('batch.statusUploading')
      : item.status === 'analyzing' ? t('batch.statusAnalyzing')
      : item.status === 'preparing' ? t('batch.statusPreparing')
      : item.status === 'waiting' ? t('batch.statusWaiting')
      : t('batch.statusQueued')

    return (
      <View style={styles.row}>
        <View>
          <Image source={{ uri: item.thumbUri }} style={styles.thumb} resizeMode="cover" />
          {item.status === 'added' && (
            <View style={styles.thumbBadge}>
              <Check size={11} color={Colors.textInverse} strokeWidth={3} />
            </View>
          )}
        </View>

        <View style={styles.rowBody}>
          {!analysed && item.status !== 'error' && (
            <>
              <View style={[styles.skeleton, styles.skeletonTitle]} />
              <Text style={styles.rowStatus}>{loadingLabel}</Text>
            </>
          )}

          {item.status === 'error' && (
            <Text style={styles.rowError} numberOfLines={2}>{t('batch.rowFailed')}</Text>
          )}

          {analysed && (
            <>
              <TextInput
                style={styles.titleInput}
                value={item.title ?? item.data?.title ?? ''}
                onChangeText={text => setBatchTitle(item.key, text)}
                onEndEditing={() => commitBatchTitle(item.key)}
                placeholder={t('batch.titlePlaceholder')}
                placeholderTextColor={Colors.textTertiary}
                returnKeyType="next"
                submitBehavior="submit"
                onSubmitEditing={focusNextField}
              />
              {item.addFailed
                ? <Text style={styles.rowError} numberOfLines={2}>{t('batch.rowAddFailed')}</Text>
                : <Text style={styles.rowMeta} numberOfLines={1}>
                    {item.status === 'added'
                      ? t('batch.statusAdded')
                      : [attrs?.category, attrs?.brand].filter(Boolean).join(' · ') || t('batch.noMeta')}
                  </Text>}
            </>
          )}

          {failed && (
            <TouchableOpacity style={styles.retryBtn} onPress={() => retryBatchItem(item.key)} hitSlop={8}>
              <RotateCw size={13} color={Colors.accent} strokeWidth={2} />
              <Text style={styles.retryText}>{t('batch.retry')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {item.status !== 'added' && (
          <TouchableOpacity onPress={() => removeBatchItem(item.key)} style={styles.removeBtn} hitSlop={8}>
            <Trash2 size={17} color={Colors.textTertiary} strokeWidth={1.6} />
          </TouchableOpacity>
        )}
      </View>
    )
  }, [t])

  // ── Écran ──────────────────────────────────────────────────────

  if (!job || !stats) return <Screen edges={['top', 'bottom']}><View /></Screen>

  if (job.phase === 'failed') {
    return (
      <Screen edges={['top', 'bottom']}>
        <View style={styles.center}>
          <Text style={styles.errorTitle}>{t('batch.fatalTitle')}</Text>
          <Text style={styles.errorBody}>
            {job.fatal === 'OBJECT_QUOTA' ? t('capture.objectQuotaBody') : job.fatal}
          </Text>
          <TouchableOpacity style={styles.btnPrimary} onPress={() => { dismissBatch(); router.replace('/(app)') }}>
            <Text style={styles.btnPrimaryText}>{t('common.back')}</Text>
          </TouchableOpacity>
        </View>
      </Screen>
    )
  }

  const finished = job.phase === 'finished'
  const stageIndex = BATCH_STAGES.indexOf(stats.stage as typeof BATCH_STAGES[number])
  const doneCount = job.destinationChosen ? stats.added : stats.settled

  const title = finished
    ? (job.collectionName
        ? t('batch.doneIn', { count: stats.added, name: job.collectionName })
        : t('batch.done', { count: stats.added }))
    : t('batch.importTitle')
  const subtitle = finished
    ? (stats.failed > 0 ? t('batch.doneWithErrors', { count: stats.failed }) : t('batch.doneSaved'))
    : job.phase === 'ready'
      ? t('batch.readyCount', { count: stats.ready })
      : `${t(`batch.stage.${stats.stage}`)} · ${t('batch.counter', { done: doneCount, count: stats.total })}`

  // Le bouton du bas dit toujours ce qui va se passer, jamais « attends ».
  const cta = finished
    ? { label: job.collectionId ? t('batch.seeCollection') : t('batch.seeTiroir'), onPress: handleFinish, disabled: false }
    : job.destinationChosen
      ? {
          label: job.collectionName ? t('batch.autoAdd', { name: job.collectionName }) : t('batch.autoAddNone'),
          onPress: () => {}, disabled: true,
        }
      : {
          label: job.phase === 'ready' && stats.ready > 0
            ? t('batch.confirmCta', { count: stats.ready })
            : t('batch.chooseDestination'),
          onPress: () => setPickerVisible(true),
          disabled: job.phase === 'ready' && stats.ready === 0,
        }

  return (
    <FormScreen
      mode="list"
      edges={['top', 'bottom']}
      header={
        <>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={finished ? handleFinish : leave}
              hitSlop={10}
              style={styles.closeBtn}
              accessibilityLabel={t('batch.close')}
            >
              <X size={22} color={Colors.textPrimary} strokeWidth={1.8} />
            </TouchableOpacity>
            <View style={styles.headerText}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>
            {finished
              ? <View style={styles.doneMark}><Check size={16} color={Colors.textInverse} strokeWidth={3} /></View>
              : stats.busy && <ActivityIndicator size="small" color={Colors.accent} />}
          </View>

          {!finished && (
            <>
              {/* Les quatre étapes, dans l'ordre : celle en cours est nommée au-dessus. */}
              <View style={styles.stages}>
                {BATCH_STAGES.map((stage, i) => (
                  <View
                    key={stage}
                    style={[
                      styles.stage,
                      i < stageIndex && styles.stageDone,
                      i === stageIndex && styles.stageCurrent,
                    ]}
                  />
                ))}
              </View>
              <View style={styles.progressTrack}>
                <Animated.View
                  style={[
                    styles.progressFill,
                    { width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
                  ]}
                />
              </View>
              {(job.offline || stats.waiting > 0)
                ? <View style={styles.notice}>
                    <WifiOff size={14} color={Colors.textSecondary} strokeWidth={1.8} />
                    <Text style={styles.noticeText}>{t('batch.offline')}</Text>
                  </View>
                : stats.busy && <Text style={styles.hint}>{t('batch.backgroundHint')}</Text>}
            </>
          )}
        </>
      }
      footer={
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.btnPrimary, cta.disabled && styles.btnDisabled]}
            onPress={cta.onPress}
            disabled={cta.disabled}
            activeOpacity={0.85}
          >
            <Text style={styles.btnPrimaryText} numberOfLines={1}>{cta.label}</Text>
          </TouchableOpacity>
        </View>
      }
    >
      <FormFlatList
        data={job.items}
        keyExtractor={item => item.key}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListFooterComponent={
          finished ? null : (
            <>
              <TouchableOpacity
                style={[styles.addMore, (remainingSlots === 0 || !canExtend) && styles.addMoreDisabled]}
                onPress={handleAddMore}
                disabled={remainingSlots === 0 || !canExtend}
                activeOpacity={0.7}
              >
                <Plus
                  size={18}
                  color={remainingSlots === 0 ? Colors.textTertiary : Colors.accent}
                  strokeWidth={2}
                />
                <Text style={[styles.addMoreText, remainingSlots === 0 && styles.addMoreTextDisabled]}>
                  {remainingSlots === 0
                    ? t('batch.addMoreFull', { max: job.batchMax })
                    : t('batch.addMore', { count: remainingSlots })}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.cancelBtn} onPress={handleCancelImport} hitSlop={8}>
                <Text style={styles.cancelText}>{t('batch.cancelImport')}</Text>
              </TouchableOpacity>
            </>
          )
        }
      />

      {/* Destination : peut se choisir pendant l'analyse, l'ajout suivra seul. */}
      <CollectionPickerSheet
        visible={pickerVisible}
        title={t('batch.destinationTitle')}
        helper={t('batch.destinationSub', { count: stats.total - stats.failed })}
        onSelect={dest => { setPickerVisible(false); setBatchDestination(dest) }}
        onDismiss={() => setPickerVisible(false)}
      />
    </FormScreen>
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

  doneMark: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },

  stages: {
    flexDirection: 'row', gap: 4,
    marginHorizontal: Spacing.md, marginBottom: Spacing.xs,
  },
  stage: { flex: 1, height: 3, borderRadius: Radius.full, backgroundColor: Colors.borderLight },
  stageDone: { backgroundColor: Colors.accent },
  stageCurrent: { backgroundColor: Colors.accent, opacity: 0.45 },

  hint: {
    fontSize: Typography.xs, color: Colors.textTertiary,
    marginHorizontal: Spacing.md, marginTop: Spacing.sm,
  },
  notice: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    marginHorizontal: Spacing.md, marginTop: Spacing.sm,
  },
  noticeText: { flex: 1, fontSize: Typography.xs, color: Colors.textSecondary },

  thumbBadge: {
    position: 'absolute', right: -4, bottom: -4,
    width: 18, height: 18, borderRadius: 9, backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.surface,
  },

  cancelBtn: { alignSelf: 'center', paddingVertical: Spacing.md },
  cancelText: { fontSize: Typography.sm, color: Colors.textTertiary },

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

  center: { flex: 1, justifyContent: 'center', padding: Spacing.lg, gap: Spacing.md },
  errorTitle: {
    fontSize: Typography.lg, fontWeight: Typography.semibold, color: Colors.textPrimary,
  },
  errorBody: { fontSize: Typography.base, color: Colors.textSecondary },
})
