import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, Linking,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ChevronRight, Lock, FileText, Shield, Trash2, Check } from 'lucide-react-native'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'
import { setAppLanguage, SUPPORTED_LANGUAGES, LANGUAGE_LABELS, type AppLanguage } from '@/i18n'
import { Screen, Colors, Typography, Spacing, Radius } from '@/components/ui'

export default function SettingsScreen() {
  const router = useRouter()
  const { t, i18n } = useTranslation()
  const { signOut } = useAuth()
  const [deletingAccount, setDeletingAccount] = useState(false)
  const currentLang = i18n.language as AppLanguage

  // ── Changer le mot de passe ──────────────────────────────────────────────

  async function handleChangePassword() {
    Alert.prompt(
      t('settings.changePasswordTitle'),
      t('settings.changePasswordMessage'),
      async (password) => {
        if (!password || password.length < 8) {
          Alert.alert(t('settings.passwordTooShortTitle'), t('settings.passwordTooShortMessage'))
          return
        }
        const { error } = await supabase.auth.updateUser({ password })
        if (error) {
          Alert.alert(t('common.error'), error.message)
        } else {
          Alert.alert(t('settings.passwordUpdatedTitle'), t('settings.passwordUpdatedMessage'))
        }
      },
      'secure-text'
    )
  }

  // ── Supprimer le compte ──────────────────────────────────────────────────

  function handleDeleteAccount() {
    Alert.alert(
      t('settings.deleteTitle'),
      t('settings.deleteMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.deleteConfirm'),
          style: 'destructive',
          onPress: confirmDeleteAccount,
        },
      ]
    )
  }

  async function confirmDeleteAccount() {
    // Double confirmation avec saisie
    Alert.alert(
      t('settings.deleteLastTitle'),
      t('settings.deleteLastMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.deleteLastConfirm'),
          style: 'destructive',
          onPress: executeDeleteAccount,
        },
      ]
    )
  }

  async function executeDeleteAccount() {
    setDeletingAccount(true)
    try {
      const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' })
      if (error) throw error
      // La session est déjà invalide côté serveur — on force la déco locale
      await signOut()
    } catch (e: any) {
      setDeletingAccount(false)
      Alert.alert(t('common.error'), e.message ?? t('settings.deleteFailed'))
    }
  }

  // ── Rendu ────────────────────────────────────────────────────────────────

  return (
    <Screen edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <ArrowLeft size={22} color={Colors.textPrimary} strokeWidth={1.8} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('settings.title')}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Section Compte */}
        <Text style={styles.sectionLabel}>{t('settings.sectionAccount')}</Text>
        <View style={styles.group}>
          <SettingsRow
            icon={<Lock size={18} color={Colors.textSecondary} strokeWidth={1.5} />}
            label={t('settings.changePassword')}
            onPress={handleChangePassword}
          />
        </View>

        {/* Section Langue */}
        <Text style={styles.sectionLabel}>{t('settings.sectionLanguage')}</Text>
        <View style={styles.group}>
          {SUPPORTED_LANGUAGES.map((lang, index) => (
            <React.Fragment key={lang}>
              {index > 0 && <View style={styles.separator} />}
              <TouchableOpacity
                style={styles.row}
                onPress={() => setAppLanguage(lang)}
                activeOpacity={0.7}
                accessibilityRole="radio"
                accessibilityState={{ selected: currentLang === lang }}
              >
                <Text style={styles.rowLabel}>{LANGUAGE_LABELS[lang]}</Text>
                {currentLang === lang && (
                  <Check size={18} color={Colors.accent} strokeWidth={2} />
                )}
              </TouchableOpacity>
            </React.Fragment>
          ))}
        </View>

        {/* Section Légal */}
        <Text style={styles.sectionLabel}>{t('settings.sectionLegal')}</Text>
        <View style={styles.group}>
          <SettingsRow
            icon={<Shield size={18} color={Colors.textSecondary} strokeWidth={1.5} />}
            label={t('settings.privacyPolicy')}
            onPress={() => Linking.openURL('https://tiroir.app/privacy')}
          />
          <View style={styles.separator} />
          <SettingsRow
            icon={<FileText size={18} color={Colors.textSecondary} strokeWidth={1.5} />}
            label={t('settings.terms')}
            onPress={() => Linking.openURL('https://tiroir.app/terms')}
          />
        </View>

        {/* Section Danger */}
        <Text style={styles.sectionLabel}>{t('settings.sectionDanger')}</Text>
        <View style={styles.group}>
          <TouchableOpacity
            style={styles.deleteRow}
            onPress={handleDeleteAccount}
            disabled={deletingAccount}
            activeOpacity={0.7}
          >
            {deletingAccount ? (
              <ActivityIndicator color={Colors.error} size="small" />
            ) : (
              <Trash2 size={18} color={Colors.error} strokeWidth={1.5} />
            )}
            <Text style={styles.deleteLabel}>
              {deletingAccount ? t('settings.deleting') : t('settings.deleteAccount')}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.deleteHint}>
          {t('settings.deleteHint')}
        </Text>

      </ScrollView>
    </Screen>
  )
}

// ── Composant ligne ──────────────────────────────────────────────────────────

function SettingsRow({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.rowIcon}>{icon}</View>
      <Text style={styles.rowLabel}>{label}</Text>
      <ChevronRight size={16} color={Colors.textTertiary} strokeWidth={1.5} />
    </TouchableOpacity>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────

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
    gap: Spacing.xs,
    paddingBottom: Spacing.xxl,
  },

  sectionLabel: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    color: Colors.textTertiary,
    letterSpacing: 0.8,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xs,
    paddingHorizontal: Spacing.xs,
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
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
  },
  rowIcon: { width: 24, alignItems: 'center' },
  rowLabel: {
    flex: 1,
    fontSize: Typography.base,
    color: Colors.textPrimary,
  },

  separator: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: Spacing.md + 24 + Spacing.md,
  },

  deleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
  },
  deleteLabel: {
    flex: 1,
    fontSize: Typography.base,
    color: Colors.error,
    fontWeight: Typography.medium,
  },
  deleteHint: {
    fontSize: Typography.xs,
    color: Colors.textTertiary,
    paddingHorizontal: Spacing.xs,
    lineHeight: 18,
    marginTop: Spacing.xs,
  },
})
