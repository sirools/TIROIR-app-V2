import React, { useEffect, useState, useCallback, useRef } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, ScrollView, Switch, Platform, Linking,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Zap, Package, Brain, Camera, Check, Sparkles } from 'lucide-react-native'
import Purchases, { PurchasesPackage } from 'react-native-purchases'
import { Colors, Typography, Spacing, Radius } from '@/components/ui'
import { supabase } from '@/lib/supabase'
import { CREDITS_OFFERING, creditsForProduct } from '@/lib/creditPacks'
import { isProProduct } from '@/lib/plan'

const MOCK_PACKAGES: PurchasesPackage[] = Platform.OS === 'web' ? [
  { identifier: '$rc_monthly', packageType: 'MONTHLY', product: { identifier: 'tiroir_premium_monthly', price: 6.99, priceString: '6,99 €', introPrice: { price: 0, priceString: '0 €', periodNumberOfUnits: 7, periodUnit: 'DAY' } } } as any,
  { identifier: '$rc_annual',  packageType: 'ANNUAL',  product: { identifier: 'tiroir_premium_annual',  price: 59.99, priceString: '59,99 €', introPrice: { price: 0, priceString: '0 €', periodNumberOfUnits: 7, periodUnit: 'DAY' } } } as any,
  { identifier: 'pro_monthly', packageType: 'CUSTOM',  product: { identifier: 'tiroir_pro_monthly',     price: 14.99, priceString: '14,99 €', introPrice: null } } as any,
] : []

const FEATURES = [
  { icon: Package,  labelKey: 'paywall.featUnlimitedObjects' },
  { icon: Brain,    labelKey: 'paywall.featAiAnalyses' },
  { icon: Camera,   labelKey: 'paywall.featMultiPhotos' },
  { icon: Sparkles, labelKey: 'paywall.featPhotoEnhance' },
]

export default function PaywallScreen() {
  const router = useRouter()
  // Ouvert après un refus « crédits insuffisants » (lib/buyCredits.ts) :
  // on descend directement aux packs.
  const { section } = useLocalSearchParams<{ section?: string }>()
  const scrollRef = useRef<ScrollView>(null)
  const insets = useSafeAreaInsets()
  const { t } = useTranslation()

  const [monthly, setMonthly]     = useState<PurchasesPackage | null>(null)
  const [annual, setAnnual]       = useState<PurchasesPackage | null>(null)
  const [isAnnual, setIsAnnual]   = useState(true)
  // Pro = Premium avec des quotas plus élevés (grille V4) ; proposé dès que
  // l'offre courante de RevenueCat contient un produit tiroir_pro_*.
  const [pro, setPro]             = useState<PurchasesPackage | null>(null)
  const [tier, setTier]           = useState<'premium' | 'pro'>('premium')
  const [loading, setLoading]     = useState(true)
  const [purchasing, setPurchasing] = useState(false)
  // Packs de crédits (achat à l'unité, sans abonnement)
  const [packs, setPacks]         = useState<PurchasesPackage[]>([])
  const [credits, setCredits]     = useState<number | null>(null)

  const refreshCredits = useCallback(async () => {
    // Solde absent tant que le SQL des crédits n'est pas appliqué : on n'affiche rien.
    const { data, error } = await supabase.rpc('get_my_ai_credits')
    if (!error && typeof data === 'number') setCredits(data)
  }, [])

  useEffect(() => {
    // Funnel : vue du paywall (fire-and-forget, ne bloque pas l'écran)
    void (async () => {
      try {
        await supabase.rpc('log_client_event', { p_action: 'paywall.viewed', p_payload: {} })
      } catch {
        // silencieux : un log manqué ne doit pas gêner l'utilisateur
      }
    })()

    if (Platform.OS === 'web') {
      setMonthly(MOCK_PACKAGES[0])
      setAnnual(MOCK_PACKAGES[1])
      setPro(MOCK_PACKAGES[2])
      setIsAnnual(true)
      setLoading(false)
      return
    }
    Purchases.getOfferings().then(offerings => {
      console.log('[Paywall] all offerings:', JSON.stringify(offerings.all))
      console.log('[Paywall] current offering:', JSON.stringify(offerings.current))
      const pkgs = offerings.current?.availablePackages ?? []
      console.log('[Paywall] packages count:', pkgs.length, pkgs.map(p => p.identifier))
      // Offre « credits » (produits consommables), rangée à part dans RevenueCat.
      const creditPkgs = (offerings.all?.[CREDITS_OFFERING]?.availablePackages ?? [])
        .filter(p => creditsForProduct(p.product.identifier) != null)
        .sort((x, y) => (creditsForProduct(x.product.identifier) ?? 0) - (creditsForProduct(y.product.identifier) ?? 0))
      setPacks(creditPkgs)
      const premiumPkgs = pkgs.filter(p => !isProProduct(p.product.identifier))
      const m = premiumPkgs.find(p => p.packageType === 'MONTHLY') ?? null
      const a = premiumPkgs.find(p => p.packageType === 'ANNUAL') ?? null
      setPro(pkgs.find(p => isProProduct(p.product.identifier)) ?? null)
      setMonthly(m)
      setAnnual(a)
      setIsAnnual(!!a)
    }).catch(e => {
      console.warn('[Paywall] getOfferings error', e)
    }).finally(() => setLoading(false))
    void refreshCredits()
  }, [])

  const handleBuyPack = useCallback(async (pkg: PurchasesPackage) => {
    const amount = creditsForProduct(pkg.product.identifier) ?? 0
    setPurchasing(true)
    try {
      await Purchases.purchasePackage(pkg)
      // Le webhook RevenueCat crédite le compte en quelques secondes.
      Alert.alert(t('paywall.packThanksTitle'), t('paywall.packThanksMessage', { count: amount }))
      setTimeout(() => { void refreshCredits() }, 4000)
    } catch (e: any) {
      if (!e.userCancelled) {
        Alert.alert(t('common.error'), e.message ?? t('paywall.genericError'))
      }
    } finally {
      setPurchasing(false)
    }
  }, [refreshCredits])

  const isPro = tier === 'pro' && !!pro
  const selected = isPro ? pro : isAnnual ? (annual ?? monthly) : (monthly ?? annual)

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
      Alert.alert(t(isPro ? 'paywall.welcomeProTitle' : 'paywall.welcomeTitle'), t('paywall.welcomeMessage'), [
        { text: t('paywall.welcomeCta'), onPress: () => router.back() },
      ])
    } catch (e: any) {
      if (!e.userCancelled) {
        Alert.alert(t('common.error'), e.message ?? t('paywall.genericError'))
      }
    } finally {
      setPurchasing(false)
    }
  }, [selected, isPro])

  const handleRestore = useCallback(async () => {
    setPurchasing(true)
    try {
      const info = await Purchases.restorePurchases()
      const active = Object.values(info.entitlements.active)
      if (active.length > 0) {
        Alert.alert(t('paywall.restoredTitle'), '', [{ text: 'OK', onPress: () => router.back() }])
      } else {
        Alert.alert(t('paywall.noSubTitle'), t('paywall.noSubMessage'))
      }
    } catch (e: any) {
      Alert.alert(t('common.error'), e.message ?? t('paywall.restoreError'))
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
        <Text style={s.headerTitle}>{t('paywall.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={s.hero}>
          <View style={s.heroIcon}>
            <Zap size={28} color="white" strokeWidth={2.2} />
          </View>
          <Text style={s.heroTitle}>{t('paywall.heroTitle')}</Text>
        </View>

        {/* Features */}
        <View style={s.features}>
          {FEATURES.map(({ icon: Icon, labelKey }) => (
            <View key={labelKey} style={s.featureRow}>
              <View style={s.featureCheck}>
                <Check size={13} color={Colors.accent} strokeWidth={2.5} />
              </View>
              <Text style={s.featureLabel}>{t(labelKey)}</Text>
            </View>
          ))}
        </View>

        {/* Premium ou Pro (Pro : mêmes fonctions, quotas plus élevés) */}
        {!!pro && (
          <View style={s.tiers} accessibilityRole="tablist">
            {(['premium', 'pro'] as const).map(key => (
              <TouchableOpacity
                key={key}
                style={[s.tierBtn, tier === key && s.tierBtnActive]}
                onPress={() => setTier(key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: tier === key }}
                activeOpacity={0.85}
              >
                <Text style={[s.tierText, tier === key && s.tierTextActive]}>
                  {t(key === 'pro' ? 'paywall.tierPro' : 'paywall.tierPremium')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
        {isPro && <Text style={s.proHint}>{t('paywall.proHint')}</Text>}

        {/* Toggle mensuel / annuel (Premium seulement : Pro est mensuel) */}
        {hasBothPlans && !isPro && (
          <View style={s.toggleWrap}>
            <Text style={[s.toggleLabel, !isAnnual && s.toggleLabelActive]}>{t('paywall.monthly')}</Text>
            <Switch
              value={isAnnual}
              onValueChange={setIsAnnual}
              trackColor={{ false: Colors.border, true: Colors.accent }}
              thumbColor="white"
              ios_backgroundColor={Colors.border}
            />
            <Text style={[s.toggleLabel, isAnnual && s.toggleLabelActive]}>{t('paywall.annual')}</Text>
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
          <Text style={s.unavailable}>{t('paywall.unavailable')}</Text>
        ) : (
          <View style={s.priceCard}>
            {!isPro && isAnnual && annual?.product.introPrice && (
              <View style={s.trialBadge}>
                <Text style={s.trialText}>{t('paywall.freeTrial')}</Text>
              </View>
            )}
            {(isPro ? !!pro?.product.introPrice : !isAnnual && !!monthly?.product.introPrice) && (
              <View style={s.trialBadge}>
                <Text style={s.trialText}>{t('paywall.freeTrial')}</Text>
              </View>
            )}

            <View style={s.priceRow}>
              <Text style={s.price}>{selected.product.priceString}</Text>
              <Text style={s.pricePer}>
                {!isPro && isAnnual && annual ? t('paywall.perYear') : t('paywall.perMonth')}
              </Text>
            </View>

            {!isPro && isAnnual && monthlyEquiv && (
              <Text style={s.priceEquiv}>
                {t('paywall.equiv')}<Text style={s.priceEquivBold}>{t('paywall.equivPerMonth', { price: monthlyEquiv })}</Text>
                {savings !== null ? t('paywall.savingsVsMonthly', { percent: savings }) : ''}
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
                {selected?.product.introPrice ? t('paywall.startTrial') : t('paywall.subscribe')}
              </Text>
          }
        </TouchableOpacity>

        {/* ── Packs de crédits : l'IA à l'unité, sans abonnement ── */}
        {packs.length > 0 && (
          <View
            style={s.packs}
            onLayout={e => { if (section === 'credits') scrollRef.current?.scrollTo({ y: e.nativeEvent.layout.y, animated: true }) }}
          >
            <Text style={s.packsTitle}>{t('paywall.packsTitle')}</Text>
            <Text style={s.packsHint}>
              {credits != null
                ? t('paywall.packsBalance', { count: credits })
                : t('paywall.packsHint')}
            </Text>
            <View style={s.packsRow}>
              {packs.map(pkg => (
                <TouchableOpacity
                  key={pkg.identifier}
                  style={[s.packCard, purchasing && s.ctaDisabled]}
                  onPress={() => handleBuyPack(pkg)}
                  disabled={purchasing}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                >
                  <Text style={s.packCredits}>
                    {t('paywall.packCredits', { count: creditsForProduct(pkg.product.identifier) ?? 0 })}
                  </Text>
                  <Text style={s.packPrice}>{pkg.product.priceString}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.packsHint}>{t('paywall.packsNoExpiry')}</Text>
          </View>
        )}

        {/* Restore + legal */}
        <TouchableOpacity onPress={handleRestore} disabled={purchasing} style={s.restoreBtn}>
          <Text style={s.restoreText}>{t('paywall.restore')}</Text>
        </TouchableOpacity>
        <Text style={s.legal}>
          {t('paywall.legal')}
        </Text>

        {/* Exigé par la guideline 3.1.2 : un écran d'abonnement doit porter
            les liens vers les conditions d'utilisation et la confidentialité,
            pas seulement la mention de reconduction. */}
        <View style={s.legalLinks}>
          <TouchableOpacity
            onPress={() => Linking.openURL('https://www.tiroir.app/cgu')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={s.legalLink}>{t('paywall.terms')}</Text>
          </TouchableOpacity>
          <Text style={s.legalSep}>·</Text>
          <TouchableOpacity
            onPress={() => Linking.openURL('https://www.tiroir.app/privacy')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={s.legalLink}>{t('paywall.privacy')}</Text>
          </TouchableOpacity>
        </View>
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

  tiers: {
    flexDirection: 'row', gap: 4, padding: 4,
    borderRadius: Radius.lg, backgroundColor: Colors.accentLight,
  },
  tierBtn:        { flex: 1, paddingVertical: 10, borderRadius: Radius.md, alignItems: 'center' },
  tierBtnActive:  { backgroundColor: Colors.surface },
  tierText:       { fontSize: Typography.base, color: Colors.textSecondary, fontWeight: Typography.medium },
  tierTextActive: { color: Colors.textPrimary, fontWeight: Typography.bold },
  proHint:        { fontSize: Typography.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },

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
  packs:       { gap: Spacing.sm, paddingTop: Spacing.lg, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  packsTitle:  { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.textPrimary },
  packsHint:   { fontSize: Typography.sm, color: Colors.textSecondary },
  packsRow:    { flexDirection: 'row', gap: Spacing.sm },
  packCard:    { flex: 1, borderWidth: 1.5, borderColor: Colors.accent, borderRadius: Radius.md, paddingVertical: 14, alignItems: 'center', gap: 2, backgroundColor: Colors.surface },
  packCredits: { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.textPrimary },
  packPrice:   { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.accent },
  restoreText: { fontSize: Typography.sm, color: Colors.textTertiary },
  legal:       { fontSize: 11, color: Colors.textTertiary, textAlign: 'center', lineHeight: 16 },
  legalLinks: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: Spacing.sm, marginBottom: Spacing.md,
  },
  legalLink: {
    fontSize: 12, color: Colors.textSecondary,
    textDecorationLine: 'underline', fontWeight: Typography.medium,
  },
  legalSep: { fontSize: 12, color: Colors.textTertiary },
})
