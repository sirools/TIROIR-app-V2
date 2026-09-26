import React, { useState, useCallback, useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, ScrollView, AppState,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import * as FileSystem from 'expo-file-system/legacy'
import { ArrowLeft, Edit3, Check, Package, FolderOpen, TrendingUp, Link2, Brain, Camera, Zap, Sparkles } from 'lucide-react-native'
import Purchases from 'react-native-purchases'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'
import { isPaidPlan, isProPlan, planLabelKey } from '@/lib/plan'
import { Screen, Input, ActionSheet, Colors, Typography, Spacing, Radius } from '@/components/ui'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { AvatarViewer } from '@/components/ui/AvatarViewer'
import { sumLots } from '@/features/objects/quantity'

interface Stats {
  objects: number
  collections: number
  totalValue: number | null
  currency: string
  shares: number
  totalPhotos: number
  aiUsed: number
  aiQuota: number | null
  aiResetAt: string | null
  objectsMax: number | null
  photosPerObject: number | null
  photoEnhanceUsed: number
  photoEnhanceQuota: number | null
  photoEnhanceIsPremium: boolean
}

/** Côté de la photo de profil stockée, comme sur le site : assez grand
 *  pour la voir en grand (web/lib/avatar.ts). */
const AVATAR_SIZE = 1024

export default function ProfileScreen() {
  const router = useRouter()
  const { t, i18n } = useTranslation()
  const { user, profile, refreshProfile } = useAuth()
  const [editing, setEditing] = useState(false)
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [saving, setSaving] = useState(false)
  const [stats, setStats] = useState<Stats | null>(null)
  const [avatarSheet, setAvatarSheet] = useState(false)
  const [avatarViewer, setAvatarViewer] = useState(false)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  const plan: string = (profile as any)?.plan ?? 'free'
  const isPaid = isPaidPlan(plan)
  // Le Professionnel est facturé en direct : pas d'abonnement store à gérer.
  const isPro = isProPlan(plan)

  // Recharge les stats au montage et à chaque retour en foreground
  useEffect(() => {
    loadStats()
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') loadStats()
    })
    return () => sub.remove()
  }, [])

  async function loadStats() {
    const [objRes, colRes, valRes, shareRes, photoRes, quotaRes, limitsRes, enhanceQuotaRes] = await Promise.all([
      supabase.from('objects').select('id', { count: 'exact', head: true }),
      supabase.from('collections').select('id', { count: 'exact', head: true }),
      supabase.from('objects').select('market_value, user_value, value_currency, quantity').not('market_value', 'is', null),
      supabase.from('share_links').select('id', { count: 'exact', head: true }),
      supabase.from('object_images').select('id', { count: 'exact', head: true }),
      supabase.rpc('get_ai_quota'),
      supabase.rpc('get_plan_limits'),
      supabase.rpc('get_photo_enhance_quota'),
    ])

    let totalValue: number | null = null
    let currency = 'EUR'
    if (valRes.data && valRes.data.length > 0) {
      // Un lot de 6 pèse six fois sa valeur unitaire dans le patrimoine.
      totalValue = sumLots(
        valRes.data as any[],
        o => o.user_value ?? o.market_value,
        o => o.quantity,
      )
      const raw = valRes.data[0].value_currency ?? 'EUR'
      currency = raw === '€' ? 'EUR' : raw === '$' ? 'USD' : raw === '£' ? 'GBP' : raw.length === 3 ? raw : 'EUR'
    }

    const quota  = quotaRes.data?.[0]
    const limits = limitsRes.data?.[0]
    const enhanceQuota = enhanceQuotaRes.data?.[0]
    setStats({
      objects: objRes.count ?? 0,
      collections: colRes.count ?? 0,
      totalValue,
      currency,
      shares: shareRes.count ?? 0,
      totalPhotos: photoRes.count ?? 0,
      aiUsed: quota?.used ?? 0,
      aiQuota: quota?.quota ?? null,
      aiResetAt: quota?.reset_at ?? null,
      objectsMax: limits?.objects_max ?? null,
      photosPerObject: limits?.photos_per_object ?? null,
      photoEnhanceUsed: enhanceQuota?.used ?? 0,
      photoEnhanceQuota: enhanceQuota?.quota ?? null,
      photoEnhanceIsPremium: enhanceQuota?.is_premium ?? false,
    })
  }

  async function handleManageSubscription() {
    try {
      await Purchases.showManageSubscriptions()
    } catch {
      Alert.alert(t('common.error'), t('profile.manageSubError'))
    }
  }

  async function handleSave() {
    const name = displayName.trim()
    if (!name) { Alert.alert(t('profile.required'), t('profile.nameRequired')); return }
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: name, updated_at: new Date().toISOString() })
      .eq('id', user!.id)
    setSaving(false)
    if (error) { Alert.alert(t('common.error'), error.message); return }
    setEditing(false)
    await refreshProfile()
  }

  async function pickAvatar(from: 'camera' | 'library') {
    if (!user) return
    const perm = from === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (perm.status !== 'granted') {
      Alert.alert(t('capture.permissionDeniedTitle'),
        t(from === 'camera' ? 'capture.permissionCamera' : 'capture.permissionLibrary'))
      return
    }

    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'], quality: 0.9, allowsEditing: true, aspect: [1, 1],
    }
    const res = from === 'camera'
      ? await ImagePicker.launchCameraAsync({ ...options, cameraType: ImagePicker.CameraType.front })
      : await ImagePicker.launchImageLibraryAsync(options)
    if (res.canceled || !res.assets[0]) return

    setAvatarBusy(true)
    try {
      const rendered = await ImageManipulator.ImageManipulator
        .manipulate(res.assets[0].uri)
        .resize({ width: AVATAR_SIZE })
        .renderAsync()
      const saved = await rendered.saveAsync({
        compress: 0.85, format: ImageManipulator.SaveFormat.JPEG,
      })
      setAvatarPreview(saved.uri)

      const b64 = await FileSystem.readAsStringAsync(saved.uri, {
        encoding: FileSystem.EncodingType.Base64,
      })
      const binary = atob(b64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

      const path = `${user.id}/avatar/${Date.now()}.jpg`
      const { error: upErr } = await supabase.storage
        .from('object-images')
        .upload(path, bytes, { contentType: 'image/jpeg', upsert: false })
      if (upErr) throw new Error(upErr.message)

      const { error: dbErr } = await supabase
        .from('profiles')
        .update({ avatar_path: path, updated_at: new Date().toISOString() })
        .eq('id', user.id)
      if (dbErr) {
        await supabase.storage.from('object-images').remove([path])
        throw new Error(dbErr.message)
      }

      // L'ancienne photo part une fois la nouvelle enregistrée : si
      // l'envoi échoue, on n'a rien perdu.
      const previous = profile?.avatar_path
      if (previous && previous !== path) {
        await supabase.storage.from('object-images').remove([previous])
      }
      await refreshProfile()
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : String(e))
    } finally {
      setAvatarPreview(null)
      setAvatarBusy(false)
    }
  }

  async function removeAvatar() {
    const previous = profile?.avatar_path
    if (!user || !previous) return
    setAvatarBusy(true)
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_path: null, updated_at: new Date().toISOString() })
      .eq('id', user.id)
    if (error) {
      setAvatarBusy(false)
      Alert.alert(t('common.error'), error.message)
      return
    }
    await supabase.storage.from('object-images').remove([previous])
    await refreshProfile()
    setAvatarBusy(false)
  }

  const photosMax = stats ? (stats.objectsMax !== null ? stats.objectsMax * (stats.photosPerObject ?? 1) : null) : null
  const resetLabel = stats?.aiResetAt
    ? new Date(stats.aiResetAt).toLocaleDateString(i18n.language, { day: 'numeric', month: 'long' })
    : null

  return (
    <Screen edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={22} color={Colors.textPrimary} strokeWidth={1.8} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('profile.title')}</Text>
        <TouchableOpacity hitSlop={12} onPress={() => editing ? handleSave() : setEditing(true)} disabled={saving}>
          {saving
            ? <ActivityIndicator size="small" color={Colors.accent} />
            : editing
              ? <Check size={20} color={Colors.accent} strokeWidth={2} />
              : <Edit3 size={18} color={Colors.textSecondary} strokeWidth={1.8} />
          }
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Avatar + nom + badge plan */}
        <View style={styles.avatarWrap}>
          <View>
            {/* Comme sur le site : avec une photo, un toucher l'agrandit ;
                sans photo, il en propose une. La pastille sert à la changer. */}
            <TouchableOpacity
              onPress={() => profile?.avatar_path ? setAvatarViewer(true) : setAvatarSheet(true)}
              disabled={avatarBusy}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={t(profile?.avatar_path ? 'profile.photoView' : 'profile.photoChange')}
            >
              <UserAvatar
                size={80}
                avatarPath={profile?.avatar_path}
                displayName={profile?.display_name}
                localUri={avatarPreview}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.avatarBadge}
              onPress={() => setAvatarSheet(true)}
              disabled={avatarBusy}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('profile.photoChange')}
            >
              {avatarBusy
                ? <ActivityIndicator size="small" color="white" />
                : <Camera size={14} color="white" strokeWidth={2} />}
            </TouchableOpacity>
          </View>
          {profile?.display_name && (
            <Text style={styles.avatarName}>{profile.display_name}</Text>
          )}
          <View style={[
            styles.planBadge,
            isPaid && styles.planBadgePremium,
            isPro && styles.planBadgePro,
          ]}>
            <Zap size={11} color={isPro ? '#B4690E' : isPaid ? '#7c3aed' : Colors.accent} strokeWidth={2.2} />
            <Text style={[
              styles.planBadgeText,
              isPaid && styles.planBadgeTextPremium,
              isPro && styles.planBadgeTextPro,
            ]}>
              {t(planLabelKey(plan))}
            </Text>
          </View>
        </View>

        {stats && (<>
          {/* ── Statistiques ── */}
          <Text style={styles.sectionTitle}>{t('profile.statsTitle')}</Text>
          <View style={styles.statsGrid}>
            <StatCard
              icon={<Package size={18} color={Colors.accent} strokeWidth={1.5} />}
              value={stats.objectsMax !== null ? `${stats.objects}/${stats.objectsMax}` : stats.objects.toString()}
              label={t('profile.statObjects')}
            />
            <StatCard
              icon={<FolderOpen size={18} color={Colors.accent} strokeWidth={1.5} />}
              value={stats.collections.toString()}
              label={t('profile.statCollections')}
            />
            <StatCard
              icon={<TrendingUp size={18} color={Colors.accent} strokeWidth={1.5} />}
              value={stats.totalValue !== null
                ? stats.totalValue.toLocaleString(i18n.language, { style: 'currency', currency: stats.currency, maximumFractionDigits: 0 })
                : '—'}
              label={t('profile.statValue')}
            />
            <StatCard
              icon={<Link2 size={18} color={Colors.accent} strokeWidth={1.5} />}
              value={stats.shares.toString()}
              label={t('profile.statShares')}
            />
          </View>

          {/* ── Suivi du Forfait ── */}
          <Text style={styles.sectionTitle}>{t('profile.planTitle')}</Text>
          <View style={styles.forfaitCard}>

            {/* Analyses IA */}
            <View style={styles.forfaitRow}>
              <View style={styles.forfaitRowHeader}>
                <Brain size={16} color={Colors.accent} strokeWidth={1.6} />
                <Text style={styles.forfaitLabel}>{t('profile.aiThisMonth')}</Text>
                <Text style={styles.forfaitValue}>
                  {stats.aiQuota !== null ? `${stats.aiUsed} / ${stats.aiQuota}` : `${stats.aiUsed} · ${t('profile.unlimited')}`}
                </Text>
              </View>
              {stats.aiQuota !== null && (
                <ProgressBar value={stats.aiUsed} max={stats.aiQuota} />
              )}
              {resetLabel && (
                <Text style={styles.forfaitHint}>{t('profile.resetOn', { date: resetLabel })}</Text>
              )}
            </View>

            <View style={styles.forfaitDivider} />

            {/* Objets */}
            <View style={styles.forfaitRow}>
              <View style={styles.forfaitRowHeader}>
                <Package size={16} color={Colors.accent} strokeWidth={1.6} />
                <Text style={styles.forfaitLabel}>{t('profile.objects')}</Text>
                <Text style={styles.forfaitValue}>
                  {stats.objectsMax !== null ? `${stats.objects} / ${stats.objectsMax}` : `${stats.objects}`}
                </Text>
              </View>
              {stats.objectsMax !== null && (
                <ProgressBar value={stats.objects} max={stats.objectsMax} />
              )}
            </View>

            <View style={styles.forfaitDivider} />

            {/* Photos */}
            <View style={styles.forfaitRow}>
              <View style={styles.forfaitRowHeader}>
                <Camera size={16} color={Colors.accent} strokeWidth={1.6} />
                <Text style={styles.forfaitLabel}>{t('profile.photosUploaded')}</Text>
                <Text style={styles.forfaitValue}>
                  {photosMax !== null ? `${stats.totalPhotos} / ${photosMax}` : `${stats.totalPhotos}`}
                </Text>
              </View>
              {photosMax !== null && (
                <ProgressBar value={stats.totalPhotos} max={photosMax} />
              )}
              {stats.photosPerObject !== null && (
                <Text style={styles.forfaitHint}>{t('profile.photosMaxPerObject', { count: stats.photosPerObject })}</Text>
              )}
            </View>

            <View style={styles.forfaitDivider} />

            {/* Amélioration IA des photos */}
            <View style={styles.forfaitRow}>
              <View style={styles.forfaitRowHeader}>
                <Sparkles size={16} color={Colors.accent} strokeWidth={1.6} />
                <Text style={styles.forfaitLabel}>{t('profile.aiPhotoEnhance')}</Text>
                <Text style={styles.forfaitValue}>
                  {stats.photoEnhanceIsPremium
                    ? `${stats.photoEnhanceUsed} / ${stats.photoEnhanceQuota}`
                    : t('profile.premiumLocked')}
                </Text>
              </View>
              {stats.photoEnhanceIsPremium && stats.photoEnhanceQuota !== null && (
                <ProgressBar value={stats.photoEnhanceUsed} max={stats.photoEnhanceQuota} />
              )}
              {!stats.photoEnhanceIsPremium && (
                <Text style={styles.forfaitHint}>{t('profile.premiumOnly')}</Text>
              )}
            </View>

            {!isPaid && (
              <TouchableOpacity style={styles.upgradeBtn} activeOpacity={0.85} onPress={() => router.push('/paywall')}>
                <Zap size={14} color="white" strokeWidth={2.2} />
                <Text style={styles.upgradeBtnText}>{t('profile.upgrade')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </>)}

        {/* Infos compte */}
        <View style={styles.group}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t('profile.name')}</Text>
            {editing ? (
              <Input
                value={displayName}
                onChangeText={setDisplayName}
                placeholder={t('profile.namePlaceholder')}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSave}
                style={styles.inlineInput}
                containerStyle={styles.inlineInputContainer}
              />
            ) : (
              <Text style={styles.rowValue}>{profile?.display_name ?? '—'}</Text>
            )}
          </View>
          <View style={styles.separator} />
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t('profile.email')}</Text>
            <Text style={styles.rowValue} numberOfLines={1}>{user?.email ?? '—'}</Text>
          </View>
        </View>

        <Text style={styles.hint}>
          {t('profile.emailHint')}
        </Text>

        {isPro ? (
          <Text style={styles.hint}>{t('profile.proBilling')}</Text>
        ) : isPaid ? (
          <TouchableOpacity onPress={handleManageSubscription} hitSlop={8} style={styles.manageSubBtn}>
            <Text style={styles.manageSubText}>{t('profile.manageSubscription')}</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      <AvatarViewer
        visible={avatarViewer}
        avatarPath={profile?.avatar_path}
        onClose={() => setAvatarViewer(false)}
        onChange={() => {
          setAvatarViewer(false)
          // Deux fenêtres modales ne s'enchaînent pas sur iOS tant que la
          // première se ferme : on laisse passer l'animation.
          setTimeout(() => setAvatarSheet(true), 350)
        }}
      />

      <ActionSheet
        visible={avatarSheet}
        onClose={() => setAvatarSheet(false)}
        options={[
          { label: t('profile.photoTake'), onPress: () => pickAvatar('camera') },
          { label: t('profile.photoLibrary'), onPress: () => pickAvatar('library') },
          ...(profile?.avatar_path
            ? [{ label: t('profile.photoRemove'), onPress: removeAvatar, destructive: true }]
            : []),
          { label: t('common.cancel'), onPress: () => {}, cancel: true },
        ]}
      />
    </Screen>
  )
}

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <View style={styles.statCard}>
      {icon}
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = Math.min(value / max, 1)
  const isWarning = pct >= 0.8
  return (
    <View style={styles.progressTrack}>
      <View style={[
        styles.progressFill,
        { width: `${pct * 100}%` as any },
        isWarning && styles.progressFillWarning,
      ]} />
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: Typography.md, fontWeight: Typography.semibold, color: Colors.textPrimary },

  content: { padding: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.xxl },

  avatarWrap: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  avatarBadge: {
    position: 'absolute', right: -2, bottom: -2,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.accent,
    borderWidth: 2, borderColor: Colors.background,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarName: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },
  planBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#FFF4E6', borderWidth: 1, borderColor: '#FFD9A8',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
  planBadgePremium: { backgroundColor: '#F3EEFF', borderColor: '#D4BBFF' },
  planBadgePro: { backgroundColor: '#FFF4E6', borderColor: '#F2C879' },
  planBadgeText: { fontSize: 12, fontWeight: Typography.semibold, color: Colors.accent },
  planBadgeTextPremium: { color: '#7c3aed' },
  planBadgeTextPro: { color: '#B4690E' },

  sectionTitle: {
    fontSize: Typography.sm, fontWeight: Typography.semibold,
    color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.6,
    marginTop: Spacing.xs,
  },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  statCard: {
    flex: 1, minWidth: '45%',
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, gap: 4, alignItems: 'flex-start',
  },
  statValue: { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary, letterSpacing: -0.5 },
  statLabel: { fontSize: Typography.xs, color: Colors.textTertiary, fontWeight: Typography.medium },

  forfaitCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  forfaitRow: { padding: Spacing.md, gap: 8 },
  forfaitRowHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  forfaitLabel: { flex: 1, fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },
  forfaitValue: { fontSize: Typography.sm, fontWeight: Typography.bold, color: Colors.textPrimary },
  forfaitHint: { fontSize: Typography.xs, color: Colors.textTertiary, marginTop: -2 },
  forfaitDivider: { height: 1, backgroundColor: Colors.border, marginHorizontal: Spacing.md },

  progressTrack: {
    height: 6, borderRadius: 99, backgroundColor: Colors.border, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', borderRadius: 99, backgroundColor: Colors.accent,
  },
  progressFillWarning: { backgroundColor: '#F97316' },

  upgradeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    margin: Spacing.md, marginTop: Spacing.sm,
    backgroundColor: Colors.accent, borderRadius: Radius.md, paddingVertical: 12,
  },
  upgradeBtnText: { fontSize: Typography.sm, fontWeight: Typography.bold, color: 'white' },

  group: {
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 14, gap: Spacing.md,
  },
  rowLabel: { width: 60, fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: Typography.medium },
  rowValue: { flex: 1, fontSize: Typography.base, color: Colors.textPrimary },
  separator: { height: 1, backgroundColor: Colors.border, marginHorizontal: Spacing.md },

  inlineInputContainer: { flex: 1, marginBottom: 0 },
  inlineInput: { paddingVertical: 0, height: 32, fontSize: Typography.base },

  hint: { fontSize: Typography.xs, color: Colors.textTertiary, lineHeight: 18, paddingHorizontal: Spacing.xs },

  manageSubBtn: { alignItems: 'center', paddingVertical: Spacing.sm },
  manageSubText: { fontSize: Typography.xs, color: Colors.textTertiary, fontWeight: Typography.medium, textDecorationLine: 'underline' },
})
