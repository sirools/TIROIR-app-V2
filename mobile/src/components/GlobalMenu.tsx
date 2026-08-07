import React, { useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Dimensions, Pressable, Alert, Modal, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { User, Settings, LogOut, Link, Zap, MessageCircle } from 'lucide-react-native'
import { Colors, Typography, Spacing, Radius } from '@/components/ui'
import { useAuth } from '@/features/auth/AuthContext'
import { isPaidPlan, isProPlan, planLabelKey } from '@/lib/plan'
import { useFeatureFlags } from '@/features/objects/useFeatureFlags'

const MENU_WIDTH = Dimensions.get('window').width * 0.78

interface GlobalMenuProps {
  visible: boolean
  onClose: () => void
}

export function GlobalMenu({ visible, onClose }: GlobalMenuProps) {
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const { t } = useTranslation()
  const { profile, signOut } = useAuth()
  const plan = (profile as any)?.plan
  const isPremium = isPaidPlan(plan)
  const { flags } = useFeatureFlags()
  const isPro = isProPlan(plan)
  const translateX = useRef(new Animated.Value(-MENU_WIDTH)).current
  const opacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, damping: 24, mass: 0.9 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start()
    } else {
      Animated.parallel([
        Animated.timing(translateX, { toValue: -MENU_WIDTH, duration: 220, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start()
    }
  }, [visible])

  async function handleSignOut() {
    if (Platform.OS === 'web') {
      if (window.confirm(t('menu.signOutWeb'))) {
        onClose()
        await signOut()
      }
      return
    }

    Alert.alert(t('menu.signOut'), t('menu.signOutMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('menu.signOut'),
        style: 'destructive',
        onPress: async () => {
          onClose()
          await signOut()
        },
      },
    ])
  }

  function navigate(path: string) {
    onClose()
    setTimeout(() => router.push(path as any), 250)
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      {/* Backdrop */}
      <Animated.View style={[styles.backdrop, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Panneau */}
      <Animated.View
        style={[
          styles.panel,
          { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + Spacing.lg },
          { transform: [{ translateX }] },
        ]}
      >
        {/* Profil */}
        <TouchableOpacity style={styles.profileRow} onPress={() => navigate('/profile')} activeOpacity={0.7}>
          <View style={styles.avatar}>
            <User size={22} color={Colors.accent} strokeWidth={1.5} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{profile?.display_name ?? t('menu.profileDefault')}</Text>
            <View style={[
              styles.planBadge,
              isPremium && styles.planBadgePremium,
              isPro && styles.planBadgePro,
            ]}>
              <Zap size={9} color={isPro ? '#B4690E' : isPremium ? '#7c3aed' : Colors.accent} strokeWidth={2.5} />
              <Text style={[
                styles.planBadgeText,
                isPremium && styles.planBadgeTextPremium,
                isPro && styles.planBadgeTextPro,
              ]}>
                {t(planLabelKey(plan))}
              </Text>
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.divider} />

        {/* Entrées */}
        {/* Drapeau serveur, pas le plan : l'assistant est encore en
            développement et ne s'ouvre qu'aux comptes admin. */}
        {flags.assistant && (
          <MenuItem
            icon={<MessageCircle size={18} color={Colors.textSecondary} strokeWidth={1.5} />}
            label={t('menu.assistant')}
            badge="BETA"
            onPress={() => navigate('/assistant')}
          />
        )}
        <MenuItem
          icon={<Link size={18} color={Colors.textSecondary} strokeWidth={1.5} />}
          label={t('shares.title')}
          onPress={() => navigate('/shares')}
        />
        <MenuItem
          icon={<Settings size={18} color={Colors.textSecondary} strokeWidth={1.5} />}
          label={t('settings.title')}
          onPress={() => navigate('/settings')}
        />

        {isPremium ? (
          <View style={[styles.premiumActive, isPro && styles.proActive]}>
            <Zap size={14} color={isPro ? '#B4690E' : '#7c3aed'} strokeWidth={2} />
            <Text style={[styles.premiumActiveText, isPro && styles.proActiveText]}>
              {isPro ? t('menu.proActive') : t('menu.premiumActive')}
            </Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.upgradeRow} onPress={() => navigate('/paywall')} activeOpacity={0.85}>
            <Zap size={15} color="white" strokeWidth={2.2} />
            <Text style={styles.upgradeText}>{t('profile.upgrade')}</Text>
          </TouchableOpacity>
        )}

        {/* Déconnexion tout en bas */}
        <View style={styles.spacer} />
        <TouchableOpacity style={styles.signOutRow} onPress={handleSignOut} activeOpacity={0.7}>
          <LogOut size={16} color={Colors.textTertiary} strokeWidth={1.5} />
          <Text style={styles.signOutText}>{t('menu.signOut')}</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  )
}

function MenuItem({ icon, label, badge, onPress }: { icon: React.ReactNode; label: string; badge?: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.menuIcon}>{icon}</View>
      <Text style={styles.menuLabel}>{label}</Text>
      {badge && (
        <View style={styles.menuBadge}>
          <Text style={styles.menuBadgeText}>{badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  )
}

// ── Icône burger exportée pour les headers ──────────────────────────────────

export function BurgerIcon({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} hitSlop={12} style={styles.burger}>
      <View style={styles.burgerLine} />
      <View style={[styles.burgerLine, styles.burgerLineMid]} />
      <View style={styles.burgerLine} />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  panel: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: MENU_WIDTH,
    backgroundColor: Colors.background,
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12,
    paddingHorizontal: Spacing.lg,
  },

  // Profil
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: {
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
  },
  profileSub: {
    fontSize: Typography.xs,
    color: Colors.textTertiary,
    marginTop: 1,
  },

  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.md,
  },

  // Entrées
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: 13,
  },
  menuIcon: {
    width: 28,
    alignItems: 'center',
  },
  menuLabel: {
    fontSize: Typography.base,
    color: Colors.textPrimary,
    fontWeight: Typography.medium,
  },
  menuBadge: {
    backgroundColor: '#F3EEFF', borderWidth: 1, borderColor: '#D4BBFF',
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999,
  },
  menuBadgeText: { fontSize: 9, fontWeight: Typography.bold, color: '#7c3aed', letterSpacing: 0.3 },

  // Badge plan
  planBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: '#FFF4E6', borderWidth: 1, borderColor: '#FFD9A8',
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999, marginTop: 3,
  },
  planBadgePremium: { backgroundColor: '#F3EEFF', borderColor: '#D4BBFF' },
  planBadgePro: { backgroundColor: '#FFF4E6', borderColor: '#F2C879' },
  planBadgeText: { fontSize: 11, fontWeight: Typography.semibold, color: Colors.accent },
  planBadgeTextPremium: { color: '#7c3aed' },
  planBadgeTextPro: { color: '#B4690E' },

  // Upgrade CTA
  upgradeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.accent, borderRadius: Radius.md,
    paddingVertical: 11, paddingHorizontal: Spacing.md,
    marginTop: Spacing.md,
  },
  upgradeText: { fontSize: Typography.sm, fontWeight: Typography.bold, color: 'white' },

  // Premium actif
  premiumActive: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F3EEFF', borderWidth: 1, borderColor: '#D4BBFF',
    borderRadius: Radius.md, paddingVertical: 10, paddingHorizontal: Spacing.md,
    marginTop: Spacing.md,
  },
  premiumActiveText: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: '#7c3aed' },

  // Professionnel actif — même bloc, palette ambre du palier Pro
  proActive: { backgroundColor: '#FFF4E6', borderColor: '#F2C879' },
  proActiveText: { color: '#B4690E' },

  spacer: { flex: 1 },

  // Déconnexion
  signOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  signOutText: {
    fontSize: Typography.sm,
    color: Colors.textTertiary,
  },

  // Burger
  burger: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  burgerLine: {
    height: 1.5,
    backgroundColor: Colors.textPrimary,
    borderRadius: 2,
  },
  burgerLineMid: {
    width: '70%',
  },
})
