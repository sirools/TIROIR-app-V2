import React, { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, Image,
  TouchableOpacity, ActivityIndicator, Linking, Platform,
} from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Share2, Download, Lock, ExternalLink } from 'lucide-react-native'
import { supabase } from '@/lib/supabase'
import { Colors, Typography, Spacing, Radius } from '@/components/ui/tokens'
import { isLot } from '@/features/objects/quantity'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SharedObject {
  id: string
  title: string
  description: string | null
  status: string | null
  location_note: string | null
  quantity: number
  cover_url: string | null
}

interface ShareLink {
  title: string | null
  object_ids: string[]
  options: {
    password_protected: boolean
    allow_download: boolean
    include_documents: boolean
  }
  expires_at: string | null
}

// ── Status labels ──────────────────────────────────────────────────────────────

const STATUS_DOT: Record<string, string> = {
  owned: '#22C55E', stored: '#38BDF8', loaned: '#E879F9',
  sold: '#FBBF24', given: '#FB7185', lost: '#9CA3AF',
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SharePage() {
  const { token } = useLocalSearchParams<{ token: string }>()
  const { t } = useTranslation()

  const [link, setLink] = useState<ShareLink | null>(null)
  const [objects, setObjects] = useState<SharedObject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<'not_found' | 'expired' | 'server' | null>(null)

  useEffect(() => {
    if (token) loadShare(token)
  }, [token])

  async function loadShare(tok: string) {
    setLoading(true)
    try {
      // 1. Charger le share_link (lecture publique via RLS)
      const { data: linkData, error: linkError } = await supabase
        .from('share_links')
        .select('title, object_ids, options, expires_at')
        .eq('token', tok)
        .single()

      if (linkError || !linkData) { setError('not_found'); return }

      if (linkData.expires_at && new Date(linkData.expires_at) < new Date()) {
        setError('expired'); return
      }

      setLink(linkData as ShareLink)

      // 2. Charger les objets
      const { data: objData, error: objError } = await supabase
        .from('objects')
        .select('id, title, description, status, location_note, quantity')
        .in('id', linkData.object_ids)

      if (objError || !objData) { setError('server'); return }

      // 3. Charger les covers (object_images)
      const { data: imgData } = await supabase
        .from('object_images')
        .select('object_id, storage_path')
        .in('object_id', linkData.object_ids)
        .eq('is_cover', true)

      const coverPaths: Record<string, string> = {}
      if (imgData) {
        for (const img of imgData) {
          coverPaths[img.object_id] = img.storage_path
        }
      }

      // 4. Générer URLs signées
      const coverUrls: Record<string, string> = {}
      const paths = Object.values(coverPaths)
      if (paths.length > 0) {
        const { data: signed } = await supabase.storage
          .from('object-images')
          .createSignedUrls(paths, 60 * 60)
        if (signed) {
          for (const s of signed) {
            const objId = Object.entries(coverPaths).find(([, p]) => p === s.path)?.[0]
            if (objId && s.signedUrl) coverUrls[objId] = s.signedUrl
          }
        }
      }

      setObjects(
        (objData as Omit<SharedObject, 'cover_url'>[]).map(o => ({
          ...o,
          cover_url: coverUrls[o.id] ?? null,
        }))
      )
    } catch {
      setError('server')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorEmoji}>{error === 'expired' ? '⏱' : '🔍'}</Text>
        <Text style={styles.errorTitle}>
          {error === 'not_found' ? t('shareView.notFoundTitle')
            : error === 'expired' ? t('shareView.expiredTitle')
            : t('shareView.errorTitle')}
        </Text>
        <Text style={styles.errorSub}>
          {error === 'not_found'
            ? t('shareView.notFoundSub')
            : error === 'expired'
            ? t('shareView.expiredSub')
            : t('shareView.errorSub')}
        </Text>
      </View>
    )
  }

  const pageTitle = link?.title ?? t('shareView.defaultTitle')
  const isProtected = link?.options.password_protected
  const allowDownload = link?.options.allow_download

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerBrand}>
          <Text style={styles.brandName}>TiROiR</Text>
        </View>
        <View style={styles.headerMeta}>
          {isProtected && (
            <View style={styles.badge}>
              <Lock size={11} color={Colors.textSecondary} strokeWidth={2} />
              <Text style={styles.badgeText}>{t('shareView.protected')}</Text>
            </View>
          )}
          <Text style={styles.countBadge}>{t('common.objects', { count: objects.length })}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Titre */}
        <Text style={styles.pageTitle}>{pageTitle}</Text>
        <Text style={styles.pageSub}>{t('shareView.sharedVia')} · {t('common.objects', { count: objects.length })}</Text>

        {/* Grille objets */}
        <View style={styles.grid}>
          {objects.map(obj => (
            <View key={obj.id} style={styles.card}>
              {/* Cover */}
              <View style={styles.cardCover}>
                {obj.cover_url
                  ? <Image source={{ uri: obj.cover_url }} style={styles.coverImg} resizeMode="cover" />
                  : <View style={styles.coverPlaceholder}>
                      <Text style={styles.coverPlaceholderIcon}>📦</Text>
                    </View>
                }
                {/* Un lot partagé doit se lire comme un lot, pas comme
                    un exemplaire unique. */}
                {isLot(obj.quantity) && (
                  <View style={styles.qtyBadge}>
                    <Text style={styles.qtyBadgeText}>×{obj.quantity}</Text>
                  </View>
                )}
              </View>

              {/* Infos */}
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={2}>{obj.title}</Text>

                {obj.status && (
                  <View style={styles.statusRow}>
                    <View style={[styles.statusDot, { backgroundColor: STATUS_DOT[obj.status] ?? '#9CA3AF' }]} />
                    <Text style={styles.statusLabel}>
                      {t(`status.${obj.status}`, { defaultValue: obj.status })}
                    </Text>
                  </View>
                )}

                {obj.location_note && (
                  <Text style={styles.location} numberOfLines={1}>📍 {obj.location_note}</Text>
                )}

                {obj.description && (
                  <Text style={styles.description} numberOfLines={3}>{obj.description}</Text>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Footer actions */}
        {allowDownload && (
          <TouchableOpacity style={styles.downloadBtn} activeOpacity={0.8}>
            <Download size={18} color={Colors.accent} strokeWidth={1.8} />
            <Text style={styles.downloadText}>{t('shareView.download')}</Text>
          </TouchableOpacity>
        )}

        {/* CTA app */}
        <View style={styles.appCta}>
          <Text style={styles.appCtaTitle}>{t('shareView.ctaTitle')}</Text>
          <Text style={styles.appCtaSub}>{t('shareView.ctaSub')}</Text>
          <TouchableOpacity
            style={styles.appCtaBtn}
            onPress={() => Linking.openURL('https://tiroir.app')}
            activeOpacity={0.85}
          >
            <ExternalLink size={16} color="white" strokeWidth={2} />
            <Text style={styles.appCtaBtnText}>{t('shareView.ctaBtn')}</Text>
          </TouchableOpacity>
        </View>

        {/* Privacy link */}
        <TouchableOpacity
          style={styles.privacyLink}
          onPress={() => Linking.openURL('https://tiroir.app/privacy')}
        >
          <Text style={styles.privacyLinkText}>{t('settings.privacyPolicy')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const CARD_WIDTH = Platform.OS === 'web' ? 320 : 160

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.background, gap: Spacing.sm, padding: Spacing.xl,
  },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerBrand: {},
  brandName: { fontSize: 18, fontWeight: '800', color: Colors.accent, letterSpacing: 1 },
  headerMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.surfaceWarm,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.full,
  },
  badgeText: { fontSize: Typography.xs, color: Colors.textSecondary },
  countBadge: { fontSize: Typography.sm, color: Colors.textTertiary },

  // Content
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: 60 },
  pageTitle: {
    fontSize: Typography.xxl, fontWeight: Typography.bold,
    color: Colors.textPrimary, lineHeight: 34,
  },
  pageSub: { fontSize: Typography.sm, color: Colors.textTertiary, marginTop: -Spacing.sm },

  // Grid
  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md,
    justifyContent: Platform.OS === 'web' ? 'flex-start' : 'space-between',
  },

  // Card
  card: {
    width: CARD_WIDTH,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    borderWidth: 1, borderColor: Colors.border,
  },
  cardCover: { width: '100%', aspectRatio: 1, position: 'relative' },
  qtyBadge: {
    position: 'absolute', top: 6, right: 6,
    minWidth: 24, paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(26, 22, 18, 0.72)',
    alignItems: 'center', justifyContent: 'center',
  },
  qtyBadgeText: { fontSize: Typography.xs, fontWeight: Typography.bold, color: Colors.textInverse },
  coverImg: { width: '100%', height: '100%' },
  coverPlaceholder: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surfaceWarm,
  },
  coverPlaceholderIcon: { fontSize: 40 },
  cardBody: { padding: Spacing.md, gap: 6 },
  cardTitle: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusLabel: { fontSize: Typography.xs, color: Colors.textSecondary },
  location: { fontSize: Typography.xs, color: Colors.textTertiary },
  description: { fontSize: Typography.sm, color: Colors.textSecondary, lineHeight: 18 },

  // Download
  downloadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 14,
    borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.accent,
  },
  downloadText: { fontSize: Typography.base, color: Colors.accent, fontWeight: Typography.semibold },

  // App CTA
  appCta: {
    alignItems: 'center', gap: Spacing.sm,
    padding: Spacing.xl,
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border,
  },
  appCtaTitle: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary, textAlign: 'center' },
  appCtaSub: { fontSize: Typography.sm, color: Colors.textSecondary, textAlign: 'center' },
  appCtaBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.accent,
    paddingHorizontal: Spacing.lg, paddingVertical: 12,
    borderRadius: Radius.full, marginTop: Spacing.sm,
  },
  appCtaBtnText: { color: 'white', fontSize: Typography.base, fontWeight: Typography.bold },

  // Privacy
  privacyLink: { alignItems: 'center', paddingVertical: Spacing.md },
  privacyLinkText: { fontSize: Typography.xs, color: Colors.textTertiary, textDecorationLine: 'underline' },

  // Error
  errorEmoji: { fontSize: 48, marginBottom: Spacing.sm },
  errorTitle: { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary, textAlign: 'center' },
  errorSub: { fontSize: Typography.base, color: Colors.textSecondary, textAlign: 'center', lineHeight: 22 },
})
