import React, { useEffect, useState } from 'react'
import { FormSheet, SheetScrollView } from '@/components/ui'
import {
  View, Text, StyleSheet, TouchableOpacity, Switch, TextInput, ActivityIndicator, Alert,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { Lock } from 'lucide-react-native'
import { supabase } from '@/lib/supabase'
import { ActionSheet } from '@/components/ui/ActionSheet'
import { Colors, Typography, Spacing, Radius } from '@/components/ui/tokens'

/** Ce que la base conserve pour un partage, hors secret. */
export interface ShareLinkOptions {
  password_protected?: boolean
  allow_download?: boolean
  include_documents?: boolean
  fields?: Partial<ShareFields>
  contact_name?: string | null
  contact_email?: string | null
  contact_phone?: string | null
}

export interface ShareFields {
  values: boolean
  location: boolean
  attributes: boolean
  description: boolean
  insurance: boolean
}

const ALL_FIELDS: ShareFields = {
  values: true, location: true, attributes: true, description: true, insurance: true,
}

export interface EditableShare {
  id: string
  title: string | null
  options: ShareLinkOptions | null
  expires_at: string | null
}

const DURATIONS: { days: number | null; labelKey: string }[] = [
  { days: 7, labelKey: 'sharePanel.duration7' },
  { days: 30, labelKey: 'sharePanel.duration30' },
  { days: 90, labelKey: 'sharePanel.duration90' },
  { days: null, labelKey: 'sharePanel.durationNever' },
]

interface Props {
  visible: boolean
  link: EditableShare | null
  onClose: () => void
  onSaved: (patch: { title: string | null; options: ShareLinkOptions; expires_at: string | null }) => void
}

/**
 * Réglages d'un partage déjà créé.
 *
 * Le tiroir part de ce que la base contient réellement — pas d'un état
 * reconstruit côté app : c'est ce qui permet de vérifier d'un coup d'œil
 * ce qui est effectivement enregistré.
 *
 * Le mot de passe fait exception : son empreinte est calculée par l'Edge
 * Function, l'app ne peut donc que la retirer, pas en poser une nouvelle.
 */
export function ShareSettingsSheet({ visible, link, onClose, onSaved }: Props) {
  const { t } = useTranslation()

  const [title, setTitle] = useState('')
  const [fields, setFields] = useState<ShareFields>(ALL_FIELDS)
  const [allowDownload, setAllowDownload] = useState(false)
  const [includeDocuments, setIncludeDocuments] = useState(false)
  const [passwordProtected, setPasswordProtected] = useState(false)
  const [expiresDays, setExpiresDays] = useState<number | null>(null)
  const [durationMenuOpen, setDurationMenuOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Rechargé à chaque ouverture : l'écran doit refléter la base, pas le
  // brouillon d'une édition précédemment abandonnée.
  useEffect(() => {
    if (!visible || !link) return
    const o = link.options ?? {}
    setTitle(link.title ?? '')
    setFields({ ...ALL_FIELDS, ...(o.fields ?? {}) })
    setAllowDownload(o.allow_download ?? false)
    setIncludeDocuments(o.include_documents ?? false)
    setPasswordProtected(o.password_protected ?? false)
    setExpiresDays(remainingDays(link.expires_at))
  }, [visible, link?.id])

  function remainingDays(iso: string | null): number | null {
    if (!iso) return null
    const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400_000)
    // On retombe sur le palier proposé le plus proche, sinon la durée
    // affichée ne correspondrait à aucun choix possible.
    return DURATIONS.reduce<number | null>((best, d) => {
      if (d.days === null) return best
      if (best === null) return d.days
      return Math.abs(d.days - days) < Math.abs(best - days) ? d.days : best
    }, null)
  }

  async function save() {
    if (!link || saving) return
    setSaving(true)
    const nextOptions: ShareLinkOptions = {
      ...(link.options ?? {}),
      allow_download: allowDownload,
      include_documents: includeDocuments,
      password_protected: passwordProtected,
      fields,
    }
    const nextExpires = expiresDays === null
      ? null
      : new Date(Date.now() + expiresDays * 86400_000).toISOString()

    // Retirer la protection retire aussi l'empreinte : la laisser derrière
    // un booléen à false serait un secret conservé sans raison.
    const patch: Record<string, unknown> = { title: title.trim() || null, options: nextOptions, expires_at: nextExpires }
    if (!passwordProtected) {
      nextOptions.password_protected = false
      delete (nextOptions as Record<string, unknown>).password_hash
    }

    const { error } = await supabase.from('share_links').update(patch).eq('id', link.id)
    setSaving(false)
    if (error) { Alert.alert(t('common.error'), error.message); return }
    onSaved({ title: title.trim() || null, options: nextOptions, expires_at: nextExpires })
  }

  const FIELD_ROWS: { key: keyof ShareFields; label: string }[] = [
    { key: 'values', label: t('sharePanel.fieldValues') },
    { key: 'location', label: t('sharePanel.fieldLocation') },
    { key: 'attributes', label: t('sharePanel.fieldAttributes') },
    { key: 'description', label: t('sharePanel.fieldDescription') },
    { key: 'insurance', label: t('sharePanel.fieldInsurance') },
  ]

  const durationLabel = DURATIONS.find(d => d.days === expiresDays)?.labelKey ?? 'sharePanel.durationNever'

  return (
    <FormSheet visible={visible} animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.handle} />
        <Text style={s.title}>{t('shares.editTitle')}</Text>
        <Text style={s.help}>{t('shares.editHelp')}</Text>

        <SheetScrollView style={s.body}>
          <View style={s.section}>
            <Text style={s.sectionLabel}>{t('sharePanel.shareName')}</Text>
            <View style={s.field}>
              <TextInput
                style={s.input}
                value={title}
                onChangeText={setTitle}
                placeholder={t('sharePanel.shareName')}
                placeholderTextColor={Colors.textTertiary}
              />
            </View>

            <TouchableOpacity style={s.field} onPress={() => setDurationMenuOpen(true)} activeOpacity={0.7}>
              <Text style={s.inputValue}>{t(durationLabel)}</Text>
            </TouchableOpacity>
          </View>

          <View style={s.section}>
            <Text style={s.sectionLabel}>{t('sharePanel.fieldsLabel')}</Text>
            <Text style={s.sectionHelp}>{t('sharePanel.fieldsHelp')}</Text>
            {FIELD_ROWS.map(row => (
              <View key={row.key} style={s.row}>
                <Text style={s.rowLabel}>{row.label}</Text>
                <Switch
                  value={fields[row.key]}
                  onValueChange={v => setFields(prev => ({ ...prev, [row.key]: v }))}
                  trackColor={{ false: Colors.borderLight, true: Colors.accent }}
                  thumbColor="white"
                  style={s.switch}
                />
              </View>
            ))}
          </View>

          <View style={s.section}>
            <Text style={s.sectionLabel}>{t('sharePanel.filesLabel')}</Text>
            <View style={s.row}>
              <Text style={s.rowLabel}>{t('sharePanel.optDownload')}</Text>
              <Switch
                value={allowDownload}
                onValueChange={setAllowDownload}
                trackColor={{ false: Colors.borderLight, true: Colors.accent }}
                thumbColor="white"
                style={s.switch}
              />
            </View>
            <View style={s.row}>
              <Text style={s.rowLabel}>{t('sharePanel.optDocuments')}</Text>
              <Switch
                value={includeDocuments}
                onValueChange={setIncludeDocuments}
                trackColor={{ false: Colors.borderLight, true: Colors.accent }}
                thumbColor="white"
                style={s.switch}
              />
            </View>
          </View>

          {/* Mot de passe : l'empreinte est calculée côté serveur, l'app ne
              peut que la retirer. Poser un nouveau mot de passe suppose de
              recréer le lien — c'est dit plutôt que deviné. */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>{t('sharePanel.optPassword')}</Text>
            <View style={s.row}>
              <Lock size={14} color={passwordProtected ? Colors.accent : Colors.textTertiary} strokeWidth={2} />
              <Text style={s.rowLabel}>
                {passwordProtected ? t('shares.passwordOn') : t('shares.passwordOff')}
              </Text>
              <Switch
                value={passwordProtected}
                onValueChange={v => { if (!v) setPasswordProtected(false) }}
                disabled={!passwordProtected}
                trackColor={{ false: Colors.borderLight, true: Colors.accent }}
                thumbColor="white"
                style={s.switch}
              />
            </View>
            {!passwordProtected && <Text style={s.sectionHelp}>{t('shares.passwordHint')}</Text>}
          </View>
        </SheetScrollView>

        <View style={s.footer}>
          <TouchableOpacity style={s.btnGhost} onPress={onClose} activeOpacity={0.8}>
            <Text style={s.btnGhostText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.btnPrimary} onPress={save} disabled={saving} activeOpacity={0.85}>
            {saving
              ? <ActivityIndicator color="white" size="small" />
              : <Text style={s.btnPrimaryText}>{t('common.validate')}</Text>}
          </TouchableOpacity>
        </View>
      </View>

      <ActionSheet
        visible={durationMenuOpen}
        onClose={() => setDurationMenuOpen(false)}
        options={[
          ...DURATIONS.map(d => ({
            label: t(d.labelKey),
            selected: d.days === expiresDays,
            onPress: () => setExpiresDays(d.days),
          })),
          { label: t('common.cancel'), cancel: true, onPress: () => {} },
        ]}
      />
    </FormSheet>
  )
}

const s = StyleSheet.create({
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(26, 22, 18, 0.4)',
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: Colors.background,
    borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl,
    paddingTop: Spacing.sm, paddingBottom: Spacing.lg, paddingHorizontal: Spacing.lg,
  },
  handle: {
    alignSelf: 'center', width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.border, marginBottom: Spacing.md,
  },
  title: { fontSize: Typography.lg, fontWeight: Typography.semibold, color: Colors.textPrimary },
  help: {
    fontSize: Typography.sm, color: Colors.textSecondary,
    lineHeight: Typography.sm * Typography.relaxed, marginTop: 4,
  },
  body: { marginTop: Spacing.md },

  section: { marginBottom: Spacing.lg },
  sectionLabel: {
    fontSize: Typography.xs, fontWeight: Typography.semibold,
    color: Colors.textTertiary, textTransform: 'uppercase',
    letterSpacing: 0.8, marginBottom: Spacing.sm,
  },
  sectionHelp: {
    fontSize: Typography.xs, color: Colors.textTertiary,
    lineHeight: Typography.xs * Typography.relaxed, marginTop: -Spacing.xs, marginBottom: Spacing.sm,
  },

  field: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingVertical: 11,
    marginBottom: Spacing.sm,
  },
  input: { fontSize: Typography.base, color: Colors.textPrimary, padding: 0 },
  inputValue: { fontSize: Typography.base, color: Colors.textPrimary },

  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 9 },
  rowLabel: { flex: 1, fontSize: Typography.sm, color: Colors.textSecondary },
  switch: { transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] },

  footer: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  btnGhost: {
    flex: 1, paddingVertical: 13, borderRadius: Radius.md, alignItems: 'center',
    backgroundColor: Colors.surface, borderWidth: 0.5, borderColor: Colors.border,
  },
  btnGhostText: { fontSize: Typography.base, color: Colors.textSecondary, fontWeight: Typography.medium },
  btnPrimary: {
    flex: 1, paddingVertical: 13, borderRadius: Radius.md, alignItems: 'center',
    backgroundColor: Colors.accent,
  },
  btnPrimaryText: { fontSize: Typography.base, color: Colors.textInverse, fontWeight: Typography.semibold },
})
