import React, { useRef, useEffect } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Screen, Colors, Typography, Spacing, Radius } from '@/components/ui'

export default function OnboardingScreen() {
  const router = useRouter()
  const { t } = useTranslation()

  const fadeAnim = useRef(new Animated.Value(0)).current
  const slideAnim = useRef(new Animated.Value(32)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 440, useNativeDriver: true }),
    ]).start()
  }, [])

  return (
    <Screen edges={['top', 'bottom']}>
      <Animated.View
        style={[styles.container, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
      >
        {/* Illustration */}
        <View style={styles.illustrationWrap}>
          <View style={styles.illustrationBg}>
            <DrawerIllustration />
          </View>
        </View>

        {/* Texte */}
        <View style={styles.textBlock}>
          <Text style={styles.wordmark}>Tiroir</Text>
          <Text style={styles.title}>{t('onboarding.tagline')}</Text>
          <Text style={styles.subtitle}>
            {t('onboarding.subtitle')}
          </Text>
        </View>

        {/* Points d'onboarding */}
        <View style={styles.points}>
          <OnboardingPoint icon="📷" text={t('onboarding.point1')} />
          <OnboardingPoint icon="📦" text={t('onboarding.point2')} />
          <OnboardingPoint icon="🔍" text={t('onboarding.point3')} />
        </View>

        {/* CTAs */}
        <View style={styles.ctas}>
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => router.replace('/capture')}
            activeOpacity={0.88}
          >
            <Text style={styles.btnPrimaryText}>{t('onboarding.ctaPrimary')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btnGhost}
            onPress={() => router.replace('/(app)')}
            activeOpacity={0.7}
          >
            <Text style={styles.btnGhostText}>{t('onboarding.ctaSecondary')}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Screen>
  )
}

function OnboardingPoint({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.point}>
      <View style={styles.pointIcon}>
        <Text style={styles.pointEmoji}>{icon}</Text>
      </View>
      <Text style={styles.pointText}>{text}</Text>
    </View>
  )
}

function DrawerIllustration() {
  return (
    <View style={styles.drawer}>
      {/* Corps du tiroir */}
      <View style={styles.drawerBody}>
        {[0, 1, 2].map(i => (
          <View key={i} style={styles.drawerRow}>
            <View style={styles.drawerHandle} />
          </View>
        ))}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.xl,
    justifyContent: 'center',
  },

  illustrationWrap: { alignItems: 'center' },
  illustrationBg: {
    width: 120,
    height: 120,
    borderRadius: 32,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  drawer: { alignItems: 'center', justifyContent: 'center' },
  drawerBody: {
    width: 72,
    gap: 4,
  },
  drawerRow: {
    height: 22,
    backgroundColor: Colors.accent,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerHandle: {
    width: 20,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.accentLight,
    opacity: 0.7,
  },

  textBlock: { gap: Spacing.sm },
  wordmark: {
    fontSize: Typography.sm,
    fontWeight: Typography.bold,
    color: Colors.accent,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: Typography.xxl + 4,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    letterSpacing: -0.8,
    lineHeight: 38,
  },
  subtitle: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    lineHeight: 22,
  },

  points: { gap: Spacing.sm },
  point: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  pointIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  pointEmoji: { fontSize: 18 },
  pointText: {
    fontSize: Typography.base,
    color: Colors.textPrimary,
    fontWeight: Typography.medium,
    flex: 1,
  },

  ctas: { gap: Spacing.sm },
  btnPrimary: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnPrimaryText: {
    fontSize: Typography.base,
    fontWeight: Typography.bold,
    color: Colors.textInverse,
    letterSpacing: 0.1,
  },
  btnGhost: { alignItems: 'center', paddingVertical: Spacing.sm },
  btnGhostText: { fontSize: Typography.base, color: Colors.textTertiary },
})
