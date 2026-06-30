import React, { useState } from 'react'
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { Screen, Button, Input, Colors, Typography, Spacing } from '@/components/ui'

export default function LoginScreen() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin() {
    if (!email.trim() || !password) {
      setError('Renseigne ton email et ton mot de passe.')
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
        setError('Email ou mot de passe incorrect.')
      } else {
        setError(authError.message)
      }
    }
    // La redirection est gérée par le guard dans _layout.tsx
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kav}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.wordmark}>Tiroir</Text>
            <Text style={styles.tagline}>Retrouve ce que tu possèdes.</Text>
          </View>

          <View style={styles.form}>
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              placeholder="toi@exemple.com"
            />
            <Input
              label="Mot de passe"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
              placeholder="••••••••"
              containerStyle={{ marginTop: Spacing.md }}
            />

            {error && <Text style={styles.error}>{error}</Text>}

            <Button
              label="Se connecter"
              onPress={handleLogin}
              loading={loading}
              style={{ marginTop: Spacing.lg }}
            />
          </View>

          <TouchableOpacity
            onPress={() => router.push('/(auth)/forgot-password')}
            style={styles.linkRow}
          >
            <Text style={styles.link}>Mot de passe oublié ? <Text style={styles.linkBold}>Réinitialiser</Text></Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push('/(auth)/register')}
            style={styles.linkRow}
          >
            <Text style={styles.link}>Pas encore de compte ? <Text style={styles.linkBold}>Créer un compte</Text></Text>
          </TouchableOpacity>
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
})
