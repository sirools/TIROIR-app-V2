import React, { useEffect, useState } from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  ActivityIndicator, Alert, Modal, TextInput, Platform, Switch, ScrollView,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system/legacy'
import { decode } from 'base64-arraybuffer'
import { useTranslation } from 'react-i18next'
import { FileText, Plus, Trash2, CalendarDays, Pencil, Camera, Image as LucideImage, File as FileIcon } from 'lucide-react-native'
import DateTimePicker from '@react-native-community/datetimepicker'
import { supabase } from '@/lib/supabase'
import { Colors, Typography, Spacing, Radius } from '@/components/ui'
import { DocumentViewer } from './DocumentViewer'
import { ObjectDocument } from './DocumentsSection'
import { ObjectInsurance } from '@/types/database'

type BillingPeriod = 'monthly' | 'yearly'

interface DraftState {
  label: string
  price: string
  billing_period: BillingPeriod
  coverage: string
  date: string
}

type FormMode = { type: 'none' } | { type: 'add' } | { type: 'edit'; id: string }

const emptyDraft: DraftState = { label: '', price: '', billing_period: 'yearly', coverage: '', date: '' }
const round2 = (n: number) => Math.round(n * 100) / 100

interface InsurancesSectionProps {
  objectId: string
  insured: boolean
  currencySymbol: string
  documents: ObjectDocument[]
  onDocumentsChange: (docs: ObjectDocument[]) => void
  onToggleInsured: (v: boolean) => void
}

export function InsurancesSection({
  objectId, insured, currencySymbol, documents, onDocumentsChange, onToggleInsured,
}: InsurancesSectionProps) {
  const { t, i18n } = useTranslation()
  const [insurances, setInsurances] = useState<ObjectInsurance[]>([])
  const [loaded, setLoaded] = useState(false)
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})

  const [mode, setMode] = useState<FormMode>({ type: 'none' })
  const [draft, setDraft] = useState<DraftState>(emptyDraft)
  const [datePickerOpen, setDatePickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [linkTarget, setLinkTarget] = useState<string | null>(null)
  const [uploadingFor, setUploadingFor] = useState<string | null>(null)

  const [viewerDoc, setViewerDoc] = useState<ObjectDocument | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ObjectInsurance | null>(null)

  useEffect(() => {
    if (!insured) return
    supabase.from('object_insurances').select('*').eq('object_id', objectId).order('position').then(({ data }) => {
      setInsurances((data as ObjectInsurance[]) ?? [])
      setLoaded(true)
    })
  }, [objectId, insured])

  // URLs signées des contrats liés (documents avec insurance_id)
  const linkedPaths = documents.filter(d => d.insurance_id).map(d => d.storage_path)
  useEffect(() => {
    const missing = linkedPaths.filter(p => !signedUrls[p])
    if (!missing.length) return
    supabase.storage.from('object-documents').createSignedUrls(missing, 3600).then(({ data }) => {
      if (!data) return
      const map: Record<string, string> = {}
      for (const s of data) { if (s.signedUrl && s.path) map[s.path] = s.signedUrl }
      setSignedUrls(prev => ({ ...prev, ...map }))
    })
  }, [linkedPaths.join(',')])

  function openAdd() { setDraft(emptyDraft); setMode({ type: 'add' }) }
  function openEdit(ins: ObjectInsurance) {
    setDraft({
      label: ins.label ?? '',
      price: ins.price != null ? String(ins.price) : '',
      billing_period: ins.billing_period,
      coverage: ins.coverage != null ? String(ins.coverage) : '',
      date: ins.date ?? '',
    })
    setMode({ type: 'edit', id: ins.id })
  }
  function cancelForm() { setMode({ type: 'none' }); setDraft(emptyDraft) }

  function changePeriod(next: BillingPeriod) {
    setDraft(d => {
      if (d.billing_period === next) return d
      const n = parseFloat(d.price.trim().replace(',', '.'))
      const price = isNaN(n) ? d.price : String(round2(next === 'yearly' ? n * 12 : n / 12))
      return { ...d, billing_period: next, price }
    })
  }

  async function submitForm() {
    const price = draft.price.trim() ? parseFloat(draft.price.trim().replace(',', '.')) : null
    if (price !== null && (isNaN(price) || price < 0)) return
    const coverage = draft.coverage.trim() ? parseFloat(draft.coverage.trim().replace(',', '.')) : null
    if (coverage !== null && (isNaN(coverage) || coverage < 0)) return
    setSaving(true)
    try {
      const patch = {
        label: draft.label.trim() || null,
        price,
        billing_period: draft.billing_period,
        coverage,
        date: draft.date || null,
      }
      if (mode.type === 'edit') {
        const { error } = await supabase.from('object_insurances').update(patch).eq('id', mode.id)
        if (error) throw error
        setInsurances(prev => prev.map(i => i.id === mode.id ? { ...i, ...patch } as ObjectInsurance : i))
      } else {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) throw new Error(t('documents.notAuthenticated'))
        const { data, error } = await supabase.from('object_insurances')
          .insert({ object_id: objectId, user_id: session.user.id, position: insurances.length, ...patch })
          .select().single()
        if (error) throw error
        setInsurances(prev => [...prev, data as ObjectInsurance])
      }
      cancelForm()
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : t('documents.uploadFailed'))
    } finally {
      setSaving(false)
    }
  }

  async function deleteInsurance() {
    if (!deleteTarget) return
    const target = deleteTarget
    setDeleteTarget(null)
    // Les contrats liés sont détachés (insurance_id → null via ON DELETE SET NULL ?
    // ici ON DELETE CASCADE supprimerait les lignes : on détache d'abord pour garder
    // les documents dans la carte Documents).
    const linked = documents.filter(d => d.insurance_id === target.id)
    if (linked.length) {
      await supabase.from('object_documents').update({ insurance_id: null }).eq('insurance_id', target.id)
      onDocumentsChange(documents.map(d => d.insurance_id === target.id ? { ...d, insurance_id: null } : d))
    }
    const { error } = await supabase.from('object_insurances').delete().eq('id', target.id)
    if (error) { Alert.alert(t('common.error'), error.message); return }
    setInsurances(prev => prev.filter(i => i.id !== target.id))
  }

  async function linkDoc(insuranceId: string, doc: ObjectDocument) {
    setLinkTarget(null)
    const { error } = await supabase.from('object_documents').update({ insurance_id: insuranceId }).eq('id', doc.id)
    if (error) { Alert.alert(t('common.error'), error.message); return }
    onDocumentsChange(documents.map(d => d.id === doc.id ? { ...d, insurance_id: insuranceId } : d))
  }

  async function unlinkDoc(doc: ObjectDocument) {
    const { error } = await supabase.from('object_documents').update({ insurance_id: null }).eq('id', doc.id)
    if (error) { Alert.alert(t('common.error'), error.message); return }
    onDocumentsChange(documents.map(d => d.id === doc.id ? { ...d, insurance_id: null } : d))
  }

  async function uploadAndLink(uri: string, fileName: string, mimeType: string, insuranceId: string) {
    setUploadingFor(insuranceId)
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
        .from('object-documents').upload(storagePath, uploadBody, { contentType: mimeType })
      if (upErr) throw upErr

      const { data: inserted, error: insErr } = await supabase.from('object_documents')
        .insert({
          object_id: objectId, user_id: userId, storage_path: storagePath,
          file_name: fileName, mime_type: mimeType, size_bytes: sizeBytes,
          doc_type: 'assurance', insurance_id: insuranceId, position: documents.length,
        })
        .select().single()
      if (insErr) throw insErr

      onDocumentsChange([...documents, inserted as ObjectDocument])
      if (Platform.OS !== 'web' || !uri.startsWith('blob:')) {
        const { data } = await supabase.storage.from('object-documents').createSignedUrls([storagePath], 3600)
        if (data?.[0]?.signedUrl) setSignedUrls(prev => ({ ...prev, [storagePath]: data[0].signedUrl! }))
      }
    } catch (err) {
      Alert.alert(t('common.error'), err instanceof Error ? err.message : t('documents.uploadFailed'))
    } finally {
      setUploadingFor(null)
      setLinkTarget(null)
    }
  }

  async function pickFromCamera(insuranceId: string) {
    setLinkTarget(null)
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) { Alert.alert(t('capture.permissionDeniedTitle'), t('documents.permissionCamera')); return }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.85 })
    if (result.canceled || !result.assets[0]) return
    const asset = result.assets[0]
    const mimeType = asset.mimeType ?? 'image/jpeg'
    const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg'
    await uploadAndLink(asset.uri, `contrat-${Date.now()}.${ext}`, mimeType, insuranceId)
  }
  async function pickFromLibrary(insuranceId: string) {
    setLinkTarget(null)
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!perm.granted) { Alert.alert(t('capture.permissionDeniedTitle'), t('documents.permissionLibrary')); return }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 })
    if (result.canceled || !result.assets[0]) return
    const asset = result.assets[0]
    const mimeType = asset.mimeType ?? 'image/jpeg'
    const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg'
    await uploadAndLink(asset.uri, `contrat-${Date.now()}.${ext}`, mimeType, insuranceId)
  }
  async function pickFromFiles(insuranceId: string) {
    setLinkTarget(null)
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*'], copyToCacheDirectory: true })
    if (result.canceled || !result.assets[0]) return
    const asset = result.assets[0]
    await uploadAndLink(asset.uri, asset.name, asset.mimeType ?? 'application/octet-stream', insuranceId)
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' })
  }
  function periodSuffix(p: BillingPeriod) {
    return p === 'monthly' ? t('object.insurance.perMonth') : t('object.insurance.perYear')
  }

  const availableDocs = documents.filter(d => !d.insurance_id)

  function renderForm(submitLabel: string) {
    return (
      <View style={s.form}>
        <Text style={s.fieldLabel}>{t('object.insurance.labelField')}</Text>
        <TextInput
          style={s.input} value={draft.label}
          onChangeText={v => setDraft(d => ({ ...d, label: v }))}
          placeholder={t('object.insurance.labelPlaceholder')} placeholderTextColor={Colors.textTertiary}
        />

        <Text style={s.fieldLabel}>{t('object.insurance.recurrence')}</Text>
        <View style={s.segment}>
          {(['monthly', 'yearly'] as BillingPeriod[]).map(p => (
            <TouchableOpacity
              key={p}
              style={[s.segmentBtn, draft.billing_period === p && s.segmentBtnActive]}
              onPress={() => changePeriod(p)}
              activeOpacity={0.8}
            >
              <Text style={[s.segmentText, draft.billing_period === p && s.segmentTextActive]}>
                {p === 'monthly' ? t('object.insurance.monthly') : t('object.insurance.yearly')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.fieldLabel}>{t('object.insurance.priceField')}</Text>
        <TextInput
          style={s.input} value={draft.price}
          onChangeText={v => setDraft(d => ({ ...d, price: v }))}
          keyboardType="decimal-pad"
          placeholder={t('object.insurance.pricePlaceholder')} placeholderTextColor={Colors.textTertiary}
        />

        <Text style={s.fieldLabel}>{t('object.insurance.coverageField')}</Text>
        <TextInput
          style={s.input} value={draft.coverage}
          onChangeText={v => setDraft(d => ({ ...d, coverage: v }))}
          keyboardType="decimal-pad"
          placeholder={t('object.insurance.coveragePlaceholder')} placeholderTextColor={Colors.textTertiary}
        />

        <Text style={s.fieldLabel}>{t('object.insurance.expiryField')}</Text>
        <TouchableOpacity style={s.dateBtn} onPress={() => setDatePickerOpen(true)} activeOpacity={0.7}>
          <CalendarDays size={16} color={draft.date ? Colors.textPrimary : Colors.textTertiary} strokeWidth={1.5} />
          <Text style={[s.dateBtnText, !draft.date && { color: Colors.textTertiary }]}>
            {draft.date ? fmtDate(draft.date) : t('object.chooseDate')}
          </Text>
          {draft.date ? (
            <TouchableOpacity onPress={() => setDraft(d => ({ ...d, date: '' }))} hitSlop={8}><Text style={s.dateClear}>×</Text></TouchableOpacity>
          ) : null}
        </TouchableOpacity>
        {datePickerOpen && (
          <DateTimePicker
            value={draft.date ? new Date(draft.date) : new Date()}
            mode="date"
            display="spinner"
            locale={i18n.language}
            onChange={(_, selected) => {
              setDatePickerOpen(false)
              if (selected) setDraft(d => ({ ...d, date: selected.toISOString().split('T')[0] }))
            }}
          />
        )}

        <View style={s.formActions}>
          <TouchableOpacity style={s.cancelBtn} onPress={cancelForm}>
            <Text style={s.cancelText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.saveBtn} onPress={submitForm} disabled={saving} activeOpacity={0.85}>
            {saving ? <ActivityIndicator size="small" color="white" /> : <Text style={s.saveText}>{submitLabel}</Text>}
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <View style={s.section}>
      {/* Toggle maître */}
      <View style={s.toggleRow}>
        <Text style={s.sectionLabel}>{t('object.insurance.title')}</Text>
        <View style={s.toggleRight}>
          <Text style={s.toggleHint}>{t('object.insurance.toggle')}</Text>
          <Switch value={insured} onValueChange={onToggleInsured} trackColor={{ true: Colors.accent }} />
        </View>
      </View>

      {insured && (
        <View style={s.body}>
          {!loaded ? (
            <ActivityIndicator color={Colors.accent} size="small" style={{ marginVertical: Spacing.sm }} />
          ) : (
            <>
              {insurances.length === 0 && mode.type !== 'add' && (
                <Text style={s.empty}>{t('object.insurance.emptyOn')}</Text>
              )}

              {insurances.map(ins => {
                if (mode.type === 'edit' && mode.id === ins.id) {
                  return <View key={ins.id}>{renderForm(t('object.insurance.validate'))}</View>
                }
                const docs = documents.filter(d => d.insurance_id === ins.id)
                return (
                  <View key={ins.id} style={s.insCard}>
                    <View style={s.insHead}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.insTitle}>{ins.label || t('object.insurance.untitled')}</Text>
                        <Text style={s.insMeta}>
                          {ins.price != null
                            ? `${ins.price.toLocaleString(i18n.language)} ${currencySymbol} ${periodSuffix(ins.billing_period)}`
                            : '—'}
                        </Text>
                        {ins.coverage != null && (
                          <Text style={s.insSub}>{t('object.insurance.coverageUpTo', { sym: currencySymbol, value: ins.coverage.toLocaleString(i18n.language) })}</Text>
                        )}
                        {ins.date && (
                          <Text style={s.insSub}>{t('object.insurance.expiry', { date: fmtDate(ins.date) })}</Text>
                        )}
                      </View>
                      <View style={s.insActions}>
                        <TouchableOpacity onPress={() => openEdit(ins)} hitSlop={8} style={s.iconBtn}>
                          <Pencil size={15} color={Colors.textTertiary} strokeWidth={1.8} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setDeleteTarget(ins)} hitSlop={8} style={s.iconBtn}>
                          <Trash2 size={16} color={Colors.textTertiary} strokeWidth={1.7} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Contrats liés */}
                    {docs.map(doc => {
                      const isImage = doc.mime_type.startsWith('image/')
                      const url = signedUrls[doc.storage_path]
                      return (
                        <TouchableOpacity key={doc.id} style={s.docRow} onPress={() => url && setViewerDoc(doc)} activeOpacity={0.7}>
                          <View style={s.thumb}>
                            {isImage && url
                              ? <Image source={{ uri: url }} style={s.thumbImg} resizeMode="cover" />
                              : <FileText size={16} color={Colors.textTertiary} strokeWidth={1.6} />}
                          </View>
                          <Text style={s.docName} numberOfLines={1}>{doc.file_name}</Text>
                          <TouchableOpacity onPress={() => unlinkDoc(doc)} hitSlop={8} style={s.docUnlink}>
                            <Text style={s.docUnlinkText}>{t('object.insurance.unlink')}</Text>
                          </TouchableOpacity>
                        </TouchableOpacity>
                      )
                    })}

                    <TouchableOpacity
                      style={s.linkBtn}
                      onPress={() => setLinkTarget(ins.id)}
                      disabled={uploadingFor === ins.id}
                      activeOpacity={0.8}
                    >
                      {uploadingFor === ins.id
                        ? <ActivityIndicator size="small" color="#5B6B7B" />
                        : <>
                            <Plus size={14} color="#5B6B7B" strokeWidth={2.2} />
                            <Text style={s.linkText}>{t('object.insurance.linkContract')}</Text>
                          </>}
                    </TouchableOpacity>
                  </View>
                )
              })}

              {/* Ajout */}
              {mode.type === 'add'
                ? renderForm(t('object.insurance.add'))
                : (
                  <TouchableOpacity style={s.addInsBtn} onPress={openAdd} activeOpacity={0.85}>
                    <Plus size={15} color={Colors.accent} strokeWidth={2.2} />
                    <Text style={s.addInsText}>{t('object.insurance.addOne')}</Text>
                  </TouchableOpacity>
                )}
            </>
          )}
        </View>
      )}

      {/* Drawer : lier un contrat */}
      <Modal visible={linkTarget !== null} transparent animationType="slide" onRequestClose={() => setLinkTarget(null)}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={() => setLinkTarget(null)} />
        <View style={s.drawer}>
          <View style={s.drawerHandle} />
          <Text style={s.drawerTitle}>{t('object.insurance.linkTitle')}</Text>

          {availableDocs.length > 0 ? (
            <>
              <Text style={s.drawerLabel}>{t('object.insurance.linkPick')}</Text>
              <ScrollView style={{ maxHeight: 240 }} showsVerticalScrollIndicator={false}>
                {availableDocs.map(doc => {
                  const isImage = doc.mime_type.startsWith('image/')
                  const url = signedUrls[doc.storage_path]
                  return (
                    <TouchableOpacity
                      key={doc.id}
                      style={s.pickRow}
                      onPress={() => { const id = linkTarget; if (id) linkDoc(id, doc) }}
                      activeOpacity={0.7}
                    >
                      <View style={s.thumb}>
                        {isImage && url
                          ? <Image source={{ uri: url }} style={s.thumbImg} resizeMode="cover" />
                          : <FileText size={16} color={Colors.textTertiary} strokeWidth={1.6} />}
                      </View>
                      <Text style={s.docName} numberOfLines={1}>{doc.file_name}</Text>
                      <Plus size={16} color={Colors.accent} strokeWidth={2.2} />
                    </TouchableOpacity>
                  )
                })}
              </ScrollView>
            </>
          ) : (
            <Text style={s.drawerEmpty}>{t('object.insurance.linkEmpty')}</Text>
          )}

          <Text style={s.drawerLabel}>{t('object.insurance.linkUpload')}</Text>
          <View style={s.sourceRow}>
            <TouchableOpacity style={s.sourceBtn} onPress={() => { const id = linkTarget; if (id) pickFromCamera(id) }} activeOpacity={0.8}>
              <Camera size={18} color={Colors.accent} strokeWidth={1.8} />
              <Text style={s.sourceText}>{t('documents.sourcePhoto')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.sourceBtn} onPress={() => { const id = linkTarget; if (id) pickFromLibrary(id) }} activeOpacity={0.8}>
              <LucideImage size={18} color={Colors.accent} strokeWidth={1.8} />
              <Text style={s.sourceText}>{t('documents.sourceLibrary')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.sourceBtn} onPress={() => { const id = linkTarget; if (id) pickFromFiles(id) }} activeOpacity={0.8}>
              <FileIcon size={18} color={Colors.accent} strokeWidth={1.8} />
              <Text style={s.sourceText}>{t('documents.sourceFile')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Confirmation suppression assurance */}
      <Modal visible={!!deleteTarget} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={() => setDeleteTarget(null)} />
        <View style={s.confirmSheet}>
          <View style={s.drawerHandle} />
          <Trash2 size={26} color={Colors.error} strokeWidth={1.5} style={{ alignSelf: 'center', marginBottom: 8 }} />
          <Text style={s.confirmTitle}>{t('object.insurance.deleteTitle')}</Text>
          <Text style={s.confirmSub}>{t('object.insurance.deleteBody')}</Text>
          <View style={s.confirmActions}>
            <TouchableOpacity style={s.cancelBtn} onPress={() => setDeleteTarget(null)}>
              <Text style={s.cancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.confirmBtn} onPress={deleteInsurance}>
              <Text style={s.confirmBtnText}>{t('common.delete')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Visionneuse */}
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
  section: { paddingHorizontal: Spacing.md, gap: Spacing.sm },
  sectionLabel: { fontSize: Typography.xs, color: Colors.textTertiary, fontWeight: Typography.semibold, letterSpacing: 0.5, textTransform: 'uppercase' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  toggleHint: { fontSize: Typography.sm, color: Colors.textSecondary },
  body: { gap: Spacing.sm },
  empty: { fontSize: Typography.sm, color: Colors.textTertiary, fontStyle: 'italic' },

  insCard: {
    backgroundColor: Colors.background, borderRadius: Radius.md,
    borderWidth: 0.5, borderColor: Colors.border, padding: Spacing.sm, gap: Spacing.xs,
  },
  insHead: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  insTitle: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  insMeta: { fontSize: Typography.sm, color: Colors.textSecondary, marginTop: 2, fontWeight: Typography.medium },
  insSub: { fontSize: Typography.xs, color: Colors.textTertiary, marginTop: 2 },
  insActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  iconBtn: { padding: 4 },

  docRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: 6, paddingHorizontal: 4,
    borderTopWidth: 0.5, borderTopColor: Colors.borderLight,
  },
  thumb: {
    width: 32, height: 32, borderRadius: Radius.sm,
    backgroundColor: Colors.surfaceWarm,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  thumbImg: { width: '100%', height: '100%' },
  docName: { flex: 1, fontSize: Typography.sm, color: Colors.textPrimary },
  docUnlink: { paddingHorizontal: 8, paddingVertical: 2 },
  docUnlinkText: { fontSize: Typography.xs, color: Colors.textTertiary, fontWeight: Typography.medium },

  // CTA tertiaire (bleu-gris) — subordonné au bouton « Ajouter une assurance »
  linkBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 9, marginTop: 4, borderRadius: Radius.sm, backgroundColor: '#EEF2F7',
  },
  linkText: { fontSize: Typography.xs, color: '#5B6B7B', fontWeight: Typography.semibold },

  addInsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 11, borderRadius: Radius.md, backgroundColor: Colors.accentLight,
  },
  addInsText: { fontSize: Typography.sm, color: Colors.accent, fontWeight: Typography.semibold },

  form: {
    backgroundColor: Colors.background, borderRadius: Radius.md,
    borderWidth: 0.5, borderColor: Colors.border, padding: Spacing.sm, gap: Spacing.xs,
  },
  fieldLabel: { fontSize: Typography.xs, color: Colors.textTertiary, fontWeight: Typography.semibold, letterSpacing: 0.5, marginTop: Spacing.xs },
  input: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    fontSize: Typography.base, color: Colors.textPrimary, backgroundColor: Colors.surface,
  },
  segment: {
    flexDirection: 'row', backgroundColor: Colors.surfaceWarm,
    borderRadius: Radius.md, padding: 3, gap: 3,
  },
  segmentBtn: { flex: 1, paddingVertical: 8, borderRadius: Radius.sm, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: Colors.surface, borderWidth: 0.5, borderColor: Colors.border },
  segmentText: { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: Typography.medium },
  segmentTextActive: { color: Colors.textPrimary, fontWeight: Typography.semibold },

  dateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 10, backgroundColor: Colors.surface,
  },
  dateBtnText: { flex: 1, fontSize: Typography.base, color: Colors.textPrimary },
  dateClear: { fontSize: 18, color: Colors.textTertiary, lineHeight: 20 },
  formActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },

  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  cancelText: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textSecondary },
  saveBtn: { flex: 1, paddingVertical: 12, borderRadius: Radius.md, backgroundColor: Colors.accent, alignItems: 'center' },
  saveText: { fontSize: Typography.sm, fontWeight: Typography.bold, color: 'white' },

  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.4)' },
  drawer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: Spacing.lg, paddingBottom: 40, gap: Spacing.sm,
  },
  drawerHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.borderLight, alignSelf: 'center', marginBottom: Spacing.sm },
  drawerTitle: { fontSize: Typography.md, fontWeight: Typography.bold, color: Colors.textPrimary },
  drawerLabel: { fontSize: Typography.xs, color: Colors.textTertiary, fontWeight: Typography.semibold, letterSpacing: 0.5, marginTop: Spacing.xs, textTransform: 'uppercase' },
  drawerEmpty: { fontSize: Typography.sm, color: Colors.textSecondary },
  pickRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.sm, paddingHorizontal: 4,
    borderBottomWidth: 0.5, borderBottomColor: Colors.borderLight,
  },
  sourceRow: { flexDirection: 'row', gap: Spacing.sm },
  sourceBtn: {
    flex: 1, alignItems: 'center', gap: 4, paddingVertical: Spacing.sm,
    borderRadius: Radius.md, backgroundColor: Colors.accentLight,
  },
  sourceText: { fontSize: Typography.xs, color: Colors.accent, fontWeight: Typography.semibold },

  confirmSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: Spacing.lg, paddingBottom: 40,
  },
  confirmTitle: { fontSize: Typography.md, fontWeight: Typography.bold, color: Colors.textPrimary, textAlign: 'center' },
  confirmSub: { fontSize: Typography.sm, color: Colors.textSecondary, textAlign: 'center', marginTop: 4, marginBottom: Spacing.md },
  confirmActions: { flexDirection: 'row', gap: Spacing.sm },
  confirmBtn: { flex: 1, paddingVertical: 13, borderRadius: Radius.md, backgroundColor: Colors.error, alignItems: 'center' },
  confirmBtnText: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: 'white' },
})
