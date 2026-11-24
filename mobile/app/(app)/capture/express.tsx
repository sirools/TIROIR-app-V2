// « Fiche express » : la brique d'IA hybride dans l'app.
// Une photo → l'iPhone propose la fiche tout de suite (même hors ligne),
// puis le cloud l'enrichit. Chaque information porte son badge, « Sur
// l'appareil » ou « Cloud ». Toute l'IA générative passe par le service
// hybridAI ; l'écran ne décide jamais où part une demande.
// L'écran n'est atteignable que dans le build hackathon.
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { View, Text, StyleSheet, Image, TouchableOpacity, Alert } from 'react-native'
import { Camera, Images, ChevronLeft } from 'lucide-react-native'
import * as ImagePicker from 'expo-image-picker'
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator'
import { useNetworkState } from 'expo-network'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Screen, Colors, Typography, Spacing, Radius, useToast } from '@/components/ui'
import {
  HACKATHON_BUILD, NoAiReachableError, appCheckDebugToken, hybridAI, isFirebaseConfigured, isInBuild,
  type AiSource, type OnDeviceStatus, type Photo,
} from '@/services/hybridAI'
import { nextStep, upsertDraft, type Draft } from '@/services/hybridAI/drafts'
import { readDrafts, writeDrafts } from '@/services/hybridAI/draftsStorage'
import { ObjectQuotaError, addToInventory } from '@/services/hybridAI/inventory'
import { useAuth } from '@/features/auth/AuthContext'

/** Largeur de la photo envoyée au modèle. */
const MAX_WIDTH = 1024

type Phase = 'running' | 'waiting' | 'failed'

/** Réduit la photo et la passe en JPEG, en base64. */
async function toPhoto(asset: ImagePicker.ImagePickerAsset): Promise<Photo> {
  const context = ImageManipulator.manipulate(asset.uri)
  if (asset.width > MAX_WIDTH) context.resize({ width: MAX_WIDTH })
  const rendered = await context.renderAsync()
  const saved = await rendered.saveAsync({ base64: true, format: SaveFormat.JPEG, compress: 0.82 })
  if (!saved.base64) throw new Error('Photo illisible')
  return { base64: saved.base64, mimeType: 'image/jpeg' }
}

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

function SourceBadge({ source }: { source: AiSource }) {
  const { t } = useTranslation()
  const onDevice = source === 'on_device'
  return (
    <View style={[styles.badge, onDevice ? styles.badgeDevice : styles.badgeCloud]}>
      <Text style={[styles.badgeText, { color: onDevice ? Colors.success : Colors.accent }]}>
        {onDevice ? t('express.badgeOnDevice') : t('express.badgeCloud')}
      </Text>
    </View>
  )
}

function Field({ label, source, children }: { label: string; source: AiSource; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldHead}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <SourceBadge source={source} />
      </View>
      {children}
    </View>
  )
}

export default function ExpressCardScreen() {
  const router = useRouter()
  const { t, i18n } = useTranslation()
  const network = useNetworkState()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [adding, setAdding] = useState(false)
  // Tant que l'état du réseau n'est pas connu, on le suppose présent.
  const online = network.isConnected !== false
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [device, setDevice] = useState<OnDeviceStatus | null>(null)
  const [phases, setPhases] = useState<Record<string, Phase>>({})
  const [debugToken, setDebugToken] = useState<string | null>(null)
  const draftsRef = useRef<Draft[]>([])
  const busy = useRef(new Set<string>())
  const ready = HACKATHON_BUILD && isInBuild() && isFirebaseConfigured()
  const locale = i18n.language

  const store = useCallback((next: Draft[]) => {
    const kept = writeDrafts(next)
    draftsRef.current = kept
    setDrafts(kept)
  }, [])
  const setPhase = (id: string, phase: Phase | null) =>
    setPhases(p => {
      const { [id]: _, ...rest } = p
      return phase ? { ...rest, [id]: phase } : rest
    })

  // Avance un brouillon d'autant d'étapes que possible : fiche rapide,
  // puis enrichissement. Sans réseau, il attend ; il reprendra tout seul.
  const advance = useCallback(async (id: string, isOnline: boolean) => {
    if (busy.current.has(id)) return
    busy.current.add(id)
    try {
      for (;;) {
        const draft = draftsRef.current.find(d => d.id === id)
        const step = draft ? nextStep(draft) : 'done'
        if (!draft || step === 'done') return setPhase(id, null)
        if (step === 'enrich' && !isOnline) return setPhase(id, 'waiting')
        setPhase(id, 'running')
        const options = { locale, online: isOnline }
        const updated: Draft = step === 'quick'
          ? { ...draft, quick: await hybridAI.quickCard(draft.photo, options) }
          : { ...draft, enrichment: await hybridAI.enrich(draft.photo, draft.quick!.data, options) }
        // Le brouillon a pu être supprimé pendant l'appel.
        if (!draftsRef.current.some(d => d.id === id)) return
        store(upsertDraft(draftsRef.current, updated))
      }
    } catch (error) {
      if (!(error instanceof NoAiReachableError)) console.warn('[fiche-express]', error)
      setPhase(id, error instanceof NoAiReachableError ? 'waiting' : 'failed')
    } finally {
      busy.current.delete(id)
    }
  }, [locale, store])

  // Au chargement : brouillons de l'appareil, IA embarquée, jeton de debug.
  useEffect(() => {
    let cancelled = false
    readDrafts().then(saved => {
      if (cancelled) return
      draftsRef.current = saved
      setDrafts(saved)
      setCurrentId(saved[0]?.id ?? null)
    })
    hybridAI.onDeviceStatus(locale).then(status => { if (!cancelled) setDevice(status) })
    if (ready) setDebugToken(appCheckDebugToken())
    return () => { cancelled = true }
  }, [locale, ready])

  // Le réseau change : les brouillons en attente reprennent seuls.
  useEffect(() => {
    if (!ready) return
    for (const d of draftsRef.current) if (nextStep(d) !== 'done') void advance(d.id, online)
  }, [advance, online, ready, drafts.length])

  async function pick(from: 'camera' | 'library') {
    if (from === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync()
      if (status !== 'granted') {
        return Alert.alert(t('capture.permissionDeniedTitle'), t('capture.permissionCamera'))
      }
    }
    const result = from === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 })
    if (result.canceled || !result.assets[0]) return
    let photo: Photo
    try {
      photo = await toPhoto(result.assets[0])
    } catch {
      return Alert.alert(t('express.photoFailed'))
    }
    const draft: Draft = { id: newId(), createdAt: Date.now(), photo, quick: null, enrichment: null }
    store(upsertDraft(draftsRef.current, draft))
    setCurrentId(draft.id)
    void advance(draft.id, online)
    hybridAI.onDeviceStatus(locale).then(setDevice)
  }

  // Ajoute la fiche complète à l'inventaire ; le brouillon garde l'identifiant de l'objet.
  async function addToTiroir(draft: Draft) {
    if (adding || !user || draft.objectId) return
    setAdding(true)
    try {
      const objectId = await addToInventory(draft, user.id)
      if (draftsRef.current.some(d => d.id === draft.id)) {
        store(upsertDraft(draftsRef.current, { ...draft, objectId }))
      }
      showToast(t('capture.created'))
    } catch (error) {
      if (error instanceof ObjectQuotaError) {
        Alert.alert(t('capture.objectQuotaTitle'), t('capture.objectQuotaBody'), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('capture.objectQuotaUpgrade'), onPress: () => router.push('/paywall') },
        ])
      } else {
        console.warn('[fiche-express] ajout', error)
        Alert.alert(t('express.addFailed'))
      }
    } finally {
      setAdding(false)
    }
  }

  function remove(id: string) {
    const next = draftsRef.current.filter(d => d.id !== id)
    store(next)
    setPhase(id, null)
    if (currentId === id) setCurrentId(next[0]?.id ?? null)
  }

  const current = drafts.find(d => d.id === currentId) ?? null
  const phase = current ? phases[current.id] : undefined
  const step = current ? nextStep(current) : 'done'
  const uri = (d: Draft) => `data:${d.photo.mimeType};base64,${d.photo.base64}`
  const euros = (n: number) => {
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)
    } catch {
      return `${n} €`
    }
  }
  const deviceText = device === 'available' ? t('express.deviceAvailable')
    : device === 'downloading' || device === 'downloadable' ? t('express.deviceDownloading')
    : t('express.deviceUnavailable')

  return (
    <Screen scroll contentStyle={styles.content}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t('common.back')}>
        <ChevronLeft size={22} color={Colors.textPrimary} strokeWidth={1.8} />
      </TouchableOpacity>

      <Text style={styles.title}>{t('express.title')}</Text>
      <Text style={styles.intro}>{t('express.intro')}</Text>

      <View style={styles.pills}>
        <View style={[styles.pill, online ? styles.pillOn : styles.pillOff]}>
          <Text style={[styles.pillText, { color: online ? Colors.success : Colors.error }]}>
            {online ? t('express.online') : t('express.offline')}
          </Text>
        </View>
        {device && (
          <View style={[styles.pill, device === 'available' && styles.pillOn]}>
            <Text style={[styles.pillText, device === 'available' && { color: Colors.success }]}>{deviceText}</Text>
          </View>
        )}
      </View>

      {!ready && (
        <Text style={styles.notice}>
          {HACKATHON_BUILD && isInBuild() ? t('express.notConfigured') : t('express.notInBuild')}
        </Text>
      )}

      {ready && (
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.button, styles.buttonPrimary]} onPress={() => pick('camera')} activeOpacity={0.8}>
            <Camera size={18} color={Colors.textInverse} strokeWidth={1.8} />
            <Text style={[styles.buttonText, { color: Colors.textInverse }]}>{t('express.takePhoto')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={() => pick('library')} activeOpacity={0.8}>
            <Images size={18} color={Colors.textPrimary} strokeWidth={1.8} />
            <Text style={styles.buttonText}>{t('express.library')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {current && (
        <View style={styles.card}>
          <Image source={{ uri: uri(current) }} style={styles.photo} accessibilityLabel={t('express.photoAlt')} />

          <View style={styles.steps}>
            <View style={styles.step}>
              <View style={[styles.dot, current.quick && styles.dotDone, step === 'quick' && phase === 'running' && styles.dotActive]} />
              <Text style={[styles.stepText, (current.quick || step === 'quick') && styles.stepTextOn]}>{t('express.stepQuick')}</Text>
              {current.quick && <SourceBadge source={current.quick.source} />}
            </View>
            <View style={styles.step}>
              <View style={[styles.dot, current.enrichment && styles.dotDone, step === 'enrich' && phase === 'running' && styles.dotActive]} />
              <Text style={[styles.stepText, (current.enrichment || step === 'enrich') && styles.stepTextOn]}>{t('express.stepEnrich')}</Text>
              {current.enrichment && <SourceBadge source={current.enrichment.source} />}
            </View>
          </View>

          <Text style={styles.state}>
            {step === 'done' && <Text style={styles.stateOk}>{t('express.complete')}</Text>}
            {step !== 'done' && current.quick && <Text style={styles.stateStrong}>{t('express.draft')} </Text>}
            {step === 'quick' && phase === 'running' && t('express.quickRunning')}
            {step === 'quick' && phase === 'waiting' && t('express.quickWaiting')}
            {step === 'enrich' && phase === 'running' && t('express.enrichRunning')}
            {step === 'enrich' && phase === 'waiting' && t('express.enrichWaiting')}
            {phase === 'failed' && <Text style={styles.stateFail}>{t('express.failed')}</Text>}
          </Text>
          {phase === 'failed' && (
            <TouchableOpacity onPress={() => void advance(current.id, online)}>
              <Text style={styles.link}>{t('express.retry')}</Text>
            </TouchableOpacity>
          )}

          {current.quick && (
            <>
              <Field label={t('express.name')} source={current.quick.source}>
                <Text style={styles.name}>{current.quick.data.name}</Text>
              </Field>
              <Field label={t('express.category')} source={current.quick.source}>
                <Text style={styles.value}>{current.quick.data.category}</Text>
              </Field>
              <Field label={t('express.description')} source={current.quick.source}>
                <Text style={styles.value}>{current.quick.data.description}</Text>
              </Field>
            </>
          )}

          {current.enrichment && (
            <View style={styles.enriched}>
              <Field label={t('express.detailed')} source={current.enrichment.source}>
                <Text style={styles.value}>{current.enrichment.data.detailedDescription}</Text>
              </Field>
              <Field label={t('express.value')} source={current.enrichment.source}>
                {current.enrichment.data.value ? (
                  <>
                    <Text style={styles.name}>
                      {t('express.valueRange', {
                        low: euros(current.enrichment.data.value.low),
                        high: euros(current.enrichment.data.value.high),
                      })}
                    </Text>
                    <Text style={styles.note}>{current.enrichment.data.value.note}</Text>
                    <Text style={[styles.note, styles.signed]}>{t('express.signedTorix')}</Text>
                  </>
                ) : (
                  <Text style={styles.value}>{t('express.valueNone')}</Text>
                )}
              </Field>
            </View>
          )}

          {step === 'done' && !current.objectId && (
            <TouchableOpacity
              style={[styles.button, styles.buttonPrimary, styles.add, (adding || !online) && styles.addOff]}
              onPress={() => void addToTiroir(current)}
              disabled={adding || !online}
              activeOpacity={0.8}
            >
              <Text style={[styles.buttonText, { color: Colors.textInverse }]}>
                {adding ? t('express.adding') : t('express.addToTiroir')}
              </Text>
            </TouchableOpacity>
          )}
          {current.objectId && (
            <View style={styles.added}>
              <Text style={styles.stateOk}>{t('express.added')}</Text>
              <TouchableOpacity onPress={() => router.push({ pathname: '/objects/[id]', params: { id: current.objectId! } })}>
                <Text style={[styles.link, styles.addedLink]}>{t('express.viewObject')}</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity onPress={() => remove(current.id)}>
            <Text style={[styles.link, styles.remove]}>{t('express.remove')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {drafts.length > 1 && (
        <View style={styles.list}>
          <Text style={styles.listTitle}>{t('express.drafts')}</Text>
          <View style={styles.thumbs}>
            {drafts.map(d => (
              <TouchableOpacity
                key={d.id}
                style={[styles.thumb, d.id === currentId && styles.thumbCurrent]}
                onPress={() => setCurrentId(d.id)}
                activeOpacity={0.8}
              >
                <Image source={{ uri: uri(d) }} style={styles.thumbImage} />
                <Text style={styles.thumbName} numberOfLines={1}>{d.quick?.data.name ?? t('express.draft')}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {debugToken && (
        <View style={styles.debug}>
          <Text style={styles.fieldLabel}>{t('express.debugTokenTitle')}</Text>
          <Text style={styles.debugToken} selectable>{debugToken}</Text>
          <Text style={styles.note}>{t('express.debugTokenHelp')}</Text>
        </View>
      )}

      <Text style={styles.privacy}>{t('express.privacy')}</Text>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  back: { width: 44, height: 44, justifyContent: 'center', marginLeft: -Spacing.sm },
  title: { fontSize: Typography.xxl, fontWeight: Typography.bold, color: Colors.textPrimary },
  intro: { fontSize: Typography.base, lineHeight: 22, color: Colors.textSecondary, marginTop: Spacing.sm },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.md },
  pill: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full,
    borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface,
  },
  pillOn: { borderColor: Colors.sage },
  pillOff: { borderColor: Colors.error, backgroundColor: Colors.errorLight },
  pillText: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textSecondary },
  notice: {
    marginTop: Spacing.md, padding: Spacing.md, borderRadius: Radius.md,
    backgroundColor: Colors.errorLight, color: Colors.error, fontSize: Typography.sm, lineHeight: 19,
  },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.lg },
  button: {
    flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    borderRadius: Radius.md, borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
  },
  buttonPrimary: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  buttonText: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  card: {
    marginTop: Spacing.lg, padding: Spacing.md, borderRadius: Radius.lg,
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderLight,
  },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: Radius.md, backgroundColor: Colors.surfaceWarm },
  steps: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md, marginTop: Spacing.md },
  step: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: Colors.border },
  dotDone: { backgroundColor: Colors.sage, borderColor: Colors.sage },
  dotActive: { borderColor: Colors.accent },
  stepText: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textTertiary },
  stepTextOn: { color: Colors.textPrimary },
  state: { fontSize: Typography.sm, lineHeight: 19, color: Colors.textSecondary, marginTop: Spacing.sm, minHeight: 19 },
  stateStrong: { fontWeight: Typography.bold, color: Colors.textPrimary },
  stateOk: { fontWeight: Typography.bold, color: Colors.success },
  stateFail: { color: Colors.error },
  field: { marginTop: Spacing.md },
  fieldHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 4 },
  fieldLabel: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textSecondary },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: Radius.full, borderWidth: 1 },
  badgeDevice: { backgroundColor: Colors.surfaceSubtle, borderColor: Colors.sage },
  badgeCloud: { backgroundColor: Colors.accentLight, borderColor: Colors.accent },
  badgeText: { fontSize: Typography.xs, fontWeight: Typography.bold },
  name: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },
  value: { fontSize: Typography.base, lineHeight: 22, color: Colors.textPrimary },
  note: { fontSize: Typography.sm, lineHeight: 19, color: Colors.textSecondary, marginTop: 4 },
  signed: { fontStyle: 'italic' },
  enriched: { marginTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.border },
  link: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.accent, textDecorationLine: 'underline', marginTop: Spacing.sm },
  remove: { color: Colors.textSecondary, marginTop: Spacing.md },
  add: { flex: 0, marginTop: Spacing.lg },
  addOff: { opacity: 0.5 },
  added: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.lg },
  addedLink: { marginTop: 0 },
  list: { marginTop: Spacing.lg },
  listTitle: { fontSize: Typography.md, fontWeight: Typography.bold, color: Colors.textPrimary, marginBottom: Spacing.sm },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  thumb: {
    width: 104, padding: 6, borderRadius: Radius.md, backgroundColor: Colors.surface,
    borderWidth: 1.5, borderColor: Colors.borderLight,
  },
  thumbCurrent: { borderColor: Colors.accent },
  thumbImage: { width: '100%', aspectRatio: 1, borderRadius: Radius.sm },
  thumbName: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textPrimary, marginTop: 4 },
  debug: {
    marginTop: Spacing.lg, padding: Spacing.md, borderRadius: Radius.md,
    backgroundColor: Colors.surfaceWarm, borderWidth: 1, borderColor: Colors.border,
  },
  debugToken: { fontSize: Typography.sm, color: Colors.textPrimary, marginTop: 4 },
  privacy: { fontSize: Typography.sm, lineHeight: 19, color: Colors.textSecondary, marginTop: Spacing.lg },
})
