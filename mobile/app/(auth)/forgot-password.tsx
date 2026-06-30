import React, { useState } from 'react'
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { Screen, Button, Input, Colors, Typography, Spacing } from '@/components/ui'

export default function ForgotPasswordScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSend() {
    if (!email.trim()) {
      setError('Renseigne ton adresse email.')
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
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kav}
      >
        <View style={styles.container}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backRow}>
            <Text style={styles.backText}>← Retour</Text>
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.title}>Mot de passe oublié</Text>
            <Text style={styles.subtitle}>
              On t'envoie un lien de réinitialisation par email.
            </Text>
          </View>

          {sent ? (
            <View style={styles.successCard}>
              <Text style={styles.successIcon}>✉️</Text>
              <Text style={styles.successTitle}>Email envoyé</Text>
              <Text style={styles.successText}>
                Vérifie ta boîte mail et clique sur le lien pour créer un nouveau mot de passe.
              </Text>
              <Button
                label="Retour à la connexion"
                onPress={() => router.replace('/(auth)/login')}
                style={{ marginTop: Spacing.md }}
              />
            </View>
          ) : (
            <View style={styles.form}>
              <Input
                label="Email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                placeholder="toi@exemple.com"
                autoFocus
              />
              {error && <Text style={styles.error}>{error}</Text>}
              <Button
                label="Envoyer le lien"
                onPress={handleSend}
                loading={loading}
                style={{ marginTop: Spacing.lg }}
              />
            </View>
          )}
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
