import React, { useCallback, useRef, useState } from 'react'
import { View, Text, StyleSheet, TouchableOpacity, Alert, BackHandler } from 'react-native'
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Check } from 'lucide-react-native'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'
import { fetchOwnDrawerId } from '@/features/collections/ownDrawer'
import {
  METIER_AUTRE, METIERS_BY_USAGE, SUGGESTIONS, USAGES,
  isMetier, isUsage, suggestionFor, usageOfMetier, type Usage,
} from '@/features/onboarding/metiers'
import { completeOnboarding } from '@/features/onboarding/onboardingState'
import {
  FormScreen, Button, Input, dismissKeyboard,
  COLLECTION_COLORS, Colors, Typography, Spacing, Radius,
} from '@/components/ui'

/**
 * Onboarding : trois écrans après la première connexion — l'usage, le
 * métier, une première collection. Il ne s'ouvre qu'une fois (voir
 * `needsOnboarding`, appelé par le layout) et se rouvre depuis les
 * Paramètres (`?from=settings`), où il repart des réponses gardées.
 *
 * « Passer » quitte tout l'onboarding ; « Plus tard » quitte sans créer la
 * collection. Dans les deux cas, ce qui a été choisi est enregistré et
 * l'app s'ouvre : rien ici ne peut retenir l'utilisateur.
 */

const STEPS = 3
const USAGE_EMOJI: Record<Usage, string> = { perso: '🏡', creatif: '🎬', business: '💼' }
/** La pastille par défaut des collections (celle du composeur de l'accueil). */
const COLLECTION_COLOR = COLLECTION_COLORS[0]

export default function OnboardingScreen() {
  const router = useRouter()
  const { t } = useTranslation()
  const { user, profile, refreshProfile } = useAuth()
  const { from } = useLocalSearchParams<{ from?: string }>()
  const fromSettings = from === 'settings'

  const [step, setStep] = useState(0)
  const [usage, setUsage] = useState<Usage | null>(null)
  const [metier, setMetier] = useState<string | null>(null)
  const [metierAutre, setMetierAutre] = useState('')
  const [name, setName] = useState('')
  /** Un nom retouché à la main n'est plus remplacé par la suggestion. */
  const [nameEdited, setNameEdited] = useState(false)
  const [busy, setBusy] = useState<'create' | 'leave' | null>(null)

  // L'écran vit dans les onglets et reste monté : à chaque ouverture, il
  // repart du début, avec les réponses déjà gardées dans le profil (ou le
  // profil choisi sur le site, profiles.persona).
  const profileRef = useRef(profile)
  profileRef.current = profile
  useFocusEffect(useCallback(() => {
    const p = profileRef.current
    const savedMetier = p?.metier ?? (isMetier(p?.persona) ? p.persona : null) ?? null
    const savedUsage = isUsage(p?.usage) ? p.usage : usageOfMetier(savedMetier)
    setStep(0)
    setUsage(savedUsage)
    setMetier(savedUsage ? savedMetier : null)
    setMetierAutre(p?.metier_autre ?? '')
    setName('')
    setNameEdited(false)
    setBusy(null)
  }, []))

  const goBack = useCallback(() => {
    dismissKeyboard()
    if (step > 0) setStep(step - 1)
    else if (fromSettings) router.replace('/settings')
  }, [step, fromSettings, router])

  // Retour matériel d'Android : l'étape précédente, pas la sortie de l'app.
  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (step === 0 && !fromSettings) return false
      goBack()
      return true
    })
    return () => sub.remove()
  }, [step, fromSettings, goBack]))

  function chooseUsage(next: Usage) {
    if (next !== usage) {
      // La liste des métiers dépend de l'usage : un métier d'un autre usage ne tient plus.
      setMetier(null)
      setMetierAutre('')
    }
    setUsage(next)
  }

  function next() {
    dismissKeyboard()
    if (step === 1 && !nameEdited) {
      setName(t(`onboarding.collection.suggestions.${suggestionFor(usage, metier)}`))
    }
    setStep(step + 1)
  }

  async function leave(createCollection: boolean) {
    if (busy || !user) return
    dismissKeyboard()

    if (createCollection) {
      setBusy('create')
      const drawerId = await fetchOwnDrawerId(user.id)
      const { error } = drawerId
        ? await supabase.from('collections').insert({
            name: name.trim(),
            drawer_id: drawerId,
            user_id: user.id,
            emoji: SUGGESTIONS[suggestionFor(usage, metier)],
            icon_color: COLLECTION_COLOR,
          })
        : { error: { message: t('home.drawerNotFound') } }
      if (error) {
        // On reste sur l'écran : « Plus tard » permet toujours d'entrer.
        setBusy(null)
        Alert.alert(t('common.error'), error.message)
        return
      }
    } else {
      setBusy('leave')
    }

    await completeOnboarding(profile, user.id, { usage, metier, metierAutre })
    await refreshProfile().catch(() => undefined)
    router.replace(fromSettings ? '/settings' : '/')
  }

  const canContinue = step === 0 ? !!usage : step === 1 ? !!metier : name.trim().length > 0
  const showBack = step > 0 || fromSettings

  const header = (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        {showBack ? (
          <TouchableOpacity style={styles.backBtn} onPress={goBack} hitSlop={12} disabled={!!busy}>
            <ArrowLeft size={20} color={Colors.textPrimary} strokeWidth={1.8} />
            <Text style={styles.backText}>{t('common.back')}</Text>
          </TouchableOpacity>
        ) : <View />}
        <TouchableOpacity onPress={() => leave(false)} hitSlop={12} disabled={!!busy}>
          <Text style={styles.skipText}>{t('onboarding.skip')}</Text>
        </TouchableOpacity>
      </View>
      <View
        style={styles.progress}
        accessibilityRole="progressbar"
        accessibilityLabel={t('onboarding.progress', { step: step + 1, total: STEPS })}
      >
        {Array.from({ length: STEPS }, (_, i) => (
          <View key={i} style={[styles.progressSegment, i <= step && styles.progressSegmentDone]} />
        ))}
      </View>
    </View>
  )

  const footer = step < 2 ? (
    <View style={styles.footer}>
      <Button label={t('onboarding.continue')} onPress={next} disabled={!canContinue} />
    </View>
  ) : (
    <View style={styles.footer}>
      <Button
        label={t('onboarding.collection.create')}
        onPress={() => leave(true)}
        disabled={!canContinue || busy === 'leave'}
        loading={busy === 'create'}
      />
      <TouchableOpacity style={styles.laterBtn} onPress={() => leave(false)} disabled={!!busy} hitSlop={8}>
        <Text style={styles.laterText}>{t('onboarding.collection.later')}</Text>
      </TouchableOpacity>
    </View>
  )

  return (
    <FormScreen header={header} footer={footer} contentContainerStyle={styles.content}>
      {step === 0 && (
        <>
          <Text style={styles.title}>{t('onboarding.usage.title')}</Text>
          <Text style={styles.subtitle}>{t('onboarding.usage.subtitle')}</Text>
          <View style={styles.options}>
            {USAGES.map(u => (
              <Option
                key={u}
                emoji={USAGE_EMOJI[u]}
                label={t(`onboarding.usage.${u}`)}
                hint={t(`onboarding.usage.${u}Hint`)}
                selected={usage === u}
                onPress={() => chooseUsage(u)}
              />
            ))}
          </View>
        </>
      )}

      {step === 1 && usage && (
        <>
          <Text style={styles.title}>
            {t(usage === 'perso' ? 'onboarding.metier.titlePerso' : 'onboarding.metier.title')}
          </Text>
          <Text style={styles.subtitle}>{t('onboarding.metier.subtitle')}</Text>
          <View style={styles.options}>
            {METIERS_BY_USAGE[usage].map(m => (
              <Option
                key={m}
                label={t(`onboarding.metier.names.${m}`)}
                selected={metier === m}
                onPress={() => { dismissKeyboard(); setMetier(m) }}
              />
            ))}
            <Option
              label={t('onboarding.metier.other')}
              selected={metier === METIER_AUTRE}
              onPress={() => setMetier(METIER_AUTRE)}
            />
          </View>
          {metier === METIER_AUTRE && (
            <Input
              label={t('onboarding.metier.otherLabel')}
              placeholder={t('onboarding.metier.otherPlaceholder')}
              value={metierAutre}
              onChangeText={setMetierAutre}
              maxLength={80}
              autoCapitalize="sentences"
              returnKeyType="done"
              onSubmitEditing={next}
              containerStyle={styles.field}
            />
          )}
        </>
      )}

      {step === 2 && (
        <>
          <Text style={styles.title}>{t('onboarding.collection.title')}</Text>
          <Text style={styles.subtitle}>{t('onboarding.collection.subtitle')}</Text>
          <View style={styles.collectionCard}>
            <View style={styles.collectionIcon}>
              <Text style={styles.collectionEmoji}>{SUGGESTIONS[suggestionFor(usage, metier)]}</Text>
            </View>
            <Input
              label={t('onboarding.collection.nameLabel')}
              value={name}
              onChangeText={v => { setName(v); setNameEdited(true) }}
              maxLength={60}
              returnKeyType="done"
              onSubmitEditing={() => { if (canContinue) leave(true) }}
              containerStyle={styles.collectionField}
            />
          </View>
        </>
      )}
    </FormScreen>
  )
}

function Option({ emoji, label, hint, selected, onPress }: {
  emoji?: string
  label: string
  hint?: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <TouchableOpacity
      style={[styles.option, selected && styles.optionSelected]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      {emoji ? (
        <View style={styles.optionIcon}><Text style={styles.optionEmoji}>{emoji}</Text></View>
      ) : null}
      <View style={styles.optionText}>
        <Text style={styles.optionLabel}>{label}</Text>
        {hint ? <Text style={styles.optionHint}>{hint}</Text> : null}
      </View>
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <Check size={14} color={Colors.textInverse} strokeWidth={3} /> : null}
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 32,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backText: { fontSize: Typography.base, color: Colors.textPrimary, fontWeight: Typography.medium },
  skipText: { fontSize: Typography.base, color: Colors.textSecondary, fontWeight: Typography.medium },

  progress: { flexDirection: 'row', gap: 6 },
  progressSegment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: Colors.border },
  progressSegmentDone: { backgroundColor: Colors.accent },

  content: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  title: {
    fontSize: Typography.xxl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    letterSpacing: -0.6,
  },
  subtitle: {
    marginTop: Spacing.sm,
    fontSize: Typography.base,
    color: Colors.textSecondary,
    lineHeight: 22,
  },

  options: { marginTop: Spacing.lg, gap: Spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 56,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  optionSelected: { borderColor: Colors.accent, backgroundColor: Colors.accentLight },
  optionIcon: {
    width: 44, height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionEmoji: { fontSize: 22, lineHeight: 28 },
  optionText: { flex: 1, gap: 2 },
  optionLabel: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  optionHint: { fontSize: Typography.sm, color: Colors.textSecondary, lineHeight: 19 },
  radio: {
    width: 22, height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: { borderColor: Colors.accent, backgroundColor: Colors.accent },

  field: { marginTop: Spacing.md },

  collectionCard: {
    marginTop: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.md,
  },
  collectionIcon: {
    width: 52, height: 52,
    borderRadius: Radius.md,
    backgroundColor: COLLECTION_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
  },
  collectionEmoji: { fontSize: 26, lineHeight: 34 },
  collectionField: { flex: 1 },

  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    gap: Spacing.xs,
  },
  laterBtn: { alignItems: 'center', paddingVertical: Spacing.sm },
  laterText: { fontSize: Typography.base, color: Colors.textSecondary, fontWeight: Typography.medium },
})
