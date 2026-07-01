import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView, Switch, Platform,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ArrowLeft, Zap, Package, Brain, Camera, Check, Sparkles } from 'lucide-react-native'
import Purchases, { PurchasesPackage } from 'react-native-purchases'
import { Colors, Typography, Spacing, Radius } from '@/components/ui'

const MOCK_PACKAGES: PurchasesPackage[] = Platform.OS === 'web' ? [
  { identifier: '$rc_monthly', packageType: 'MONTHLY', product: { identifier: 'tiroir_premium_monthly', price: 6.99, priceString: '6,99 €', introPrice: { price: 0, priceString: '0 €', periodNumberOfUnits: 7, periodUnit: 'DAY' } } } as any,
  { identifier: '$rc_annual',  packageType: 'ANNUAL',  product: { identifier: 'tiroir_premium_annual',  price: 59.99, priceString: '59,99 €', introPrice: { price: 0, priceString: '0 €', periodNumberOfUnits: 7, periodUnit: 'DAY' } } } as any,
] : []

const FEATURES = [
  { icon: Package,  label: 'Objets illimités' },
  { icon: Brain,    label: '150 analyses IA par mois' },
  { icon: Camera,   label: 'Photos multiples par objet' },
  { icon: Sparkles, label: '50 améliorations photo IA / mois' },
]

export default function PaywallScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()

  const [monthly, setMonthly]     = useState<PurchasesPackage | null>(null)
  const [annual, setAnnual]       = useState<PurchasesPackage | null>(null)
  const [isAnnual, setIsAnnual]   = useState(true)
  const [loading, setLoading]     = useState(true)
  const [purchasing, setPurchasing] = useState(false)

  useEffect(() => {
    if (Platform.OS === 'web') {
      setMonthly(MOCK_PACKAGES[0])
      setAnnual(MOCK_PACKAGES[1])
      setIsAnnual(true)
      setLoading(false)
      return
    }
    Purchases.getOfferings().then(offerings => {
      console.log('[Paywall] all offerings:', JSON.stringify(offerings.all))
      console.log('[Paywall] current offering:', JSON.stringify(offerings.current))
      const pkgs = offerings.current?.availablePackages ?? []
      console.log('[Paywall] packages count:', pkgs.length, pkgs.map(p => p.identifier))
      const m = pkgs.find(p => p.packageType === 'MONTHLY') ?? null
      const a = pkgs.find(p => p.packageType === 'ANNUAL') ?? null
      setMonthly(m)
      setAnnual(a)
      setIsAnnual(!!a)
    }).catch(e => {
      console.warn('[Paywall] getOfferings error', e)
    }).finally(() => setLoading(false))
  }, [])

  const selected = isAnnual ? (annual ?? monthly) : (monthly ?? annual)

  // Économie annuelle vs mensuel × 12
  const savings = monthly && annual
    ? Math.round((1 - annual.product.price / (monthly.product.price * 12)) * 100)
    : null

  const monthlyEquiv = annual
    ? (annual.product.price / 12).toFixed(2).replace('.', ',')
    : null

  const hasBothPlans = !!monthly && !!annual

  const handlePurchase = useCallback(async () => {
    if (!selected) return
    setPurchasing(true)
    try {
      await Purchases.purchasePackage(selected)
      Alert.alert('Bienvenue dans Tiroir Premium ! 🎉', 'Ton abonnement est actif.', [
        { text: 'Super !', onPress: () => router.back() },
      ])
    } catch (e: any) {
      if (!e.userCancelled) {
        Alert.alert('Erreur', e.message ?? 'Une erreur est survenue.')
      }
    } finally {
      setPurchasing(false)
    }
  }, [selected])

  const handleRestore = useCallback(async () => {
    setPurchasing(true)
    try {
      const info = await Purchases.restorePurchases()
      const active = Object.values(info.entitlements.active)
      if (active.length > 0) {
        Alert.alert('Abonnement restauré ✓', '', [{ text: 'OK', onPress: () => router.back() }])
      } else {
        Alert.alert('Aucun abonnement trouvé', 'Aucun achat précédent à restaurer.')
      }
    } catch (e: any) {
      Alert.alert('Erreur', e.message ?? 'Impossible de restaurer.')
    } finally {
      setPurchasing(false)
    }
  }, [])

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={s.backBtn}>
          <ArrowLeft size={22} color={Colors.textPrimary} strokeWidth={1.8} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Tiroir Premium</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={s.hero}>
          <View style={s.heroIcon}>
            <Zap size={28} color="white" strokeWidth={2.2} />
          </View>
          <Text style={s.heroTitle}>Inventaire illimité,{'\n'}150 analyses IA par mois.</Text>
        </View>

        {/* Features */}
        <View style={s.features}>
          {FEATURES.map(({ icon: Icon, label }) => (
            <View key={label} style={s.featureRow}>
              <View style={s.featureCheck}>
                <Check size={13} color={Colors.accent} strokeWidth={2.5} />
              </View>
              <Text style={s.featureLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Toggle mensuel / annuel */}
        {hasBothPlans && (
          <View style={s.toggleWrap}>
            <Text style={[s.toggleLabel, !isAnnual && s.toggleLabelActive]}>Mensuel</Text>
            <Switch
              value={isAnnual}
              onValueChange={setIsAnnual}
              trackColor={{ false: Colors.border, true: Colors.accent }}
              thumbColor="white"
              ios_backgroundColor={Colors.border}
            />
            <Text style={[s.toggleLabel, isAnnual && s.toggleLabelActive]}>Annuel</Text>
            {savings !== null && isAnnual && (
              <View style={s.savingsBadge}>
                <Text style={s.savingsText}>−{savings}%</Text>
              </View>
            )}
          </View>
        )}

        {/* Price card */}
        {loading ? (
          <ActivityIndicator color={Colors.accent} style={{ marginVertical: 32 }} />
        ) : !selected ? (
          <Text style={s.unavailable}>Abonnements indisponibles pour le moment.</Text>
        ) : (
          <View style={s.priceCard}>
            {isAnnual && annual?.product.introPrice && (
              <View style={s.trialBadge}>
                <Text style={s.trialText}>✦ 7 jours d'essai gratuit</Text>
              </View>
            )}
            {!isAnnual && monthly?.product.introPrice && (
              <View style={s.trialBadge}>
                <Text style={s.trialText}>✦ 7 jours d'essai gratuit</Text>
              </View>
            )}

            <View style={s.priceRow}>
              <Text style={s.price}>{selected.product.priceString}</Text>
              <Text style={s.pricePer}>
                {isAnnual && annual ? ' / an' : ' / mois'}
              </Text>
            </View>

            {isAnnual && monthlyEquiv && (
              <Text style={s.priceEquiv}>
                soit <Text style={s.priceEquivBold}>{monthlyEquiv} € / mois</Text>
                {savings !== null ? ` — ${savings}% d'économie vs mensuel` : ''}
              </Text>
            )}
          </View>
        )}

        {/* CTA */}
        <TouchableOpacity
          style={[s.cta, (!selected || purchasing) && s.ctaDisabled]}
          onPress={handlePurchase}
          disabled={!selected || purchasing}
          activeOpacity={0.85}
        >
          {purchasing
            ? <ActivityIndicator color="white" />
            : <Text style={s.ctaText}>
                {selected?.product.introPrice ? 'Démarrer l\'essai gratuit' : 'S\'abonner'}
              </Text>
          }
        </TouchableOpacity>

        {/* Restore + legal */}
        <TouchableOpacity onPress={handleRestore} disabled={purchasing} style={s.restoreBtn}>
          <Text style={s.restoreText}>Restaurer un achat</Text>
        </TouchableOpacity>
        <Text style={s.legal}>
          L'abonnement se renouvelle automatiquement. Tu peux annuler à tout moment depuis les Réglages iOS. Aucun frais pendant l'essai gratuit.
        </Text>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  root:    { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn:     { width: 40 },
  headerTitle: { fontSize: Typography.md, fontWeight: Typography.semibold, color: Colors.textPrimary },

  content: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 48 },

  hero:      { alignItems: 'center', gap: 12, paddingVertical: Spacing.sm },
  heroIcon:  { width: 64, height: 64, borderRadius: 20, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary, textAlign: 'center', lineHeight: 28 },

  features:     { gap: 12 },
  featureRow:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureCheck: { width: 24, height: 24, borderRadius: 99, backgroundColor: Colors.accentLight, alignItems: 'center', justifyContent: 'center' },
  featureLabel: { fontSize: Typography.base, color: Colors.textPrimary, fontWeight: Typography.medium },

  toggleWrap: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: Spacing.sm,
  },
  toggleLabel:       { fontSize: Typography.sm, color: Colors.textTertiary, fontWeight: Typography.medium },
  toggleLabelActive: { color: Colors.textPrimary, fontWeight: Typography.bold },
  savingsBadge: {
    backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 999,
  },
  savingsText: { fontSize: 12, fontWeight: Typography.bold, color: '#16A34A' },

  priceCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1.5, borderColor: Colors.accent,
    padding: Spacing.lg, gap: 8, alignItems: 'center',
  },
  trialBadge: {
    backgroundColor: Colors.accentLight, paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 999, marginBottom: 4,
  },
  trialText:  { fontSize: 13, fontWeight: Typography.semibold, color: Colors.accent },
  priceRow:   { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  price:      { fontSize: 42, fontWeight: Typography.bold, color: Colors.textPrimary, letterSpacing: -1 },
  pricePer:   { fontSize: Typography.base, color: Colors.textTertiary, fontWeight: Typography.regular },
  priceEquiv: { fontSize: Typography.sm, color: Colors.textTertiary, textAlign: 'center' },
  priceEquivBold: { fontWeight: Typography.semibold, color: Colors.textSecondary },

  unavailable: { fontSize: Typography.sm, color: Colors.textTertiary, textAlign: 'center', paddingVertical: 24 },

  cta:         { backgroundColor: Colors.accent, borderRadius: Radius.md, paddingVertical: 15, alignItems: 'center' },
  ctaDisabled: { opacity: 0.5 },
  ctaText:     { fontSize: Typography.base, fontWeight: Typography.bold, color: 'white' },

  restoreBtn:  { alignItems: 'center', paddingVertical: 4 },
  restoreText: { fontSize: Typography.sm, color: Colors.textTertiary },
  legal:       { fontSize: 11, color: Colors.textTertiary, textAlign: 'center', lineHeight: 16 },
})
