import React, { useEffect, useState } from 'react'
import { View, Text, Pressable, StyleSheet, ActivityIndicator, type ViewStyle } from 'react-native'
import { Image } from 'expo-image'
import { useTranslation } from 'react-i18next'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import { Check, CircleAlert, RotateCw, WifiOff, X } from 'lucide-react-native'
import { ProgressRing } from './ProgressRing'
import { Colors, Motion, Opacity, Radius, Spacing, Typography } from './tokens'
import type { UploadStatus } from '@/features/uploads/uploadQueue'

export type { UploadStatus }

export interface PhotoUploadTileProps {
  /** URI locale de la photo choisie : affichée tout de suite. */
  source: string
  status: UploadStatus
  /** Fraction envoyée, de 0 à 1. */
  progress?: number
  onRetry?: () => void
  /** Annule l'envoi en cours, ou retire une photo en échec. */
  onCancel?: () => void
  size?: number
  style?: ViewStyle
}

const ease = Easing.bezier(...Motion.easing.out)
const easeInOut = Easing.bezier(...Motion.easing.inOut)
/** Zone de toucher minimale (Apple, Google) : 44 pt. */
const MIN_TOUCH = 44
const CLOSE_SIZE = 24
/** En dessous, les mots ne tiennent pas : icônes seules, libellés pour VoiceOver. */
const COMPACT_BELOW = 88

/**
 * Une photo et l'état de son envoi, sur la photo même.
 *
 * Préparation : voile léger et petit loader. Envoi : anneau nourri par la
 * vraie progression. Analyse : balayage lumineux. Réussite : l'anneau se
 * referme en coche, le voile s'en va. Échec : bordure d'erreur et bouton
 * Réessayer — la photo reste là. Hors connexion : « En attente ».
 */
export function PhotoUploadTile({
  source,
  status,
  progress = 0,
  onRetry,
  onCancel,
  size = 72,
  style,
}: PhotoUploadTileProps) {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()
  const [showPercent, setShowPercent] = useState(false)
  const compact = size < COMPACT_BELOW
  const percent = Math.round(Math.max(0, Math.min(1, progress)) * 100)

  // Entrée : fondu + zoom 0,96 → 1 (fondu seul si « Réduire les animations »).
  const enter = useSharedValue(0)
  useEffect(() => {
    enter.value = withTiming(1, { duration: Motion.duration.base, easing: ease })
  }, [])
  const enterStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: reduceMotion ? [] : [{ scale: Motion.enterScale + (1 - Motion.enterScale) * enter.value }],
  }))

  // Voile : léger en préparation et en échec, plein pendant l'envoi, absent une fois fini.
  const veilTarget =
    status === 'uploading' || status === 'queued' || status === 'offline' ? Opacity.scrim
    : status === 'preparing' || status === 'error' ? Opacity.scrim / 2
    : 0
  const veil = useSharedValue(veilTarget)
  useEffect(() => {
    // Réussite : le voile attend que la coche soit posée, puis s'en va.
    const delay = status === 'done' && !reduceMotion ? Motion.duration.fast : 0
    veil.value = withDelay(delay, withTiming(veilTarget, { duration: Motion.duration.base, easing: ease }))
  }, [veilTarget])
  const veilStyle = useAnimatedStyle(() => ({ opacity: veil.value }))

  // Coche : apparaît en grossissant, puis s'efface avec le voile (< 600 ms en tout).
  const check = useSharedValue(status === 'done' ? 1 : 0)
  useEffect(() => {
    if (status === 'done') {
      check.value = reduceMotion
        ? withSequence(withTiming(1, { duration: Motion.duration.fast }), withDelay(Motion.duration.fast, withTiming(0, { duration: Motion.duration.fast })))
        : withSequence(
            withTiming(1, { duration: Motion.duration.fast, easing: ease }),
            withDelay(Motion.duration.fast, withTiming(0, { duration: Motion.duration.finish - 2 * Motion.duration.fast, easing: ease })),
          )
    } else {
      check.value = 0
    }
  }, [status])
  // L'anneau plein s'efface avec la coche : il ne reste que la photo.
  const ringOut = useSharedValue(1)
  useEffect(() => {
    ringOut.value = status === 'done'
      ? withDelay(2 * Motion.duration.fast, withTiming(0, { duration: Motion.duration.finish - 2 * Motion.duration.fast, easing: ease }))
      : 1
  }, [status])
  const ringStyle = useAnimatedStyle(() => ({ opacity: ringOut.value }))

  const checkStyle = useAnimatedStyle(() => ({
    opacity: check.value,
    transform: reduceMotion ? [] : [{ scale: 0.6 + 0.4 * Math.min(1, check.value) }],
  }))

  // Analyse : un balayage lumineux traverse la photo (pulsation douce si animations réduites).
  const sweep = useSharedValue(0)
  useEffect(() => {
    if (status === 'analyzing') {
      sweep.value = 0
      sweep.value = withRepeat(
        withTiming(1, { duration: Motion.duration.slow * 3, easing: easeInOut }),
        -1,
        reduceMotion,
      )
    } else {
      cancelAnimation(sweep)
      sweep.value = 0
    }
    return () => cancelAnimation(sweep)
  }, [status, reduceMotion])
  const sweepStyle = useAnimatedStyle(() =>
    reduceMotion
      ? { opacity: 0.2 + 0.4 * sweep.value }
      : { opacity: 1, transform: [{ translateX: -size + sweep.value * size * 2 }] },
  )

  const ringSize = Math.min(Math.round(size * 0.5), 56)
  const showRing = status === 'uploading' || status === 'queued' || status === 'done'
  const canCancel = !!onCancel && status !== 'done' && status !== 'analyzing'

  const label = (() => {
    switch (status) {
      case 'preparing': return t('upload.tile.preparing')
      case 'queued': return t('upload.tile.queued')
      case 'uploading': return t('upload.tile.uploading', { percent })
      case 'analyzing': return t('upload.tile.analyzing')
      case 'done': return t('upload.tile.done')
      case 'error': return t('upload.tile.error')
      case 'offline': return t('upload.tile.offline')
    }
  })()

  const tile = (
    <Animated.View
      style={[
        styles.tile,
        { width: size, height: size },
        status === 'error' && styles.tileError,
        enterStyle,
        style,
      ]}
    >
      <Image source={{ uri: source }} style={StyleSheet.absoluteFill} contentFit="cover" transition={0} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.veil, veilStyle]} />

      {status === 'analyzing' && (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, sweepStyle]}>
          <Svg width={size} height={size}>
            <Defs>
              <LinearGradient id="sweep" x1="0" y1="0" x2="1" y2="0.35">
                <Stop offset="0.25" stopColor={Colors.surface} stopOpacity={0} />
                <Stop offset="0.5" stopColor={Colors.surface} stopOpacity={0.55} />
                <Stop offset="0.75" stopColor={Colors.surface} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={size} height={size} fill="url(#sweep)" />
          </Svg>
        </Animated.View>
      )}

      <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center]}>
        {status === 'preparing' && <ActivityIndicator size="small" color={Colors.textInverse} />}

        {showRing && (
          <Animated.View style={ringStyle}>
            <ProgressRing
              progress={status === 'done' ? 1 : status === 'queued' ? 0 : progress}
              size={ringSize}
              strokeWidth={ringSize >= 40 ? 3 : 2.5}
              color={Colors.textInverse}
              trackColor={Colors.borderLight}
            >
              {status === 'uploading' && (showPercent || !compact) && (
                <Text style={[styles.percent, { fontSize: ringSize >= 40 ? Typography.xs : 9 }]}>{percent}</Text>
              )}
            </ProgressRing>
            <Animated.View style={[StyleSheet.absoluteFill, styles.center, checkStyle]}>
              <View style={[styles.checkBubble, { width: ringSize, height: ringSize, borderRadius: ringSize / 2 }]}>
                <Check size={Math.round(ringSize * 0.5)} color={Colors.textInverse} strokeWidth={3} />
              </View>
            </Animated.View>
          </Animated.View>
        )}

        {status === 'offline' && (
          <View style={styles.stack}>
            <WifiOff size={compact ? 18 : 20} color={Colors.textInverse} strokeWidth={2} />
            {!compact && <Text style={styles.caption}>{t('upload.tile.waiting')}</Text>}
          </View>
        )}

        {status === 'error' && (
          <View style={styles.stack}>
            <View style={styles.errorIcon}>
              <CircleAlert size={compact ? 16 : 18} color={Colors.error} strokeWidth={2.2} />
            </View>
            {!!onRetry && (
              <View style={[styles.retryPill, compact && styles.retryPillCompact]}>
                <RotateCw size={12} color={Colors.error} strokeWidth={2.4} />
                {!compact && <Text style={styles.retryText}>{t('upload.tile.retry')}</Text>}
              </View>
            )}
          </View>
        )}
      </View>
    </Animated.View>
  )

  return (
    <View style={{ width: size, height: size }}>
      <Pressable
        // Toute la vignette réessaie en cas d'échec : la cible fait la
        // taille de la photo, bien au-delà des 44 pt.
        onPress={status === 'error' ? onRetry : undefined}
        onLongPress={status === 'uploading' ? () => setShowPercent(v => !v) : undefined}
        disabled={status !== 'error' && status !== 'uploading'}
        accessible
        accessibilityRole={status === 'error' && onRetry ? 'button' : 'image'}
        accessibilityLabel={label}
        accessibilityHint={status === 'error' && onRetry ? t('upload.tile.errorHint') : undefined}
        accessibilityValue={status === 'uploading' ? { min: 0, max: 100, now: percent } : undefined}
        accessibilityLiveRegion="polite"
        accessibilityState={{ busy: status === 'preparing' || status === 'uploading' || status === 'analyzing' }}
      >
        {tile}
      </Pressable>

      {canCancel && (
        <Pressable
          onPress={onCancel}
          hitSlop={(MIN_TOUCH - CLOSE_SIZE) / 2}
          style={styles.close}
          accessibilityRole="button"
          accessibilityLabel={status === 'error' ? t('upload.tile.remove') : t('upload.tile.cancel')}
        >
          <X size={14} color={Colors.textInverse} strokeWidth={2.6} />
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceWarm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tileError: { borderWidth: 2, borderColor: Colors.error },
  veil: { backgroundColor: Colors.textPrimary },
  center: { alignItems: 'center', justifyContent: 'center' },
  stack: { alignItems: 'center', gap: Spacing.xs },
  percent: { color: Colors.textInverse, fontWeight: Typography.semibold, fontVariant: ['tabular-nums'] },
  checkBubble: { backgroundColor: Colors.success, alignItems: 'center', justifyContent: 'center' },
  caption: { color: Colors.textInverse, fontSize: Typography.xs, fontWeight: Typography.semibold },
  errorIcon: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    padding: 3,
  },
  retryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  retryPillCompact: { paddingHorizontal: Spacing.xs + 2 },
  retryText: { color: Colors.error, fontSize: Typography.xs, fontWeight: Typography.semibold },
  close: {
    position: 'absolute',
    top: -Spacing.xs - 2,
    right: -Spacing.xs - 2,
    width: CLOSE_SIZE,
    height: CLOSE_SIZE,
    borderRadius: CLOSE_SIZE / 2,
    backgroundColor: Colors.textPrimary,
    borderWidth: 2,
    borderColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
