import React, { useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { FormScreen, PRIMARY_BUTTON_SPACE, Button, Input, Colors, Typography, Spacing } from '@/components/ui'

export default function ForgotPasswordScreen() {
  const router = useRouter()
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSend() {
    if (!email.trim()) {
      setError(t('auth.forgot.errorMissingEmail'))
      return
    }
    setLoading(true)
    setError(null)
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: 'tiroir://reset-password',
    })
    setLoading(false)
    if (authError) {
      setError(authError.message)
    } else {
      setSent(true)
    }
  }

  return (
    <FormScreen keepVisibleBelow={PRIMARY_BUTTON_SPACE}>
        <View style={styles.container}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
            <Text style={styles.backText}>← {t('common.back')}</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.title}>{t('auth.forgot.title')}</Text>
            <Text style={styles.subtitle}>
              {t('auth.forgot.subtitle')}
            </Text>
          </View>

          {sent ? (
            <View style={styles.successCard}>
              <Text style={styles.successIcon}>✉️</Text>
              <Text style={styles.successTitle}>{t('auth.forgot.successTitle')}</Text>
              <Text style={styles.successText}>
                {t('auth.forgot.successText')}
              </Text>
              <Button
                label={t('auth.forgot.backToLogin')}
                onPress={() => router.replace('/(auth)/login')}
                style={{ marginTop: Spacing.md }}
              />
            </View>
          ) : (
            <View style={styles.form}>
              <Input
                label={t('auth.forgot.emailLabel')}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                placeholder={t('auth.forgot.emailPlaceholder')}
                autoFocus
                returnKeyType="send"
                onSubmitEditing={handleSend}
              />
              {error && <Text style={styles.error}>{error}</Text>}
              <Button
                label={t('auth.forgot.sendLink')}
                onPress={handleSend}
                loading={loading}
                style={{ marginTop: Spacing.lg }}
              />
            </View>
          )}
        </View>
    </FormScreen>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    gap: Spacing.xl,
  },
  backRow: { alignSelf: 'flex-start' },
  backText: { fontSize: Typography.base, color: Colors.accent, fontWeight: Typography.medium },

  header: { gap: Spacing.xs },
  title: {
    fontSize: Typography.xxl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: { fontSize: Typography.base, color: Colors.textSecondary, lineHeight: 22 },

  form: { gap: 0 },
  error: { fontSize: Typography.sm, color: Colors.error, marginTop: Spacing.sm },

  successCard: {
    backgroundColor: Colors.accentLight,
    borderRadius: 20,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  successIcon: { fontSize: 40 },
  successTitle: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    color: Colors.accent,
  },
  successText: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
})
