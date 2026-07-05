import React, { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ActivityIndicator, Alert, Modal, TextInput, Platform,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { decode } from 'base64-arraybuffer'
import { useTranslation } from 'react-i18next'
import { FileText, Plus, Trash2 } from 'lucide-react-native'
import { supabase } from '@/lib/supabase'
import { Colors, Typography, Spacing, Radius, ActionSheet } from '@/components/ui'
import { DocumentViewer } from './DocumentViewer'

export interface ObjectDocument {
  id: string
  object_id: string
  user_id: string
  storage_path: string
  file_name: string
  mime_type: string
  size_bytes: number | null
  doc_type: 'facture' | 'notice' | 'assurance' | 'autre'
  doc_type_label: string | null
  position: number
  created_at: string
}

const DOC_TYPES: { key: ObjectDocument['doc_type']; labelKey: string }[] = [
  { key: 'facture', labelKey: 'documents.typeFacture' },
  { key: 'notice', labelKey: 'documents.typeNotice' },
  { key: 'assurance', labelKey: 'documents.typeAssurance' },
  { key: 'autre', labelKey: 'documents.typeAutre' },
]

function formatSize(bytes: number | null, t: (k: string, o?: any) => string): string {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return t('documents.sizeKb', { n: Math.round(bytes / 1024) })
  return t('documents.sizeMb', { n: (bytes / (1024 * 1024)).toFixed(1) })
}

interface DocumentsSectionProps {
  objectId: string
  documents: ObjectDocument[]
  onDocumentsChange: (docs: ObjectDocument[]) => void
}

export function DocumentsSection({ objectId, documents, onDocumentsChange }: DocumentsSectionProps) {
  const { t } = useTranslation()
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})
  const [addSheetVisible, setAddSheetVisible] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [pendingDoc, setPendingDoc] = useState<ObjectDocument | null>(null)
  const [pendingLabel, setPendingLabel] = useState('')
  const [customMode, setCustomMode] = useState(false)
  const [viewerDoc, setViewerDoc] = useState<ObjectDocument | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ObjectDocument | null>(null)

  useEffect(() => {
    if (!documents.length) return
    const paths = documents.map(d => d.storage_path)
    supabase.storage.from('object-documents').createSignedUrls(paths, 3600).then(({ data }) => {
      if (!data) return
      const map: Record<string, string> = {}
      for (const s of data) { if (s.signedUrl && s.path) map[s.path] = s.signedUrl }
      setSignedUrls(map)
    })
  }, [documents.map(d => d.storage_path).join(',')])

  async function uploadFile(uri: string, fileName: string, mimeType: string) {
    setUploading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error(t('documents.notAuthenticated'))
      const userId = session.user.id

      const ext = fileName.split('.').pop() ?? 'dat'
      const storagePath = `${userId}/${objectId}/${Date.now()}.${ext}`

      let uploadBody: ArrayBuffer | File
      let sizeBytes: number | null = null
      if (Platform.OS === 'web' && (globalThis as any).File && uri.startsWith('blob:')) {
        const resp = await fetch(uri)
        const blob = await resp.blob()
        uploadBody = new File([blob], fileName, { type: mimeType })
        sizeBytes = blob.size
      } else {
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 })
        uploadBody = decode(base64)
        sizeBytes = uploadBody.byteLength
      }

      const { error: upErr } = await supabase.storage
        .from('object-documents')
        .upload(storagePath, uploadBody, { contentType: mimeType })
      if (upErr) throw upErr

      const { data: inserted, error: insErr } = await supabase
        .from('object_documents')
        .insert({
          object_id: objectId,
          user_id: userId,
          storage_path: storagePath,
          file_name: fileName,
          mime_type: mimeType,
          size_bytes: sizeBytes,
          doc_type: 'autre',
          position: documents.length,
        })
        .select()
        .single()
      if (insErr) throw insErr

      // Ouvre directement le sélecteur de type — l'upload est déjà fait
      setPendingDoc(inserted as ObjectDocument)
      setPendingLabel('')
      onDocumentsChange([...documents, inserted as ObjectDocument])
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : t('documents.uploadFailed'))
    } finally {
      setUploading(false)
    }
  }

  async function pickFromCamera() {
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) {
      Alert.alert(t('capture.permissionDeniedTitle'), t('documents.permissionCamera'))
      return
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.85 })
    if (result.canceled || !result.assets[0]) return
    const asset = result.assets[0]
    const mimeType = asset.mimeType ?? 'image/jpeg'
    const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg'
    await uploadFile(asset.uri, `photo-${Date.now()}.${ext}`, mimeType)
  }

  async function pickFromLibrary() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) {
      Alert.alert(t('capture.permissionDeniedTitle'), t('documents.permissionLibrary'))
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 })
    if (result.canceled || !result.assets[0]) return
    const asset = result.assets[0]
    const mimeType = asset.mimeType ?? 'image/jpeg'
    const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg'
    await uploadFile(asset.uri, `photo-${Date.now()}.${ext}`, mimeType)
  }

  async function pickFromFiles() {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    })
    if (result.canceled || !result.assets[0]) return
    const asset = result.assets[0]
    await uploadFile(asset.uri, asset.name, asset.mimeType ?? 'application/octet-stream')
  }

  async function confirmType(type: ObjectDocument['doc_type']) {
    if (!pendingDoc) return
    const label = type === 'autre' ? pendingLabel.trim() : null
    const { error } = await supabase
      .from('object_documents')
      .update({ doc_type: type, doc_type_label: label })
      .eq('id', pendingDoc.id)
    if (!error) {
      const updated = documents.map(d => d.id === pendingDoc.id ? { ...d, doc_type: type, doc_type_label: label } : d)
      onDocumentsChange(updated)
    }
    setPendingDoc(null)
    setPendingLabel('')
    setCustomMode(false)
  }

  async function deleteDocument() {
    if (!deleteTarget) return
    await supabase.storage.from('object-documents').remove([deleteTarget.storage_path])
    await supabase.from('object_documents').delete().eq('id', deleteTarget.id)
    onDocumentsChange(documents.filter(d => d.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  function typeLabel(doc: ObjectDocument): string {
    if (doc.doc_type === 'autre' && doc.doc_type_label) return doc.doc_type_label
    const found = DOC_TYPES.find(dt => dt.key === doc.doc_type)
    return found ? t(found.labelKey) : t('documents.typeAutre')
  }

  return (
    <View>
      <Text style={s.sectionTitle}>{t('documents.title')}</Text>

      <View style={s.card}>
        {documents.map((doc, i) => {
          const isImage = doc.mime_type.startsWith('image/')
          const url = signedUrls[doc.storage_path]
          return (
            <TouchableOpacity
              key={doc.id}
              style={[s.row, i > 0 && s.rowSep]}
              onPress={() => url && setViewerDoc(doc)}
              activeOpacity={0.7}
            >
              <View style={s.thumb}>
                {isImage && url
                  ? <Image source={{ uri: url }} style={s.thumbImg} resizeMode="cover" />
                  : <FileText size={20} color={Colors.textTertiary} strokeWidth={1.6} />
                }
              </View>
              <View style={s.rowContent}>
                <Text style={s.fileName} numberOfLines={1}>{doc.file_name}</Text>
                <Text style={s.meta}>
                  {typeLabel(doc)}{doc.size_bytes ? ` · ${formatSize(doc.size_bytes, t)}` : ''}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setDeleteTarget(doc)} hitSlop={8} style={s.removeBtn}>
                <Trash2 size={16} color={Colors.textTertiary} strokeWidth={1.6} />
              </TouchableOpacity>
            </TouchableOpacity>
          )
        })}

        {documents.length > 0 && <View style={s.rowSep} />}
        <TouchableOpacity
          style={s.addCta}
          onPress={() => setAddSheetVisible(true)}
          disabled={uploading}
          activeOpacity={0.8}
        >
          {uploading
            ? <ActivityIndicator size="small" color={Colors.accent} />
            : <>
                <Plus size={15} color={Colors.accent} strokeWidth={2.2} />
                <Text style={s.addCtaText}>{t('documents.add')}</Text>
              </>
          }
        </TouchableOpacity>
      </View>

      {/* Choix source */}
      <ActionSheet
        visible={addSheetVisible}
        onClose={() => setAddSheetVisible(false)}
        options={[
          { label: t('documents.sourcePhoto'), onPress: pickFromCamera },
          { label: t('documents.sourceLibrary'), onPress: pickFromLibrary },
          { label: t('documents.sourceFile'), onPress: pickFromFiles },
          { label: t('common.cancel'), onPress: () => {}, cancel: true },
        ]}
      />

      {/* Choix du type — apparaît juste après l'upload */}
      <Modal visible={!!pendingDoc} transparent animationType="fade">
        <View style={s.typeBackdrop}>
          <View style={s.typeSheet}>
            <Text style={s.typeTitle}>{t('documents.typeTitle')}</Text>
            <View style={s.typeChips}>
              {DOC_TYPES.map(dt => (
                <TouchableOpacity
                  key={dt.key}
                  style={[s.typeChip, dt.key === 'autre' && customMode && s.typeChipActive]}
                  onPress={() => dt.key === 'autre' ? setCustomMode(true) : confirmType(dt.key)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.typeChipText, dt.key === 'autre' && customMode && s.typeChipTextActive]}>{t(dt.labelKey)}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {customMode && (
              <>
                <TextInput
                  style={s.typeInput}
                  placeholder={t('documents.customLabel')}
                  placeholderTextColor={Colors.textTertiary}
                  value={pendingLabel}
                  onChangeText={setPendingLabel}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={() => confirmType('autre')}
                />
                <TouchableOpacity
                  style={[s.typeConfirm, !pendingLabel.trim() && s.typeConfirmDisabled]}
                  onPress={() => confirmType('autre')}
                  disabled={!pendingLabel.trim()}
                  activeOpacity={0.85}
                >
                  <Text style={s.typeConfirmText}>{t('documents.validate')}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Confirm suppression */}
      <Modal visible={!!deleteTarget} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
        <TouchableOpacity style={s.typeBackdrop} activeOpacity={1} onPress={() => setDeleteTarget(null)} />
        <View style={s.confirmSheet}>
          <View style={s.confirmHandle} />
          <Trash2 size={26} color={Colors.error} strokeWidth={1.5} style={{ alignSelf: 'center', marginBottom: 8 }} />
          <Text style={s.confirmTitle}>{t('documents.deleteTitle')}</Text>
          <Text style={s.confirmSub}>{t('documents.deleteBody')}</Text>
          <View style={s.confirmActions}>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setDeleteTarget(null)}>
              <Text style={s.cancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.confirmBtn} onPress={deleteDocument}>
              <Text style={s.confirmBtnText}>{t('common.delete')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Viewer */}
      {viewerDoc && signedUrls[viewerDoc.storage_path] && (
        <DocumentViewer
          url={signedUrls[viewerDoc.storage_path]}
          fileName={viewerDoc.file_name}
          mimeType={viewerDoc.mime_type}
          onClose={() => setViewerDoc(null)}
        />
      )}
    </View>
  )
}

const s = StyleSheet.create({
  sectionTitle: {
    fontSize: Typography.xs, fontWeight: Typography.bold,
    color: Colors.textTertiary, textTransform: 'uppercase',
    letterSpacing: 0.8, marginBottom: Spacing.xs,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 0.5,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  rowSep: { borderTopWidth: 0.5, borderTopColor: Colors.borderLight },
  thumb: {
    width: 40, height: 40, borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceWarm,
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  rowContent: { flex: 1 },
  fileName: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textPrimary },
  meta: { fontSize: Typography.xs, color: Colors.textTertiary, marginTop: 2 },
  removeBtn: { padding: 4 },

  addCta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 11,
    margin: Spacing.sm,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentLight,
  },
  addCtaText: { fontSize: Typography.sm, color: Colors.accent, fontWeight: Typography.semibold },

  typeBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.4)' },
  typeSheet: {
    position: 'absolute', left: Spacing.lg, right: Spacing.lg, top: '30%',
    backgroundColor: Colors.surface, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.md,
  },
  typeTitle: { fontSize: Typography.md, fontWeight: Typography.bold, color: Colors.textPrimary },
  typeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  typeChip: {
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: Radius.full, backgroundColor: Colors.surfaceWarm,
    borderWidth: 1, borderColor: Colors.border,
  },
  typeChipText: { fontSize: Typography.sm, color: Colors.textPrimary, fontWeight: Typography.medium },
  typeChipActive: { backgroundColor: Colors.accentLight, borderColor: Colors.accent },
  typeChipTextActive: { color: Colors.accent, fontWeight: Typography.semibold },
  typeInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    fontSize: Typography.sm, color: Colors.textPrimary,
  },
  typeConfirm: {
    backgroundColor: Colors.accent, borderRadius: Radius.md,
    paddingVertical: 12, alignItems: 'center',
  },
  typeConfirmDisabled: { opacity: 0.5 },
  typeConfirmText: { color: 'white', fontSize: Typography.sm, fontWeight: Typography.bold },

  confirmSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: Spacing.lg, paddingBottom: 40,
  },
  confirmHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.borderLight, alignSelf: 'center', marginBottom: Spacing.md },
  confirmTitle: { fontSize: Typography.md, fontWeight: Typography.bold, color: Colors.textPrimary, textAlign: 'center' },
  confirmSub: { fontSize: Typography.sm, color: Colors.textSecondary, textAlign: 'center', marginTop: 4, marginBottom: Spacing.md },
  confirmActions: { flexDirection: 'row', gap: Spacing.sm },
  cancelBtn: { flex: 1, paddingVertical: 13, borderRadius: Radius.md, backgroundColor: Colors.surfaceWarm, alignItems: 'center' },
  cancelText: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary },
  confirmBtn: { flex: 1, paddingVertical: 13, borderRadius: Radius.md, backgroundColor: Colors.error, alignItems: 'center' },
  confirmBtnText: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: 'white' },
})
