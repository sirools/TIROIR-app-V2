import React, { useCallback, useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import * as FileSystem from 'expo-file-system/legacy'
import { ArrowLeft, Camera, Images, AlertTriangle, Minus, Plus, Trash2, RotateCcw, Sparkles } from 'lucide-react-native'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'
import { functionMessage } from '@/lib/functionError'
import { cropSceneObjects, ensureLocalScenePhoto, SceneCrop } from '@/services/sceneCrops'
import {
  Screen, Colors, Typography, Spacing, Radius,
  CollectionPickerSheet, PickedCollection, useToast,
} from '@/components/ui'

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
  /** Ligne scene_analyses écrite par la fonction. NULL si l'écriture a échoué :
   *  les fiches se créeront alors sans photo plutôt que d'échouer. */
  scene_id: string | null
  scene_storage_path: string | null
  _meta: {
    model: string
    input_tokens: number
    output_tokens: number
    cost_usd: number
    duration_ms: number
  }
}

/**
 * Une analyse passée, telle qu'elle est conservée en base.
 *
 * La photo et le résultat sont stockés à l'analyse, pas à la validation :
 * c'est l'analyse abandonnée qu'il faut rattraper, pas celle qui a déjà
 * donné des fiches.
 */
interface SceneRow {
  id: string
  created_at: string
  storage_path: string | null
  thumbnails: Record<string, { path: string; kind: 'cutout' | 'generate'; mime?: string }> | null
  model: string
  input_tokens: number
  output_tokens: number
  cost_usd: number | null
  duration_ms: number | null
  result: Omit<DetectionResult, 'truncated' | 'scene_id' | 'scene_storage_path' | '_meta'>

  object_count: number
  truncated: boolean
  objects_created: number
}

interface HistoryEntry extends SceneRow {
  thumb: string | null
}

/**
 * Vignette travaillée par le modèle image, rangée avec la scène.
 *
 * `cutout` reste la photo du propriétaire, nettoyée. `generate` ne l'est
 * pas : c'est une illustration, et la fiche naîtra en le sachant.
 */
interface SceneThumb {
  path: string
  url: string | null
  kind: 'cutout' | 'generate'
  mime: string
}

/** Une ligne d'historique redevient un résultat complet : rejouer une
 *  analyse doit rendre exactement ce que l'utilisateur avait vu. */
function toResult(row: SceneRow): DetectionResult {
  return {
    ...row.result,
    truncated: row.truncated,
    scene_id: row.id,
    scene_storage_path: row.storage_path,
    _meta: {
      model: row.model,
      input_tokens: row.input_tokens,
      output_tokens: row.output_tokens,
      cost_usd: row.cost_usd ?? 0,
      duration_ms: row.duration_ms ?? 0,
    },
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

/**
 * Banc d'essai, réservé aux comptes d'administration.
 *
 * Pour tout le monde d'autre, le modèle est une conséquence du plan et se
 * décide côté serveur : l'écart de coût est de 1 à 17, et un utilisateur
 * à qui on présente trois boutons prendra toujours le plus cher sans
 * savoir ce qu'il change.
 */
const MODELS = [
  { id: 'claude-haiku-4-5', label: 'Haiku 4.5' },
  { id: 'claude-sonnet-5', label: 'Sonnet 5' },
  { id: 'claude-opus-5', label: 'Opus 5' },
]

export default function SceneDetectionScreen() {
  const router = useRouter()
  const { t, i18n } = useTranslation()
  const { showToast } = useToast()
  const { profile } = useAuth()
  const isAdmin = Boolean(profile?.is_admin)

  const [uri, setUri] = useState<string | null>(null)
  const [model, setModel] = useState(MODELS[0].id)
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<DetectionResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  /**
   * Analyse rejouée depuis l'historique : la photo vient du Storage et non
   * du téléphone, donc elle s'affiche mais ne se réanalyse pas. Reprendre
   * un placard photographié hier ne doit pas coûter une seconde analyse.
   */
  const [replayUrl, setReplayUrl] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  /**
   * Vignettes découpées dans la photo de scène, indexées sur le rang de
   * l'objet dans le résultat du modèle. Absent = boîte manquante ou trop
   * petite : la fiche prendra la photo entière.
   */
  const [crops, setCrops] = useState<Record<number, SceneCrop>>({})

  /** Vignettes travaillées : détourage ou illustration. Payantes, une par une. */
  const [thumbs, setThumbs] = useState<Record<number, SceneThumb>>({})
  const [busyThumb, setBusyThumb] = useState<number | null>(null)

  /**
   * Revue de la détection. Le résultat du modèle n'est jamais modifié :
   * on tient à part ce que l'utilisateur en a fait, pour qu'une nouvelle
   * analyse reparte d'une base propre.
   */
  const [removed, setRemoved] = useState<Set<number>>(new Set())
  const [quantities, setQuantities] = useState<Record<number, number>>({})
  const [pickerVisible, setPickerVisible] = useState(false)
  const [creating, setCreating] = useState(false)

  /** Photo affichée : celle qu'on vient de prendre, ou celle d'une analyse rejouée. */
  const photo = uri ?? replayUrl

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString(i18n.language, {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    })
  }

  const loadHistory = useCallback(async () => {
    const { data, error: histError } = await supabase
      .from('scene_analyses')
      .select('id, created_at, storage_path, thumbnails, model, input_tokens, output_tokens, cost_usd, duration_ms, result, object_count, truncated, objects_created')
      .order('created_at', { ascending: false })
      .limit(20)
    setHistoryLoading(false)
    if (histError || !data) return

    const rows = data as SceneRow[]
    const paths = rows.map(r => r.storage_path).filter(Boolean) as string[]
    const signed = paths.length > 0
      ? (await supabase.storage.from('object-images').createSignedUrls(paths, 3600)).data ?? []
      : []
    const byPath = new Map(signed.map(s => [s.path, s.signedUrl]))

    setHistory(rows.map(r => ({
      ...r,
      thumb: r.storage_path ? byPath.get(r.storage_path) ?? null : null,
    })))
  }, [])

  // À chaque retour sur l'écran : une analyse a pu être créée entre-temps,
  // le compteur « N fiches créées » doit suivre.
  useFocusEffect(useCallback(() => { loadHistory() }, [loadHistory]))

  /** Rejouer : le résultat conservé, la photo du Storage, aucun appel modèle. */
  async function replay(entry: HistoryEntry) {
    setUri(null)
    setError(null)
    setRemoved(new Set())
    setQuantities({})
    setCrops({})
    setThumbs({})
    setReplayUrl(entry.thumb)
    setResult(toResult(entry))

    // Les vignettes déjà payées reviennent avec la scène : les refaire
    // serait facturer deux fois la même image.
    const saved = Object.entries(entry.thumbnails ?? {})
    if (saved.length === 0) return

    const { data: signed } = await supabase.storage
      .from('object-images')
      .createSignedUrls(saved.map(([, v]) => v.path), 3600)
    const byPath = new Map((signed ?? []).map(s => [s.path, s.signedUrl]))

    setThumbs(Object.fromEntries(saved.map(([k, v]) => [Number(k), {
      path: v.path,
      url: byPath.get(v.path) ?? null,
      kind: v.kind,
      mime: v.mime ?? 'image/png',
    }])))
  }

  /**
   * Découpe les objets dès qu'un résultat s'affiche.
   *
   * Sur l'appareil et sans rien demander : c'est la photo de l'utilisateur,
   * recadrée, donc ni coût ni attente à justifier. Ce qui n'a pas de boîte
   * exploitable reste sans vignette — la fiche prendra la photo entière.
   */
  useEffect(() => {
    if (!result) return

    const boxes = result.objects
      .map((o, index) => ({ index, bbox: o.bbox }))
      .filter(b => Array.isArray(b.bbox) && b.bbox.length === 4)
    if (boxes.length === 0) return

    let cancelled = false
    const stale = () => cancelled

    ;(async () => {
      const src = await ensureLocalScenePhoto(uri, replayUrl, result.scene_id ?? 'courante')
      if (!src || cancelled) return
      await cropSceneObjects(src, boxes, (index, crop) => {
        setCrops(prev => ({ ...prev, [index]: crop }))
      }, stale)
    })()

    return () => { cancelled = true }
  }, [result, uri, replayUrl])

  /**
   * Vignette travaillée, à la demande et objet par objet.
   *
   * Jamais en masse : une image coûte environ quatre centimes, soit près
   * de sept fois l'analyse Opus qui a produit les vingt-et-un objets de
   * cette vitrine. Facturer ça sans que personne ne l'ait demandé serait
   * une mauvaise surprise sur la facture.
   */
  async function makeThumb(i: number, mode: 'cutout' | 'generate') {
    if (!result?.scene_id || busyThumb !== null) return
    setBusyThumb(i)
    try {
      let image: { data: string; media_type: string } | null = null

      if (mode === 'cutout') {
        const crop = crops[i]
        if (!crop) throw new Error(t('scene.thumbNoCrop'))
        // Le serveur ne sait pas découper une image : la découpe faite sur
        // l'appareil part avec la requête plutôt que d'être refaite.
        image = {
          data: await FileSystem.readAsStringAsync(crop.uri, {
            encoding: FileSystem.EncodingType.Base64,
          }),
          media_type: 'image/jpeg',
        }
      }

      const { data: res, error: fnError } = await supabase.functions.invoke('scene-thumbnail', {
        body: { scene_id: result.scene_id, index: i, mode, image },
      })
      if (fnError) throw new Error(await functionMessage(fnError))
      if (res?.error) throw new Error(res.error.message ?? res.error.code)

      setThumbs(prev => ({
        ...prev,
        [i]: { path: res.storage_path, url: res.url, kind: mode, mime: res.mime_type },
      }))
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : String(e))
    } finally {
      setBusyThumb(null)
    }
  }

  async function deleteHistory(entry: HistoryEntry) {
    Alert.alert(t('scene.historyDeleteTitle'), t('scene.historyDeleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          if (entry.storage_path) {
            await supabase.storage.from('object-images').remove([entry.storage_path])
          }
          const { error: delError } = await supabase.from('scene_analyses').delete().eq('id', entry.id)
          if (delError) { Alert.alert(t('common.error'), delError.message); return }
          setHistory(prev => prev.filter(h => h.id !== entry.id))
          if (result?.scene_id === entry.id) reset()
        },
      },
    ])
  }

  /**
   * Retour d'un cran, pas fermeture.
   *
   * Une revue de scène se quitte souvent pour reprendre la photo, pas pour
   * abandonner : la croix renvoyait à l'écran d'ajout et faisait tout
   * perdre. On remonte donc revue → photo & historique → écran d'ajout.
   */
  function goBack() {
    if (photo || result) { reset(); return }
    // Destination explicite plutôt que router.back() : l'écran est monté
    // dans le navigateur d'onglets, et « revenir » y ramenait à l'onglet
    // précédent — l'accueil — au lieu de l'écran d'ajout d'où l'on vient.
    router.replace('/capture')
  }

  function reset() {
    setUri(null)
    setReplayUrl(null)
    setResult(null)
    setError(null)
    setRemoved(new Set())
    setQuantities({})
    setCrops({})
    setThumbs({})
  }

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
    setReplayUrl(null)
    setCrops({})
    setThumbs({})
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
        // Envoyé seulement par un admin : le serveur ignore ce champ pour
        // tous les autres, mais autant ne pas le transmettre du tout.
        body: { image: { data, media_type: 'image/jpeg' }, ...(isAdmin ? { model } : {}) },
      })
      // Le motif — quota atteint, modèle indisponible — vit dans le corps
      // de la réponse ; `invoke` ne rend qu'un « non-2xx status code ».
      if (fnError) throw new Error(await functionMessage(fnError))
      if (res?.error) throw new Error(res.error.message ?? res.error.code)
      setRemoved(new Set())
      setQuantities({})
      setCrops({})
      setThumbs({})
      setResult(res as DetectionResult)
      // La scène est déjà en base : l'historique doit la refléter même si
      // l'utilisateur quitte l'écran sans rien créer.
      loadHistory()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }

  const qtyOf = (i: number, o: DetectedObject) => quantities[i] ?? o.quantity

  const kept = (result?.objects ?? [])
    .map((o, i) => ({ o, i }))
    .filter(({ i }) => !removed.has(i))

  const totalUnits = kept.reduce((n, { o, i }) => n + qtyOf(i, o), 0)

  function setQty(i: number, next: number) {
    setQuantities(prev => ({ ...prev, [i]: Math.max(1, Math.min(999, next)) }))
  }

  /**
   * Une seule RPC pour tout le lot : sur onze objets, deux allers-retours
   * chacun feraient vingt-deux appels, et un échec au milieu laisserait un
   * inventaire à moitié créé.
   *
   * La photo n'est PAS partagée entre les fiches. object_images porte
   * UNIQUE (storage_path), et surtout la suppression d'une fiche efface ses
   * fichiers : un chemin commun aurait fait disparaître la photo des douze
   * autres. La RPC rend donc un chemin par fiche, et la copie se fait côté
   * Storage — un seul envoi depuis le téléphone, au moment de l'analyse.
   */
  async function create(collection: PickedCollection | null) {
    if (!result || creating) return
    setPickerVisible(false)
    setCreating(true)
    try {
      const { data: rows, error: rpcErr } = await supabase.rpc('create_objects_from_scene', {
        p_objects: kept.map(({ o, i }) => ({
          title: o.title,
          quantity: qtyOf(i, o),
          category: o.category,
          // La fiche naît en sachant que son image est une illustration :
          // l'apprendre par un UPDATE d'après coup laisserait une fenêtre
          // où elle passerait pour une photo de l'objet.
          illustration: thumbs[i]?.kind === 'generate',
        })),
        p_scene_id: result.scene_id,
        p_collection_id: collection?.id ?? null,
      })
      if (rpcErr) throw new Error(rpcErr.message)

      const created = (rows ?? []) as { object_id: string; image_path: string | null }[]
      const scenePath = result.scene_storage_path

      /**
       * Les lignes object_images existent déjà ; les fichiers, pas encore.
       *
       * Chaque fiche reçoit SA découpe quand le modèle a rendu une boîte
       * exploitable — une vitrine de vingt-et-un objets donnait vingt-et-une
       * fiches illustrées par la même étagère. À défaut, la photo de scène
       * entière, copiée côté serveur.
       *
       * Un envoi qui échoue laisse sa ligne effacée : une fiche sans photo
       * vaut mieux qu'une vignette cassée.
       */
      /** Chemins dont le fichier n'est pas du JPEG, contrairement à ce que
       *  la RPC a inscrit : Gemini rend du PNG. */
      const notJpeg: string[] = []

      const failed = (await Promise.all(created.map(async (row, k) => {
        if (!row.image_path) return null
        const source = kept[k]?.i ?? -1
        const thumb = thumbs[source]
        const crop = crops[source]

        // Vignette travaillée d'abord : elle est déjà dans le Storage,
        // et c'est celle que l'utilisateur a payée et vue.
        if (thumb) {
          const { error: copyErr } = await supabase.storage
            .from('object-images')
            .copy(thumb.path, row.image_path)
          if (!copyErr) {
            if (thumb.mime && thumb.mime !== 'image/jpeg') notJpeg.push(row.image_path)
            return null
          }
        }

        if (crop) {
          try {
            const b64 = await FileSystem.readAsStringAsync(crop.uri, {
              encoding: FileSystem.EncodingType.Base64,
            })
            const binary = atob(b64)
            const bytes = new Uint8Array(binary.length)
            for (let j = 0; j < binary.length; j++) bytes[j] = binary.charCodeAt(j)

            const { error: upErr } = await supabase.storage
              .from('object-images')
              .upload(row.image_path, bytes, { contentType: 'image/jpeg', upsert: false })
            if (!upErr) return null
          } catch {
            // On retombe sur la photo de scène plutôt que d'abandonner.
          }
        }

        if (!scenePath) return row.image_path
        const { error: copyErr } = await supabase.storage
          .from('object-images')
          .copy(scenePath, row.image_path)
        return copyErr ? row.image_path : null
      }))).filter(Boolean) as string[]

      if (failed.length > 0) {
        await supabase.from('object_images').delete().in('storage_path', failed)
      }

      // La RPC déduit le type du fichier de celui de la scène : elle ne peut
      // pas deviner qu'une vignette générée revient en PNG.
      const wrongMime = notJpeg.filter(p => !failed.includes(p))
      if (wrongMime.length > 0) {
        await supabase.from('object_images')
          .update({ mime_type: 'image/png' })
          .in('storage_path', wrongMime)
      }

      showToast(t('scene.created', { count: created.length || kept.length }))
      // L'écran reste monté dans la pile : sans remise à zéro, y revenir
      // rouvrirait le lot déjà créé, prêt à être créé une seconde fois.
      // La scène n'est pas perdue pour autant — elle est dans l'historique.
      reset()
      loadHistory()
      if (collection) {
        router.replace({ pathname: '/collections/[id]', params: { id: collection.id } })
      } else {
        router.back()
      }
    } catch (e) {
      Alert.alert(t('common.error'), e instanceof Error ? e.message : String(e))
    } finally {
      setCreating(false)
    }
  }

  return (
    <Screen edges={['top']} topColor={Colors.surface}>
      <View style={s.header}>
        <TouchableOpacity onPress={goBack} hitSlop={12}>
          <ArrowLeft size={22} color={Colors.textPrimary} strokeWidth={2} />
        </TouchableOpacity>
        <View style={s.headerText}>
          <Text style={s.title}>{t('scene.title')}</Text>
          <Text style={s.subtitle}>{t('scene.subtitle')}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        {!photo ? (
          <>
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

            {/* Historique — une analyse déjà payée reste disponible. Le cas
                à rattraper est celui qu'on abandonne : photographier un
                placard, être interrompu, et devoir tout recommencer. */}
            {historyLoading ? (
              <ActivityIndicator color={Colors.accent} style={s.historyLoader} />
            ) : history.length > 0 && (
              <>
                <Text style={s.sectionLabel}>{t('scene.history')}</Text>
                {history.map(entry => (
                  <TouchableOpacity
                    key={entry.id}
                    style={s.histRow}
                    onPress={() => replay(entry)}
                    activeOpacity={0.7}
                  >
                    {entry.thumb
                      ? <Image source={{ uri: entry.thumb }} style={s.histThumb} resizeMode="cover" />
                      : <View style={[s.histThumb, s.histThumbEmpty]}>
                          <Images size={18} color={Colors.textTertiary} strokeWidth={1.5} />
                        </View>}
                    <View style={s.histText}>
                      <Text style={s.histTitle} numberOfLines={1}>
                        {t('scene.historyObjects', { count: entry.object_count })}
                      </Text>
                      <Text style={s.histMeta} numberOfLines={1}>
                        {formatDate(entry.created_at)} · {entry.objects_created > 0
                          ? t('scene.historyCreated', { count: entry.objects_created })
                          : t('scene.historyNone')}
                      </Text>
                    </View>
                    <RotateCcw size={16} color={Colors.textTertiary} strokeWidth={1.8} />
                    <TouchableOpacity onPress={() => deleteHistory(entry)} hitSlop={10} style={s.histDelete}>
                      <Trash2 size={16} color={Colors.textTertiary} strokeWidth={1.8} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </>
        ) : (
          <TouchableOpacity onPress={() => (replayUrl ? reset() : pick('library'))} activeOpacity={0.85}>
            <Image source={{ uri: photo }} style={s.preview} resizeMode="cover" />
          </TouchableOpacity>
        )}

        {/* Analyse rejouée : la photo vient du Storage, elle s'affiche mais
            ne se réanalyse pas — reprendre ne doit rien coûter. */}
        {replayUrl && (
          <TouchableOpacity style={s.replayRow} onPress={reset} activeOpacity={0.7}>
            <RotateCcw size={14} color={Colors.textSecondary} strokeWidth={1.8} />
            <Text style={s.replayText}>{t('scene.replayed')}</Text>
            <Text style={s.replayAction}>{t('scene.newPhoto')}</Text>
          </TouchableOpacity>
        )}

        {/* Instrument de banc : le modèle est décidé par le plan côté
            serveur, seul un admin peut encore le forcer. */}
        {uri && isAdmin && (
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
              {/* Les deux chiffres comptent ce qui RESTE : après un retrait,
                  afficher les types d'origine face aux exemplaires gardés
                  donnerait « 5 types · 2 exemplaires ». */}
              {t('scene.resultCount', { types: kept.length, units: totalUnits })}
            </Text>

            {kept.map(({ o, i }) => (
              <View key={i} style={s.row}>
                <View style={s.rowHead}>
                  {/* Vignette travaillée si elle existe, sinon la découpe
                      brute. Rien des deux = pas de boîte exploitable ; la
                      fiche prendra la photo entière. */}
                  <View>
                    {thumbs[i]?.url ? (
                      <Image source={{ uri: thumbs[i].url! }} style={s.rowThumb} resizeMode="cover" />
                    ) : crops[i] ? (
                      <Image source={{ uri: crops[i].uri }} style={s.rowThumb} resizeMode="cover" />
                    ) : o.bbox.length === 4 ? (
                      <View style={[s.rowThumb, s.rowThumbEmpty]}>
                        <ActivityIndicator size="small" color={Colors.textTertiary} />
                      </View>
                    ) : (
                      <View style={[s.rowThumb, s.rowThumbEmpty]}>
                        <Images size={16} color={Colors.textTertiary} strokeWidth={1.5} />
                      </View>
                    )}
                    {/* Une image générée n'est pas une photo de l'objet.
                        Elle le dit ici, et la fiche le redira. */}
                    {thumbs[i]?.kind === 'generate' && (
                      <View style={s.illusBadge}>
                        <Sparkles size={9} color={Colors.textInverse} strokeWidth={2.4} />
                      </View>
                    )}
                  </View>
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
                  {/* Retirer, pas supprimer : l'objet est déjà dans
                      l'inventaire, il n'a rien à faire dans ce lot. */}
                  <TouchableOpacity
                    onPress={() => setRemoved(prev => new Set(prev).add(i))}
                    hitSlop={10}
                    style={s.rowRemove}
                  >
                    <Trash2 size={16} color={Colors.textTertiary} strokeWidth={1.8} />
                  </TouchableOpacity>
                </View>

                {/* La quantité est une proposition : elle se corrige ici,
                    au moment où l'utilisateur a la photo sous les yeux. */}
                <View style={s.qtyRow}>
                  <TouchableOpacity
                    style={[s.qtyBtn, qtyOf(i, o) <= 1 && s.qtyBtnOff]}
                    onPress={() => setQty(i, qtyOf(i, o) - 1)}
                    disabled={qtyOf(i, o) <= 1}
                    hitSlop={8}
                  >
                    <Minus size={14} color={qtyOf(i, o) <= 1 ? Colors.textTertiary : Colors.textPrimary} strokeWidth={2.6} />
                  </TouchableOpacity>
                  <Text style={s.qtyValue}>×{qtyOf(i, o)}</Text>
                  <TouchableOpacity
                    style={s.qtyBtn}
                    onPress={() => setQty(i, qtyOf(i, o) + 1)}
                    hitSlop={8}
                  >
                    <Plus size={14} color={Colors.textPrimary} strokeWidth={2.6} />
                  </TouchableOpacity>
                  {!o.quantity_certain && <Text style={s.qtyDoubt}>{t('scene.approx')}</Text>}

                  {/* Détourer quand la photo donne quelque chose, générer
                      sinon. Une image à la fois : le compte y gagne, et
                      l'utilisateur voit le résultat avant d'en payer un autre. */}
                  <TouchableOpacity
                    style={[s.thumbBtn, busyThumb !== null && s.thumbBtnOff]}
                    onPress={() => makeThumb(i, crops[i] ? 'cutout' : 'generate')}
                    disabled={busyThumb !== null}
                    activeOpacity={0.7}
                  >
                    {busyThumb === i ? (
                      <ActivityIndicator size="small" color={Colors.accent} />
                    ) : (
                      <>
                        <Sparkles size={12} color={Colors.accent} strokeWidth={2} />
                        <Text style={s.thumbBtnText}>
                          {thumbs[i]
                            ? t('scene.thumbRedo')
                            : crops[i] ? t('scene.thumbCutout') : t('scene.thumbGenerate')}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {kept.length > 0 && (
              <TouchableOpacity
                style={[s.cta, creating && s.ctaOff]}
                onPress={() => setPickerVisible(true)}
                disabled={creating}
                activeOpacity={0.85}
              >
                {creating
                  ? <ActivityIndicator color={Colors.textInverse} />
                  : <Text style={s.ctaText}>{t('scene.createCta', { count: kept.length })}</Text>}
              </TouchableOpacity>
            )}

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

      <CollectionPickerSheet
        visible={pickerVisible}
        title={t('collectionPicker.title')}
        helper={t('scene.destinationHelper', { count: kept.length })}
        busy={creating}
        onSelect={create}
        onDismiss={() => setPickerVisible(false)}
      />
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

  sectionLabel: {
    fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.textTertiary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginTop: Spacing.xs,
  },
  historyLoader: { marginTop: Spacing.lg },
  histRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 0.5, borderColor: Colors.border,
    padding: Spacing.sm,
  },
  histThumb: { width: 44, height: 44, borderRadius: Radius.sm, backgroundColor: Colors.surfaceWarm },
  histThumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  histText: { flex: 1, gap: 2 },
  histTitle: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },
  histMeta: { fontSize: Typography.xs, color: Colors.textTertiary },
  histDelete: { padding: 4 },

  replayRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surfaceWarm, borderRadius: Radius.md,
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
  },
  replayText: { flex: 1, fontSize: Typography.xs, color: Colors.textSecondary },
  replayAction: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.accent },

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
    backgroundColor: Colors.surface, borderRadius: Radius.md,
    borderWidth: 0.5, borderColor: Colors.border,
    padding: Spacing.md,
  },
  rowHead: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  rowThumb: {
    width: 52, height: 52, borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceWarm,
  },
  rowThumbEmpty: { alignItems: 'center', justifyContent: 'center' },
  illusBadge: {
    position: 'absolute', bottom: -3, right: -3,
    width: 17, height: 17, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.accent,
    borderWidth: 1.5, borderColor: Colors.surface,
  },
  thumbBtn: {
    marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 5, paddingHorizontal: 10,
    borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
    minWidth: 84, justifyContent: 'center',
  },
  thumbBtnOff: { opacity: 0.45 },
  thumbBtnText: { fontSize: Typography.xs, fontWeight: Typography.semibold, color: Colors.accent },
  rowRemove: { padding: 2 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: Typography.base, fontWeight: Typography.medium, color: Colors.textPrimary },
  rowMeta: { fontSize: Typography.xs, color: Colors.textTertiary, lineHeight: Typography.xs * 1.45 },
  qtyRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    marginTop: Spacing.sm, paddingTop: Spacing.sm,
    borderTopWidth: 1, borderTopColor: Colors.borderLight,
  },
  qtyBtn: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.surfaceWarm,
  },
  qtyBtnOff: { backgroundColor: 'transparent' },
  qtyValue: { fontSize: Typography.md, fontWeight: Typography.bold, color: Colors.textPrimary, minWidth: 40 },
  qtyDoubt: { flex: 1, fontSize: Typography.xs, color: '#C2410C', fontWeight: Typography.semibold },

  metaBox: {
    backgroundColor: Colors.surfaceWarm, borderRadius: Radius.md,
    padding: Spacing.md, gap: 2, marginTop: Spacing.xs,
  },
  metaLine: { fontSize: Typography.xs, color: Colors.textSecondary, fontVariant: ['tabular-nums'] },
})
