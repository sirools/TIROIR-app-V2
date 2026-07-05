import React, { useRef, useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Animated,
  ScrollView, Share, ActivityIndicator, Switch, TextInput,
} from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff } from 'lucide-react-native'
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

export function SharePanel({ visible, selectedObjects, collectionName, onClose, onDone }: SharePanelProps) {
  const { t } = useTranslation()
  const slideAnim = useRef(new Animated.Value(600)).current

  const [options, setOptions] = useState<ShareOptions>({
    password_protected: false,
    allow_download: false,
    include_documents: false,
  })
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const passwordAnim = useRef(new Animated.Value(0)).current
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [emailSent, setEmailSent] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (visible) {
      setGeneratedUrl(null)
      setCopied(false)
      setPassword('')
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

  const trimmedEmail = contactEmail.trim()
  const emailIsValid = trimmedEmail.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)

  async function generateLink() {
    if (generating) return
    if (options.password_protected && password.trim().length < 4) {
      // champ visible mais vide ou trop court
      return
    }
    if (!emailIsValid) return
    setGenerating(true)
    try {
      const { data, error } = await supabase.functions.invoke('create-share-link', {
        body: {
          object_ids: selectedObjects.map(o => o.id),
          title: collectionName,
          options: {
            ...options,
            password: options.password_protected ? password.trim() : undefined,
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

  const OPTION_ROWS: { key: keyof ShareOptions; label: string; sub?: string }[] = [
    { key: 'password_protected', label: t('sharePanel.optPassword') },
    { key: 'allow_download', label: t('sharePanel.optDownload') },
    { key: 'include_documents', label: t('sharePanel.optDocuments') },
  ]

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.handle} />
        <Text style={styles.title}>{t('sharePanel.title')}</Text>

        {!generatedUrl ? (
          <>
            {/* Objets sélectionnés */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t('sharePanel.selection')}</Text>
              <ScrollView style={styles.objectList} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                {selectedObjects.map(obj => (
                  <View key={obj.id} style={styles.objectRow}>
                    <View style={styles.objectThumb}>
                      <Text style={styles.objectThumbIcon}>📦</Text>
                    </View>
                    <Text style={styles.objectTitle} numberOfLines={1}>{obj.title}</Text>
                    <View style={styles.objectRemove}>
                      <Text style={styles.objectRemoveIcon}>⊖</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>

            {/* Destinataire */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t('sharePanel.recipient')}</Text>
              <View style={styles.contactField}>
                <TextInput
                  style={styles.contactInput}
                  value={contactName}
                  onChangeText={setContactName}
                  placeholder={t('sharePanel.recipientName')}
                  placeholderTextColor={Colors.textTertiary}
                  autoCorrect={false}
                  returnKeyType="next"
                />
              </View>
              <View style={styles.contactField}>
                <TextInput
                  style={styles.contactInput}
                  value={contactEmail}
                  onChangeText={setContactEmail}
                  placeholder={t('sharePanel.recipientEmail')}
                  placeholderTextColor={Colors.textTertiary}
                  autoCorrect={false}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  returnKeyType="next"
                />
              </View>
              {!emailIsValid && (
                <Text style={styles.contactError}>{t('sharePanel.invalidEmail')}</Text>
              )}
              <View style={styles.contactField}>
                <TextInput
                  style={styles.contactInput}
                  value={contactPhone}
                  onChangeText={setContactPhone}
                  placeholder={t('sharePanel.recipientPhone')}
                  placeholderTextColor={Colors.textTertiary}
                  autoCorrect={false}
                  keyboardType="phone-pad"
                  returnKeyType="done"
                />
              </View>
              {trimmedEmail.length > 0 && (
                <Text style={styles.contactHint}>
                  {t('sharePanel.emailAutoHint')}
                </Text>
              )}
            </View>

            {/* Options */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>{t('sharePanel.shareOptions')}</Text>
              {OPTION_ROWS.map(row => (
                <View key={row.key}>
                  <View style={styles.optionRow}>
                    <Text style={styles.optionLabel}>{row.label}</Text>
                    <Switch
                      value={options[row.key]}
                      onValueChange={() => toggleOption(row.key)}
                      trackColor={{ false: Colors.borderLight, true: Colors.accent }}
                      thumbColor="white"
                      style={styles.switch}
                    />
                  </View>

                  {/* Champ mot de passe animé */}
                  {row.key === 'password_protected' && (
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
                  )}
                </View>
              ))}
            </View>

            {/* CTA */}
            <TouchableOpacity
              style={[styles.generateBtn, (generating || (options.password_protected && password.trim().length < 4) || !emailIsValid) && styles.generateBtnDisabled]}
              onPress={generateLink}
              disabled={generating || (options.password_protected && password.trim().length < 4) || !emailIsValid}
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

  section: { marginBottom: Spacing.lg },
  sectionLabel: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },

  objectList: { maxHeight: 160 },
  objectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  objectThumb: {
    width: 36, height: 36,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceWarm,
    alignItems: 'center', justifyContent: 'center',
  },
  objectThumbIcon: { fontSize: 18 },
  objectTitle: { flex: 1, fontSize: Typography.base, color: Colors.textPrimary },
  objectRemove: { padding: 4 },
  objectRemoveIcon: { fontSize: 18, color: Colors.textTertiary },

  contactField: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    marginBottom: Spacing.sm,
  },
  contactInput: {
    fontSize: Typography.sm,
    color: Colors.textPrimary,
    padding: 0,
  },
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
