import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, Linking,
  Modal, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ChevronRight, Lock, FileText, Shield, Trash2, Check } from 'lucide-react-native'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'
import { setAppLanguage, SUPPORTED_LANGUAGES, LANGUAGE_LABELS, type AppLanguage } from '@/i18n'
import { Screen, Button, Input, Colors, Typography, Spacing, Radius } from '@/components/ui'
import { saveAccountLocale } from '@/features/auth/accountLocale'

const MIN_PASSWORD_LENGTH = 8

export default function SettingsScreen() {
  const router = useRouter()
  const { t, i18n } = useTranslation()
  const { signOut } = useAuth()
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [passwordModalVisible, setPasswordModalVisible] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const currentLang = i18n.language as AppLanguage

  // ── Changer le mot de passe ──────────────────────────────────────────────

  // Alert.prompt n'existe que sur iOS : sur Android l'appel ne faisait
  // strictement rien. D'où cette modale, identique sur les deux plateformes.
  async function submitNewPassword() {
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(t('settings.passwordTooShortMessage'))
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('settings.passwordMismatch'))
      return
    }

    setSavingPassword(true)
    setPasswordError(null)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSavingPassword(false)

    if (error) {
      setPasswordError(error.message)
      return
    }

    closePasswordModal()
    Alert.alert(t('settings.passwordUpdatedTitle'), t('settings.passwordUpdatedMessage'))
  }

  function closePasswordModal() {
    setPasswordModalVisible(false)
    setNewPassword('')
    setConfirmPassword('')
    setPasswordError(null)
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
            onPress={() => setPasswordModalVisible(true)}
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
                onPress={() => {
                  void setAppLanguage(lang)
                  void saveAccountLocale(lang).catch(() => undefined)
                }}
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

      {/* Changement de mot de passe — modale plutôt qu'Alert.prompt (iOS only) */}
      <Modal
        visible={passwordModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closePasswordModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={closePasswordModal}
          />
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t('settings.changePasswordTitle')}</Text>
            <Text style={styles.modalMessage}>{t('settings.changePasswordMessage')}</Text>

            <Input
              label={t('settings.newPasswordLabel')}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              autoFocus
            />
            <Input
              label={t('settings.confirmPasswordLabel')}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              containerStyle={{ marginTop: Spacing.md }}
            />

            {passwordError && <Text style={styles.modalError}>{passwordError}</Text>}

            <View style={styles.modalActions}>
              <TouchableOpacity onPress={closePasswordModal} style={styles.modalCancel}>
                <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <Button
                label={t('settings.savePassword')}
                onPress={submitNewPassword}
                loading={savingPassword}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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

  // Modale « changer le mot de passe »
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  modalTitle: {
    fontSize: Typography.md,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  modalMessage: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  modalError: {
    fontSize: Typography.sm,
    color: Colors.error,
    marginTop: Spacing.sm,
  },
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  modalCancel: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  modalCancelText: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    fontWeight: Typography.medium,
  },
})
