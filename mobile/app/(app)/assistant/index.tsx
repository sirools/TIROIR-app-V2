import React from 'react'
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native'
import { useRouter } from 'expo-router'
import { ArrowLeft, MessageCircle, Sparkles, MapPin, Search, ListChecks, Zap } from 'lucide-react-native'
import { useAuth } from '@/features/auth/AuthContext'
import { Screen, Colors, Typography, Spacing, Radius } from '@/components/ui'

const TIPS = [
  { icon: Search, text: "Pose ta question comme à un pote qui connaît ton inventaire par cœur." },
  { icon: Sparkles, text: "Rien ne correspond exactement ? Je propose l'objet le plus proche plutôt que de sécher." },
  { icon: MapPin, text: "Je peux te dire ce qui n'a pas d'emplacement renseigné, et te lister les objets d'un coup." },
  { icon: ListChecks, text: "Statut, comptage, emplacement : je fouille vraiment ton inventaire, je n'invente rien." },
]

const EXAMPLE_PROMPTS = [
  "Où ai-je planqué mon appareil photo ? 📸",
  "Qu'est-ce que je pourrais vendre pour me faire un peu de cash ? 💸",
  "Combien d'objets dorment dans mes cartons ? 📦",
  "Qu'est-ce qui traîne sans emplacement précis ? 🕵️",
  "Ai-je prêté un truc que j'ai oublié ? 🤔",
]

export default function AssistantLandingScreen() {
  const router = useRouter()
  const { profile } = useAuth()
  const isPremium = profile?.plan === 'premium'

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
          <Text style={styles.headerTitle}>Assistant</Text>
          <View style={styles.betaBadge}>
            <Text style={styles.betaBadgeText}>BETA</Text>
          </View>
        </View>
        <View style={{ width: 22 }} />
      </View>

      {!isPremium ? (
        <View style={styles.lockedWrap}>
          <View style={styles.heroIcon}>
            <Zap size={28} color="white" strokeWidth={2.2} />
          </View>
          <Text style={styles.heroTitle}>Fonctionnalité Premium</Text>
          <Text style={styles.heroSub}>L'Assistant conversationnel est réservé aux abonnés Premium.</Text>
          <TouchableOpacity style={styles.ctaBtn} onPress={() => router.push('/paywall')} activeOpacity={0.85}>
            <Zap size={18} color="white" strokeWidth={2.2} />
            <Text style={styles.ctaBtnText}>VOIR PREMIUM</Text>
          </TouchableOpacity>
        </View>
      ) : (
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <MessageCircle size={28} color="white" strokeWidth={2.2} />
          </View>
          <Text style={styles.heroTitle}>Ton inventaire, mais en conversation.</Text>
          <Text style={styles.heroSub}>Pose une question, je fouille tes objets et je te réponds. En quelques secondes.</Text>
        </View>

        <Text style={styles.sectionLabel}>Comment bien l'utiliser</Text>
        <View style={styles.tipsCard}>
          {TIPS.map((tip, i) => (
            <View key={i}>
              <View style={styles.tipRow}>
                <View style={styles.tipIcon}>
                  <tip.icon size={16} color={Colors.accent} strokeWidth={1.8} />
                </View>
                <Text style={styles.tipText}>{tip.text}</Text>
              </View>
              {i < TIPS.length - 1 && <View style={styles.tipDivider} />}
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.ctaBtn} onPress={() => openChat()} activeOpacity={0.85}>
          <MessageCircle size={18} color="white" strokeWidth={2.2} />
          <Text style={styles.ctaBtnText}>DISCUTER AVEC L'ASSISTANT</Text>
        </TouchableOpacity>

        <Text style={styles.sectionLabel}>Ou pars d'une idée</Text>
        <View style={styles.promptsWrap}>
          {EXAMPLE_PROMPTS.map((prompt, i) => (
            <TouchableOpacity key={i} style={styles.promptChip} onPress={() => openChat(prompt)} activeOpacity={0.8}>
              <Text style={styles.promptChipText}>{prompt}</Text>
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
