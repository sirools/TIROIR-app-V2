import React, { useEffect, useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { Screen, Input, Button, Colors, Typography, Spacing, Radius } from '@/components/ui'
import { TiroirObject, Collection } from '@/types/database'

// ─── Types locaux ────────────────────────────────────────────────────────────

interface FormState {
  title: string
  description: string
  location_note: string
  collection_id: string | null
}

interface FormErrors {
  title?: string
}

// ─── Composant principal ─────────────────────────────────────────────────────

export default function EditObjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()

  const [object, setObject] = useState<TiroirObject | null>(null)
  const [collections, setCollections] = useState<Collection[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState<FormState>({
    title: '',
    description: '',
    location_note: '',
    collection_id: null,
  })
  const [errors, setErrors] = useState<FormErrors>({})

  // ── Chargement initial ──────────────────────────────────────────────────

  useEffect(() => {
    if (!id) return
    loadData(id)
  }, [id])

  async function loadData(objectId: string) {
    setLoading(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        Alert.alert('Erreur', 'Utilisateur non connecté.')
        router.back()
        return
      }

      const [objRes, colRes, lastUsedRes] = await Promise.all([
        supabase
          .from('objects')
          .select('*')
          .eq('id', objectId)
          .eq('user_id', user.id)
          .single(),
        supabase
          .from('collections')
          .select('*')
          .eq('user_id', user.id)
          .order('name'),
        supabase
          .from('objects')
          .select('collection_id')
          .eq('user_id', user.id)
          .neq('id', objectId)
          .not('collection_id', 'is', null)
          .order('updated_at', { ascending: false })
          .limit(1)
          .single(),
      ])

      if (objRes.error || !objRes.data) {
        Alert.alert('Erreur', 'Objet introuvable ou accès refusé.')
        router.back()
        return
      }

      const obj = objRes.data as TiroirObject
      const cols = (colRes.data as Collection[]) ?? []
      setObject(obj)
      setCollections(cols)

      // Si l'objet n'a pas encore de collection (création manuelle),
      // pré-sélectionne la dernière utilisée ou la première disponible
      let defaultCollectionId = obj.collection_id
      if (defaultCollectionId === null && cols.length > 0) {
        const lastUsedId = lastUsedRes.data?.collection_id ?? null
        const lastUsedExists = cols.some(c => c.id === lastUsedId)
        defaultCollectionId = lastUsedExists ? lastUsedId : cols[0].id
      }

      setForm({
        title: obj.title,
        description: obj.description ?? '',
        location_note: obj.location_note ?? '',
        collection_id: defaultCollectionId,
      })
    } catch (err) {
      console.error('[EditObjectScreen] loadData error:', err)
      Alert.alert('Erreur', "Impossible de charger l'objet.")
      router.back()
    } finally {
      setLoading(false)
    }
  }

  // ── Validation ──────────────────────────────────────────────────────────

  function validate(): boolean {
    const newErrors: FormErrors = {}
    if (!form.title.trim()) {
      newErrors.title = 'Le titre est obligatoire.'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // ── Sauvegarde via RPC update_object ────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!validate() || !object || !id) return

    setSaving(true)
    try {
      const { error } = await supabase.rpc('update_object', {
        p_object_id: id,
        p_title: form.title.trim(),
        p_description: form.description.trim() || null,
        p_location_note: form.location_note.trim() || null,
        p_collection_id: form.collection_id,
      })

      if (error) {
        console.error('[EditObjectScreen] update_object RPC error:', error)
        Alert.alert('Erreur', error.message)
        return
      }

      // Retour à la fiche objet — useFocusEffect dans [id].tsx rechargera les données
      router.back()
    } catch (err) {
      console.error('[EditObjectScreen] handleSave error:', err)
      Alert.alert('Erreur', 'La sauvegarde a échoué.')
    } finally {
      setSaving(false)
    }
  }, [form, object, id, router])

  // ── Sélection de collection ─────────────────────────────────────────────

  function handleCollectionSelect(collectionId: string | null) {
    setForm(prev => ({ ...prev, collection_id: collectionId }))
  }

  // ── Rendu ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Screen>
        <View style={styles.loader}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      </Screen>
    )
  }

  if (!object) {
    return (
      <Screen>
        <View style={styles.loader}>
          <Text style={styles.errorText}>Objet introuvable.</Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.backLink}>← Retour</Text>
          </TouchableOpacity>
        </View>
      </Screen>
    )
  }

  const selectedCollection = collections.find(c => c.id === form.collection_id) ?? null

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerBack}>
            <Text style={styles.headerBackText}>Annuler</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Modifier</Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={styles.headerSave}
          >
            {saving ? (
              <ActivityIndicator color={Colors.accent} size="small" />
            ) : (
              <Text style={styles.headerSaveText}>Enregistrer</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Formulaire ── */}
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Titre */}
          <Input
            label="Titre *"
            value={form.title}
            onChangeText={text => {
              setForm(prev => ({ ...prev, title: text }))
              if (errors.title) setErrors(prev => ({ ...prev, title: undefined }))
            }}
            placeholder="Nom de l'objet"
            error={errors.title}
            autoCapitalize="sentences"
            returnKeyType="next"
          />

          {/* Description */}
          <Input
            label="Description"
            value={form.description}
            onChangeText={text => setForm(prev => ({ ...prev, description: text }))}
            placeholder="Décrivez l'objet (optionnel)"
            multiline
            numberOfLines={4}
            containerStyle={styles.textareaContainer}
            style={styles.textarea}
            textAlignVertical="top"
            returnKeyType="next"
          />

          {/* Emplacement */}
          <Input
            label="Emplacement"
            value={form.location_note}
            onChangeText={text => setForm(prev => ({ ...prev, location_note: text }))}
            placeholder="Ex : Placard chambre, boîte bleue…"
            autoCapitalize="sentences"
            returnKeyType="done"
          />

          {/* Collection */}
          <View style={styles.sectionContainer}>
            <Text style={styles.sectionLabel}>Collection</Text>
            <View style={styles.collectionList}>
              {collections.map(col => (
                <CollectionChip
                  key={col.id}
                  label={col.name}
                  selected={form.collection_id === col.id}
                  onPress={() => handleCollectionSelect(col.id)}
                />
              ))}
            </View>
            {selectedCollection && (
              <Text style={styles.collectionHint}>
                Collection sélectionnée : {selectedCollection.name}
              </Text>
            )}
          </View>

          {/* Bouton Enregistrer (bas de page) */}
          <Button
            label="Enregistrer les modifications"
            onPress={handleSave}
            loading={saving}
            style={styles.saveButton}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

// ─── Composant chip collection ────────────────────────────────────────────────

interface CollectionChipProps {
  label: string
  selected: boolean
  onPress: () => void
}

function CollectionChip({ label, selected, onPress }: CollectionChipProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  errorText: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
  },
  backLink: {
    color: Colors.accent,
    fontSize: Typography.base,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  headerBack: {
    minWidth: 70,
  },
  headerBackText: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
  },
  headerTitle: {
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
  },
  headerSave: {
    minWidth: 70,
    alignItems: 'flex-end',
  },
  headerSaveText: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.accent,
  },

  // Scroll
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },

  // Textarea
  textareaContainer: {},
  textarea: {
    height: 100,
    paddingTop: Spacing.sm + 4,
  },

  // Section collection
  sectionContainer: {
    gap: Spacing.sm,
  },
  sectionLabel: {
    fontSize: Typography.sm,
    fontWeight: Typography.medium,
    color: Colors.textSecondary,
  },
  collectionList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  collectionHint: {
    fontSize: Typography.xs,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },

  // Chips
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentLight,
  },
  chipText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontWeight: Typography.medium,
  },
  chipTextSelected: {
    color: Colors.accent,
    fontWeight: Typography.semibold,
  },

  // Bouton bas
  saveButton: {
    marginTop: Spacing.sm,
  },
})
