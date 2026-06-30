import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, ScrollView,
} from 'react-native'
import { useRouter } from 'expo-router'
import { ArrowLeft, User, Edit3, Check, Package, FolderOpen, TrendingUp, Link2, Brain, Camera } from 'lucide-react-native'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'
import { Screen, Input, Colors, Typography, Spacing, Radius } from '@/components/ui'

interface Stats {
  objects: number
  collections: number
  totalValue: number | null
  currency: string
  shares: number
  aiUsed: number
  aiQuota: number | null
  objectsMax: number | null
  photosPerObject: number | null
}

export default function ProfileScreen() {
  const router = useRouter()
  const { user, profile } = useAuth()
  const [editing, setEditing] = useState(false)
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [saving, setSaving] = useState(false)
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => { loadStats() }, [])

  async function loadStats() {
    const [objRes, colRes, valRes, shareRes, quotaRes, limitsRes] = await Promise.all([
      supabase.from('objects').select('id', { count: 'exact', head: true }),
      supabase.from('collections').select('id', { count: 'exact', head: true }),
      supabase.from('objects').select('market_value, user_value, value_currency').not('market_value', 'is', null),
      supabase.from('share_links').select('id', { count: 'exact', head: true }),
      supabase.rpc('get_ai_quota'),
      supabase.rpc('get_plan_limits'),
    ])

    // Calcul valeur totale (somme des user_value sinon market_value)
    let totalValue: number | null = null
    let currency = 'EUR'
    if (valRes.data && valRes.data.length > 0) {
      totalValue = valRes.data.reduce((sum: number, o: any) => {
        return sum + (o.user_value ?? o.market_value ?? 0)
      }, 0)
      const raw = valRes.data[0].value_currency ?? 'EUR'
      currency = raw === '€' ? 'EUR' : raw === '$' ? 'USD' : raw === '£' ? 'GBP' : raw.length === 3 ? raw : 'EUR'
    }

    const quota  = quotaRes.data?.[0]
    const limits = limitsRes.data?.[0]
    setStats({
      objects: objRes.count ?? 0,
      collections: colRes.count ?? 0,
      totalValue,
      currency,
      shares: shareRes.count ?? 0,
      aiUsed: quota?.used ?? 0,
      aiQuota: quota?.quota ?? null,
      objectsMax: limits?.objects_max ?? null,
      photosPerObject: limits?.photos_per_object ?? null,
    })
  }

  async function handleSave() {
    const name = displayName.trim()
    if (!name) { Alert.alert('Requis', 'Le nom ne peut pas être vide.'); return }
    setSaving(true)
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: name, updated_at: new Date().toISOString() })
      .eq('id', user!.id)
    setSaving(false)
    if (error) { Alert.alert('Erreur', error.message); return }
    setEditing(false)
  }

  return (
    <Screen edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={22} color={Colors.textPrimary} strokeWidth={1.8} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mon Profil</Text>
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
        {/* Avatar */}
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <User size={36} color={Colors.accent} strokeWidth={1.5} />
          </View>
          {profile?.display_name && (
            <Text style={styles.avatarName}>{profile.display_name}</Text>
          )}
        </View>

        {/* Stats */}
        {stats && (
          <View style={styles.statsGrid}>
            <StatCard
              icon={<Package size={18} color={Colors.accent} strokeWidth={1.5} />}
              value={stats.objects.toString()}
              label="objets"
            />
            <StatCard
              icon={<FolderOpen size={18} color={Colors.accent} strokeWidth={1.5} />}
              value={stats.collections.toString()}
              label="collections"
            />
            <StatCard
              icon={<TrendingUp size={18} color={Colors.accent} strokeWidth={1.5} />}
              value={stats.totalValue !== null
                ? stats.totalValue.toLocaleString('fr-FR', { style: 'currency', currency: stats.currency, maximumFractionDigits: 0 })
                : '—'
              }
              label="valeur estimée"
            />
            <StatCard
              icon={<Link2 size={18} color={Colors.accent} strokeWidth={1.5} />}
              value={stats.shares.toString()}
              label="partages actifs"
            />
            <StatCard
              icon={<Brain size={18} color={Colors.accent} strokeWidth={1.5} />}
              value={stats.aiQuota !== null ? `${stats.aiUsed}/${stats.aiQuota}` : `${stats.aiUsed} ∞`}
              label="analyses IA ce mois"
            />
            <StatCard
              icon={<Package size={18} color={Colors.accent} strokeWidth={1.5} />}
              value={stats.objectsMax !== null
                ? `${stats.objectsMax - stats.objects} restants`
                : '∞'}
              label="objets encore possibles"
            />
            <StatCard
              icon={<Camera size={18} color={Colors.accent} strokeWidth={1.5} />}
              value={stats.photosPerObject !== null ? `${stats.photosPerObject}` : '∞'}
              label="photo par objet"
            />
          </View>
        )}

        {/* Infos */}
        <View style={styles.group}>
          {/* Nom d'affichage */}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Nom</Text>
            {editing ? (
              <Input
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Ton prénom ou pseudo"
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

          {/* Email (lecture seule) */}
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Email</Text>
            <Text style={styles.rowValue} numberOfLines={1}>{user?.email ?? '—'}</Text>
          </View>
        </View>

        <Text style={styles.hint}>
          L'email ne peut pas être modifié. Pour changer ton mot de passe, rends-toi dans Paramètres.
        </Text>
      </ScrollView>
    </Screen>
  )
}

function StatCard({ icon, value, label, wide }: { icon: React.ReactNode; value: string; label: string; wide?: boolean }) {
  return (
    <View style={[styles.statCard, wide && styles.statCardWide]}>
      {icon}
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
  },

  content: {
    padding: Spacing.lg,
    gap: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },

  avatarWrap: { alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.accentLight,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarName: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
  },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: 4,
    alignItems: 'flex-start',
  },
  statCardWide: { minWidth: '100%' },
  statValue: {
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: Typography.xs,
    color: Colors.textTertiary,
    fontWeight: Typography.medium,
  },

  group: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    gap: Spacing.md,
  },
  rowLabel: {
    width: 60,
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.medium,
  },
  rowValue: {
    flex: 1,
    fontSize: Typography.base,
    color: Colors.textPrimary,
  },
  separator: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: Spacing.md,
  },

  inlineInputContainer: { flex: 1, marginBottom: 0 },
  inlineInput: { paddingVertical: 0, height: 32, fontSize: Typography.base },

  hint: {
    fontSize: Typography.xs,
    color: Colors.textTertiary,
    lineHeight: 18,
    paddingHorizontal: Spacing.xs,
  },
})
