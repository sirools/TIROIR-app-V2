import React, { useEffect, useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView,
} from 'react-native'
import { useRouter } from 'expo-router'
import { ArrowLeft, Zap, Package, Brain, Camera, Check } from 'lucide-react-native'
import Purchases, { PurchasesPackage } from 'react-native-purchases'
import { Colors, Typography, Spacing, Radius } from '@/components/ui'

const FEATURES = [
  { icon: Package, label: 'Objets illimités' },
  { icon: Brain,   label: 'Analyses IA sans restriction' },
  { icon: Camera,  label: 'Photos multiples par objet' },
]

export default function PaywallScreen() {
  const router = useRouter()
  const [packages, setPackages]   = useState<PurchasesPackage[]>([])
  const [selected, setSelected]   = useState<PurchasesPackage | null>(null)
  const [loading, setLoading]     = useState(true)
  const [purchasing, setPurchasing] = useState(false)

  useEffect(() => {
    Purchases.getOfferings().then(offerings => {
      const pkgs = offerings.current?.availablePackages ?? []
      setPackages(pkgs)
      // Sélectionner l'annuel par défaut s'il existe
      const annual = pkgs.find(p => p.packageType === 'ANNUAL')
      setSelected(annual ?? pkgs[0] ?? null)
    }).catch(e => {
      console.warn('[Paywall] getOfferings error', e)
    }).finally(() => setLoading(false))
  }, [])

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
    <View style={s.root}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={22} color={Colors.textPrimary} strokeWidth={1.8} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={s.hero}>
          <View style={s.heroIcon}>
            <Zap size={28} color="white" strokeWidth={2.2} />
          </View>
          <Text style={s.heroTitle}>Tiroir Premium</Text>
          <Text style={s.heroSub}>Inventaire illimité, IA et photos sans limites.</Text>
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

        {/* Plans */}
        {loading ? (
          <ActivityIndicator color={Colors.accent} style={{ marginVertical: 32 }} />
        ) : packages.length === 0 ? (
          <Text style={s.unavailable}>Abonnements indisponibles pour le moment.</Text>
        ) : (
          <View style={s.plans}>
            {packages.map(pkg => {
              const isAnnual  = pkg.packageType === 'ANNUAL'
              const isSelected = selected?.identifier === pkg.identifier
              return (
                <TouchableOpacity
                  key={pkg.identifier}
                  style={[s.planCard, isSelected && s.planCardSelected]}
                  onPress={() => setSelected(pkg)}
                  activeOpacity={0.8}
                >
                  {isAnnual && (
                    <View style={s.bestValueBadge}>
                      <Text style={s.bestValueText}>2 mois offerts</Text>
                    </View>
                  )}
                  <Text style={[s.planName, isSelected && s.planNameSelected]}>
                    {isAnnual ? 'Annuel' : 'Mensuel'}
                  </Text>
                  <Text style={[s.planPrice, isSelected && s.planPriceSelected]}>
                    {pkg.product.priceString}
                    <Text style={s.planPricePer}>
                      {isAnnual ? ' / an' : ' / mois'}
                    </Text>
                  </Text>
                  {isAnnual && (
                    <Text style={[s.planDetail, isSelected && s.planDetailSelected]}>
                      soit {(pkg.product.price / 12).toFixed(2).replace('.', ',')} € / mois
                    </Text>
                  )}
                  {pkg.product.introPrice && (
                    <Text style={[s.planTrial, isSelected && s.planTrialSelected]}>
                      7 jours d'essai gratuit
                    </Text>
                  )}
                </TouchableOpacity>
              )
            })}
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
  header:  { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },

  content: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 48 },

  hero:      { alignItems: 'center', gap: 12, paddingVertical: Spacing.sm },
  heroIcon:  { width: 64, height: 64, borderRadius: 20, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: Typography.xxl, fontWeight: Typography.bold, color: Colors.textPrimary, textAlign: 'center' },
  heroSub:   { fontSize: Typography.base, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },

  features:     { gap: 10 },
  featureRow:   { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureCheck: { width: 22, height: 22, borderRadius: 99, backgroundColor: Colors.accentLight, alignItems: 'center', justifyContent: 'center' },
  featureLabel: { fontSize: Typography.base, color: Colors.textPrimary, fontWeight: Typography.medium },

  plans:     { gap: 12 },
  planCard:  {
    borderRadius: Radius.lg, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.surface, padding: Spacing.md, gap: 4,
  },
  planCardSelected: { borderColor: Colors.accent, backgroundColor: '#FFF8F3' },
  planName:         { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textSecondary },
  planNameSelected: { color: Colors.accent },
  planPrice:        { fontSize: Typography.xxl, fontWeight: Typography.bold, color: Colors.textPrimary, letterSpacing: -0.5 },
  planPriceSelected:{ color: Colors.accent },
  planPricePer:     { fontSize: Typography.base, fontWeight: Typography.regular, color: Colors.textTertiary },
  planDetail:       { fontSize: Typography.sm, color: Colors.textTertiary },
  planDetailSelected:{ color: Colors.accent },
  planTrial:        { fontSize: Typography.sm, color: Colors.textTertiary, fontWeight: Typography.medium },
  planTrialSelected:{ color: Colors.accent },
  bestValueBadge:   { alignSelf: 'flex-start', backgroundColor: Colors.accentLight, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, marginBottom: 4 },
  bestValueText:    { fontSize: 11, fontWeight: Typography.bold, color: Colors.accent },

  unavailable: { fontSize: Typography.sm, color: Colors.textTertiary, textAlign: 'center', paddingVertical: 24 },

  cta:         { backgroundColor: Colors.accent, borderRadius: Radius.md, paddingVertical: 15, alignItems: 'center' },
  ctaDisabled: { opacity: 0.5 },
  ctaText:     { fontSize: Typography.base, fontWeight: Typography.bold, color: 'white' },

  restoreBtn:  { alignItems: 'center', paddingVertical: 4 },
  restoreText: { fontSize: Typography.sm, color: Colors.textTertiary },
  legal:       { fontSize: 11, color: Colors.textTertiary, textAlign: 'center', lineHeight: 16 },
})
