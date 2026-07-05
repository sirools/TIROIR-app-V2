import { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { Platform } from 'react-native'
import Purchases, { LOG_LEVEL } from 'react-native-purchases'
import { AuthProvider, useAuth } from '@/features/auth/AuthContext'
import { loadStoredLanguage } from '@/i18n'

const RC_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY

// Initialisation RevenueCat au démarrage de l'app
try {
  if (Platform.OS === 'ios' && RC_API_KEY) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG)
    Purchases.configure({ apiKey: RC_API_KEY })
  }
} catch (e) {
  console.warn('[RC] configure error', e)
}

function RootGuard() {
  const { session, loading } = useAuth()
  const segments = useSegments()
  const router = useRouter()

  // Lier l'user Supabase à RevenueCat dès qu'une session est disponible
  useEffect(() => {
    if (!RC_API_KEY) return
    try {
      if (session?.user?.id) {
        Purchases.logIn(session.user.id).catch(e =>
          console.warn('[RC] logIn error', e)
        )
      }
      // logOut() intentionnellement omis : RC gère l'état anonyme seul
    } catch (e) {
      console.warn('[RC] session sync error', e)
    }
  }, [session?.user?.id])

  useEffect(() => {
    if (loading) return

    const inAuth    = segments[0] === '(auth)'
  const isPublic  = segments[0] === 's' || segments[0] === 'privacy'

    if (isPublic) return
    if (!session && !inAuth) {
      router.replace('/(auth)/login')
    } else if (session && inAuth) {
      router.replace('/(app)')
    }
  }, [session, loading, segments])

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(app)" />
      <Stack.Screen name="s/[token]" />
      <Stack.Screen name="privacy" />
    </Stack>
  )
}

export default function RootLayout() {
  // Applique la langue mémorisée par l'utilisateur (override de la langue de l'appareil).
  // L'i18n est déjà initialisé de façon synchrone (langue de l'appareil) à l'import.
  useEffect(() => {
    loadStoredLanguage()
  }, [])

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AuthProvider>
        <RootGuard />
      </AuthProvider>
    </SafeAreaProvider>
  )
}
