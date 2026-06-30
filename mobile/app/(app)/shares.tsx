import React, { useCallback, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, RefreshControl, Alert, ActivityIndicator, Linking,
} from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import * as Clipboard from 'expo-clipboard'
import { Link2, Eye, Trash2, Copy, ArrowLeft, ExternalLink } from 'lucide-react-native'
import { supabase } from '@/lib/supabase'
import { Screen, Colors, Typography, Spacing, Radius } from '@/components/ui'

interface ShareLink {
  id: string
  token: string
  object_ids: string[]
  title: string | null
  view_count: number
  expires_at: string | null
  created_at: string
}

export default function SharesScreen() {
  const router = useRouter()
  const [links, setLinks] = useState<ShareLink[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('share_links')
      .select('id, token, object_ids, title, view_count, expires_at, created_at')
      .order('created_at', { ascending: false })

    if (!error) setLinks(data ?? [])
    setLoading(false)
    setRefreshing(false)
  }, [])

  useFocusEffect(useCallback(() => { load() }, [load]))

  function onRefresh() { setRefreshing(true); load() }

  async function handleCopy(link: ShareLink) {
    const url = `https://tiroir.app/s/${link.token}`
    await Clipboard.setStringAsync(url)
    setCopiedId(link.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  function handleDelete(link: ShareLink) {
    const count = link.object_ids.length
    Alert.alert(
      'Supprimer ce lien ?',
      `Le lien partagé (${count} objet${count > 1 ? 's' : ''}) ne sera plus accessible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('share_links').delete().eq('id', link.id)
            if (error) { Alert.alert('Erreur', error.message); return }
            setLinks(prev => prev.filter(l => l.id !== link.id))
          },
        },
      ]
    )
  }

  function isExpired(link: ShareLink) {
    if (!link.expires_at) return false
    return new Date(link.expires_at) < new Date()
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  function formatExpiry(iso: string) {
    const d = new Date(iso)
    const now = new Date()
    const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays < 0) return 'Expiré'
    if (diffDays === 0) return "Expire aujourd'hui"
    if (diffDays === 1) return 'Expire demain'
    return `Expire dans ${diffDays} j`
  }

  return (
    <Screen edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={22} color={Colors.textPrimary} strokeWidth={1.8} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Partages actifs</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      ) : links.length === 0 ? (
        <View style={styles.center}>
          <Link2 size={40} color={Colors.textTertiary} strokeWidth={1.2} />
          <Text style={styles.emptyTitle}>Aucun lien partagé</Text>
          <Text style={styles.emptySubtitle}>
            Crée un lien depuis la fiche d'un objet ou d'une collection.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
        >
          {links.map(link => {
            const expired = isExpired(link)
            const copied = copiedId === link.id
            return (
              <View key={link.id} style={[styles.card, expired && styles.cardExpired]}>
                {/* Titre + badge */}
                <View style={styles.cardTop}>
                  <View style={styles.cardTitleRow}>
                    <Link2 size={14} color={expired ? Colors.textTertiary : Colors.accent} strokeWidth={1.8} />
                    <Text style={[styles.cardTitle, expired && styles.cardTitleExpired]} numberOfLines={1}>
                      {link.title ?? `${link.object_ids.length} objet${link.object_ids.length > 1 ? 's' : ''}`}
                    </Text>
                  </View>
                  {expired && (
                    <View style={styles.badgeExpired}>
                      <Text style={styles.badgeExpiredText}>Expiré</Text>
                    </View>
                  )}
                </View>

                {/* Méta */}
                <View style={styles.meta}>
                  <View style={styles.metaItem}>
                    <Eye size={12} color={Colors.textTertiary} strokeWidth={1.8} />
                    <Text style={styles.metaText}>{link.view_count} vue{link.view_count > 1 ? 's' : ''}</Text>
                  </View>
                  <Text style={styles.metaDot}>·</Text>
                  <Text style={styles.metaText}>{link.object_ids.length} objet{link.object_ids.length > 1 ? 's' : ''}</Text>
                  <Text style={styles.metaDot}>·</Text>
                  <Text style={styles.metaText}>
                    {link.expires_at ? formatExpiry(link.expires_at) : `Créé le ${formatDate(link.created_at)}`}
                  </Text>
                </View>

                {/* URL — cliquable */}
                <TouchableOpacity
                  onPress={() => Linking.openURL(`https://tiroir.app/s/${link.token}`)}
                  activeOpacity={0.7}
                  style={styles.urlBtn}
                >
                  <ExternalLink size={11} color={Colors.accent} strokeWidth={1.8} />
                  <Text style={styles.url} numberOfLines={1}>tiroir.app/s/{link.token}</Text>
                </TouchableOpacity>

                {/* Actions */}
                <View style={styles.actions}>
                  <TouchableOpacity
                    style={[styles.actionBtn, copied && styles.actionBtnCopied]}
                    onPress={() => handleCopy(link)}
                    activeOpacity={0.7}
                  >
                    <Copy size={14} color={copied ? Colors.accent : Colors.textSecondary} strokeWidth={1.8} />
                    <Text style={[styles.actionText, copied && styles.actionTextCopied]}>
                      {copied ? 'Copié !' : 'Copier'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnDestructive]}
                    onPress={() => handleDelete(link)}
                    activeOpacity={0.7}
                  >
                    <Trash2 size={14} color={Colors.error} strokeWidth={1.8} />
                    <Text style={styles.actionTextDestructive}>Supprimer</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )
          })}
        </ScrollView>
      )}
    </Screen>
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

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
    marginTop: Spacing.sm,
  },
  emptySubtitle: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  list: {
    padding: Spacing.lg,
    gap: Spacing.md,
    paddingBottom: Spacing.xxl,
  },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  cardExpired: {
    opacity: 0.6,
  },

  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flex: 1,
  },
  cardTitle: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
    flex: 1,
  },
  cardTitleExpired: { color: Colors.textTertiary },

  badgeExpired: {
    backgroundColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
  },
  badgeExpiredText: {
    fontSize: Typography.xs,
    color: Colors.textTertiary,
    fontWeight: Typography.medium,
  },

  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: Typography.xs, color: Colors.textTertiary },
  metaDot: { fontSize: Typography.xs, color: Colors.textTertiary },

  urlBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: Colors.background,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
  },
  url: {
    fontSize: Typography.xs,
    color: Colors.accent,
    fontFamily: 'monospace',
    flex: 1,
  },

  actions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: 2,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  actionBtnCopied: {
    borderColor: Colors.accentLight,
    backgroundColor: Colors.accentLight,
  },
  actionBtnDestructive: {
    borderColor: Colors.errorLight,
    backgroundColor: Colors.errorLight,
  },
  actionText: { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: Typography.medium },
  actionTextCopied: { color: Colors.accent },
  actionTextDestructive: { fontSize: Typography.sm, color: Colors.error, fontWeight: Typography.medium },
})
