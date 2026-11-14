import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Screen, Colors, Typography, Spacing, Radius } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthContext'
import {
  PROFILE_KEYS, USER_PROFILES, saveUserProfile, skipProfileQuestion, type UserProfile,
} from '@/features/profile/userProfile'

/**
 * La question de l'onboarding, au premier lancement : « Tu utilises
 * Tiroir… ». Une question, un écran, la réponse en un tap. Le choix règle
 * le ton, les exemples et les offres suggérées ; il ne déclenche aucun
 * paiement et se change dans Paramètres. Même écran sur le site, après la
 * sauvegarde du premier objet.
 */
export default function ProfileTypeScreen() {
  const router = useRouter()
  const { t } = useTranslation()
  const { user, refreshProfile } = useAuth()
  const [saving, setSaving] = useState<UserProfile | null>(null)
  const [failed, setFailed] = useState(false)

  async function choose(profile: UserProfile) {
    if (!user || saving) return
    setSaving(profile)
    setFailed(false)
    const ok = await saveUserProfile(user.id, profile)
    if (!ok) {
      setSaving(null)
      setFailed(true)
      return
    }
    await refreshProfile()
    setSaving(null)
    router.replace('/(app)')
  }

  async function later() {
    if (user) await skipProfileQuestion(user.id)
    router.replace('/(app)')
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.container}>
        <View style={styles.textBlock}>
          <Text style={styles.wordmark}>Tiroir</Text>
          <Text style={styles.title} accessibilityRole="header">{t('profileType.title')}</Text>
          <Text style={styles.subtitle}>{t('profileType.subtitle')}</Text>
        </View>

        <View style={styles.options}>
          {USER_PROFILES.map(profile => (
            <TouchableOpacity
              key={profile}
              style={styles.option}
              activeOpacity={0.85}
              disabled={saving !== null}
              onPress={() => choose(profile)}
              accessibilityRole="button"
              accessibilityLabel={t(PROFILE_KEYS[profile].label)}
              accessibilityHint={t(PROFILE_KEYS[profile].hint)}
            >
              <View style={styles.optionIcon}>
                {saving === profile
                  ? <ActivityIndicator color={Colors.accent} size="small" />
                  : <Text style={styles.optionEmoji}>{PROFILE_KEYS[profile].icon}</Text>}
              </View>
              <View style={styles.optionText}>
                <Text style={styles.optionLabel}>{t(PROFILE_KEYS[profile].label)}</Text>
                <Text style={styles.optionHint}>{t(PROFILE_KEYS[profile].hint)}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {failed && <Text style={styles.error} accessibilityLiveRegion="polite">{t('profileType.saveFailed')}</Text>}
        <Text style={styles.note}>{t('profileType.noPayment')}</Text>

        <TouchableOpacity style={styles.later} onPress={later} disabled={saving !== null} activeOpacity={0.7}>
          <Text style={styles.laterText}>{t('profileType.skip')}</Text>
        </TouchableOpacity>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.lg,
    justifyContent: 'center',
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
    fontSize: Typography.xxl + 2,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    letterSpacing: -0.6,
    lineHeight: 36,
  },
  subtitle: { fontSize: Typography.base, color: Colors.textSecondary, lineHeight: 22 },

  options: { gap: Spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 76,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.lg,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  optionEmoji: { fontSize: 22 },
  optionText: { flex: 1, gap: 2 },
  optionLabel: { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.textPrimary },
  optionHint: { fontSize: Typography.sm, color: Colors.textSecondary, lineHeight: 18 },

  error: { fontSize: Typography.sm, color: Colors.error },
  note: { fontSize: Typography.sm, color: Colors.textTertiary, lineHeight: 18 },
  later: { alignItems: 'center', paddingVertical: Spacing.sm },
  laterText: { fontSize: Typography.base, color: Colors.textTertiary },
})
