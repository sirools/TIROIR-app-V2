import React, { useEffect } from 'react'
import { View, Text, Pressable, StyleSheet, type ViewStyle } from 'react-native'
import { useTranslation } from 'react-i18next'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, useReducedMotion } from 'react-native-reanimated'
import { CircleAlert, Sparkles, WifiOff } from 'lucide-react-native'
import { Colors, Motion, Radius, Spacing, Typography } from './tokens'
import type { UploadSummary } from '@/features/uploads/uploadQueue'

const ease = Easing.bezier(...Motion.easing.out)

export interface UploadStatusBarProps {
  summary: UploadSummary
  /** « Tout réessayer », montré quand des envois ont échoué. */
  onRetryAll?: () => void
  style?: ViewStyle
}

/**
 * Compteur d'ensemble : « 2 sur 5 envoyées », et la phrase qui dit quoi
 * faire quand un envoi coince (hors connexion, échec). Une seule ligne,
 * lue par VoiceOver/TalkBack à chaque changement.
 */
export function UploadStatusBar({ summary, onRetryAll, style }: UploadStatusBarProps) {
  const { t } = useTranslation()
  const reduceMotion = useReducedMotion()
  const fill = useSharedValue(summary.progress)

  useEffect(() => {
    fill.value = reduceMotion
      ? summary.progress
      : withTiming(summary.progress, { duration: Motion.duration.base, easing: ease })
  }, [summary.progress, reduceMotion])
  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }))

  if (summary.total === 0) return null

  const { total, done, failed, offline, analyzing } = summary
  const line =
    analyzing ? t('upload.bar.analyzing', { count: total })
    : failed > 0 ? t('upload.bar.failed', { count: failed })
    : offline > 0 ? t('upload.bar.offline')
    : done === total ? t('upload.bar.done', { count: total })
    : t('upload.bar.progress', { done, count: total })

  const tone = failed > 0 ? 'error' : 'normal'

  return (
    <View style={[styles.root, style]}>
      <View style={styles.row}>
        {analyzing ? <Sparkles size={16} color={Colors.accent} strokeWidth={2} />
          : failed > 0 ? <CircleAlert size={16} color={Colors.error} strokeWidth={2.2} />
          : offline > 0 ? <WifiOff size={16} color={Colors.textSecondary} strokeWidth={2} />
          : null}
        <Text
          style={[styles.text, tone === 'error' && styles.textError]}
          numberOfLines={2}
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: total, now: done }}
          accessibilityLiveRegion="polite"
        >
          {line}
        </Text>
        {failed > 0 && onRetryAll && (
          <Pressable
            onPress={onRetryAll}
            hitSlop={Spacing.sm}
            style={styles.action}
            accessibilityRole="button"
            accessibilityLabel={t('upload.bar.retryAll')}
          >
            <Text style={styles.actionText}>{t('upload.bar.retryAll')}</Text>
          </Pressable>
        )}
      </View>
      {!analyzing && done < total && (
        <View style={styles.track}>
          <Animated.View style={[styles.fill, failed > 0 && styles.fillError, fillStyle]} />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: 24 },
  text: { flex: 1, fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: Typography.medium },
  textError: { color: Colors.error },
  action: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.xs },
  actionText: { fontSize: Typography.sm, color: Colors.accent, fontWeight: Typography.semibold },
  track: { height: 4, borderRadius: Radius.full, backgroundColor: Colors.borderLight, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.full, backgroundColor: Colors.accent },
  fillError: { backgroundColor: Colors.error },
})
