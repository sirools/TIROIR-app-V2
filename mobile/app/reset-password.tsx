// Écran d'arrivée du lien de réinitialisation envoyé par e-mail
// (tiroir://reset-password).
//
// Volontairement hors du groupe (auth) : le lien de récupération ouvre une
// session, et le garde de navigation de _layout renverrait aussitôt vers
// l'app si cet écran vivait dans (auth). Le garde laisse passer cette route.
//
// Le client mobile est configuré avec detectSessionInUrl: false — normal en
// natif — donc c'est ici qu'on lit le lien et qu'on ouvre la session, à la
// main. Supabase renvoie soit un couple de jetons dans le fragment (#) en
// flux implicite, soit un ?code= en flux PKCE : les deux sont gérés.
import React, { useEffect, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import * as Linking from 'expo-linking'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { FormScreen, PRIMARY_BUTTON_SPACE, Button, Input, Colors, Typography, Spacing } from '@/components/ui'

const MIN_PASSWORD_LENGTH = 8

type Phase = 'opening' | 'ready' | 'invalid' | 'done'

/** Extrait les paramètres d'auth, qu'ils soient dans le fragment ou la query. */
function parseAuthParams(url: string): URLSearchParams {
  const hashIndex = url.indexOf('#')
  const fragment = hashIndex >= 0 ? url.slice(hashIndex + 1) : ''
  if (fragment) return new URLSearchParams(fragment)

  const queryIndex = url.indexOf('?')
  return new URLSearchParams(queryIndex >= 0 ? url.slice(queryIndex + 1) : '')
}

export default function ResetPasswordScreen() {
  const router = useRouter()
  const { t } = useTranslation()
  // useURL couvre les deux cas : app lancée par le lien, et app déjà ouverte.
  const url = Linking.useURL()

  const [phase, setPhase] = useState<Phase>('opening')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!url || phase === 'ready' || phase === 'done') return

    let cancelled = false

    async function openSession(link: string) {
      const params = parseAuthParams(link)

      const authError = params.get('error_description') ?? params.get('error')
      if (authError) {
        if (!cancelled) { setError(authError); setPhase('invalid') }
        return
      }

      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')
      const code = params.get('code')

      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        if (!cancelled) {
          if (sessionError) { setError(sessionError.message); setPhase('invalid') }
          else setPhase('ready')
        }
        return
      }

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (!cancelled) {
          if (exchangeError) { setError(exchangeError.message); setPhase('invalid') }
          else setPhase('ready')
        }
        return
      }

      // Pas de jeton dans le lien : reste valable si une session de
      // récupération a déjà été ouverte (retour sur l'écran, par exemple).
      const { data } = await supabase.auth.getSession()
      if (!cancelled) setPhase(data.session ? 'ready' : 'invalid')
    }

    openSession(url)
    return () => { cancelled = true }
  }, [url, phase])

  async function handleSubmit() {
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(t('auth.reset.errorTooShort', { count: MIN_PASSWORD_LENGTH }))
      return
    }
    if (password !== confirm) {
      setError(t('auth.reset.errorMismatch'))
      return
    }

    setLoading(true)
    setError(null)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) { setError(updateError.message); return }
    setPhase('done')
  }

  return (
    <FormScreen keepVisibleBelow={PRIMARY_BUTTON_SPACE}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('auth.reset.title')}</Text>
            <Text style={styles.subtitle}>
              {phase === 'invalid' ? t('auth.reset.invalidSubtitle') : t('auth.reset.subtitle')}
            </Text>
          </View>

          {phase === 'opening' && (
            <Text style={styles.subtitle}>{t('auth.reset.opening')}</Text>
          )}

          {phase === 'invalid' && (
            <View style={styles.form}>
              {error && <Text style={styles.error}>{error}</Text>}
              <Button
                label={t('auth.reset.askNewLink')}
                onPress={() => router.replace('/(auth)/forgot-password')}
                style={{ marginTop: Spacing.lg }}
              />
              <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={styles.linkRow}>
                <Text style={styles.linkText}>{t('auth.forgot.backToLogin')}</Text>
              </TouchableOpacity>
            </View>
          )}

          {phase === 'ready' && (
            <View style={styles.form}>
              <Input
                label={t('auth.reset.newPasswordLabel')}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                placeholder={t('auth.reset.newPasswordPlaceholder')}
                autoFocus
              />
              <Input
                label={t('auth.reset.confirmLabel')}
                value={confirm}
                onChangeText={setConfirm}
                secureTextEntry
                autoCapitalize="none"
                autoComplete="new-password"
                placeholder={t('auth.reset.confirmPlaceholder')}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
                containerStyle={{ marginTop: Spacing.md }}
              />
              {error && <Text style={styles.error}>{error}</Text>}
              <Button
                label={t('auth.reset.submit')}
                onPress={handleSubmit}
                loading={loading}
                style={{ marginTop: Spacing.lg }}
              />
            </View>
          )}

          {phase === 'done' && (
            <View style={styles.successCard}>
              <Text style={styles.successIcon}>🔒</Text>
              <Text style={styles.successTitle}>{t('auth.reset.successTitle')}</Text>
              <Text style={styles.successText}>{t('auth.reset.successText')}</Text>
              <Button
                label={t('auth.reset.continue')}
                onPress={() => router.replace('/(app)')}
                style={{ marginTop: Spacing.md }}
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
    paddingTop: Spacing.xxl,
    gap: Spacing.xl,
  },
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
  linkRow: { alignSelf: 'center', marginTop: Spacing.lg },
  linkText: { fontSize: Typography.base, color: Colors.accent, fontWeight: Typography.medium },

  successCard: {
    backgroundColor: Colors.accentLight,
    borderRadius: 20,
    padding: Spacing.xl,
    alignItems: 'center',
    gap: Spacing.md,
  },
  successIcon: { fontSize: 40 },
  successTitle: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.accent },
  successText: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
})
