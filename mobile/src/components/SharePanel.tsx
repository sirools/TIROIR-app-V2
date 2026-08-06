import React, { useRef, useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Animated, Image,
  ScrollView, Share, ActivityIndicator, Switch, TextInput,
} from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, Plus, X, ChevronRight, ChevronLeft } from 'lucide-react-native'
import { ActionSheet } from '@/components/ui/ActionSheet'
import { supabase } from '@/lib/supabase'
import { Colors, Typography, Spacing, Radius } from '@/components/ui/tokens'
import { TiroirObject } from '@/types/database'

interface ShareOptions {
  password_protected: boolean
  allow_download: boolean
  include_documents: boolean
}

interface SharePanelProps {
  visible: boolean
  selectedObjects: TiroirObject[]
  collectionName: string
  onClose: () => void
  onDone: () => void
}

/** Champs de contact ajoutés à la demande, pas imposés d'emblée. */
type InfoField = 'name' | 'email' | 'phone' | 'duration'

/**
 * Blocs d'informations que le partage expose ou non.
 *
 * Ce qui reste toujours visible — titre, photo, statut, date d'ajout —
 * n'est pas listé : c'est ce qui identifie l'objet, un partage qui le
 * masquerait ne montrerait plus rien.
 */
interface ShareFields {
  values: boolean
  location: boolean
  attributes: boolean
  description: boolean
  insurance: boolean
}

const DEFAULT_FIELDS: ShareFields = {
  values: true, location: true, attributes: true, description: true, insurance: true,
}

/** Durées proposées. `null` = sans expiration. */
const DURATIONS: { days: number | null; labelKey: string }[] = [
  { days: 7, labelKey: 'sharePanel.duration7' },
  { days: 30, labelKey: 'sharePanel.duration30' },
  { days: 90, labelKey: 'sharePanel.duration90' },
  { days: null, labelKey: 'sharePanel.durationNever' },
]

/**
 * Ligne de saisie ajoutée à la demande, retirable.
 *
 * Définie au niveau module et NON dans le corps de SharePanel : un composant
 * déclaré à l'intérieur change d'identité à chaque rendu, React démonte donc
 * le TextInput et le remonte — le champ perd le focus après chaque caractère.
 */
function InfoInput({
  value, onChangeText, placeholder, onRemove, ...rest
}: {
  value: string
  onChangeText: (v: string) => void
  placeholder: string
  onRemove: () => void
} & Partial<React.ComponentProps<typeof TextInput>>) {
  return (
    <View style={styles.contactField}>
      <TextInput
        style={styles.contactInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textTertiary}
        autoCorrect={false}
        {...rest}
      />
      <TouchableOpacity onPress={onRemove} hitSlop={10}>
        <X size={15} color={Colors.textTertiary} strokeWidth={2} />
      </TouchableOpacity>
    </View>
  )
}

export function SharePanel({ visible, selectedObjects, collectionName, onClose, onDone }: SharePanelProps) {
  const { t } = useTranslation()
  const slideAnim = useRef(new Animated.Value(600)).current

  /** Le tiroir a deux pages : les réglages fins vivent derrière, pas dessous. */
  const [page, setPage] = useState<'main' | 'advanced'>('main')

  const [options, setOptions] = useState<ShareOptions>({
    password_protected: false,
    allow_download: false,
    include_documents: false,
  })
  const [fields, setFields] = useState<ShareFields>(DEFAULT_FIELDS)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const passwordAnim = useRef(new Animated.Value(0)).current

  const [shareName, setShareName] = useState('')
  const [activeFields, setActiveFields] = useState<InfoField[]>([])
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [durationMenuOpen, setDurationMenuOpen] = useState(false)
  const [expiresDays, setExpiresDays] = useState<number | null>(null)

  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [emailSent, setEmailSent] = useState(false)
  const [copied, setCopied] = useState(false)
  const [coverUrls, setCoverUrls] = useState<Record<string, string>>({})

  useEffect(() => {
    if (visible) {
      setPage('main')
      setGeneratedUrl(null)
      setCopied(false)
      setPassword('')
      setShareName(collectionName ?? '')
      setActiveFields([])
      setExpiresDays(null)
      setFields(DEFAULT_FIELDS)
      setContactName('')
      setContactEmail('')
      setContactPhone('')
      setEmailSent(false)
      Animated.spring(slideAnim, {
        toValue: 0, useNativeDriver: true, damping: 22, mass: 0.9,
      }).start()
    } else {
      Animated.timing(slideAnim, { toValue: 600, duration: 250, useNativeDriver: true }).start()
    }
  }, [visible])

  // Vignettes de la sélection : le panneau affichait un carton pour tous.
  useEffect(() => {
    if (!visible || selectedObjects.length === 0) return
    let cancelled = false
    ;(async () => {
      const { data: rows } = await supabase
        .from('object_images')
        .select('object_id, storage_path')
        .in('object_id', selectedObjects.map(o => o.id))
        .eq('is_cover', true)
      if (!rows?.length || cancelled) return
      const map: Record<string, string> = {}
      await Promise.all(rows.map(async row => {
        const { data } = await supabase.storage.from('object-images').createSignedUrl(row.storage_path, 3600)
        if (data?.signedUrl) map[row.object_id] = data.signedUrl
      }))
      if (!cancelled) setCoverUrls(map)
    })()
    return () => { cancelled = true }
  }, [visible, selectedObjects.map(o => o.id).join(',')])

  function toggleOption(key: keyof ShareOptions) {
    const next = !options[key]
    setOptions(prev => ({ ...prev, [key]: next }))
    if (key === 'password_protected') {
      Animated.spring(passwordAnim, {
        toValue: next ? 1 : 0,
        useNativeDriver: false,
        damping: 20,
        mass: 0.8,
      }).start()
      if (!next) setPassword('')
    }
  }

  function addField(field: InfoField) {
    setAddMenuOpen(false)
    setActiveFields(prev => prev.includes(field) ? prev : [...prev, field])
    if (field === 'duration') setDurationMenuOpen(true)
  }

  function removeField(field: InfoField) {
    setActiveFields(prev => prev.filter(f => f !== field))
    if (field === 'name') setContactName('')
    if (field === 'email') setContactEmail('')
    if (field === 'phone') setContactPhone('')
    if (field === 'duration') setExpiresDays(null)
  }

  const trimmedEmail = contactEmail.trim()
  const emailIsValid = trimmedEmail.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)
  const blocked = generating || (options.password_protected && password.trim().length < 4) || !emailIsValid

  const durationLabel = DURATIONS.find(d => d.days === expiresDays)?.labelKey ?? 'sharePanel.durationNever'

  async function generateLink() {
    if (generating || blocked) return
    setGenerating(true)
    try {
      const { data, error } = await supabase.functions.invoke('create-share-link', {
        body: {
          object_ids: selectedObjects.map(o => o.id),
          title: shareName.trim() || collectionName,
          options: {
            ...options,
            password: options.password_protected ? password.trim() : undefined,
            expires_days: activeFields.includes('duration') ? expiresDays ?? undefined : undefined,
            fields,
          },
          contact: {
            name: contactName.trim() || undefined,
            email: trimmedEmail || undefined,
            phone: contactPhone.trim() || undefined,
          },
        },
      })
      if (error) throw error
      setGeneratedUrl(data.url)
      setEmailSent(Boolean(data.email_sent))
    } catch {
      // keep generating=false, show nothing
    } finally {
      setGenerating(false)
    }
  }

  async function copyLink() {
    if (!generatedUrl) return
    await Clipboard.setStringAsync(generatedUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function shareLink() {
    if (!generatedUrl) return
    await Share.share({ url: generatedUrl, message: generatedUrl })
  }

  const FIELD_ROWS: { key: keyof ShareFields; label: string }[] = [
    { key: 'values', label: t('sharePanel.fieldValues') },
    { key: 'location', label: t('sharePanel.fieldLocation') },
    { key: 'attributes', label: t('sharePanel.fieldAttributes') },
    { key: 'description', label: t('sharePanel.fieldDescription') },
    { key: 'insurance', label: t('sharePanel.fieldInsurance') },
  ]

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.handle} />

        {page === 'advanced' ? (
          <>
            <TouchableOpacity style={styles.backRow} onPress={() => setPage('main')} hitSlop={8}>
              <ChevronLeft size={18} color={Colors.textPrimary} strokeWidth={2.2} />
              <Text style={styles.title}>{t('sharePanel.advanced')}</Text>
            </TouchableOpacity>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>{t('sharePanel.fieldsLabel')}</Text>
                <Text style={styles.sectionHelp}>{t('sharePanel.fieldsHelp')}</Text>
                {FIELD_ROWS.map(row => (
                  <View key={row.key} style={styles.optionRow}>
                    <Text style={styles.optionLabel}>{row.label}</Text>
                    <Switch
                      value={fields[row.key]}
                      onValueChange={v => setFields(prev => ({ ...prev, [row.key]: v }))}
                      trackColor={{ false: Colors.borderLight, true: Colors.accent }}
                      thumbColor="white"
                      style={styles.switch}
                    />
                  </View>
                ))}
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionLabel}>{t('sharePanel.filesLabel')}</Text>
                <View style={styles.optionRow}>
                  <Text style={styles.optionLabel}>{t('sharePanel.optDownload')}</Text>
                  <Switch
                    value={options.allow_download}
                    onValueChange={() => toggleOption('allow_download')}
                    trackColor={{ false: Colors.borderLight, true: Colors.accent }}
                    thumbColor="white"
                    style={styles.switch}
                  />
                </View>
                <View style={styles.optionRow}>
                  <Text style={styles.optionLabel}>{t('sharePanel.optDocuments')}</Text>
                  <Switch
                    value={options.include_documents}
                    onValueChange={() => toggleOption('include_documents')}
                    trackColor={{ false: Colors.borderLight, true: Colors.accent }}
                    thumbColor="white"
                    style={styles.switch}
                  />
                </View>
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.generateBtn} onPress={() => setPage('main')} activeOpacity={0.85}>
              <Text style={styles.generateBtnText}>{t('common.validate')}</Text>
            </TouchableOpacity>
          </>
        ) : !generatedUrl ? (
          <>
            <Text style={styles.title}>{t('sharePanel.title')}</Text>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Sélection — une bande qu'on balaye du pouce plutôt qu'une
                  liste verticale qui mange la moitié du tiroir. */}
              <View style={styles.section}>
                <View style={styles.sectionHead}>
                  <Text style={styles.sectionLabel}>{t('sharePanel.selection')}</Text>
                  <Text style={styles.sectionCount}>
                    {t('common.objects', { count: selectedObjects.length })}
                  </Text>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.stripRow}
                >
                  {selectedObjects.map(obj => (
                    <View key={obj.id} style={styles.miniCard}>
                      <View style={styles.miniCover}>
                        {coverUrls[obj.id]
                          ? <Image source={{ uri: coverUrls[obj.id] }} style={styles.miniImg} resizeMode="cover" />
                          : <Text style={styles.miniPlaceholder}>📦</Text>}
                      </View>
                      <Text style={styles.miniTitle} numberOfLines={1}>{obj.title}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>

              {/* Informations */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>{t('sharePanel.infos')}</Text>

                <View style={styles.contactField}>
                  <TextInput
                    style={styles.contactInput}
                    value={shareName}
                    onChangeText={setShareName}
                    placeholder={t('sharePanel.shareName')}
                    placeholderTextColor={Colors.textTertiary}
                    returnKeyType="next"
                  />
                </View>

                {activeFields.includes('name') && (
                  <InfoInput
                    onRemove={() => removeField('name')}
                    value={contactName}
                    onChangeText={setContactName}
                    placeholder={t('sharePanel.recipientName')}
                    returnKeyType="next"
                  />
                )}
                {activeFields.includes('email') && (
                  <>
                    <InfoInput
                      onRemove={() => removeField('email')}
                      value={contactEmail}
                      onChangeText={setContactEmail}
                      placeholder={t('sharePanel.recipientEmail')}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      returnKeyType="next"
                    />
                    {!emailIsValid && <Text style={styles.contactError}>{t('sharePanel.invalidEmail')}</Text>}
                    {trimmedEmail.length > 0 && emailIsValid && (
                      <Text style={styles.contactHint}>{t('sharePanel.emailAutoHint')}</Text>
                    )}
                  </>
                )}
                {activeFields.includes('phone') && (
                  <InfoInput
                    onRemove={() => removeField('phone')}
                    value={contactPhone}
                    onChangeText={setContactPhone}
                    placeholder={t('sharePanel.recipientPhone')}
                    keyboardType="phone-pad"
                    returnKeyType="done"
                  />
                )}
                {activeFields.includes('duration') && (
                  <TouchableOpacity
                    style={styles.contactField}
                    onPress={() => setDurationMenuOpen(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.contactValue}>{t(durationLabel)}</Text>
                    <TouchableOpacity onPress={() => removeField('duration')} hitSlop={10}>
                      <X size={15} color={Colors.textTertiary} strokeWidth={2} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                )}

                {activeFields.length < 4 && (
                  <TouchableOpacity style={styles.addBtn} onPress={() => setAddMenuOpen(true)} activeOpacity={0.7}>
                    <Plus size={14} color={Colors.accent} strokeWidth={2.4} />
                    <Text style={styles.addBtnText}>{t('sharePanel.addField')}</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Paramètres */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>{t('sharePanel.settings')}</Text>
                <View style={styles.optionRow}>
                  <Text style={styles.optionLabel}>{t('sharePanel.optPassword')}</Text>
                  <Switch
                    value={options.password_protected}
                    onValueChange={() => toggleOption('password_protected')}
                    trackColor={{ false: Colors.borderLight, true: Colors.accent }}
                    thumbColor="white"
                    style={styles.switch}
                  />
                </View>

                <Animated.View style={{
                  overflow: 'hidden',
                  maxHeight: passwordAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 64] }),
                  opacity: passwordAnim,
                  marginBottom: passwordAnim.interpolate({ inputRange: [0, 1], outputRange: [0, Spacing.sm] }),
                }}>
                  <View style={styles.passwordRow}>
                    <TextInput
                      style={styles.passwordInput}
                      value={password}
                      onChangeText={setPassword}
                      placeholder={t('sharePanel.passwordPlaceholder')}
                      placeholderTextColor={Colors.textTertiary}
                      secureTextEntry={!showPassword}
                      autoCorrect={false}
                      autoCapitalize="none"
                      returnKeyType="done"
                    />
                    <TouchableOpacity onPress={() => setShowPassword(p => !p)} hitSlop={8}>
                      {showPassword
                        ? <EyeOff size={18} color={Colors.textTertiary} strokeWidth={1.5} />
                        : <Eye size={18} color={Colors.textTertiary} strokeWidth={1.5} />
                      }
                    </TouchableOpacity>
                  </View>
                </Animated.View>

                <TouchableOpacity style={styles.navRow} onPress={() => setPage('advanced')} activeOpacity={0.7}>
                  <Text style={styles.optionLabel}>{t('sharePanel.advanced')}</Text>
                  <ChevronRight size={17} color={Colors.textTertiary} strokeWidth={2} />
                </TouchableOpacity>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.generateBtn, blocked && styles.generateBtnDisabled]}
              onPress={generateLink}
              disabled={blocked}
              activeOpacity={0.85}
            >
              {generating
                ? <ActivityIndicator color="white" />
                : <Text style={styles.generateBtnText}>{t('sharePanel.generate')}</Text>
              }
            </TouchableOpacity>
          </>
        ) : (
          /* Succès */
          <View style={styles.successContainer}>
            <View style={styles.successIcon}>
              <Text style={styles.successCheck}>✓</Text>
            </View>
            <Text style={styles.successTitle}>{t('sharePanel.successTitle')}</Text>

            <TouchableOpacity style={styles.linkBox} onPress={copyLink} activeOpacity={0.8}>
              <Text style={styles.linkUrl} numberOfLines={1}>{generatedUrl.replace('https://', '')}</Text>
              <Text style={styles.linkCopyIcon}>{copied ? '✓' : '⎘'}</Text>
            </TouchableOpacity>

            {emailSent && trimmedEmail.length > 0 && (
              <Text style={styles.emailSentBadge}>{t('sharePanel.emailSentBadge', { email: trimmedEmail })}</Text>
            )}

            <Text style={styles.successSub}>{t('sharePanel.sendNow')}</Text>

            <TouchableOpacity style={styles.shareBtn} onPress={shareLink} activeOpacity={0.85}>
              <Text style={styles.shareBtnText}>{t('sharePanel.share')}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.laterBtn} onPress={onDone} activeOpacity={0.75}>
              <Text style={styles.laterBtnText}>{t('sharePanel.later')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>

      <ActionSheet
        visible={addMenuOpen}
        onClose={() => setAddMenuOpen(false)}
        options={[
          ...(['name', 'email', 'phone', 'duration'] as InfoField[])
            .filter(f => !activeFields.includes(f))
            .map(f => ({ label: t(`sharePanel.field_${f}`), onPress: () => addField(f) })),
          { label: t('common.cancel'), cancel: true, onPress: () => {} },
        ]}
      />

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
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 40,
    maxHeight: '85%',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.borderLight,
    alignSelf: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },

  backRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },

  section: { marginBottom: Spacing.lg },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sectionCount: {
    fontSize: Typography.xs, color: Colors.textTertiary,
    marginBottom: Spacing.sm,
  },
  sectionHelp: {
    fontSize: Typography.xs, color: Colors.textTertiary,
    lineHeight: Typography.xs * Typography.relaxed,
    marginTop: -Spacing.xs, marginBottom: Spacing.sm,
  },

  // Bande de sélection : on balaye le contenu du partage d'un coup d'œil.
  stripRow: { flexDirection: 'row', gap: Spacing.sm, paddingRight: Spacing.sm },
  miniCard: { width: 76, gap: 5 },
  miniCover: {
    width: 76, height: 76,
    borderRadius: Radius.md,
    backgroundColor: Colors.surfaceWarm,
    borderWidth: 0.5, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  miniImg: { width: '100%', height: '100%' },
  miniPlaceholder: { fontSize: 26 },
  miniTitle: { fontSize: 10, color: Colors.textSecondary, lineHeight: 13 },

  navRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: Colors.borderLight,
    marginTop: Spacing.xs,
  },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 10, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed',
  },
  addBtnText: { fontSize: Typography.sm, color: Colors.accent, fontWeight: Typography.semibold },
  sectionLabel: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },


  contactField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    marginBottom: Spacing.sm,
  },
  contactInput: {
    flex: 1,
    fontSize: Typography.sm,
    color: Colors.textPrimary,
    padding: 0,
  },
  contactValue: { flex: 1, fontSize: Typography.sm, color: Colors.textPrimary },
  contactError: {
    fontSize: Typography.xs,
    color: '#DC2626',
    marginTop: -Spacing.xs,
    marginBottom: Spacing.sm,
  },
  contactHint: {
    fontSize: Typography.xs,
    color: Colors.textTertiary,
    marginTop: -Spacing.xs,
  },

  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  optionLabel: { flex: 1, fontSize: Typography.sm, color: Colors.textSecondary },
  switch: { transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] },

  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
  },
  passwordInput: {
    flex: 1,
    fontSize: Typography.sm,
    color: Colors.textPrimary,
    padding: 0,
  },

  generateBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  generateBtnDisabled: { opacity: 0.6 },
  generateBtnText: {
    color: 'white',
    fontSize: Typography.base,
    fontWeight: Typography.bold,
    letterSpacing: 0.8,
  },

  // Success state
  successContainer: { alignItems: 'center', gap: Spacing.md, paddingTop: Spacing.md },
  successIcon: {
    width: 64, height: 64, borderRadius: 32,
    borderWidth: 2, borderColor: '#16A34A',
    alignItems: 'center', justifyContent: 'center',
  },
  successCheck: { fontSize: 28, color: '#16A34A', fontWeight: '700' },
  successTitle: { fontSize: Typography.xl, fontWeight: Typography.bold, color: Colors.textPrimary },

  linkBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    gap: Spacing.sm,
    width: '100%',
  },
  linkUrl: { flex: 1, fontSize: Typography.sm, color: Colors.accent, fontWeight: Typography.medium },
  linkCopyIcon: { fontSize: 18, color: Colors.textTertiary },

  successSub: { fontSize: Typography.sm, color: Colors.textSecondary },
  emailSentBadge: { fontSize: Typography.sm, color: '#16A34A', fontWeight: Typography.medium },

  shareBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  shareBtnText: { color: 'white', fontSize: Typography.base, fontWeight: Typography.bold, letterSpacing: 0.8 },

  laterBtn: { paddingVertical: 12, alignItems: 'center', width: '100%' },
  laterBtnText: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
})
