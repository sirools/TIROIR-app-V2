import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, MessageCircle, Sparkles, MapPin, Search, ListChecks, Zap } from 'lucide-react-native'
import { useAuth } from '@/features/auth/AuthContext'
import { useFeatureFlags } from '@/features/objects/useFeatureFlags'
import { Screen, Colors, Typography, Spacing, Radius } from '@/components/ui'

const TIPS = [
  { icon: Search, key: 'assistant.tip1' },
  { icon: Sparkles, key: 'assistant.tip2' },
  { icon: MapPin, key: 'assistant.tip3' },
  { icon: ListChecks, key: 'assistant.tip4' },
]

const EXAMPLE_PROMPT_KEYS = [
  'assistant.prompt1',
  'assistant.prompt2',
  'assistant.prompt3',
  'assistant.prompt4',
  'assistant.prompt5',
]

export default function AssistantLandingScreen() {
  const router = useRouter()
  const { t } = useTranslation()
  const { profile } = useAuth()
  // Drapeau serveur : l'assistant n'est pas encore ouvert aux abonnés,
  // il est en cours de développement. `loaded` évite le clignotement du
  // message d'indisponibilité pendant le premier rendu.
  const { flags, loaded: flagsLoaded } = useFeatureFlags()
  const isPremium = flags.assistant

  function openChat(prompt?: string) {
    router.push({ pathname: '/assistant/chat', params: prompt ? { prompt } : undefined })
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={22} color={Colors.textPrimary} strokeWidth={1.8} />
        </TouchableOpacity>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>{t('assistant.title')}</Text>
          <View style={styles.betaBadge}>
            <Text style={styles.betaBadgeText}>BETA</Text>
          </View>
        </View>
        <View style={{ width: 22 }} />
      </View>

      {!flagsLoaded ? (
        <View style={styles.lockedWrap} />
      ) : !isPremium ? (
        /* Pas de renvoi vers le paywall : l'assistant est en cours de
           développement, aucun abonnement ne le débloque aujourd'hui.
           Proposer de payer pour ça serait une promesse fausse. */
        <View style={styles.lockedWrap}>
          <View style={styles.heroIcon}>
            <MessageCircle size={28} color="white" strokeWidth={2.2} />
          </View>
          <Text style={styles.heroTitle}>{t('assistant.devTitle')}</Text>
          <Text style={styles.heroSub}>{t('assistant.devSub')}</Text>
        </View>
      ) : (
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <MessageCircle size={28} color="white" strokeWidth={2.2} />
          </View>
          <Text style={styles.heroTitle}>{t('assistant.heroTitle')}</Text>
          <Text style={styles.heroSub}>{t('assistant.heroSub')}</Text>
        </View>

        <Text style={styles.sectionLabel}>{t('assistant.howToTitle')}</Text>
        <View style={styles.tipsCard}>
          {TIPS.map((tip, i) => (
            <View key={i}>
              <View style={styles.tipRow}>
                <View style={styles.tipIcon}>
                  <tip.icon size={16} color={Colors.accent} strokeWidth={1.8} />
                </View>
                <Text style={styles.tipText}>{t(tip.key)}</Text>
              </View>
              {i < TIPS.length - 1 && <View style={styles.tipDivider} />}
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.ctaBtn} onPress={() => openChat()} activeOpacity={0.85}>
          <MessageCircle size={18} color="white" strokeWidth={2.2} />
          <Text style={styles.ctaBtnText}>{t('assistant.chatCta')}</Text>
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>{t('assistant.orIdea')}</Text>
        <View style={styles.promptsWrap}>
          {EXAMPLE_PROMPT_KEYS.map((promptKey, i) => (
            <TouchableOpacity key={i} style={styles.promptChip} onPress={() => openChat(t(promptKey))} activeOpacity={0.8}>
              <Text style={styles.promptChipText}>{t(promptKey)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: Typography.md, fontWeight: Typography.semibold, color: Colors.textPrimary },
  betaBadge: {
    backgroundColor: '#F3EEFF', borderWidth: 1, borderColor: '#D4BBFF',
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999,
  },
  betaBadgeText: { fontSize: 10, fontWeight: Typography.bold, color: '#7c3aed', letterSpacing: 0.4 },

  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxl, gap: Spacing.lg },

  lockedWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl },

  hero: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md },
  heroIcon: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  heroTitle: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary, textAlign: 'center' },
  heroSub: { fontSize: Typography.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20, paddingHorizontal: Spacing.md },

  sectionLabel: {
    fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },

  tipsCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, padding: Spacing.md },
  tipIcon: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: Colors.accentLight,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  tipText: { flex: 1, fontSize: Typography.sm, color: Colors.textPrimary, lineHeight: 19, paddingTop: 3 },
  tipDivider: { height: 1, backgroundColor: Colors.border, marginLeft: Spacing.md + 28 + Spacing.sm },

  ctaBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.accent, borderRadius: Radius.md, paddingVertical: 16,
  },
  ctaBtnText: { color: 'white', fontSize: Typography.base, fontWeight: Typography.bold, letterSpacing: 0.5 },

  promptsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  promptChip: {
    backgroundColor: Colors.accentLight, borderWidth: 1, borderColor: Colors.accent,
    borderRadius: 999, paddingHorizontal: Spacing.md, paddingVertical: 9,
  },
  promptChipText: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.accent },
})
