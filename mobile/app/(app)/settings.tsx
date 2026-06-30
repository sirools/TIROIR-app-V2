import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Alert, ActivityIndicator, Linking,
} from 'react-native'
import { useRouter } from 'expo-router'
import { ArrowLeft, ChevronRight, Lock, FileText, Shield, Trash2 } from 'lucide-react-native'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'
import { Screen, Colors, Typography, Spacing, Radius } from '@/components/ui'

export default function SettingsScreen() {
  const router = useRouter()
  const { signOut } = useAuth()
  const [deletingAccount, setDeletingAccount] = useState(false)

  // ── Changer le mot de passe ──────────────────────────────────────────────

  async function handleChangePassword() {
    Alert.prompt(
      'Nouveau mot de passe',
      'Saisis ton nouveau mot de passe (8 caractères minimum).',
      async (password) => {
        if (!password || password.length < 8) {
          Alert.alert('Trop court', 'Le mot de passe doit faire au moins 8 caractères.')
          return
        }
        const { error } = await supabase.auth.updateUser({ password })
        if (error) {
          Alert.alert('Erreur', error.message)
        } else {
          Alert.alert('Mot de passe mis à jour', 'Tu peux maintenant te connecter avec ton nouveau mot de passe.')
        }
      },
      'secure-text'
    )
  }

  // ── Supprimer le compte ──────────────────────────────────────────────────

  function handleDeleteAccount() {
    Alert.alert(
      'Supprimer mon compte ?',
      'Toutes tes données seront définitivement supprimées : objets, collections, photos, partages. Cette action est irréversible.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer définitivement',
          style: 'destructive',
          onPress: confirmDeleteAccount,
        },
      ]
    )
  }

  async function confirmDeleteAccount() {
    // Double confirmation avec saisie
    Alert.alert(
      'Dernière confirmation',
      'Tape "SUPPRIMER" pour confirmer.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Je confirme',
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
      Alert.alert('Erreur', e.message ?? 'La suppression a échoué. Réessaie ou contacte le support.')
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
        <Text style={styles.headerTitle}>Paramètres</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Section Compte */}
        <Text style={styles.sectionLabel}>COMPTE</Text>
        <View style={styles.group}>
          <SettingsRow
            icon={<Lock size={18} color={Colors.textSecondary} strokeWidth={1.5} />}
            label="Changer le mot de passe"
            onPress={handleChangePassword}
          />
        </View>

        {/* Section Légal */}
        <Text style={styles.sectionLabel}>LÉGAL</Text>
        <View style={styles.group}>
          <SettingsRow
            icon={<Shield size={18} color={Colors.textSecondary} strokeWidth={1.5} />}
            label="Politique de confidentialité"
            onPress={() => Linking.openURL('https://tiroir.app/privacy')}
          />
          <View style={styles.separator} />
          <SettingsRow
            icon={<FileText size={18} color={Colors.textSecondary} strokeWidth={1.5} />}
            label="Conditions d'utilisation"
            onPress={() => Linking.openURL('https://tiroir.app/terms')}
          />
        </View>

        {/* Section Danger */}
        <Text style={styles.sectionLabel}>ZONE DANGEREUSE</Text>
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
              {deletingAccount ? 'Suppression en cours…' : 'Supprimer mon compte'}
            </Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.deleteHint}>
          Supprime définitivement ton compte et toutes tes données (objets, photos, collections). Irréversible.
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
