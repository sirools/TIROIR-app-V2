import React, { useState } from 'react'
import { View, Text, StyleSheet, Platform, TouchableOpacity, Linking } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import * as AppleAuthentication from 'expo-apple-authentication'
import { supabase } from '@/lib/supabase'
import { signInWithApple, signInWithGoogle } from '@/features/auth/socialAuth'
import { FormScreen, PRIMARY_BUTTON_SPACE, Button, Input, GoogleButton, Colors, Typography, Spacing, Radius } from '@/components/ui'

export default function LoginScreen() {
  const router = useRouter()
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [socialLoading, setSocialLoading] = useState<'apple' | 'google' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleAppleSignIn() {
    setError(null)
    setSocialLoading('apple')
    try {
      await signInWithApple()
    } catch (e: any) {
      if (e?.code !== 'ERR_REQUEST_CANCELED') {
        setError(e?.message ?? t('auth.login.errorAppleFailed'))
      }
    } finally {
      setSocialLoading(null)
    }
  }

  async function handleGoogleSignIn() {
    setError(null)
    setSocialLoading('google')
    try {
      await signInWithGoogle()
    } catch (e: any) {
      setError(e?.message ?? t('auth.login.errorGoogleFailed'))
    } finally {
      setSocialLoading(null)
    }
  }

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError(t('auth.login.errorMissingCredentials'))
      return
    }

    setLoading(true)
    setError(null)

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    setLoading(false)

    if (authError) {
      if (authError.message.includes('Invalid login credentials')) {
        setError(t('auth.login.errorInvalidCredentials'))
      } else {
        setError(authError.message)
      }
    }
    // La redirection est gérée par le guard dans _layout.tsx
  }

  return (
    <FormScreen centered keepVisibleBelow={PRIMARY_BUTTON_SPACE}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.wordmark}>Tiroir</Text>
            <Text style={styles.tagline}>{t('auth.login.tagline')}</Text>
          </View>

          <View style={styles.form}>
            <Input
              label={t('auth.login.emailLabel')}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              placeholder={t('auth.login.emailPlaceholder')}
            />
            <Input
              label={t('auth.login.passwordLabel')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              placeholder="••••••••"
              returnKeyType="go"
              onSubmitEditing={handleLogin}
              containerStyle={{ marginTop: Spacing.md }}
            />

            {error && <Text style={styles.error}>{error}</Text>}

            <Button
              label={t('auth.login.signIn')}
              onPress={handleLogin}
              loading={loading}
              style={{ marginTop: Spacing.lg }}
            />

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t('common.or')}</Text>
              <View style={styles.dividerLine} />
            </View>

            {Platform.OS === 'ios' && AppleAuthentication.AppleAuthenticationButton && (
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                cornerRadius={Radius.lg}
                style={styles.appleButton}
                onPress={handleAppleSignIn}
              />
            )}

            <GoogleButton
              label={t('common.continueWithGoogle')}
              onPress={handleGoogleSignIn}
              loading={socialLoading === 'google'}
              style={{ marginTop: Spacing.sm }}
            />

            <Text style={styles.legalNote}>
              {t('auth.login.legalPrefix')}
              <Text
                style={styles.legalLink}
                onPress={() => Linking.openURL('https://tiroir.app/cgu')}
              >
                {t('common.cgu')}
              </Text>
              {t('auth.login.legalAnd')}
              <Text
                style={styles.legalLink}
                onPress={() => Linking.openURL('https://tiroir.app/privacy')}
              >
                {t('common.privacyPolicy')}
              </Text>
              .
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => router.push('/(auth)/forgot-password')}
            style={styles.linkRow}
          >
            <Text style={styles.link}>{t('auth.login.forgotQuestion')}<Text style={styles.linkBold}>{t('auth.login.reset')}</Text></Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/(auth)/register')}
            style={styles.linkRow}
          >
            <Text style={styles.link}>{t('auth.login.noAccountQuestion')}<Text style={styles.linkBold}>{t('auth.login.createAccount')}</Text></Text>
          </TouchableOpacity>
        </View>
    </FormScreen>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
    gap: Spacing.xxl,
  },
  header: {
    gap: Spacing.xs,
  },
  wordmark: {
    fontSize: Typography.xxxl,
    fontWeight: Typography.bold,
    color: Colors.accent,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: Typography.md,
    color: Colors.textSecondary,
    fontWeight: Typography.regular,
  },
  form: {
    gap: 0,
  },
  error: {
    fontSize: Typography.sm,
    color: Colors.error,
    marginTop: Spacing.sm,
  },
  linkRow: {
    alignItems: 'center',
  },
  link: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
  linkBold: {
    color: Colors.accent,
    fontWeight: Typography.semibold,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontSize: Typography.sm,
    color: Colors.textTertiary,
  },
  appleButton: {
    height: 52,
    width: '100%',
    marginTop: Spacing.md,
  },
  legalNote: {
    fontSize: Typography.xs,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: Typography.xs * 1.5,
    marginTop: Spacing.md,
  },
  legalLink: {
    color: Colors.accent,
    fontWeight: Typography.medium,
  },
})
