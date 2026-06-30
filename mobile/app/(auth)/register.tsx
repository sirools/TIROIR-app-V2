import React, { useState } from 'react'
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { Screen, Button, Input, Colors, Typography, Spacing } from '@/components/ui'

export default function RegisterScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleRegister() {
    if (!email.trim() || !password || !name.trim()) {
      setError('Renseigne ton prénom, ton email et un mot de passe.')
      return
    }
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.')
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

            {error && <Text style={styles.error}>{error}</Text>}

            <Button
              label="Créer mon compte"
              onPress={handleRegister}
              loading={loading}
              style={{ marginTop: Spacing.lg }}
            />
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
})
