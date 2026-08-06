import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import * as FileSystem from 'expo-file-system/legacy'
import { X, Camera, Images, AlertTriangle } from 'lucide-react-native'
import { supabase } from '@/lib/supabase'
import { Screen, Colors, Typography, Spacing, Radius } from '@/components/ui'

/**
 * Détecté par le modèle. Aucun champ n'est nullable : côté serveur une
 * absence se dit par une chaîne ou un tableau vide (les unions de types
 * passent mal en sortie structurée).
 */
interface DetectedObject {
  type: string
  variant: string
  title: string
  category: string
  quantity: number
  quantity_certain: boolean
  discernable: boolean
  confidence: 'low' | 'medium' | 'high'
  bbox: number[]
}

interface DetectionResult {
  scene_type: 'objects' | 'container'
  container_title: string
  container_contents: string
  uncountable: string
  objects: DetectedObject[]
  truncated: boolean
  _meta: {
    model: string
    input_tokens: number
    output_tokens: number
    cost_usd: number
    duration_ms: number
  }
}

/**
 * Toutes les images partent à 1568 px, le plafond de Haiku 4.5.
 *
 * Envoyer plus ne servirait à rien pour lui, et fausserait la comparaison
 * avec les modèles haute résolution : à taille d'entrée identique, l'écart
 * mesuré vient du modèle et non du cadrage.
 */
const BENCH_WIDTH = 1568

const MODELS = [
  { id: 'claude-haiku-4-5', label: 'Haiku 4.5' },
  { id: 'claude-sonnet-5', label: 'Sonnet 5' },
  { id: 'claude-opus-5', label: 'Opus 5' },
]

export default function SceneDetectionScreen() {
  const router = useRouter()
  const { t } = useTranslation()

  const [uri, setUri] = useState<string | null>(null)
  const [model, setModel] = useState(MODELS[0].id)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<DetectionResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function pick(from: 'camera' | 'library') {
    const perm = from === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (perm.status !== 'granted') {
      Alert.alert(t('capture.permissionDeniedTitle'),
        t(from === 'camera' ? 'capture.permissionCamera' : 'capture.permissionLibrary'))
      return
    }
    const res = from === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9 })
    if (res.canceled || !res.assets[0]) return
    setResult(null)
    setError(null)
    setUri(res.assets[0].uri)
  }

  async function analyse() {
    if (!uri || running) return
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const resized = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: BENCH_WIDTH } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
      )
      const data = await FileSystem.readAsStringAsync(resized.uri, {
        encoding: FileSystem.EncodingType.Base64,
      })

      const { data: res, error: fnError } = await supabase.functions.invoke('detect-scene', {
        body: { image: { data, media_type: 'image/jpeg' }, model },
      })
      if (fnError) throw new Error(fnError.message)
      if (res?.error) throw new Error(res.error.code)
      setResult(res as DetectionResult)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }

  const totalUnits = result?.objects.reduce((n, o) => n + o.quantity, 0) ?? 0

  return (
    <Screen edges={['top']} topColor={Colors.surface}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
          <X size={22} color={Colors.textPrimary} strokeWidth={2} />
        </TouchableOpacity>
        <View style={s.headerText}>
          <Text style={s.title}>{t('scene.title')}</Text>
          <Text style={s.subtitle}>{t('scene.subtitle')}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        {!uri ? (
          <View style={s.sources}>
            <TouchableOpacity style={s.source} onPress={() => pick('camera')} activeOpacity={0.8}>
              <Camera size={26} color={Colors.textPrimary} strokeWidth={1.5} />
              <Text style={s.sourceLabel}>{t('capture.takePhoto')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.source} onPress={() => pick('library')} activeOpacity={0.8}>
              <Images size={26} color={Colors.textPrimary} strokeWidth={1.5} />
              <Text style={s.sourceLabel}>{t('capture.library')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => pick('library')} activeOpacity={0.85}>
            <Image source={{ uri }} style={s.preview} resizeMode="cover" />
          </TouchableOpacity>
        )}

        {/* Sélecteur de modèle — instrument du banc, pas une option produit.
            Il disparaîtra quand le modèle sera arrêté. */}
        {uri && (
          <View style={s.modelRow}>
            {MODELS.map(m => (
              <TouchableOpacity
                key={m.id}
                style={[s.modelChip, model === m.id && s.modelChipOn]}
                onPress={() => setModel(m.id)}
                activeOpacity={0.7}
              >
                <Text style={[s.modelChipText, model === m.id && s.modelChipTextOn]}>{m.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {uri && (
          <TouchableOpacity
            style={[s.cta, running && s.ctaOff]}
            onPress={analyse}
            disabled={running}
            activeOpacity={0.85}
          >
            {running
              ? <ActivityIndicator color={Colors.textInverse} />
              : <Text style={s.ctaText}>{t('scene.analyse')}</Text>}
          </TouchableOpacity>
        )}

        {error && (
          <View style={s.errorBox}>
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        {result && (
          <>
            {/* Ce que le modèle n'a pas su compter, dit en clair plutôt que
                masqué derrière un chiffre qui aurait l'air sûr. */}
            {result.uncountable.length > 0 && (
              <View style={s.warnBox}>
                <AlertTriangle size={15} color="#C2410C" strokeWidth={2} />
                <Text style={s.warnText}>{result.uncountable}</Text>
              </View>
            )}

            {result.truncated && (
              <View style={s.warnBox}>
                <AlertTriangle size={15} color="#C2410C" strokeWidth={2} />
                <Text style={s.warnText}>{t('scene.truncated')}</Text>
              </View>
            )}

            {result.scene_type === 'container' && (
              <View style={s.containerBox}>
                <Text style={s.containerLabel}>{t('scene.containerSuggested')}</Text>
                <Text style={s.containerTitle}>{result.container_title}</Text>
                <Text style={s.containerContents}>{result.container_contents}</Text>
              </View>
            )}

            <Text style={s.resultCount}>
              {t('scene.resultCount', { types: result.objects.length, units: totalUnits })}
            </Text>

            {result.objects.map((o, i) => (
              <View key={i} style={s.row}>
                <View style={s.rowText}>
                  <Text style={s.rowTitle} numberOfLines={2}>{o.title}</Text>
                  <Text style={s.rowMeta}>
                    {[
                      o.type + (o.variant ? ` · ${o.variant}` : ''),
                      o.category,
                      t(`scene.confidence_${o.confidence}`),
                      o.discernable ? t('scene.discernable') : t('scene.notDiscernable'),
                      o.bbox.length === 4 ? t('scene.croppable') : t('scene.noCrop'),
                    ].filter(Boolean).join(' · ')}
                  </Text>
                </View>
                <View style={s.qty}>
                  <Text style={s.qtyValue}>×{o.quantity}</Text>
                  {!o.quantity_certain && <Text style={s.qtyDoubt}>{t('scene.approx')}</Text>}
                </View>
              </View>
            ))}

            {/* Mesure du banc : coût et latence réels, pas un forfait. */}
            <View style={s.metaBox}>
              <Text style={s.metaLine}>
                {result._meta.model} · {(result._meta.duration_ms / 1000).toFixed(1)} s
              </Text>
              <Text style={s.metaLine}>
                {result._meta.input_tokens} + {result._meta.output_tokens} tokens ·{' '}
                {(result._meta.cost_usd * 100).toFixed(3)} ¢
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  )
}

const s = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerText: { flex: 1 },
  title: { fontSize: Typography.lg, fontWeight: Typography.semibold, color: Colors.textPrimary },
  subtitle: { fontSize: Typography.sm, color: Colors.textSecondary, marginTop: 2 },

  body: { padding: Spacing.md, gap: Spacing.md, paddingBottom: Spacing.xxl },

  sources: { flexDirection: 'row', gap: Spacing.sm },
  source: {
    flex: 1, alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: Radius.lg,
    borderWidth: 0.5, borderColor: Colors.border,
    paddingVertical: Spacing.lg,
  },
  sourceLabel: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },

  preview: { width: '100%', height: 220, borderRadius: Radius.lg, backgroundColor: Colors.surfaceWarm },

  modelRow: { flexDirection: 'row', gap: Spacing.sm },
  modelChip: {
    flex: 1, alignItems: 'center', paddingVertical: 7,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  modelChipOn: { backgroundColor: Colors.accentLight, borderColor: Colors.accent },
  modelChipText: { fontSize: Typography.xs, color: Colors.textSecondary, fontWeight: Typography.medium },
  modelChipTextOn: { color: Colors.accent, fontWeight: Typography.semibold },

  cta: {
    backgroundColor: Colors.accent, borderRadius: Radius.md,
    paddingVertical: 15, alignItems: 'center',
  },
  ctaOff: { opacity: 0.6 },
  ctaText: { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.textInverse },

  errorBox: {
    backgroundColor: Colors.errorLight, borderRadius: Radius.md, padding: Spacing.md,
  },
  errorText: { fontSize: Typography.sm, color: Colors.error },

  warnBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm,
    backgroundColor: '#FFF7ED', borderRadius: Radius.md, padding: Spacing.md,
  },
  warnText: { flex: 1, fontSize: Typography.sm, color: '#C2410C', lineHeight: Typography.sm * 1.45 },

  containerBox: {
    backgroundColor: Colors.accentLight, borderRadius: Radius.md, padding: Spacing.md, gap: 2,
  },
  containerLabel: {
    fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.accent,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  containerTitle: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  containerContents: { fontSize: Typography.sm, color: Colors.textSecondary, lineHeight: Typography.sm * 1.45 },

  resultCount: {
    fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 0.5, borderColor: Colors.border,
    padding: Spacing.md,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.textPrimary },
  rowMeta: { fontSize: Typography.xs, color: Colors.textTertiary, lineHeight: Typography.xs * 1.45 },
  qty: { alignItems: 'flex-end' },
  qtyValue: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },
  qtyDoubt: { fontSize: 9, color: '#C2410C', fontWeight: Typography.semibold },

  metaBox: {
    backgroundColor: Colors.surfaceWarm, borderRadius: Radius.md,
    padding: Spacing.md, gap: 2, marginTop: Spacing.xs,
  },
  metaLine: { fontSize: Typography.xs, color: Colors.textSecondary, fontVariant: ['tabular-nums'] },
})
