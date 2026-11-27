import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useRouter, useSegments } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Check, ChevronRight, X } from 'lucide-react-native'
import { Colors, Typography, Spacing, Radius } from '@/components/ui'
import { useBatchJob, batchStats, dismissBatch } from './batchStore'

/**
 * Rappel discret d'un import en cours, posé au-dessus des onglets.
 *
 * Il suit l'utilisateur d'écran en écran tant que le lot n'est pas
 * enregistré, puis devient la confirmation (« 15 objets ajoutés à … »)
 * qui reste jusqu'à ce qu'on la touche — un message de trois secondes
 * se rate trop facilement.
 */
export function BatchIndicator() {
  const job = useBatchJob()
  const router = useRouter()
  const { t } = useTranslation()
  const segments = useSegments() as string[]

  // Sur l'écran de suivi, il ferait doublon.
  if (!job || segments.includes('review') || job.phase === 'failed') return null

  const stats = batchStats(job)
  const finished = job.phase === 'finished'
  const doneCount = job.destinationChosen ? stats.added : stats.settled

  const label = finished
    ? (job.collectionName
        ? t('batch.doneIn', { count: stats.added, name: job.collectionName })
        : t('batch.done', { count: stats.added }))
    : job.phase === 'ready'
      ? t('batch.indicatorReady', { count: stats.ready })
      : t('batch.indicator', { done: doneCount, total: stats.total })
  const sub = finished
    ? (stats.failed > 0 ? t('batch.doneWithErrors', { count: stats.failed }) : null)
    : job.offline || stats.waiting > 0
      ? t('batch.statusWaiting')
      : job.phase === 'ready' ? null : t(`batch.stage.${stats.stage}`)

  function open() {
    if (finished && stats.failed === 0) {
      const collectionId = job!.collectionId
      dismissBatch()
      router.push(collectionId ? { pathname: '/collections/[id]', params: { id: collectionId } } : '/(app)')
      return
    }
    router.push('/capture/review')
  }

  const fraction = stats.total ? Math.max(0.04, doneCount / stats.total) : 0

  return (
    <TouchableOpacity style={styles.wrap} onPress={open} activeOpacity={0.85} accessibilityRole="button">
      <View style={styles.row}>
        {finished
          ? <View style={styles.doneMark}><Check size={12} color={Colors.textInverse} strokeWidth={3} /></View>
          : stats.busy
            ? <ActivityIndicator size="small" color={Colors.accent} />
            : <View style={styles.dot} />}
        <View style={styles.texts}>
          <Text style={styles.label} numberOfLines={1}>{label}</Text>
          {sub ? <Text style={styles.sub} numberOfLines={1}>{sub}</Text> : null}
        </View>
        {finished
          ? <TouchableOpacity onPress={dismissBatch} hitSlop={12} accessibilityLabel={t('batch.close')}>
              <X size={18} color={Colors.textTertiary} strokeWidth={1.8} />
            </TouchableOpacity>
          : <ChevronRight size={18} color={Colors.textTertiary} strokeWidth={1.8} />}
      </View>
      {!finished && (
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(fraction * 100)}%` }]} />
        </View>
      )}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
    gap: Spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  texts: { flex: 1 },
  label: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },
  sub: { fontSize: Typography.xs, color: Colors.textSecondary, marginTop: 1 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.accent, marginHorizontal: 5 },
  doneMark: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  track: { height: 3, borderRadius: Radius.full, backgroundColor: Colors.borderLight, overflow: 'hidden' },
  fill: { height: 3, backgroundColor: Colors.accent },
})
