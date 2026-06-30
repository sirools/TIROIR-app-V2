import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity,
  ActivityIndicator, Image, TextInput, Animated,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { Screen, Colors, Typography, Spacing, Radius } from '@/components/ui'
import { DraftProposedData, Collection } from '@/types/database'
import { draftCache } from '@/services/draftCache'

export default function DraftScreen() {
  const { draftId } = useLocalSearchParams<{ draftId: string }>()
  const router = useRouter()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [locationNote, setLocationNote] = useState('')
  const [attributes, setAttributes] = useState<Record<string, string>>({})
  const [collections, setCollections] = useState<Collection[]>([])
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null)
  const [newCollectionName, setNewCollectionName] = useState('')
  const [creatingCollection, setCreatingCollection] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [coverUri, setCoverUri] = useState<string | null>(null)

  useEffect(() => {
    if (!draftId) return
    const data = draftCache.get(draftId) ?? {}
    setTitle(data.title ?? '')
    setDescription(data.description ?? '')
    setLocationNote(data.location_note ?? '')
    setAttributes(data.attributes ?? {})
    setSelectedCollectionId(null)
    setCoverUri(null)
  }, [draftId])
  const attrLabels: Record<string, string> = {
    brand: 'Marque', model: 'Modèle', category: 'Catégorie',
    color: 'Couleur', voltage: 'Voltage', serial_number: 'N° série',
  }

  // Animation d'entrée
  const slideAnim = useRef(new Animated.Value(40)).current
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 420, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 380, useNativeDriver: true }),
    ]).start()
    loadCollections()
    loadCoverImage()
  }, [])

  async function loadCoverImage() {
    if (!draftId) return
    const { data: imgRows } = await supabase
      .from('ai_draft_images')
      .select('storage_path')
      .eq('draft_id', draftId)
      .eq('position', 0)
      .limit(1)
    if (imgRows && imgRows.length > 0) {
      const { data } = await supabase.storage
        .from('object-images')
        .createSignedUrl(imgRows[0].storage_path, 3600)
      if (data?.signedUrl) setCoverUri(data.signedUrl)
    }
  }

  async function loadCollections() {
    const { data, error } = await supabase.from('collections').select('*').order('name')
    if (!error) setCollections(data ?? [])
  }

  async function createCollection() {
    if (!newCollectionName.trim()) return
    setCreatingCollection(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data: drawer } = await supabase.from('drawers').select('id').single()
    if (!drawer || !user) {
      Alert.alert('Erreur', 'Tiroir introuvable.')
      setCreatingCollection(false)
      return
    }
    const { data, error } = await supabase
      .from('collections')
      .insert({ name: newCollectionName.trim(), drawer_id: drawer.id, user_id: user.id })
      .select()
      .single()
    setCreatingCollection(false)
    if (error) { Alert.alert('Erreur', error.message); return }
    setCollections(prev => [...prev, data])
    setSelectedCollectionId(data.id)
    setNewCollectionName('')
  }

  async function handleConfirm() {
    if (!title.trim()) {
      Alert.alert('Titre manquant', 'Donne un nom à cet objet avant de confirmer.')
      return
    }
    if (!draftId) return
    setConfirming(true)
    const { data: objectId, error } = await supabase.rpc('confirm_draft', {
      p_draft_id: draftId,
      p_collection_id: selectedCollectionId,
    })
    setConfirming(false)
    if (error) {
      let msg = error.message
      if (msg.includes("non traité par l'IA")) msg = "L'analyse IA n'est pas encore terminée. Réessaie dans un instant."
      else if (msg.includes('expiré')) msg = 'Ce brouillon a expiré. Recommence la capture.'
      Alert.alert('Impossible de confirmer', msg)
      return
    }
    if (draftId) draftCache.clear(draftId)
    router.navigate(`/objects/${objectId}`)
  }

  async function handleReject() {
    Alert.alert('Annuler ?', 'Les photos seront supprimées et le brouillon effacé.', [
      { text: 'Non', style: 'cancel' },
      {
        text: 'Oui, annuler', style: 'destructive',
        onPress: async () => {
          const { data } = await supabase.rpc('reject_draft', { p_draft_id: draftId })
          const paths: string[] = data?.storage_paths_to_delete ?? []
          if (paths.length > 0) await supabase.storage.from('object-images').remove(paths)
          if (draftId) draftCache.clear(draftId)
          router.navigate('/')
        },
      },
    ])
  }

  function handleReanalyze() {
    if (!draftId) return
    draftCache.clear(draftId)
    router.replace({ pathname: '/capture/uploading', params: { draftId, images: '[]' } })
  }

  const visibleAttrs = Object.entries(attributes).filter(([, v]) => v !== null && v !== '')

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

          {/* Indicateur d'étapes */}
          <View style={styles.steps}>
            <View style={styles.stepDone} />
            <View style={[styles.stepLine, styles.stepLineDone]} />
            <View style={styles.stepDone} />
            <View style={styles.stepLine} />
            <View style={[styles.stepDot, styles.stepActive]} />
          </View>

          {/* Hero photo */}
          <View style={styles.hero}>
            {coverUri ? (
              <Image source={{ uri: coverUri }} style={styles.heroImg} resizeMode="cover" />
            ) : (
              <View style={styles.heroPlaceholder}>
                <Text style={styles.heroPlaceholderIcon}>📦</Text>
              </View>
            )}
            {/* Badge confiance IA */}
            <View style={styles.confidenceBadge}>
              <Text style={styles.confidenceBadgeText}>✦ IA — à vérifier</Text>
            </View>
          </View>

          {/* Titre éditable */}
          <View style={styles.titleBlock}>
            {editingTitle ? (
              <TextInput
                value={title}
                onChangeText={setTitle}
                onBlur={() => setEditingTitle(false)}
                onSubmitEditing={() => setEditingTitle(false)}
                style={styles.titleInput}
                returnKeyType="done"
                autoFocus
                selectTextOnFocus
                maxLength={120}
              />
            ) : (
              <TouchableOpacity onPress={() => setEditingTitle(true)} activeOpacity={0.7} style={styles.titleRow}>
                <Text style={styles.titleText} numberOfLines={2}>
                  {title || 'Sans titre'}
                </Text>
                <Text style={styles.titleEdit}>✎</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.titleSub}>Proposition de l'IA · appuie pour modifier</Text>
          </View>

          {/* Attributs IA — lecture seule */}
          {visibleAttrs.length > 0 && (
            <View style={styles.attrsCard}>
              <Text style={styles.sectionLabel}>Détecté par l'IA</Text>
              {visibleAttrs.map(([key, value], i) => (
                <View key={key} style={[styles.attrRow, i > 0 && styles.attrSep]}>
                  <Text style={styles.attrKey}>{attrLabels[key] ?? key}</Text>
                  <Text style={styles.attrVal}>{String(value)}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Description */}
          <View style={styles.fieldGroup}>
            <Text style={styles.sectionLabel}>Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Quelques mots sur l'objet…"
              placeholderTextColor={Colors.textTertiary}
              style={[styles.field, styles.fieldMulti]}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Emplacement */}
          <View style={styles.fieldGroup}>
            <Text style={styles.sectionLabel}>Emplacement</Text>
            <TextInput
              value={locationNote}
              onChangeText={setLocationNote}
              placeholder="Garage, étagère du haut…"
              placeholderTextColor={Colors.textTertiary}
              style={styles.field}
              returnKeyType="done"
            />
          </View>

          {/* Collection */}
          <View style={styles.fieldGroup}>
            <Text style={styles.sectionLabel}>Collection</Text>
            <View style={styles.chips}>
              <TouchableOpacity
                onPress={() => setSelectedCollectionId(null)}
                style={[styles.chip, selectedCollectionId === null && styles.chipActive]}
                activeOpacity={0.75}
              >
                <Text style={[styles.chipText, selectedCollectionId === null && styles.chipTextActive]}>
                  Sans collection
                </Text>
              </TouchableOpacity>
              {collections.map(col => (
                <TouchableOpacity
                  key={col.id}
                  onPress={() => setSelectedCollectionId(col.id)}
                  style={[styles.chip, selectedCollectionId === col.id && styles.chipActive]}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.chipText, selectedCollectionId === col.id && styles.chipTextActive]}>
                    {col.emoji ?? '📦'} {col.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Créer une collection */}
            <View style={styles.newColRow}>
              <TextInput
                value={newCollectionName}
                onChangeText={setNewCollectionName}
                placeholder="Nouvelle collection…"
                placeholderTextColor={Colors.textTertiary}
                style={[styles.field, { flex: 1 }]}
                returnKeyType="done"
                onSubmitEditing={createCollection}
              />
              <TouchableOpacity
                onPress={createCollection}
                disabled={!newCollectionName.trim() || creatingCollection}
                style={[styles.newColBtn, (!newCollectionName.trim() || creatingCollection) && { opacity: 0.4 }]}
                activeOpacity={0.8}
              >
                {creatingCollection
                  ? <ActivityIndicator color={Colors.textInverse} size="small" />
                  : <Text style={styles.newColBtnText}>+</Text>}
              </TouchableOpacity>
            </View>
          </View>

          {/* Séparateur */}
          <View style={styles.sep} />

          {/* CTA */}
          <TouchableOpacity
            style={[styles.btnPrimary, confirming && styles.btnPrimaryLoading]}
            onPress={handleConfirm}
            activeOpacity={0.88}
            disabled={confirming}
          >
            {confirming
              ? <ActivityIndicator color={Colors.textInverse} size="small" />
              : <Text style={styles.btnPrimaryText}>Ajouter à mon Tiroir</Text>}
          </TouchableOpacity>

          <View style={styles.bottomLinks}>
            <TouchableOpacity onPress={handleReanalyze} activeOpacity={0.7} hitSlop={8}>
              <Text style={styles.bottomLinkText}>Relancer l'analyse IA</Text>
            </TouchableOpacity>
            <Text style={styles.bottomLinkSep}>·</Text>
            <TouchableOpacity style={styles.btnCancel} onPress={handleReject} activeOpacity={0.7} hitSlop={8}>
              <Text style={styles.btnCancelText}>Annuler</Text>
            </TouchableOpacity>
          </View>

        </Animated.View>
      </ScrollView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  scroll: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  content: {
    gap: Spacing.lg,
  },

  steps: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: Spacing.xs,
  },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  stepDone: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.accent },
  stepActive: { width: 24, borderRadius: 4, backgroundColor: Colors.accent },
  stepLine: { flex: 1, height: 1, backgroundColor: Colors.border, marginHorizontal: Spacing.xs },
  stepLineDone: { backgroundColor: Colors.accent },

  hero: {
    height: 200,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceWarm,
    position: 'relative',
  },
  heroImg: { width: '100%', height: '100%' },
  heroPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroPlaceholderIcon: { fontSize: 48 },
  confidenceBadge: {
    position: 'absolute',
    bottom: Spacing.sm,
    right: Spacing.sm,
    backgroundColor: Colors.accentLight,
    borderRadius: Radius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  confidenceBadgeText: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    color: Colors.accent,
  },

  titleBlock: { gap: 4 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  titleText: {
    flex: 1,
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    lineHeight: 30,
  },
  titleEdit: { fontSize: Typography.md, color: Colors.textTertiary, marginTop: 4 },
  titleInput: {
    fontSize: Typography.xl,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    borderBottomWidth: 2,
    borderBottomColor: Colors.accent,
    paddingBottom: 4,
    paddingHorizontal: 0,
  },
  titleSub: { fontSize: Typography.xs, color: Colors.textTertiary },

  sectionLabel: {
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  attrsCard: {
    backgroundColor: Colors.surfaceWarm,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  attrRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  attrSep: { borderTopWidth: 1, borderTopColor: Colors.borderLight },
  attrKey: { fontSize: Typography.sm, color: Colors.textSecondary },
  attrVal: { fontSize: Typography.sm, color: Colors.textPrimary, fontWeight: Typography.semibold },

  fieldGroup: { gap: Spacing.sm, marginTop: Spacing.sm },
  field: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
    fontSize: Typography.base,
    color: Colors.textPrimary,
  },
  fieldMulti: { height: 88, textAlignVertical: 'top', paddingTop: 13 },

  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm - 2,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipActive: { borderColor: Colors.accent, backgroundColor: Colors.accentLight },
  chipText: { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: Typography.medium },
  chipTextActive: { color: Colors.accent },

  newColRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  newColBtn: {
    width: 50, height: 50,
    borderRadius: Radius.md,
    backgroundColor: Colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  newColBtnText: { color: Colors.textInverse, fontSize: Typography.xl, lineHeight: Typography.xl + 4 },

  sep: { height: 1, backgroundColor: Colors.borderLight },

  btnPrimary: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  btnPrimaryLoading: { opacity: 0.75 },
  btnPrimaryText: {
    fontSize: Typography.base,
    fontWeight: Typography.bold,
    color: Colors.textInverse,
    letterSpacing: 0.1,
  },
  bottomLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  bottomLinkText: { fontSize: Typography.sm, color: Colors.textSecondary },
  bottomLinkSep: { fontSize: Typography.sm, color: Colors.textTertiary },
  btnCancel: {},
  btnCancelText: { fontSize: Typography.sm, color: Colors.textTertiary },
})
