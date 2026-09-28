import React, { useCallback, useState, useRef } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  RefreshControl, Alert, TextInput, Image, Dimensions, Modal, Animated, ScrollView,
} from 'react-native'
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft, MoreHorizontal, Minus, Plus,
  CheckSquare, Square, Trash2, MoveRight, Tag, Share2, CheckCircle,
  Camera, Images, Layers, ChevronRight, ChevronDown, FolderPlus,
  Search, SlidersHorizontal,
} from 'lucide-react-native'
import { supabase } from '@/lib/supabase'
import {
  Screen, EmptyState, ActionSheet, PromptDialog,
  CollectionEditSheet, EditableCollection, CollectionPatch,
  Colors, Typography, Spacing, Radius,
} from '@/components/ui'
import { SharePanel } from '@/components/SharePanel'
import { Collection, TiroirObject, ObjectGroup } from '@/types/database'
import { isLot, lotTotal } from '@/features/objects/quantity'
import { setIconOverride } from '@/utils/collectionIconCache'

// ── Zoom levels ───────────────────────────────────────────────────────────────

const ZOOM_LEVELS = [
  { cols: 5, label: '25%' },
  { cols: 4, label: '50%' },
  { cols: 3, label: '75%' },
  { cols: 2, label: '100%' },
]

const BULK_STATUS_OPTIONS = [
  { value: 'owned',  dot: '#22C55E' },
  { value: 'stored', dot: '#38BDF8' },
  { value: 'loaned', dot: '#E879F9' },
  { value: 'sold',   dot: '#FBBF24' },
  { value: 'given',  dot: '#FB7185' },
  { value: 'lost',   dot: '#9CA3AF' },
]
const DEFAULT_ZOOM = 2 // 75%, 3 colonnes

// ── Types champs d'affichage ──────────────────────────────────────────────────

interface DisplayConfig {
  showPhoto: boolean
  showName: boolean
  showStatus: boolean
  showValue: boolean
  showSize: boolean
  showColor: boolean
  showBrand: boolean
  showEra: boolean
  showCondition: boolean
}

const DEFAULT_DISPLAY: DisplayConfig = {
  showPhoto: true, showName: true, showStatus: false,
  showValue: false, showSize: false, showColor: false,
  showBrand: false, showEra: false, showCondition: false,
}

const DISPLAY_FIELDS: { key: keyof DisplayConfig; labelKey: string; icon: string }[] = [
  { key: 'showPhoto',     labelKey: 'collectionDetail.fieldPhoto',     icon: '📷' },
  { key: 'showName',      labelKey: 'collectionDetail.fieldName',      icon: 'T'  },
  { key: 'showStatus',    labelKey: 'collectionDetail.fieldStatus',    icon: '◎'  },
  { key: 'showValue',     labelKey: 'collectionDetail.fieldValue',     icon: '€'  },
  { key: 'showSize',      labelKey: 'collectionDetail.fieldSize',      icon: '↕'  },
  { key: 'showColor',     labelKey: 'collectionDetail.fieldColor',     icon: '◐'  },
  { key: 'showBrand',     labelKey: 'collectionDetail.fieldBrand',     icon: 'ℹ'  },
  { key: 'showEra',       labelKey: 'collectionDetail.fieldEra',       icon: '📅' },
  { key: 'showCondition', labelKey: 'collectionDetail.fieldCondition', icon: '✦'  },
]

// ── Calcul taille carte ───────────────────────────────────────────────────────

const SCREEN_WIDTH = Dimensions.get('window').width
const GRID_PADDING = Spacing.md // marge latérale de la grille
const TAB_BAR_H = 64            // hauteur CustomTabBar (ICON_AREA_H dans _layout)

/**
 * Gouttière entre cartes. Elle se resserre à mesure qu'on dézoome :
 * à cinq colonnes, un écart trop large mangerait la vignette ; à deux,
 * un écart trop serré ferait bloc.
 */
function gridGap(cols: number) {
  if (cols >= 5) return 6
  if (cols === 4) return 8
  if (cols === 3) return 10
  return 12
}

function cardSize(cols: number) {
  const gap = gridGap(cols)
  return (SCREEN_WIDTH - GRID_PADDING * 2 - gap * (cols - 1)) / cols
}

/** Découpe une liste d'objets en rangées de `cols` cartes. */
function chunk<T>(items: T[], cols: number): T[][] {
  const rows: T[][] = []
  for (let i = 0; i < items.length; i += cols) rows.push(items.slice(i, i + cols))
  return rows
}

// ── Composant carte objet ─────────────────────────────────────────────────────

interface ObjectCardProps {
  object: TiroirObject
  coverUrl: string | null
  onPress: () => void
  onLongPress?: () => void
  cols: number
  display: DisplayConfig
  isSelectMode?: boolean
  isSelected?: boolean
}

function ObjectCard({ object, coverUrl, onPress, onLongPress, cols, display, isSelectMode, isSelected }: ObjectCardProps) {
  const { t, i18n } = useTranslation()
  const size = cardSize(cols)
  const attrs = (object.attributes as Record<string, string> | null) ?? {}
  // Dans une liste on lit un patrimoine : c'est le total du lot qui compte,
  // pas le prix unitaire. La pastille ×N dit d'où vient le montant.
  const quantity = object.quantity ?? 1
  const value = lotTotal(object.user_value ?? object.market_value, quantity)
  const currSym = (object.value_currency ?? 'EUR') === 'EUR' ? '€' : (object.value_currency ?? 'EUR')
  const showInfo = cols <= 4 && (
    display.showName || display.showStatus || display.showBrand || display.showValue ||
    display.showSize || display.showColor || display.showEra || display.showCondition
  )
  // La photo occupe toute la largeur de la carte ; le texte vit dessous,
  // dans le même bloc, pour qu'on lise une carte et non une image suivie
  // d'une légende flottante.
  return (
    <TouchableOpacity
      style={[cardStyles.card, { width: size }, isSelected && cardStyles.cardSelected]}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={300}
      activeOpacity={0.8}
    >
      {display.showPhoto && (
        <View style={[cardStyles.imageWrap, { height: size }]}>
          {coverUrl ? (
            <Image source={{ uri: coverUrl }} style={cardStyles.image} resizeMode="cover" />
          ) : (
            <View style={cardStyles.imagePlaceholder}>
              <Text style={cardStyles.placeholderEmoji}>{cols <= 3 ? '📦' : '·'}</Text>
            </View>
          )}
          {isSelectMode && (
            <View style={[cardStyles.selectOverlay, isSelected && cardStyles.selectOverlayActive]}>
              {isSelected && <Text style={cardStyles.checkmark}>✓</Text>}
            </View>
          )}
          {/* Rien ne s'affiche pour un objet unique : l'ajout unitaire
              retrouve exactement la carte qu'il connaissait. */}
          {isLot(quantity) && (
            <View style={cardStyles.qtyBadge}>
              <Text style={cardStyles.qtyBadgeText}>×{quantity}</Text>
            </View>
          )}
        </View>
      )}

      {showInfo && (
        <View style={[cardStyles.info, cols <= 2 && cardStyles.infoLarge]}>
          {display.showName && (
            <Text style={[cardStyles.title, cols >= 4 && cardStyles.titleSm]} numberOfLines={cols <= 2 ? 2 : 1}>
              {object.title}
            </Text>
          )}
          {display.showStatus && object.status && (
            <Text style={cardStyles.tag}>{t(`status.${object.status}`, { defaultValue: object.status })}</Text>
          )}
          {display.showBrand && attrs.brand && (
            <Text style={cardStyles.meta} numberOfLines={1}>{attrs.brand}</Text>
          )}
          {display.showValue && value != null && (
            <Text style={cardStyles.meta}>{value.toLocaleString(i18n.language)} {currSym}</Text>
          )}
          {display.showSize && attrs.size && (
            <Text style={cardStyles.meta}>{t('collectionDetail.sizeLabel', { value: attrs.size })}</Text>
          )}
          {display.showColor && attrs.color && (
            <Text style={cardStyles.meta}>{attrs.color}</Text>
          )}
          {display.showEra && attrs.year && (
            <Text style={cardStyles.meta}>{attrs.year}</Text>
          )}
          {display.showCondition && attrs.condition && (
            <Text style={cardStyles.meta}>{attrs.condition}</Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  )
}

const cardStyles = StyleSheet.create({
  // Un seul bloc : fond, arrondi et bordure enveloppent la photo *et* le
  // texte. C'est ce qui rattache la légende à sa vignette quand les
  // cartes sont espacées les unes des autres.
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: 'hidden',
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  imageWrap: { width: '100%', position: 'relative' },
  selectOverlay: {
    ...StyleSheet.absoluteFill,
  },
  selectOverlayActive: {
    backgroundColor: 'rgba(192, 104, 42, 0.25)',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    padding: 6,
  },
  checkmark: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.accent,
    color: 'white',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 22,
    overflow: 'hidden',
  },
  /** Coin supérieur droit de la photo, opposé au ✓ de sélection. */
  qtyBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    minWidth: 24,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(26, 22, 18, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyBadgeText: {
    fontSize: Typography.xs,
    fontWeight: Typography.bold,
    color: Colors.textInverse,
  },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: { flex: 1, backgroundColor: Colors.surfaceWarm, alignItems: 'center', justifyContent: 'center' },
  placeholderEmoji: { fontSize: 24, opacity: 0.4 },
  info: { paddingHorizontal: 6, paddingVertical: 6, gap: 2 },
  infoLarge: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, gap: 4 },
  title: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.textPrimary },
  titleSm: { fontSize: Typography.xs },
  tag: { fontSize: Typography.xs, color: Colors.accent, fontWeight: Typography.medium },
  meta: { fontSize: Typography.xs, color: Colors.textSecondary },
})

/** Une ligne de la liste : en-tête de groupe, rangée de cartes, ou filet. */
type GridRow =
  | { type: 'group'; key: string; group: ObjectGroup; count: number; collapsed: boolean }
  | { type: 'items'; key: string; items: TiroirObject[] }
  | { type: 'divider'; key: string }
  | { type: 'loose'; key: string }

// ── En-tête de groupe ─────────────────────────────────────────────────────────

interface GroupHeaderProps {
  group: ObjectGroup
  count: number
  collapsed: boolean
  onToggle: () => void
  onLongPress: () => void
  selectMode: boolean
  allSelected: boolean
  onSelectGroup: () => void
}

/**
 * Une ligne au-dessus des objets du groupe. Les objets sans groupe n'en
 * ont pas : ils suivent la liste, sans catégorie fourre-tout.
 *
 * En sélection, la case prend le groupe entier — et rien d'autre : c'est
 * le raccourci pour agir sur un groupe sans le cocher objet par objet.
 */
function GroupHeader({
  group, count, collapsed, onToggle, onLongPress,
  selectMode, allSelected, onSelectGroup,
}: GroupHeaderProps) {
  const { t } = useTranslation()
  return (
    <View style={groupStyles.header}>
      <TouchableOpacity
        style={groupStyles.headerMain}
        onPress={onToggle}
        onLongPress={onLongPress}
        delayLongPress={300}
        activeOpacity={0.6}
      >
        <Text style={groupStyles.name} numberOfLines={1}>{group.name}</Text>
        <Text style={groupStyles.count}>{t('common.objects', { count })}</Text>
      </TouchableOpacity>

      {selectMode && count > 0 && (
        <TouchableOpacity
          onPress={onSelectGroup}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.7}
          accessibilityLabel={t('groups.selectGroup')}
        >
          {allSelected
            ? <CheckSquare size={19} color={Colors.accent} strokeWidth={2} />
            : <Square size={19} color={Colors.textTertiary} strokeWidth={2} />
          }
        </TouchableOpacity>
      )}

      <TouchableOpacity onPress={onToggle} hitSlop={10} activeOpacity={0.7}>
        {collapsed
          ? <ChevronRight size={18} color={Colors.textSecondary} strokeWidth={2} />
          : <ChevronDown size={18} color={Colors.textSecondary} strokeWidth={2} />
        }
      </TouchableOpacity>
    </View>
  )
}

const groupStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: GRID_PADDING,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  headerMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  name: {
    fontSize: Typography.base,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  count: { fontSize: Typography.xs, color: Colors.textTertiary, fontWeight: Typography.medium },
})

// ── Panneau "Personnaliser l'affichage" ───────────────────────────────────────

interface DisplayPanelProps {
  visible: boolean
  config: DisplayConfig
  onApply: (c: DisplayConfig) => void
  onClose: () => void
}

function DisplayPanel({ visible, config, onApply, onClose }: DisplayPanelProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<DisplayConfig>(config)
  const slideAnim = useRef(new Animated.Value(300)).current

  React.useEffect(() => {
    if (visible) {
      setDraft(config)
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, damping: 20, mass: 0.8 }).start()
    } else {
      Animated.timing(slideAnim, { toValue: 300, duration: 220, useNativeDriver: true }).start()
    }
  }, [visible])

  function toggle(key: keyof DisplayConfig) {
    setDraft(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableOpacity style={panelStyles.backdrop} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[panelStyles.sheet, { transform: [{ translateY: slideAnim }] }]}>
        <View style={panelStyles.handle} />
        <Text style={panelStyles.title}>{t('collectionDetail.customizeTitle')}</Text>
        <Text style={panelStyles.subtitle}>{t('collectionDetail.customizeSub')}</Text>

        <View style={panelStyles.grid}>
          {DISPLAY_FIELDS.map(field => {
            const active = draft[field.key]
            return (
              <TouchableOpacity
                key={field.key}
                style={[panelStyles.chip, active && panelStyles.chipActive]}
                onPress={() => toggle(field.key)}
                activeOpacity={0.75}
              >
                <Text style={[panelStyles.chipIcon, active && panelStyles.chipIconActive]}>
                  {field.icon}
                </Text>
                <Text style={[panelStyles.chipLabel, active && panelStyles.chipLabelActive]}>
                  {t(field.labelKey)}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>

        <TouchableOpacity
          style={panelStyles.applyBtn}
          onPress={() => { onApply(draft); onClose() }}
          activeOpacity={0.88}
        >
          <Text style={panelStyles.applyText}>{t('collectionDetail.apply')}</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  )
}

const panelStyles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.lg,
    paddingBottom: 40,
    gap: Spacing.md,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: Spacing.xs,
  },
  title: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },
  subtitle: { fontSize: Typography.sm, color: Colors.textSecondary, lineHeight: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.md, paddingVertical: 10,
    borderRadius: Radius.full,
    borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  chipActive: { borderColor: Colors.accent, backgroundColor: '#FFF3EC' },
  chipIcon: { fontSize: 14, color: Colors.textTertiary },
  chipIconActive: { color: Colors.accent },
  chipLabel: { fontSize: Typography.sm, fontWeight: Typography.medium, color: Colors.textSecondary },
  chipLabelActive: { color: Colors.accent },
  applyBtn: {
    backgroundColor: Colors.accent,
    borderRadius: Radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  applyText: { fontSize: Typography.base, fontWeight: Typography.bold, color: Colors.textInverse, letterSpacing: 0.8 },
})

// ── Invite « premier objet » ──────────────────────────────────────────────────

/**
 * Une collection vide n'est pas un état d'erreur : c'est l'étape suivante.
 * On propose les trois façons d'ajouter un objet plutôt qu'un simple
 * « aucun objet », et on emmène l'utilisateur directement dans le bon
 * sélecteur — la collection courante devient la destination par défaut.
 */
function FirstObjectInvite({ collectionId, collectionName }: { collectionId: string; collectionName: string }) {
  const { t } = useTranslation()
  const router = useRouter()

  const routes: { intent: string; icon: React.ReactNode; labelKey: string; hintKey: string }[] = [
    {
      intent: 'camera',
      icon: <Camera size={22} color={Colors.accent} strokeWidth={1.7} />,
      labelKey: 'collectionDetail.inviteCamera',
      hintKey: 'collectionDetail.inviteCameraHint',
    },
    {
      intent: 'library',
      icon: <Images size={22} color={Colors.accent} strokeWidth={1.7} />,
      labelKey: 'collectionDetail.inviteLibrary',
      hintKey: 'collectionDetail.inviteLibraryHint',
    },
    {
      intent: 'batch',
      icon: <Layers size={22} color={Colors.accent} strokeWidth={1.7} />,
      labelKey: 'collectionDetail.inviteBatch',
      hintKey: 'collectionDetail.inviteBatchHint',
    },
  ]

  return (
    <View style={inviteStyles.wrap}>
      <Text style={inviteStyles.title}>{t('collectionDetail.inviteTitle', { name: collectionName })}</Text>
      <Text style={inviteStyles.body}>{t('collectionDetail.inviteBody')}</Text>

      <View style={inviteStyles.list}>
        {routes.map(r => (
          <TouchableOpacity
            key={r.intent}
            style={inviteStyles.row}
            activeOpacity={0.75}
            onPress={() => router.push({
              pathname: '/capture',
              params: { intent: r.intent, collectionId },
            })}
          >
            <View style={inviteStyles.rowIcon}>{r.icon}</View>
            <View style={inviteStyles.rowText}>
              <Text style={inviteStyles.rowLabel}>{t(r.labelKey)}</Text>
              <Text style={inviteStyles.rowHint}>{t(r.hintKey)}</Text>
            </View>
            <ChevronRight size={18} color={Colors.textTertiary} strokeWidth={1.8} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  )
}

const inviteStyles = StyleSheet.create({
  wrap: { padding: Spacing.lg, gap: Spacing.sm },
  title: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  body: { fontSize: Typography.sm, color: Colors.textSecondary, lineHeight: 21, marginBottom: Spacing.xs },
  list: { gap: Spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: Spacing.md,
  },
  rowIcon: {
    width: 46, height: 46,
    borderRadius: Radius.md,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontSize: Typography.base, fontWeight: Typography.semibold, color: Colors.textPrimary },
  rowHint: { fontSize: Typography.xs, color: Colors.textSecondary },
})

// ── Écran principal ───────────────────────────────────────────────────────────

export default function CollectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { t } = useTranslation()

  const [collection, setCollection] = useState<Collection | null>(null)
  const [objects, setObjects] = useState<TiroirObject[]>([])
  const [coverUrls, setCoverUrls] = useState<Record<string, string>>({})
  const [filter, setFilter] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [pickerVisible, setPickerVisible] = useState(false)
  const [coverUrl, setCoverUrl] = useState<string | null>(null)
  const [menuVisible, setMenuVisible] = useState(false)
  const [renameVisible, setRenameVisible] = useState(false)
  const [renameValue, setRenameValue] = useState('')
  const [deleteVisible, setDeleteVisible] = useState(false)
  const [displayPanelVisible, setDisplayPanelVisible] = useState(false)
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM)
  const [displayConfig, setDisplayConfig] = useState<DisplayConfig>(DEFAULT_DISPLAY)

  // Multi-select
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectModeEnabled, setSelectModeEnabled] = useState(false)
  const [sharePanelVisible, setSharePanelVisible] = useState(false)
  const [statuerVisible, setStatuerVisible] = useState(false)
  const [deplacerVisible, setDeplacerVisible] = useState(false)
  const [deleteBulkVisible, setDeleteBulkVisible] = useState(false)
  const [allCollections, setAllCollections] = useState<Collection[]>([])
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const isSelectMode = selectModeEnabled

  // Groupes
  const [groups, setGroups] = useState<ObjectGroup[]>([])
  // Repli local : c'est un état de lecture, pas une donnée à conserver.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [groupActionTarget, setGroupActionTarget] = useState<ObjectGroup | null>(null)
  const [groupRenameTarget, setGroupRenameTarget] = useState<ObjectGroup | null>(null)
  const [groupPickerVisible, setGroupPickerVisible] = useState(false)
  const [newGroupVisible, setNewGroupVisible] = useState(false)
  /** Collection choisie à l'étape 1 du déplacement, en attente de son groupe. */
  const [moveTarget, setMoveTarget] = useState<{ collection: Collection; groups: ObjectGroup[] } | null>(null)

  const zoom = ZOOM_LEVELS[zoomIndex]

  const load = useCallback(async () => {
    if (!id) return
    const [colRes, objRes, grpRes] = await Promise.all([
      supabase.from('collections').select('*').eq('id', id).single(),
      supabase.from('objects').select('*').eq('collection_id', id).order('created_at', { ascending: false }),
      supabase.from('object_groups').select('*').eq('collection_id', id)
        .order('position').order('created_at'),
    ])
    if (!colRes.error) {
      const col = colRes.data as Collection
      setCollection(col)
      // La couverture ne descend pas avec la ligne : elle vit en Storage
      // et demande une URL signée.
      if (col.cover_image_path) {
        const { data } = await supabase.storage
          .from('object-images').createSignedUrl(col.cover_image_path, 3600)
        setCoverUrl(data?.signedUrl ?? null)
      } else {
        setCoverUrl(null)
      }
    }
    if (!grpRes.error) setGroups((grpRes.data ?? []) as ObjectGroup[])
    const objs: TiroirObject[] = objRes.error ? [] : (objRes.data as TiroirObject[])
    setObjects(objs)

    if (objs.length > 0) {
      const { data: imgRows } = await supabase
        .from('object_images')
        .select('object_id, storage_path')
        .in('object_id', objs.map(o => o.id))
        .eq('is_cover', true)
      if (imgRows && imgRows.length > 0) {
        const urlMap: Record<string, string> = {}
        await Promise.all(imgRows.map(async row => {
          const { data } = await supabase.storage.from('object-images').createSignedUrl(row.storage_path, 3600)
          if (data?.signedUrl) urlMap[row.object_id] = data.signedUrl
        }))
        setCoverUrls(urlMap)
      }
    }
    setLoading(false)
    setRefreshing(false)
  }, [id])

  useFocusEffect(useCallback(() => { load() }, [load]))

  function onRefresh() { setRefreshing(true); load() }

  /**
   * La feuille a déjà écrit en base. On aligne l'écran, et le cache
   * d'icônes — il sert à afficher la bonne pastille avant que la liste
   * n'ait rechargé.
   */
  async function handleCollectionSaved(patch: CollectionPatch) {
    if (!collection) return
    setIconOverride(collection.id, patch.emoji, patch.icon_color)
    setCollection(prev => prev ? { ...prev, ...patch } : prev)

    if (patch.cover_image_path) {
      const { data } = await supabase.storage
        .from('object-images').createSignedUrl(patch.cover_image_path, 3600)
      setCoverUrl(data?.signedUrl ?? null)
    } else {
      setCoverUrl(null)
    }
  }

  function doRename() {
    if (!collection) return
    setRenameValue(collection.name)
    setRenameVisible(true)
  }

  async function submitRename() {
    if (!collection || !renameValue.trim()) return
    const newName = renameValue.trim()
    setRenameVisible(false)
    const { error } = await supabase.from('collections').update({ name: newName }).eq('id', collection.id)
    if (error) { Alert.alert(t('common.error'), error.message); return }
    setCollection(prev => prev ? { ...prev, name: newName } : prev)
  }

  function doDelete() {
    if (!collection) return
    setDeleteVisible(true)
  }

  async function confirmDelete() {
    if (!collection) return
    setDeleteVisible(false)
    const { error } = await supabase.from('collections').delete().eq('id', collection.id)
    if (error) { Alert.alert(t('common.error'), error.message); return }
    router.back()
  }

  function openMenu() {
    if (!collection) return
    setMenuVisible(true)
  }

  if (loading) {
    return <Screen><View style={styles.loader}><ActivityIndicator color={Colors.accent} /></View></Screen>
  }

  if (!collection) {
    return (
      <Screen>
        <View style={styles.loader}>
          <Text style={styles.errorText}>{t('collectionDetail.notFound')}</Text>
          <TouchableOpacity onPress={() => router.back()}><Text style={styles.backLink}>← {t('common.back')}</Text></TouchableOpacity>
        </View>
      </Screen>
    )
  }

  const filtered = filter.trim()
    ? objects.filter(o => o.title.toLowerCase().includes(filter.toLowerCase()))
    : objects

  const cols = zoom.cols
  const gap = gridGap(cols)
  const allObjectsSelected = objects.length > 0 && selectedIds.size === objects.length

  /**
   * La grille est aplatie en rangées plutôt que confiée à `numColumns` :
   * c'est ce qui permet d'intercaler les en-têtes de groupe et de maîtriser
   * les gouttières, que `numColumns` ne sait pas espacer proprement.
   */
  const rows: GridRow[] = []
  const loose = filtered.filter(o => !o.group_id)
  // Pendant une recherche, un groupe sans résultat n'a rien à annoncer.
  const shownGroups = filter.trim()
    ? groups.filter(g => filtered.some(o => o.group_id === g.id))
    : groups

  shownGroups.forEach((group, gi) => {
    const items = filtered.filter(o => o.group_id === group.id)
    const isCollapsed = collapsed.has(group.id)
    rows.push({ type: 'group', key: `g-${group.id}`, group, count: items.length, collapsed: isCollapsed })
    if (!isCollapsed) {
      chunk(items, cols).forEach((r, i) => rows.push({ type: 'items', key: `g-${group.id}-${i}`, items: r }))
    }
    // Un filet ferme le groupe — sauf s'il n'y a plus rien derrière lui.
    const hasMore = gi < shownGroups.length - 1 || loose.length > 0
    if (hasMore) rows.push({ type: 'divider', key: `d-${group.id}` })
  })

  // Les objets sans groupe sont annoncés — mais seulement s'il existe des
  // groupes au-dessus : sans eux, il n'y a rien dont les distinguer.
  if (loose.length > 0 && shownGroups.length > 0) {
    rows.push({ type: 'loose', key: 'loose-label' })
  }
  chunk(loose, cols).forEach((r, i) => rows.push({ type: 'items', key: `loose-${i}`, items: r }))

  function toggleGroup(groupId: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(groupId) ? next.delete(groupId) : next.add(groupId)
      return next
    })
  }

  // ── Multi-select handlers ─────────────────────────────────────────────────

  function toggleSelect(objectId: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(objectId) ? next.delete(objectId) : next.add(objectId)
      return next
    })
  }

  function enterSelectMode(objectId: string) {
    setSelectModeEnabled(true)
    setSelectedIds(new Set([objectId]))
  }

  function exitSelectMode() {
    setSelectModeEnabled(false)
    setSelectedIds(new Set())
  }

  function toggleSelectAll() {
    if (objects.length === 0) return
    setSelectModeEnabled(true)
    setSelectedIds(allObjectsSelected ? new Set() : new Set(objects.map(o => o.id)))
  }

  /** Les objets du groupe actuellement visibles (une recherche peut en masquer). */
  function groupObjectIds(groupId: string) {
    return filtered.filter(o => o.group_id === groupId).map(o => o.id)
  }

  function isGroupFullySelected(groupId: string) {
    const ids = groupObjectIds(groupId)
    return ids.length > 0 && ids.every(i => selectedIds.has(i))
  }

  /**
   * Raccourci : la sélection devient exactement ce groupe. On remplace au
   * lieu d'ajouter — « statuer sur ce groupe » veut dire ce groupe et rien
   * d'autre. Un second appui vide la sélection.
   */
  function selectOnlyGroup(groupId: string) {
    const ids = groupObjectIds(groupId)
    if (ids.length === 0) return
    setSelectModeEnabled(true)
    setSelectedIds(prev => {
      const isExactly = prev.size === ids.length && ids.every(i => prev.has(i))
      return isExactly ? new Set() : new Set(ids)
    })
  }

  async function deleteSelected() {
    const ids = Array.from(selectedIds)
    for (const oid of ids) {
      await supabase.rpc('delete_object', { p_object_id: oid })
    }
    setObjects(prev => prev.filter(o => !selectedIds.has(o.id)))
    exitSelectMode()
  }

  function confirmDeleteSelected() {
    setStatuerVisible(false)
    setDeplacerVisible(false)
    // Utilise un modal maison (cross-platform)
    setDeleteBulkVisible(true)
  }

  // ── Statuer ────────────────────────────────────────────────────────────────

  async function applyBulkStatus(status: string) {
    setBulkActionLoading(true)
    const ids = Array.from(selectedIds)
    await supabase.from('objects').update({ status }).in('id', ids)
    setObjects(prev => prev.map(o => selectedIds.has(o.id) ? { ...o, status: status as TiroirObject['status'] } : o))
    setBulkActionLoading(false)
    setStatuerVisible(false)
    exitSelectMode()
  }

  // ── Grouper ────────────────────────────────────────────────────────────────

  /** Range la sélection dans un groupe existant, ou l'en sort si null. */
  async function applyGroup(groupId: string | null) {
    setBulkActionLoading(true)
    const ids = Array.from(selectedIds)
    const { error } = await supabase.from('objects').update({ group_id: groupId }).in('id', ids)
    setBulkActionLoading(false)
    setGroupPickerVisible(false)
    if (error) { Alert.alert(t('common.error'), error.message); return }
    setObjects(prev => prev.map(o => selectedIds.has(o.id) ? { ...o, group_id: groupId } : o))
    exitSelectMode()
  }

  /** Création et rattachement en une passe côté serveur. */
  async function createGroupFromSelection(name: string) {
    setNewGroupVisible(false)
    const ids = Array.from(selectedIds)
    const { data: groupId, error } = await supabase.rpc('create_object_group', {
      p_collection_id: id,
      p_name: name,
      p_object_ids: ids,
    })
    if (error) { Alert.alert(t('common.error'), error.message); return }
    setObjects(prev => prev.map(o => selectedIds.has(o.id) ? { ...o, group_id: groupId as string } : o))
    exitSelectMode()
    load()
  }

  async function renameGroup(group: ObjectGroup, name: string) {
    setGroupRenameTarget(null)
    if (name === group.name) return
    const { error } = await supabase.from('object_groups').update({ name }).eq('id', group.id)
    if (error) { Alert.alert(t('common.error'), error.message); return }
    setGroups(prev => prev.map(g => g.id === group.id ? { ...g, name } : g))
  }

  function confirmDeleteGroup(group: ObjectGroup) {
    Alert.alert(
      t('groups.deleteTitle', { name: group.name }),
      t('groups.deleteBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.from('object_groups').delete().eq('id', group.id)
            if (error) { Alert.alert(t('common.error'), error.message); return }
            setGroups(prev => prev.filter(g => g.id !== group.id))
            // Les objets restent dans la collection, sans groupe.
            setObjects(prev => prev.map(o => o.group_id === group.id ? { ...o, group_id: null } : o))
          },
        },
      ],
    )
  }

  // ── Déplacer ───────────────────────────────────────────────────────────────

  async function loadAllCollections() {
    const { data } = await supabase.from('collections').select('*').order('name')
    setAllCollections((data as Collection[]) ?? [])
  }

  /**
   * Étape 1 : choisir la collection de destination. Si elle a des groupes,
   * on demande lequel plutôt que de déposer les objets en vrac.
   */
  async function pickMoveCollection(target: Collection) {
    if (target.id === id) { setMoveTarget({ collection: target, groups }); return }
    const { data } = await supabase.from('object_groups').select('*')
      .eq('collection_id', target.id).order('position').order('created_at')
    const targetGroups = (data ?? []) as ObjectGroup[]
    if (targetGroups.length === 0) { applyBulkMove(target.id, null); return }
    setMoveTarget({ collection: target, groups: targetGroups })
  }

  async function applyBulkMove(targetCollectionId: string | null, groupId: string | null) {
    setBulkActionLoading(true)
    const ids = Array.from(selectedIds)

    // RPC plutôt que deux updates : côté base, changer la collection
    // détache du groupe, il faut donc écrire les deux ensemble.
    const { error } = targetCollectionId
      ? await supabase.rpc('move_objects', {
          p_object_ids: ids,
          p_collection_id: targetCollectionId,
          p_group_id: groupId,
        })
      : await supabase.from('objects').update({ collection_id: null, group_id: null }).in('id', ids)

    setBulkActionLoading(false)
    setMoveTarget(null)
    setDeplacerVisible(false)
    if (error) { Alert.alert(t('common.error'), error.message); return }

    if (targetCollectionId !== id) {
      setObjects(prev => prev.filter(o => !selectedIds.has(o.id)))
    } else {
      setObjects(prev => prev.map(o => selectedIds.has(o.id) ? { ...o, group_id: groupId } : o))
    }
    exitSelectMode()
  }

  return (
    <Screen edges={['top']} topColor={Colors.surface}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={isSelectMode ? exitSelectMode : () => router.back()} style={styles.headerBtn} hitSlop={12}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          {isSelectMode ? (
            <Text style={styles.headerTitle}>{t('collectionDetail.selectedCount', { count: selectedIds.size })}</Text>
          ) : (
            <>
              {/* Icône et nom sont modifiables sur place : une fois la
                  collection ouverte, on la retouche sans passer par le menu. */}
              <TouchableOpacity
                onPress={() => setPickerVisible(true)}
                activeOpacity={0.7}
                hitSlop={8}
              >
                {/* Photo ou emoji, jamais les deux — même règle que sur
                    l'accueil, sinon les deux écrans se contrediraient. */}
                {collection.cover_image_path && coverUrl ? (
                  <Image source={{ uri: coverUrl }} style={styles.headerIcon} resizeMode="cover" />
                ) : (
                  <View style={[styles.headerIcon, { backgroundColor: collection.icon_color ?? '#E8F0E0' }]}>
                    <Text style={styles.headerIconEmoji}>{collection.emoji ?? '📦'}</Text>
                  </View>
                )}
              </TouchableOpacity>
              {/* Le nom ouvre la même feuille : le renommage n'est plus une
                  action à part, c'est un champ de l'édition. */}
              <TouchableOpacity onPress={() => setPickerVisible(true)} activeOpacity={0.7} style={styles.headerTitleBtn} hitSlop={6}>
                <Text style={styles.headerTitle} numberOfLines={1}>{collection.name}</Text>
              </TouchableOpacity>
              <Text style={styles.headerCount}>({objects.length})</Text>
            </>
          )}
        </View>
        {isSelectMode ? (
          <TouchableOpacity onPress={exitSelectMode} style={styles.headerCancelBtn} hitSlop={12}>
            <Text style={styles.cancelSelectText} numberOfLines={1}>{t('common.cancel')}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={openMenu} style={styles.headerBtn} hitSlop={12}>
            <Text style={styles.menuDots}>···</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Barre filtre + zoom */}
      <View style={styles.toolbar}>
        <TouchableOpacity style={styles.filterBtn} onPress={() => setDisplayPanelVisible(true)} activeOpacity={0.75}>
          <SlidersHorizontal size={14} color={Colors.textSecondary} strokeWidth={2} />
          <Text style={styles.filterBtnText}>{t('collectionDetail.filter')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.filterBtn,
            isSelectMode && styles.filterBtnActive,
            objects.length === 0 && styles.filterBtnDisabled,
          ]}
          onPress={() => isSelectMode ? toggleSelectAll() : setSelectModeEnabled(true)}
          activeOpacity={0.75}
          disabled={objects.length === 0}
        >
          <Text style={[styles.filterBtnText, isSelectMode && styles.filterBtnTextActive]}>
            {isSelectMode ? (allObjectsSelected ? t('collectionDetail.clear') : t('collectionDetail.all')) : t('collectionDetail.select')}
          </Text>
        </TouchableOpacity>

        {/* La recherche ne prend de la place que lorsqu'on s'en sert :
            repliée, c'est un bouton comme les autres. */}
        {searchOpen ? (
          <TextInput
            style={styles.filterInput}
            value={filter}
            onChangeText={setFilter}
            placeholder={t('collectionDetail.searchPlaceholder')}
            placeholderTextColor={Colors.textTertiary}
            clearButtonMode="while-editing"
            autoFocus
            returnKeyType="search"
            onBlur={() => { if (!filter.trim()) setSearchOpen(false) }}
          />
        ) : (
          <TouchableOpacity
            style={styles.filterBtn}
            onPress={() => setSearchOpen(true)}
            activeOpacity={0.75}
          >
            <Search size={14} color={Colors.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
        )}

        {!searchOpen && <View style={styles.toolbarSpacer} />}

        <View style={styles.zoomControls}>
          <TouchableOpacity
            onPress={() => setZoomIndex(i => Math.max(0, i - 1))}
            style={[styles.zoomBtn, zoomIndex === 0 && styles.zoomBtnDisabled]}
            disabled={zoomIndex === 0}
            hitSlop={8}
          >
            <Text style={styles.zoomIcon}>⊖</Text>
          </TouchableOpacity>
          <Text style={styles.zoomLabel}>{zoom.label}</Text>
          <TouchableOpacity
            onPress={() => setZoomIndex(i => Math.min(ZOOM_LEVELS.length - 1, i + 1))}
            style={[styles.zoomBtn, zoomIndex === ZOOM_LEVELS.length - 1 && styles.zoomBtnDisabled]}
            disabled={zoomIndex === ZOOM_LEVELS.length - 1}
            hitSlop={8}
          >
            <Text style={styles.zoomIcon}>⊕</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Menu ··· */}
      <ActionSheet
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        options={[
          { label: t('collectionDetail.editIcon'), onPress: () => setPickerVisible(true) },
          { label: t('collections.rename'), onPress: doRename },
          { label: t('common.delete'), onPress: doDelete, destructive: true },
          { label: t('common.cancel'), onPress: () => {}, cancel: true },
        ]}
      />

      {/* Modal renommer */}
      <Modal visible={renameVisible} transparent animationType="fade" onRequestClose={() => setRenameVisible(false)}>
        <TouchableOpacity style={styles.renameBackdrop} activeOpacity={1} onPress={() => setRenameVisible(false)} />
        <View style={styles.renameCard}>
          <Text style={styles.renameTitle}>{t('collectionDetail.renameTitle')}</Text>
          <TextInput
            style={styles.renameInput}
            value={renameValue}
            onChangeText={setRenameValue}
            placeholder={t('collectionDetail.renamePlaceholder')}
            placeholderTextColor={Colors.textTertiary}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={submitRename}
          />
          <View style={styles.renameActions}>
            <TouchableOpacity style={styles.renameCancelBtn} onPress={() => setRenameVisible(false)}>
              <Text style={styles.renameCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.renameConfirmBtn, !renameValue.trim() && styles.renameConfirmDisabled]}
              onPress={submitRename}
              disabled={!renameValue.trim()}
            >
              <Text style={styles.renameConfirmText}>{t('collections.rename')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal confirmation suppression */}
      <Modal visible={deleteVisible} transparent animationType="fade" onRequestClose={() => setDeleteVisible(false)}>
        <TouchableOpacity style={styles.renameBackdrop} activeOpacity={1} onPress={() => setDeleteVisible(false)} />
        <View style={styles.deleteCard}>
          <Text style={styles.renameTitle}>{t('home.deleteCollectionTitle', { name: collection.name })}</Text>
          <Text style={styles.deleteBody}>
            {objects.length > 0
              ? t('home.deleteCollectionWithObjects', { count: objects.length })
              : t('home.deleteCollectionIrreversible')}
          </Text>
          <View style={styles.renameActions}>
            <TouchableOpacity style={styles.renameCancelBtn} onPress={() => setDeleteVisible(false)}>
              <Text style={styles.renameCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteConfirmBtn} onPress={confirmDelete}>
              <Text style={styles.renameConfirmText}>{t('common.delete')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Édition de la collection : nom, icône ou photo */}
      <CollectionEditSheet
        visible={pickerVisible}
        collection={collection as EditableCollection}
        onClose={() => setPickerVisible(false)}
        onSaved={handleCollectionSaved}
      />

      {/* Panneau personnalisation */}
      <DisplayPanel
        visible={displayPanelVisible}
        config={displayConfig}
        onApply={setDisplayConfig}
        onClose={() => setDisplayPanelVisible(false)}
      />

      {/* Grille objets */}
      <FlatList
        data={rows}
        keyExtractor={r => r.key}
        contentContainerStyle={[styles.grid, { paddingBottom: isSelectMode ? TAB_BAR_H + 80 : TAB_BAR_H + 16 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} />}
        ListEmptyComponent={
          filter.trim()
            ? <EmptyState
                title={t('collectionDetail.emptyTitle')}
                subtitle={t('collectionDetail.emptyNoResults')}
              />
            : <FirstObjectInvite collectionId={collection.id} collectionName={collection.name} />
        }
        renderItem={({ item: row }) => {
          if (row.type === 'divider') return <View style={styles.groupDivider} />
          if (row.type === 'loose') {
            return (
              <View style={styles.looseHeader}>
                <Text style={styles.looseLabel}>{t('groups.ungrouped')}</Text>
                <Text style={styles.looseCount}>{loose.length}</Text>
              </View>
            )
          }
          if (row.type === 'group') {
            return (
              <GroupHeader
                group={row.group}
                count={row.count}
                collapsed={row.collapsed}
                onToggle={() => toggleGroup(row.group.id)}
                onLongPress={() => setGroupActionTarget(row.group)}
                selectMode={isSelectMode}
                allSelected={isGroupFullySelected(row.group.id)}
                onSelectGroup={() => selectOnlyGroup(row.group.id)}
              />
            )
          }
          return (
            <View style={[styles.gridRow, { gap, marginBottom: gap }]}>
              {row.items.map(item => (
                <ObjectCard
                  key={item.id}
                  object={item}
                  coverUrl={coverUrls[item.id] ?? null}
                  onPress={() => isSelectMode
                    ? toggleSelect(item.id)
                    : router.push({ pathname: '/objects/[id]', params: { id: item.id } })
                  }
                  onLongPress={() => enterSelectMode(item.id)}
                  cols={cols}
                  display={displayConfig}
                  isSelectMode={isSelectMode}
                  isSelected={selectedIds.has(item.id)}
                />
              ))}
            </View>
          )
        }}
      />

      {/* Bottom action bar (multi-select) */}
      {isSelectMode && (
        <View style={styles.actionBar}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setStatuerVisible(true)} activeOpacity={0.7} disabled={selectedIds.size === 0}>
            <Tag size={22} color={selectedIds.size === 0 ? Colors.textTertiary : Colors.textPrimary} strokeWidth={1.8} />
            <Text style={[styles.actionLabel, selectedIds.size === 0 && styles.actionLabelDisabled]}>{t('collectionDetail.actionStatus')}</Text>
          </TouchableOpacity>
          {/* Grouper s'ajoute aux actions, sans prendre la place de
              Statuer : marquer plusieurs objets vendus reste courant. */}
          <TouchableOpacity style={styles.actionBtn} onPress={() => setGroupPickerVisible(true)} activeOpacity={0.7} disabled={selectedIds.size === 0}>
            <FolderPlus size={22} color={selectedIds.size === 0 ? Colors.textTertiary : Colors.textPrimary} strokeWidth={1.8} />
            <Text style={[styles.actionLabel, selectedIds.size === 0 && styles.actionLabelDisabled]}>{t('groups.action')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => { loadAllCollections(); setDeplacerVisible(true) }} activeOpacity={0.7} disabled={selectedIds.size === 0}>
            <MoveRight size={22} color={selectedIds.size === 0 ? Colors.textTertiary : Colors.textPrimary} strokeWidth={1.8} />
            <Text style={[styles.actionLabel, selectedIds.size === 0 && styles.actionLabelDisabled]}>{t('collectionDetail.actionMove')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => setSharePanelVisible(true)} activeOpacity={0.7} disabled={selectedIds.size === 0}>
            <Share2 size={22} color={selectedIds.size === 0 ? Colors.textTertiary : Colors.textPrimary} strokeWidth={1.8} />
            <Text style={[styles.actionLabel, selectedIds.size === 0 && styles.actionLabelDisabled]}>{t('collectionDetail.actionShare')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={confirmDeleteSelected} activeOpacity={0.7} disabled={selectedIds.size === 0}>
            <Trash2 size={22} color={selectedIds.size === 0 ? Colors.textTertiary : Colors.error} strokeWidth={1.8} />
            <Text style={[styles.actionLabel, selectedIds.size > 0 ? styles.actionLabelDestructive : styles.actionLabelDisabled]}>{t('common.delete')}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Modal Statuer ── */}
      <Modal visible={statuerVisible} transparent animationType="slide" onRequestClose={() => setStatuerVisible(false)}>
        <TouchableOpacity style={styles.bulkBackdrop} activeOpacity={1} onPress={() => setStatuerVisible(false)} />
        <View style={styles.bulkSheet}>
          <View style={styles.bulkHandle} />
          <Text style={styles.bulkTitle}>{t('collectionDetail.statusOn', { count: selectedIds.size })}</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {BULK_STATUS_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={styles.bulkOptionRow}
                onPress={() => applyBulkStatus(opt.value)}
                activeOpacity={0.7}
                disabled={bulkActionLoading}
              >
                <View style={[styles.bulkStatusDot, { backgroundColor: opt.dot }]} />
                <Text style={styles.bulkOptionLabel}>{t(`status.${opt.value}`)}</Text>
                {bulkActionLoading
                  ? <ActivityIndicator size="small" color={Colors.accent} />
                  : <CheckCircle size={18} color={Colors.borderLight} strokeWidth={1.5} />
                }
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* ── Modal Grouper ── */}
      <Modal visible={groupPickerVisible} transparent animationType="slide" onRequestClose={() => setGroupPickerVisible(false)}>
        <TouchableOpacity style={styles.bulkBackdrop} activeOpacity={1} onPress={() => setGroupPickerVisible(false)} />
        <View style={styles.bulkSheet}>
          <View style={styles.bulkHandle} />
          <Text style={styles.bulkTitle}>{t('groups.pickTitle', { count: selectedIds.size })}</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            <TouchableOpacity
              style={styles.bulkOptionRow}
              onPress={() => { setGroupPickerVisible(false); setTimeout(() => setNewGroupVisible(true), 220) }}
              activeOpacity={0.7}
              disabled={bulkActionLoading}
            >
              <FolderPlus size={18} color={Colors.accent} strokeWidth={1.8} />
              <Text style={[styles.bulkOptionLabel, styles.bulkOptionAccent]}>{t('groups.newGroup')}</Text>
            </TouchableOpacity>

            {groups.map(g => (
              <TouchableOpacity
                key={g.id}
                style={styles.bulkOptionRow}
                onPress={() => applyGroup(g.id)}
                activeOpacity={0.7}
                disabled={bulkActionLoading}
              >
                <View style={[styles.bulkStatusDot, { backgroundColor: Colors.sage }]} />
                <Text style={styles.bulkOptionLabel}>{g.name}</Text>
                {bulkActionLoading
                  ? <ActivityIndicator size="small" color={Colors.accent} />
                  : <CheckCircle size={18} color={Colors.borderLight} strokeWidth={1.5} />
                }
              </TouchableOpacity>
            ))}

            {groups.length > 0 && (
              <TouchableOpacity
                style={styles.bulkOptionRow}
                onPress={() => applyGroup(null)}
                activeOpacity={0.7}
                disabled={bulkActionLoading}
              >
                <View style={[styles.bulkStatusDot, { backgroundColor: Colors.textTertiary }]} />
                <Text style={styles.bulkOptionLabel}>{t('groups.noGroup')}</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>
      </Modal>

      {/* ── Modal Déplacer ── */}
      <Modal
        visible={deplacerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => { setDeplacerVisible(false); setMoveTarget(null) }}
      >
        <TouchableOpacity
          style={styles.bulkBackdrop}
          activeOpacity={1}
          onPress={() => { setDeplacerVisible(false); setMoveTarget(null) }}
        />
        <View style={styles.bulkSheet}>
          <View style={styles.bulkHandle} />

          {moveTarget ? (
            /* Étape 2 : la collection est choisie, reste le groupe. */
            <>
              <Text style={styles.bulkTitle}>
                {t('groups.moveInto', { name: moveTarget.collection.name })}
              </Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                <TouchableOpacity
                  style={styles.bulkOptionRow}
                  onPress={() => applyBulkMove(moveTarget.collection.id, null)}
                  activeOpacity={0.7}
                  disabled={bulkActionLoading}
                >
                  <View style={[styles.bulkStatusDot, { backgroundColor: Colors.textTertiary }]} />
                  <Text style={styles.bulkOptionLabel}>{t('groups.noGroup')}</Text>
                </TouchableOpacity>
                {moveTarget.groups.map(g => (
                  <TouchableOpacity
                    key={g.id}
                    style={styles.bulkOptionRow}
                    onPress={() => applyBulkMove(moveTarget.collection.id, g.id)}
                    activeOpacity={0.7}
                    disabled={bulkActionLoading}
                  >
                    <View style={[styles.bulkStatusDot, { backgroundColor: Colors.sage }]} />
                    <Text style={styles.bulkOptionLabel}>{g.name}</Text>
                    {bulkActionLoading
                      ? <ActivityIndicator size="small" color={Colors.accent} />
                      : <MoveRight size={16} color={Colors.textTertiary} strokeWidth={1.5} />
                    }
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <TouchableOpacity style={styles.bulkBackBtn} onPress={() => setMoveTarget(null)} activeOpacity={0.7}>
                <Text style={styles.bulkBackText}>← {t('common.back')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            /* Étape 1 : rester ici en changeant de groupe, ou partir ailleurs. */
            <>
              <Text style={styles.bulkTitle}>{t('collectionDetail.moveTo')}</Text>
              <ScrollView showsVerticalScrollIndicator={false}>
                {groups.length > 0 && (
                  <>
                    <Text style={styles.bulkSectionLabel}>{t('groups.inThisCollection')}</Text>
                    {groups.map(g => (
                      <TouchableOpacity
                        key={g.id}
                        style={styles.bulkOptionRow}
                        onPress={() => applyBulkMove(id, g.id)}
                        activeOpacity={0.7}
                        disabled={bulkActionLoading}
                      >
                        <View style={[styles.bulkStatusDot, { backgroundColor: Colors.sage }]} />
                        <Text style={styles.bulkOptionLabel}>{g.name}</Text>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      style={styles.bulkOptionRow}
                      onPress={() => applyBulkMove(id, null)}
                      activeOpacity={0.7}
                      disabled={bulkActionLoading}
                    >
                      <View style={[styles.bulkStatusDot, { backgroundColor: Colors.textTertiary }]} />
                      <Text style={styles.bulkOptionLabel}>{t('groups.noGroup')}</Text>
                    </TouchableOpacity>
                  </>
                )}

                <Text style={styles.bulkSectionLabel}>{t('groups.otherCollection')}</Text>
                <TouchableOpacity
                  style={styles.bulkOptionRow}
                  onPress={() => applyBulkMove(null, null)}
                  activeOpacity={0.7}
                  disabled={bulkActionLoading}
                >
                  <View style={[styles.bulkStatusDot, { backgroundColor: Colors.textTertiary }]} />
                  <Text style={styles.bulkOptionLabel}>{t('capture.noCollection')}</Text>
                </TouchableOpacity>
                {allCollections.filter(c => c.id !== id).map(col => (
                  <TouchableOpacity
                    key={col.id}
                    style={styles.bulkOptionRow}
                    onPress={() => pickMoveCollection(col)}
                    activeOpacity={0.7}
                    disabled={bulkActionLoading}
                  >
                    <Text style={styles.bulkColEmoji}>{col.emoji ?? '📦'}</Text>
                    <Text style={styles.bulkOptionLabel}>{col.name}</Text>
                    {bulkActionLoading
                      ? <ActivityIndicator size="small" color={Colors.accent} />
                      : <MoveRight size={16} color={Colors.textTertiary} strokeWidth={1.5} />
                    }
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}
        </View>
      </Modal>

      {/* Actions sur un groupe (appui long sur son en-tête) */}
      <ActionSheet
        visible={!!groupActionTarget}
        onClose={() => setGroupActionTarget(null)}
        options={groupActionTarget ? [
          {
            label: t('collections.rename'),
            onPress: () => setTimeout(() => setGroupRenameTarget(groupActionTarget), 220),
          },
          {
            label: t('groups.dissolve'),
            destructive: true,
            onPress: () => setTimeout(() => confirmDeleteGroup(groupActionTarget), 220),
          },
          { label: t('common.cancel'), cancel: true, onPress: () => {} },
        ] : []}
      />

      <PromptDialog
        visible={newGroupVisible}
        title={t('groups.newGroupTitle')}
        placeholder={t('groups.namePlaceholder')}
        confirmLabel={t('groups.create')}
        onConfirm={createGroupFromSelection}
        onClose={() => setNewGroupVisible(false)}
      />

      <PromptDialog
        visible={!!groupRenameTarget}
        title={t('groups.renameTitle')}
        placeholder={t('groups.namePlaceholder')}
        initialValue={groupRenameTarget?.name ?? ''}
        confirmLabel={t('collections.rename')}
        onConfirm={name => groupRenameTarget && renameGroup(groupRenameTarget, name)}
        onClose={() => setGroupRenameTarget(null)}
      />

      {/* ── Modal Supprimer (confirmation) ── */}
      <Modal visible={deleteBulkVisible} transparent animationType="fade" onRequestClose={() => setDeleteBulkVisible(false)}>
        <TouchableOpacity style={styles.bulkBackdrop} activeOpacity={1} onPress={() => setDeleteBulkVisible(false)} />
        <View style={styles.bulkSheet}>
          <View style={styles.bulkHandle} />
          <View style={styles.bulkDeleteIcon}>
            <Trash2 size={32} color={Colors.error} strokeWidth={1.5} />
          </View>
          <Text style={styles.bulkTitle}>
            {t('collectionDetail.deleteBulkTitle', { count: selectedIds.size })}
          </Text>
          <Text style={styles.bulkDeleteBody}>{t('collectionDetail.deleteBulkBody')}</Text>
          <View style={styles.bulkActions}>
            <TouchableOpacity style={styles.bulkCancelBtn} onPress={() => setDeleteBulkVisible(false)}>
              <Text style={styles.bulkCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.bulkDeleteBtn} onPress={() => { setDeleteBulkVisible(false); deleteSelected() }}>
              <Text style={styles.bulkDeleteText}>{t('common.delete')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Share panel */}
      <SharePanel
        visible={sharePanelVisible}
        selectedObjects={objects.filter(o => selectedIds.has(o.id))}
        collectionName={collection.name}
        collectionId={collection.id}
        onClose={() => setSharePanelVisible(false)}
        onDone={() => { setSharePanelVisible(false); exitSelectMode() }}
      />
    </Screen>
  )
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md },
  errorText: { fontSize: Typography.base, color: Colors.textSecondary },
  backLink: { color: Colors.accent, fontSize: Typography.base },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 4,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  headerBtn: { width: 44, alignItems: 'center', justifyContent: 'center' },
  // « Annuler » ne tient pas dans les 44 px des boutons à icône.
  headerCancelBtn: {
    minWidth: 44,
    paddingHorizontal: Spacing.xs,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  headerTitle: {
    fontSize: Typography.md,
    fontWeight: Typography.semibold,
    color: Colors.textPrimary,
    flexShrink: 1,
  },
  headerTitleBtn: { flexShrink: 1 },
  headerCount: { fontSize: Typography.sm, color: Colors.textTertiary },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerIconEmoji: { fontSize: 18, lineHeight: 24 },
  cancelSelectText: { fontSize: Typography.sm, fontWeight: Typography.semibold, color: Colors.accent },
  backArrow: { fontSize: Typography.xl, color: Colors.accent, lineHeight: Typography.xl * 1.2 },
  menuDots: { fontSize: Typography.xl, color: Colors.textPrimary, letterSpacing: 2, marginBottom: 4 },

  // Pousse les contrôles de zoom à droite quand la recherche est repliée.
  toolbarSpacer: { flex: 1 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    flexShrink: 0,
  },
  filterBtnActive: {
    borderColor: Colors.accent,
    backgroundColor: Colors.accentLight,
  },
  filterBtnDisabled: {
    opacity: 0.45,
  },
  filterBtnTextActive: {
    color: Colors.accent,
    fontWeight: Typography.semibold,
  },
  filterBtnText: { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: Typography.medium },
  filterInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    fontSize: Typography.sm,
    color: Colors.textPrimary,
  },
  zoomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  zoomBtn: { padding: 4 },
  zoomBtnDisabled: { opacity: 0.3 },
  zoomIcon: { fontSize: 18, color: Colors.textPrimary },
  zoomLabel: { fontSize: Typography.xs, color: Colors.textSecondary, fontWeight: Typography.medium, minWidth: 30, textAlign: 'center' },

  grid: { flexGrow: 1, paddingTop: Spacing.sm },
  gridRow: { flexDirection: 'row', paddingHorizontal: GRID_PADDING },
  /**
   * Même rythme vertical qu'un en-tête de groupe, pour que la liste garde
   * une seule grille. Mais typographie en retrait : « hors groupes » n'est
   * pas un groupe, c'est ce qui reste.
   */
  looseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: GRID_PADDING,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  looseLabel: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    color: Colors.textTertiary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  looseCount: { fontSize: Typography.xs, color: Colors.textTertiary, fontWeight: Typography.medium },
  // Ferme un groupe sans le souligner : un filet, pas une barre.
  groupDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: GRID_PADDING,
    marginTop: Spacing.sm,
  },

  renameBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.4)' },
  renameCard: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.xl,
    gap: Spacing.md,
    paddingBottom: 40,
  },
  renameTitle: { fontSize: Typography.lg, fontWeight: Typography.bold, color: Colors.textPrimary },
  renameInput: {
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    fontSize: Typography.base,
    color: Colors.textPrimary,
  },
  renameActions: { flexDirection: 'row', gap: Spacing.sm },
  renameCancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  renameCancelText: { fontSize: Typography.base, color: Colors.textSecondary },
  renameConfirmBtn: {
    flex: 1, paddingVertical: 12, borderRadius: Radius.md,
    backgroundColor: Colors.accent, alignItems: 'center',
  },
  renameConfirmDisabled: { opacity: 0.4 },
  renameConfirmText: { fontSize: Typography.base, color: 'white', fontWeight: Typography.semibold },

  deleteCard: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.xl,
    gap: Spacing.md,
    paddingBottom: 40,
  },
  deleteBody: { fontSize: Typography.sm, color: Colors.textSecondary, lineHeight: 20 },
  deleteConfirmBtn: {
    flex: 1, paddingVertical: 12, borderRadius: Radius.md,
    backgroundColor: Colors.error, alignItems: 'center',
  },

  // Multi-select action bar
  actionBar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingBottom: 28,
    paddingTop: Spacing.sm,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    gap: 4,
  },
  actionIcon: { fontSize: 22, color: Colors.textPrimary },
  actionIconDestructive: { color: Colors.error },
  actionLabel: { fontSize: Typography.xs, color: Colors.textSecondary, fontWeight: Typography.medium },
  actionLabelDestructive: { color: Colors.error },
  actionLabelDisabled: { color: Colors.textTertiary },

  // ── Bulk modals ──────────────────────────────────────────────────────────
  bulkBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.4)' },
  bulkSheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.lg,
    paddingBottom: 40,
    maxHeight: '75%',
  },
  bulkHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: Colors.borderLight,
    alignSelf: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  bulkTitle: {
    fontSize: Typography.lg,
    fontWeight: Typography.bold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  bulkOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  bulkStatusDot: {
    width: 10, height: 10, borderRadius: 5,
  },
  bulkColEmoji: { fontSize: 18, width: 22, textAlign: 'center' },
  bulkOptionLabel: { flex: 1, fontSize: Typography.base, color: Colors.textPrimary },
  bulkOptionAccent: { color: Colors.accent, fontWeight: Typography.semibold },
  bulkSectionLabel: {
    fontSize: Typography.xs,
    fontWeight: Typography.semibold,
    color: Colors.textTertiary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  bulkBackBtn: { paddingVertical: Spacing.md, alignItems: 'center' },
  bulkBackText: { fontSize: Typography.base, color: Colors.accent, fontWeight: Typography.medium },

  bulkDeleteIcon: {
    alignSelf: 'center',
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: '#FFF1F2',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  bulkDeleteBody: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  bulkActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  bulkCancelBtn: {
    flex: 1,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 14,
    alignItems: 'center',
  },
  bulkCancelText: {
    fontSize: Typography.base,
    fontWeight: Typography.semibold,
    color: Colors.textSecondary,
  },
  bulkDeleteBtn: {
    flex: 1,
    borderRadius: Radius.md,
    backgroundColor: Colors.error,
    paddingVertical: 14,
    alignItems: 'center',
  },
  bulkDeleteText: {
    fontSize: Typography.base,
    fontWeight: Typography.bold,
    color: 'white',
  },
})
