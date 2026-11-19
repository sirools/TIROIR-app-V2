import { useEffect, useState } from 'react'
import { Tabs, useRouter, useSegments } from 'expo-router'
import { View, TouchableOpacity, StyleSheet } from 'react-native'
import { Archive, Camera, Search } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors, ToastProvider } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthContext'
import { needsOnboarding, wasOnboardingSeen } from '@/features/onboarding/onboardingState'
import { BatchIndicator } from '@/features/batch/BatchIndicator'
import { restoreBatch, suspendBatch } from '@/features/batch/batchStore'

const ICON_AREA_H = 64

interface TabBarProps {
  state: { index: number; routes: { name: string }[] }
  navigation: { navigate: (name: string) => void }
}

function CustomTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets()

  // L'onboarding occupe tout l'écran : pas d'onglets pour en sortir de côté.
  const current = state.routes[state.index]?.name
  // Comme la rafale : l'appareil photo prend tout l'écran.
  if (current === 'onboarding' || current === 'capture/burst') return null

  // Les 3 onglets visibles sont index=0,1,2 dans state.routes
  const tabs = [
    { name: 'index',         icon: Archive },
    { name: 'capture/index', icon: Camera,  camera: true },
    { name: 'search',        icon: Search },
  ]

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
      {/* Import multiple en cours : visible depuis tous les écrans. */}
      <BatchIndicator />
      <View style={styles.row}>
        {tabs.map(tab => {
          const routeIndex = state.routes.findIndex((r: { name: string }) => r.name === tab.name)
          const focused = state.index === routeIndex
          const Icon = tab.icon

          return (
            <TouchableOpacity
              key={tab.name}
              style={styles.item}
              activeOpacity={0.8}
              onPress={() => navigation.navigate(tab.name)}
            >
              {tab.camera ? (
                <View style={[styles.iconBtn, styles.cameraBtn, focused && styles.cameraBtnFocused]}>
                  <Icon size={22} color="#fff" strokeWidth={1.8} />
                </View>
              ) : (
                <View style={[styles.iconBtn, focused && styles.iconBtnActive]}>
                  <Icon size={22} color={focused ? Colors.accent : Colors.textTertiary} strokeWidth={1.8} />
                </View>
              )}
            </TouchableOpacity>
          )
        })}
      </View>
    </View>
  )
}

/**
 * Ouvre l'onboarding quand le profil dit qu'il n'a jamais été présenté
 * (nouveau compte). Rend `true` le temps de décider, pour que l'accueil
 * n'apparaisse pas une fraction de seconde avant lui.
 */
function useOnboardingGate(): boolean {
  const { user, profile } = useAuth()
  const router = useRouter()
  const segments = useSegments() as string[]
  const onOnboarding = segments.includes('onboarding')
  const userId = user?.id ?? null
  const pending = !!userId && needsOnboarding(profile)
  /** Compte pour lequel l'appareil se souvient d'un onboarding terminé ou passé. */
  const [clearedFor, setClearedFor] = useState<string | null>(null)

  useEffect(() => {
    if (!pending || !userId || onOnboarding || clearedFor === userId) return
    let cancelled = false
    wasOnboardingSeen(userId).then(seen => {
      if (cancelled) return
      if (seen) setClearedFor(userId)
      else router.replace('/onboarding')
    })
    return () => { cancelled = true }
  }, [pending, userId, onOnboarding, clearedFor, router])

  return pending && !onOnboarding && clearedFor !== userId
}

export default function AppLayout() {
  const deciding = useOnboardingGate()
  const { user } = useAuth()
  const userId = user?.id ?? null

  // Un import interrompu (app fermée, réseau perdu) reprend à l'ouverture.
  useEffect(() => {
    if (userId) void restoreBatch(userId)
    else suspendBatch()
  }, [userId])

  return (
    <ToastProvider>
      <Tabs
        tabBar={props => <CustomTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="capture/index" />
        <Tabs.Screen name="search" />
        <Tabs.Screen name="onboarding"        options={{ href: null }} />
        <Tabs.Screen name="profile"           options={{ href: null }} />
        <Tabs.Screen name="shares"            options={{ href: null }} />
        <Tabs.Screen name="settings"          options={{ href: null }} />
        <Tabs.Screen name="capture/uploading" options={{ href: null }} />
        <Tabs.Screen name="capture/review"    options={{ href: null }} />
        <Tabs.Screen name="capture/burst"     options={{ href: null }} />
        <Tabs.Screen name="capture/scene"     options={{ href: null }} />
        <Tabs.Screen name="objects/[id]"      options={{ href: null }} />
        <Tabs.Screen name="objects/edit/[id]" options={{ href: null }} />
        <Tabs.Screen name="collections/index" options={{ href: null }} />
        <Tabs.Screen name="collections/[id]"  options={{ href: null }} />
      </Tabs>
      {deciding ? <View style={styles.gate} /> : null}
    </ToastProvider>
  )
}

const styles = StyleSheet.create({
  gate: {
    position: 'absolute',
    top: 0, right: 0, bottom: 0, left: 0,
    backgroundColor: Colors.background,
  },
  bar: {
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  row: {
    height: ICON_AREA_H,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: ICON_AREA_H,
  },
  iconBtn: {
    width: 52,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconBtnActive: {
    backgroundColor: Colors.accentLight,
  },
  cameraBtn: {
    backgroundColor: '#C0682A',
  },
  cameraBtnFocused: {
    backgroundColor: '#A0541F',
  },
})
