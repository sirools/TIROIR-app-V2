import React, { useState } from 'react'
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity, Linking } from 'react-native'
import { useRouter } from 'expo-router'
import * as AppleAuthentication from 'expo-apple-authentication'
import { supabase } from '@/lib/supabase'
import { signInWithApple, signInWithGoogle } from '@/features/auth/socialAuth'
import { Screen, Button, Input, Checkbox, GoogleButton, Colors, Typography, Spacing, Radius } from '@/components/ui'

export default function RegisterScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [socialLoading, setSocialLoading] = useState<'apple' | 'google' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [cguAccepted, setCguAccepted] = useState(false)

  async function handleAppleSignIn() {
    if (!cguAccepted) {
      setError("Merci d'accepter les Conditions Générales d'Utilisation pour continuer.")
      return
    }
    setError(null)
    setSocialLoading('apple')
    try {
      await signInWithApple()
    } catch (e: any) {
      if (e?.code !== 'ERR_REQUEST_CANCELED') {
        setError(e?.message ?? "La connexion avec Apple a échoué.")
      }
    } finally {
      setSocialLoading(null)
    }
  }

  async function handleGoogleSignIn() {
    if (!cguAccepted) {
      setError("Merci d'accepter les Conditions Générales d'Utilisation pour continuer.")
      return
    }
    setError(null)
    setSocialLoading('google')
    try {
      await signInWithGoogle()
    } catch (e: any) {
      setError(e?.message ?? "La connexion avec Google a échoué.")
    } finally {
      setSocialLoading(null)
    }
  }

  async function handleRegister() {
    if (!email.trim() || !password || !name.trim()) {
      setError('Renseigne ton prénom, ton email et un mot de passe.')
      return
    }
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.')
      return
    }
    if (!cguAccepted) {
      setError('Merci d\'accepter les Conditions Générales d\'Utilisation pour continuer.')
      return
    }

    setLoading(true)
    setError(null)

    const { error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: name.trim() } },
    })

    setLoading(false)

    if (authError) {
      setError(authError.message)
    } else {
      setSuccess(true)
    }
  }

  if (success) {
    return (
      <Screen>
        <View style={styles.successContainer}>
          <Text style={styles.wordmark}>Tiroir</Text>
          <Text style={styles.successTitle}>Compte créé !</Text>
          <Text style={styles.successText}>
            Vérifie ta boîte mail pour confirmer ton adresse, puis connecte-toi.
          </Text>
          <Button
            label="Se connecter"
            onPress={() => router.replace('/(auth)/login')}
            style={{ marginTop: Spacing.lg }}
          />
        </View>
      </Screen>
    )
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kav}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <Text style={styles.back}>← Retour</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Créer un compte</Text>
          </View>

          <View style={styles.form}>
            <Input
              label="Prénom"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoComplete="name"
              placeholder="Ada"
            />
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              placeholder="ada@exemple.com"
              containerStyle={{ marginTop: Spacing.md }}
            />
            <Input
              label="Mot de passe"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="6 caractères minimum"
              containerStyle={{ marginTop: Spacing.md }}
            />

            <View style={styles.cguRow}>
              <Checkbox checked={cguAccepted} onToggle={() => setCguAccepted(v => !v)} />
              <Text style={styles.cguText}>
                J'ai lu et j'accepte les{' '}
                <Text
                  style={styles.cguLink}
                  onPress={() => Linking.openURL('https://tiroir.app/cgu')}
                >
                  Conditions Générales d'Utilisation
                </Text>
              </Text>
            </View>

            {error && <Text style={styles.error}>{error}</Text>}

            <Button
              label="Créer mon compte"
              onPress={handleRegister}
              loading={loading}
              disabled={!cguAccepted}
              style={{ marginTop: Spacing.lg }}
            />

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ou</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={[styles.socialGroup, !cguAccepted && styles.socialGroupDisabled]}>
              {Platform.OS === 'ios' && AppleAuthentication.AppleAuthenticationButton && (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                  cornerRadius={Radius.lg}
                  style={styles.appleButton}
                  onPress={handleAppleSignIn}
                />
              )}

              <GoogleButton
                label="Continuer avec Google"
                onPress={handleGoogleSignIn}
                loading={socialLoading === 'google'}
                style={{ marginTop: Spacing.sm }}
              />
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  kav: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    gap: Spacing.xl,
  },
  header: { gap: Spacing.md },
  back: {
    fontSize: Typography.base,
    color: Colors.accent,
    fontWeight: Typography.medium,
  },
  title: {
    fontSize: Typography.xxl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  form: { gap: 0 },
  cguRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  cguText: {
    flex: 1,
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    lineHeight: Typography.sm * 1.5,
  },
  cguLink: {
    color: Colors.accent,
    fontWeight: Typography.semibold,
    textDecorationLine: 'underline',
  },
  error: {
    fontSize: Typography.sm,
    color: Colors.error,
    marginTop: Spacing.sm,
  },
  successContainer: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
    gap: Spacing.md,
  },
  wordmark: {
    fontSize: Typography.xxxl,
    fontWeight: Typography.bold,
    color: Colors.accent,
    letterSpacing: -1,
    marginBottom: Spacing.md,
  },
  successTitle: {
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },
  successText: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    lineHeight: Typography.base * 1.5,
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
  socialGroup: {
    marginTop: Spacing.md,
  },
  socialGroupDisabled: {
    opacity: 0.5,
  },
  appleButton: {
    height: 52,
    width: '100%',
  },
})
