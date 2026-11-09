import { Tabs } from 'expo-router'
import { View, TouchableOpacity, StyleSheet } from 'react-native'
import { Archive, Camera, Search } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors, ToastProvider } from '@/components/ui'

const ICON_AREA_H = 64

interface TabBarProps {
  state: { index: number; routes: { name: string }[] }
  navigation: { navigate: (name: string) => void }
}

function CustomTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets()

  // Les 3 onglets visibles sont index=0,1,2 dans state.routes
  const tabs = [
    { name: 'index',         icon: Archive },
    { name: 'capture/index', icon: Camera,  camera: true },
    { name: 'search',        icon: Search },
  ]

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
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

export default function AppLayout() {
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
        <Tabs.Screen name="capture/scene"     options={{ href: null }} />
        <Tabs.Screen name="objects/[id]"      options={{ href: null }} />
        <Tabs.Screen name="objects/edit/[id]" options={{ href: null }} />
        <Tabs.Screen name="collections/index" options={{ href: null }} />
        <Tabs.Screen name="collections/[id]"  options={{ href: null }} />
        <Tabs.Screen name="dev/uploads"       options={{ href: null }} />
      </Tabs>
    </ToastProvider>
  )
}

const styles = StyleSheet.create({
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
