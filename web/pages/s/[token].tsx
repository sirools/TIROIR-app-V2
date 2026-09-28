// pages/s/[token].tsx — Page publique V2 (share_links table)
import type { GetServerSidePropsContext } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useReducer, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import HeaderTiroirWeb from '../../components/layout/HeaderTiroirWeb'
import WishCard from '../../components/share/WishCard'
import SuggestModal, { type SuggestStep } from '../../components/share/SuggestModal'
import SuggestionTriage from '../../components/share/SuggestionTriage'
import SuggestionsToggle from '../../components/share/SuggestionsToggle'
import { hasValidCookie } from '../../lib/shareAuth'
import { hasSignedCookie } from '../../lib/shareCookieSignature'
import { isLot, lotTotal } from '../../lib/quantity'
import { serverSupabase, supabase as browserSupabase } from '../../lib/supabase'
import { loadShareSuggestions, type ShareCollection } from '../../lib/shareSuggestions'
import {
  initialTriageState, pendingWishes, showTriage, triageReducer, visibleWishes,
  type TriageDecision, type Wish,
} from '../../lib/suggestions'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SharedObject {
  id: string
  title: string
  description: string | null
  status: string | null
  location_note: string | null
  cover_url: string | null
  attributes: Record<string, string | number | boolean | null> | null
  market_value: number | null
  user_value: number | null
  value_currency: string | null
  purchase_price: number | null
  purchase_currency: string | null
  purchase_date: string | null
  sale_price: number | null
  sale_price_lot: number | null
  deposit_amount: number | null
  quantity: number | null
  insured: boolean | null
  created_at: string | null
}

/**
 * Blocs d'informations exposés par le partage. Absent côté base = tout est
 * visible : les liens créés avant l'option gardent leur comportement.
 */
interface ShareFields {
  values: boolean
  location: boolean
  attributes: boolean
  description: boolean
  insurance: boolean
}

const ALL_FIELDS: ShareFields = {
  values: true, location: true, attributes: true, description: true, insurance: true,
}

/**
 * Idées et suggestions de la collection partagée (brouillon v4 0003).
 * Absent ou `collection: null` : la page se comporte exactement comme avant.
 */
interface SuggestionsProps {
  collection: ShareCollection | null
  wishes: Wish[]
  isOwner: boolean
  isLoggedIn: boolean
  /** Lien protégé ouvert avec un ancien cookie non signé : mot de passe à confirmer pour écrire. */
  suggestLocked: boolean
}

interface Props {
  suggestions?: SuggestionsProps
  token: string
  title: string
  objects: SharedObject[]
  allowDownload: boolean
  fields: ShareFields
  /** Date d'expiration du lien, `null` s'il n'expire pas. */
  expiresAt?: string | null
  error?: 'not_found' | 'expired'
  gated?: boolean
}

// ── Status helpers ─────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  owned: 'Possédé', stored: 'En stockage', loaned: 'Prêté',
  sold: 'Vendu', given: 'Donné', lost: 'Perdu',
}
const STATUS_COLOR: Record<string, string> = {
  owned: '#22C55E', stored: '#38BDF8', loaned: '#E879F9',
  sold: '#FBBF24', given: '#FB7185', lost: '#9CA3AF',
}

// Libellés FR des attributs connus (fallback : la clé brute)
const ATTR_LABEL_FR: Record<string, string> = {
  brand: 'Marque', model: 'Modèle', category: 'Catégorie', serial_number: 'N° de série',
  color: 'Couleur', material: 'Matière', dimensions: 'Dimensions', voltage: 'Voltage',
  condition: 'État', size: 'Taille', weight: 'Poids', year: 'Année',
}
// Ordre de priorité des attributs connus dans le tableau
const ATTR_ORDER = ['brand', 'model', 'category', 'color', 'material', 'size', 'condition', 'dimensions', 'year', 'weight', 'voltage', 'serial_number']

function attrLabel(key: string): string {
  return ATTR_LABEL_FR[key] ?? (key.charAt(0).toUpperCase() + key.slice(1))
}

function normCurrency(raw: string | null | undefined): string {
  const c = raw ?? 'EUR'
  if (c === '€') return 'EUR'
  if (c === '$') return 'USD'
  if (c === '£') return 'GBP'
  if (c.length === 3) return c
  return 'EUR'
}

function money(amount: number | null | undefined, rawCurrency?: string | null): string | null {
  if (amount === null || amount === undefined) return null
  return amount.toLocaleString('fr-FR', {
    style: 'currency', currency: normCurrency(rawCurrency), maximumFractionDigits: 0,
  })
}

function shortDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ── SSR ───────────────────────────────────────────────────────────────────────

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const token = (ctx.params?.token as string || '').trim()
  const supabase = getAdmin()

  const { data: link, error: linkErr } = await supabase
    .from('share_links')
    .select('id, user_id, title, object_ids, options, expires_at, is_archived')
    .eq('token', token)
    .single()

  if (linkErr || !link) return { props: { error: 'not_found', title: '', objects: [], allowDownload: false, fields: ALL_FIELDS } }
  if (link.is_archived || (link.expires_at && new Date(link.expires_at) < new Date())) {
    return { props: { error: 'expired', title: '', objects: [], allowDownload: false, fields: ALL_FIELDS } }
  }

  if (link.options?.password_protected && !hasValidCookie(token, ctx)) {
    return { props: { token, title: link.title ?? 'Partage TiROiR', objects: [], allowDownload: false, fields: ALL_FIELDS, gated: true } }
  }

  /**
   * Vue comptabilisée ici, et pas plus haut : seul ce point du parcours
   * signifie que la page est réellement rendue — ni introuvable, ni expirée,
   * ni bloquée par le mot de passe.
   *
   * Volontairement sans await : le compteur ne doit jamais retarder ni faire
   * échouer l'affichage du partage.
   */
  void supabase.rpc('increment_share_view', { p_token: token })

  const ids: string[] = Array.isArray(link.object_ids) ? link.object_ids : []
  const fields: ShareFields = { ...ALL_FIELDS, ...(link.options?.fields ?? {}) }

  /**
   * Ce qu'un partage masque n'est PAS chargé.
   *
   * Filtrer au rendu ne suffit pas : les props d'une page Next voyagent en
   * clair dans le HTML, et « afficher le code source » suffirait à lire des
   * montants que le propriétaire a explicitement choisi de ne pas montrer.
   * La colonne n'est donc même pas demandée à la base.
   */
  const columns = [
    'id', 'title', 'status', 'quantity', 'created_at',
    ...(fields.description ? ['description'] : []),
    ...(fields.location ? ['location_note'] : []),
    ...(fields.attributes ? ['attributes'] : []),
    ...(fields.values ? [
      'market_value', 'user_value', 'value_currency',
      'purchase_price', 'purchase_currency', 'purchase_date',
      'sale_price', 'sale_price_lot', 'deposit_amount',
    ] : []),
    ...(fields.insurance ? ['insured'] : []),
  ].join(', ')

  const { data: objData } = await supabase
    .from('objects')
    .select(columns)
    .in('id', ids)

  // Covers
  const { data: imgData } = await supabase
    .from('object_images')
    .select('object_id, storage_path')
    .in('object_id', ids)
    .eq('is_cover', true)

  const coverPaths: Record<string, string> = {}
  if (imgData) for (const img of imgData) coverPaths[img.object_id] = img.storage_path

  const paths = Object.values(coverPaths)
  const coverUrls: Record<string, string> = {}
  if (paths.length) {
    const { data: signed } = await supabase.storage
      .from('object-images')
      .createSignedUrls(paths, 3600)
    if (signed) {
      for (const s of signed) {
        const objId = Object.entries(coverPaths).find(([, p]) => p === s.path)?.[0]
        if (objId && s.signedUrl) coverUrls[objId] = s.signedUrl
      }
    }
  }

  /**
   * « Assuré » se DÉDUIT, il ne se lit plus.
   *
   * `objects.insured` était piloté par une bascule de la fiche, supprimée
   * lors du passage aux contrats multiples : un contrat ajouté depuis laisse
   * le booléen à false, et le partage annoncerait « Non » alors que l'objet
   * est assuré. On retient donc la présence d'un contrat OU l'ancien booléen
   * — quelques objets historiques ne portent leur assurance que par lui.
   */
  const insuredIds = new Set<string>()
  if (fields.insurance && ids.length > 0) {
    const { data: insRows } = await supabase
      .from('object_insurances')
      .select('object_id')
      .in('object_id', ids)
    for (const row of insRows ?? []) insuredIds.add(row.object_id)
  }

  // Les champs absents de la requête arrivent à `null` côté client, ce que
  // les types déclarent déjà : rien à distinguer entre « masqué » et « vide ».
  const objects: SharedObject[] = (objData ?? []).map((o: any) => ({
    description: null, location_note: null, attributes: null,
    market_value: null, user_value: null, value_currency: null,
    purchase_price: null, purchase_currency: null, purchase_date: null,
    sale_price: null, sale_price_lot: null, deposit_amount: null,
    ...o,
    insured: fields.insurance ? Boolean(o.insured || insuredIds.has(o.id)) : null,
    cover_url: coverUrls[o.id] ?? null,
  }))

  // Qui regarde : getUser() vérifie le jeton auprès de Supabase, une session
  // simplement décodée ne suffit pas à montrer la vue du propriétaire.
  let viewerId: string | null = null
  try {
    const { data } = await serverSupabase(ctx).auth.getUser()
    viewerId = data.user?.id ?? null
  } catch {
    viewerId = null
  }
  const { collection, wishes } = await loadShareSuggestions(supabase, link, viewerId)
  const suggestions: SuggestionsProps = {
    collection,
    wishes,
    isOwner: viewerId !== null && viewerId === link.user_id,
    isLoggedIn: viewerId !== null,
    suggestLocked: Boolean(link.options?.password_protected) && !hasSignedCookie(token, ctx.req),
  }

  return {
    props: {
      suggestions,
      token,
      title: link.title ?? 'Partage TiROiR',
      objects,
      allowDownload: link.options?.allow_download ?? false,
      fields,
      expiresAt: link.expires_at ?? null,
    },
  }
}

// ── Formulaire mot de passe ─────────────────────────────────────────────────────

function PasswordForm({ token }: { token: string }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault?.()
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/shares/${encodeURIComponent(token)}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.ok) { window.location.href = `/s/${token}`; return }
      if (res.status === 401) setError('Mot de passe incorrect. Réessaie.')
      else if (res.status === 404) setError('Ce lien de partage est introuvable.')
      else if (res.status === 410) setError('Ce lien a expiré.')
      else setError("Une erreur est survenue. Réessaie plus tard.")
    } catch {
      setError("Impossible d'atteindre le serveur.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="password-gate">
      <div className="password-icon">🔒</div>
      <h1 className="password-title">Partage protégé</h1>
      <p className="password-sub">Ce partage est protégé par un mot de passe.</p>
      <form onSubmit={onSubmit} className="password-form">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mot de passe"
          autoFocus
          className="password-input"
        />
        <button type="submit" disabled={loading} className="password-btn">
          {loading ? '...' : 'Valider'}
        </button>
      </form>
      {error && <p className="password-error">{error}</p>}
      <style jsx>{`
        .password-gate {
          display: flex; flex-direction: column; align-items: center;
          gap: 8px; padding: 80px 24px; text-align: center;
        }
        .password-icon { font-size: 48px; margin-bottom: 8px; }
        .password-title { font-size: 24px; font-weight: 800; color: #1A1612; }
        .password-sub { font-size: 14px; color: #6B6158; margin-bottom: 16px; }
        .password-form { display: flex; gap: 8px; width: 100%; max-width: 360px; }
        .password-input {
          flex: 1; padding: 12px 14px; border-radius: 12px;
          border: 1px solid rgba(0,0,0,0.12); font-size: 15px;
        }
        .password-btn {
          padding: 12px 20px; border-radius: 12px; border: 0;
          background: #F26900; color: white; font-weight: 700;
          font-size: 15px; cursor: pointer;
        }
        .password-btn:disabled { opacity: 0.7; cursor: default; }
        .password-error { color: #C0392B; font-size: 14px; font-weight: 600; margin-top: 8px; }
      `}</style>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

type SortKey = 'title' | 'status' | 'location_note' | 'value'
  | 'market_value' | 'purchase_price' | 'sale_price' | 'deposit_amount' | 'created_at'
type SortDir = 'asc' | 'desc'

function sortValueOf(obj: SharedObject, key: SortKey): string | number {
  switch (key) {
    case 'title': return obj.title?.toLowerCase() ?? ''
    case 'status': return obj.status ? (STATUS_LABEL[obj.status] ?? obj.status).toLowerCase() : ''
    case 'location_note': return obj.location_note?.toLowerCase() ?? ''
    case 'value': return obj.user_value ?? obj.market_value ?? -Infinity
    case 'market_value': return obj.market_value ?? -Infinity
    case 'purchase_price': return obj.purchase_price ?? -Infinity
    case 'sale_price': return obj.sale_price ?? -Infinity
    case 'deposit_amount': return obj.deposit_amount ?? -Infinity
    case 'created_at': return obj.created_at ? new Date(obj.created_at).getTime() : -Infinity
  }
}

function sortObjects(objects: SharedObject[], key: SortKey | null, dir: SortDir) {
  if (!key) return objects
  const factor = dir === 'asc' ? 1 : -1
  return [...objects].sort((a, b) => {
    const va = sortValueOf(a, key)
    const vb = sortValueOf(b, key)
    if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * factor
    return String(va).localeCompare(String(vb), 'fr') * factor
  })
}

export default function ShareV2Page({ token, title, objects, allowDownload, fields = ALL_FIELDS, expiresAt, error, gated, suggestions }: Props) {
  const router = useRouter()
  const collection = suggestions?.collection ?? null
  const isOwner = suggestions?.isOwner ?? false
  const [suggestionsEnabled, setSuggestionsEnabled] = useState(collection?.suggestionsEnabled ?? false)
  const [triage, dispatch] = useReducer(triageReducer, suggestions?.wishes ?? [], initialTriageState)
  const [triageBusy, setTriageBusy] = useState(false)
  const [triageError, setTriageError] = useState<string | null>(null)
  const [suggestStep, setSuggestStep] = useState<SuggestStep | null>(null)
  const [justSuggested, setJustSuggested] = useState(false)

  // Le « + » : collection déterminée, suggestions activées, pas le propriétaire.
  const canSuggest = Boolean(collection) && suggestionsEnabled && !isOwner
  const wishesInGrid = visibleWishes(triage)
  const pending = pendingWishes(triage)

  function openSuggest() {
    setJustSuggested(false)
    if (!suggestions?.isLoggedIn) setSuggestStep('signup')
    else if (suggestions.suggestLocked) setSuggestStep('password')
    else setSuggestStep('form')
  }

  async function decide(id: string, decision: TriageDecision) {
    const before = triage.history
    setTriageBusy(true); setTriageError(null)
    dispatch({ type: 'decide', id, decision })
    const { error: rpcErr } = await browserSupabase.rpc('triage_collection_wish', { p_wish_id: id, p_decision: decision })
    if (rpcErr) {
      dispatch({ type: 'rollback', id, status: 'suggested', history: before })
      setTriageError('Ce choix n’a pas pu être enregistré. Réessaie.')
    }
    setTriageBusy(false)
  }

  async function undo() {
    const last = triage.history[triage.history.length - 1]
    if (!last) return
    const before = triage.history
    setTriageBusy(true); setTriageError(null)
    dispatch({ type: 'undo' })
    const { error: rpcErr } = await browserSupabase.rpc('undo_collection_wish_triage', { p_wish_id: last.id })
    if (rpcErr) {
      dispatch({ type: 'rollback', id: last.id, status: last.decision === 'keep' ? 'idea' : 'dismissed', history: before })
      setTriageError('L’annulation n’a pas pu être enregistrée. Réessaie.')
    }
    setTriageBusy(false)
  }
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [exportMode, setExportMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const pageTitle = error ? 'Lien introuvable — TiROiR' : `${title} — TiROiR`

  function toggleSort(key: SortKey) {
    if (sortKey !== key) { setSortKey(key); setSortDir('asc'); return }
    setSortDir(d => d === 'asc' ? 'desc' : 'asc')
  }

  function startExportSelection() {
    setSelectedIds(new Set(objects.map(o => o.id)))
    setExportMode(true)
    setView('list')
  }

  function toggleSelected(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /** Décompte avant archivage automatique du lien. */
  const expiry = (() => {
    if (!expiresAt) return null
    const end = new Date(expiresAt)
    if (isNaN(end.getTime())) return null
    const days = Math.ceil((end.getTime() - Date.now()) / 86400_000)
    const date = end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    if (days <= 0) return { label: `Ce lien expire aujourd'hui`, urgent: true }
    if (days === 1) return { label: `Ce lien expire demain, le ${date}`, urgent: true }
    return {
      label: `Ce lien expire dans ${days} jours, le ${date}`,
      // Une semaine : le seuil où prévenir sert encore à quelque chose.
      urgent: days <= 7,
    }
  })()

  const sortedObjects = sortObjects(objects, sortKey, sortDir)

  // Colonnes d'attributs : union des clés présentes sur les objets, connues d'abord
  const attrKeys = (() => {
    if (!fields.attributes) return []
    const seen: string[] = []
    for (const o of objects) {
      for (const [k, v] of Object.entries(o.attributes ?? {})) {
        if (v === null || v === undefined || v === '') continue
        if (!seen.includes(k)) seen.push(k)
      }
    }
    return seen.sort((a, b) => {
      const ia = ATTR_ORDER.indexOf(a), ib = ATTR_ORDER.indexOf(b)
      if (ia !== -1 && ib !== -1) return ia - ib
      if (ia !== -1) return -1
      if (ib !== -1) return 1
      return seen.indexOf(a) - seen.indexOf(b)
    })
  })()

  // Colonnes monétaires (partagent en-tête, cellule, total, tri)
  const allMoneyCols: {
    key: Extract<SortKey, 'value' | 'market_value' | 'purchase_price' | 'sale_price' | 'deposit_amount'>
    label: string
    /** Montant unitaire, tel qu'il est stocké. */
    get: (o: SharedObject) => number | null
    /** Ce que pèse la ligne : unitaire × quantité, sauf prix de lot négocié. */
    total: (o: SharedObject) => number | null
    cur: (o: SharedObject) => string | null
  }[] = [
    { key: 'value', label: 'Valeur estimée', get: o => o.user_value ?? o.market_value, total: o => lotTotal(o.user_value ?? o.market_value, o.quantity), cur: o => o.value_currency },
    { key: 'market_value', label: 'Valeur marché', get: o => o.market_value, total: o => lotTotal(o.market_value, o.quantity), cur: o => o.value_currency },
    { key: 'purchase_price', label: "Prix d'achat", get: o => o.purchase_price, total: o => lotTotal(o.purchase_price, o.quantity), cur: o => o.purchase_currency ?? o.value_currency },
    // Un prix de lot négocié remplace le produit, il ne s'y ajoute pas.
    { key: 'sale_price', label: 'Prix de vente', get: o => o.sale_price, total: o => o.sale_price_lot ?? lotTotal(o.sale_price, o.quantity), cur: o => o.value_currency },
    { key: 'deposit_amount', label: 'Caution', get: o => o.deposit_amount, total: o => lotTotal(o.deposit_amount, o.quantity), cur: o => o.value_currency },
  ]

  // Le partage peut masquer tout le bloc monétaire d'un coup.
  const moneyCols = fields.values ? allMoneyCols : []

  /**
   * Total par colonne monétaire (EUR — devise dominante du partage).
   *
   * Convention comptable : les cellules affichent le montant UNITAIRE, la
   * colonne Quantité dit combien, et seule la ligne de total multiplie.
   * C'est l'inverse du mobile, où l'on parcourt un patrimoine et où la
   * carte montre directement le total du lot — deux lectures différentes
   * du même modèle, chacune adaptée à sa surface.
   */
  // Nombre d'exemplaires réellement partagés, lots compris.
  const totalUnits = objects.reduce((n, o) => n + (o.quantity ?? 1), 0)

  const moneyTotals: Record<string, number> = {}
  for (const col of moneyCols) {
    moneyTotals[col.key] = objects.reduce((sum, o) => sum + (col.total(o) ?? 0), 0)
  }

  if (gated) {
    return (
      <>
        <Head>
          <title>{pageTitle}</title>
          <meta name="robots" content="noindex,nofollow" />
        </Head>
        <div className="root">
          <HeaderTiroirWeb />
          <main className="main">
            <PasswordForm token={token} />
          </main>
        </div>
        <style jsx>{`
          .root {
            min-height: 100vh;
            background: #F7F3EE;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            color: #1A1612;
            display: flex; flex-direction: column;
          }
          .main { flex: 1; max-width: 1200px; margin: 0 auto; padding: 32px 24px; width: 100%; box-sizing: border-box; }
        `}</style>
      </>
    )
  }

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="root">
        <HeaderTiroirWeb />

        <main className="main">
          <Link href="/mes-partages" legacyBehavior passHref>
            <a className="back-link">← Retour à mes partages</a>
          </Link>

          {error ? (
            <div className="error-state">
              <div className="error-icon">{error === 'expired' ? '⏱' : '🔍'}</div>
              <h1 className="error-title">
                {error === 'expired' ? 'Ce lien a expiré' : 'Lien introuvable'}
              </h1>
              <p className="error-sub">
                {error === 'expired'
                  ? 'Demandez un nouveau lien au propriétaire.'
                  : 'Vérifiez l\'adresse ou demandez un nouveau lien.'}
              </p>
              <Link href="/" legacyBehavior passHref>
                <a className="cta-btn">Découvrir TiROiR</a>
              </Link>
            </div>
          ) : (
            <>
              <div className="page-hero">
                <div className="page-hero-text">
                  <h1 className="page-title">{title}</h1>
                  <p className="page-sub">Partagé via TiROiR · {objects.length} objet{objects.length !== 1 ? 's' : ''}</p>
                  {/* Un lien à durée limitée doit le dire pendant qu'il vit
                      encore : constater l'expiration après coup n'aide personne. */}
                  {expiry && (
                    <p className={`expiry ${expiry.urgent ? 'urgent' : ''}`}>
                      ⏱ {expiry.label}
                    </p>
                  )}
                </div>
                <div className="hero-actions">
                {canSuggest && (
                  <button type="button" className="suggest-btn" onClick={openSuggest}>
                    <span aria-hidden>+</span> Suggérer un objet
                  </button>
                )}
                <div className="view-toggle" role="group" aria-label="Mode d'affichage">
                  <button
                    type="button"
                    className={`view-btn ${view === 'grid' ? 'active' : ''}`}
                    onClick={() => setView('grid')}
                    aria-pressed={view === 'grid'}
                  >
                    ▦ Grille
                  </button>
                  <button
                    type="button"
                    className={`view-btn ${view === 'list' ? 'active' : ''}`}
                    onClick={() => setView('list')}
                    aria-pressed={view === 'list'}
                  >
                    ☰ Tableau
                  </button>
                </div>
                </div>
              </div>

              {justSuggested && (
                <p className="suggest-ok" role="status">
                  Suggestion envoyée. Elle apparaît en pointillé jusqu’à ce que le propriétaire la trie.
                </p>
              )}

              {isOwner && collection && (
                <SuggestionsToggle
                  collectionId={collection.id}
                  collectionName={collection.name}
                  enabled={suggestionsEnabled}
                  onChange={setSuggestionsEnabled}
                />
              )}

              {isOwner && showTriage(triage) && (
                <SuggestionTriage
                  pending={pending}
                  canUndo={triage.history.length > 0}
                  busy={triageBusy}
                  error={triageError}
                  onDecide={decide}
                  onUndo={undo}
                />
              )}

              {view === 'grid' ? (
                <div className="grid">
                  {objects.map(obj => (
                    <div
                      key={obj.id}
                      className="card"
                      onClick={() => router.push(`/s/${token}/${obj.id}`)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="card-cover">
                        {obj.cover_url
                          ? <img src={obj.cover_url} alt={obj.title} className="cover-img" />
                          : <div className="cover-placeholder">📦</div>
                        }
                        {/* Même pastille que dans l'app : un lot partagé ne
                            doit pas se lire comme un exemplaire unique. */}
                        {isLot(obj.quantity) && (
                          <span className="qty-badge">×{obj.quantity}</span>
                        )}
                      </div>
                      <div className="card-body">
                        <h2 className="card-title">{obj.title}</h2>
                        {obj.status && (
                          <div className="status-row">
                            <span
                              className="status-dot"
                              style={{ background: STATUS_COLOR[obj.status] ?? '#9CA3AF' }}
                            />
                            <span className="status-label">
                              {STATUS_LABEL[obj.status] ?? obj.status}
                            </span>
                          </div>
                        )}
                        {fields.location && obj.location_note && (
                          <p className="location">📍 {obj.location_note}</p>
                        )}
                        {obj.description && (
                          <p className="description">{obj.description}</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {/* Idées et suggestions : après les objets possédés, en « fantôme ». */}
                  {wishesInGrid.map(w => <WishCard key={w.id} wish={w} />)}
                </div>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        {exportMode && (
                          <th className="th-check">
                            <input
                              type="checkbox"
                              checked={selectedIds.size === objects.length && objects.length > 0}
                              onChange={() => setSelectedIds(
                                selectedIds.size === objects.length ? new Set() : new Set(objects.map(o => o.id))
                              )}
                            />
                          </th>
                        )}
                        <th className="th-cover"></th>
                        <th className="th-sortable" onClick={() => toggleSort('title')}>
                          Titre{sortKey === 'title' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                        </th>
                        <th className="th-sortable" onClick={() => toggleSort('status')}>
                          Statut{sortKey === 'status' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                        </th>
                        {fields.location && (
                          <th className="th-sortable" onClick={() => toggleSort('location_note')}>
                            Emplacement{sortKey === 'location_note' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                          </th>
                        )}
                        {attrKeys.map(k => (
                          <th key={k} className="th-attr">{attrLabel(k)}</th>
                        ))}
                        {fields.description && <th className="th-desc">Description</th>}
                        <th className="th-center">Qté</th>
                        {moneyCols.map(col => (
                          <th key={col.key} className="th-value th-sortable" onClick={() => toggleSort(col.key)}>
                            {col.label}{sortKey === col.key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                          </th>
                        ))}
                        {fields.insurance && <th className="th-center">Assuré</th>}
                        <th className="th-sortable th-nowrap" onClick={() => toggleSort('created_at')}>
                          Ajouté le{sortKey === 'created_at' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedObjects.map(obj => (
                        <tr
                          key={obj.id}
                          onClick={() => exportMode ? toggleSelected(obj.id) : router.push(`/s/${token}/${obj.id}`)}
                        >
                          {exportMode && (
                            <td className="td-check" onClick={e => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={selectedIds.has(obj.id)}
                                onChange={() => toggleSelected(obj.id)}
                              />
                            </td>
                          )}
                          <td className="td-cover">
                            {obj.cover_url
                              ? <img src={obj.cover_url} alt={obj.title} className="row-thumb" />
                              : <div className="row-thumb-placeholder">📦</div>
                            }
                          </td>
                          <td className="td-title">{obj.title}</td>
                          <td>
                            {obj.status && (
                              <span className="status-row">
                                <span
                                  className="status-dot"
                                  style={{ background: STATUS_COLOR[obj.status] ?? '#9CA3AF' }}
                                />
                                <span className="status-label">{STATUS_LABEL[obj.status] ?? obj.status}</span>
                              </span>
                            )}
                          </td>
                          {fields.location && (
                            <td className="td-muted td-nowrap">{obj.location_note ?? '—'}</td>
                          )}
                          {attrKeys.map(k => {
                            const v = obj.attributes?.[k]
                            return (
                              <td key={k} className="td-attr">
                                {v === null || v === undefined || v === '' ? '—' : String(v)}
                              </td>
                            )
                          })}
                          {fields.description && (
                            <td className="td-description">{obj.description ?? '—'}</td>
                          )}
                          <td className="td-center td-qty">
                            {isLot(obj.quantity) ? obj.quantity : '—'}
                          </td>
                          {moneyCols.map(col => (
                            <td key={col.key} className="td-value">
                              {money(col.get(obj), col.cur(obj)) ?? '—'}
                            </td>
                          ))}
                          {fields.insurance && (
                            <td className="td-center">{obj.insured ? 'Oui' : '—'}</td>
                          )}
                          <td className="td-muted td-nowrap">{shortDate(obj.created_at) ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="total-row">
                        <td
                          colSpan={
                            (exportMode ? 1 : 0) + 3
                            + (fields.location ? 1 : 0)
                            + attrKeys.length
                            + (fields.description ? 1 : 0)
                          }
                          className="td-total-label"
                        >Total</td>
                        <td className="td-center td-total-value">
                          {totalUnits > objects.length ? totalUnits : ''}
                        </td>
                        {moneyCols.map(col => (
                          <td key={col.key} className="td-value td-total-value">
                            {moneyTotals[col.key] > 0 ? money(moneyTotals[col.key], 'EUR') : '—'}
                          </td>
                        ))}
                        {fields.insurance && <td className="td-center"></td>}
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {allowDownload && (
                <div className="download-row">
                  {!exportMode ? (
                    <button type="button" className="download-btn" onClick={startExportSelection}>
                      ↓ Télécharger CSV
                    </button>
                  ) : (
                    <div className="export-panel">
                      <div className="export-shortcuts">
                        <button
                          type="button"
                          className="text-link"
                          onClick={() => setSelectedIds(new Set(objects.map(o => o.id)))}
                        >
                          Tout sélectionner
                        </button>
                        <span className="dot-sep">·</span>
                        <button
                          type="button"
                          className="text-link"
                          onClick={() => setSelectedIds(new Set())}
                        >
                          Tout désélectionner
                        </button>
                      </div>
                      <div className="export-actions">
                        <span className="export-count">
                          {selectedIds.size} objet{selectedIds.size !== 1 ? 's' : ''} sélectionné{selectedIds.size !== 1 ? 's' : ''}
                        </span>
                        <a
                          className={`download-btn ${selectedIds.size === 0 ? 'btn-disabled' : ''}`}
                          href={`/api/shares/${encodeURIComponent(token)}/export.csv?ids=${encodeURIComponent(Array.from(selectedIds).join(','))}`}
                          download
                          onClick={(e) => { if (selectedIds.size === 0) e.preventDefault() }}
                        >
                          ↓ CSV
                        </a>
                        <a
                          className={`download-btn ${selectedIds.size === 0 ? 'btn-disabled' : ''}`}
                          href={`/api/shares/${encodeURIComponent(token)}/export.pdf?ids=${encodeURIComponent(Array.from(selectedIds).join(','))}`}
                          download
                          onClick={(e) => { if (selectedIds.size === 0) e.preventDefault() }}
                        >
                          ↓ PDF
                        </a>
                        <button type="button" className="text-link" onClick={() => setExportMode(false)}>
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="app-cta">
                <h2 className="app-cta-title">Créez votre inventaire personnel</h2>
                <p className="app-cta-sub">TiROiR — photographiez, cataloguez, retrouvez.</p>
                <Link href="/" legacyBehavior passHref>
                  <a className="cta-btn">Découvrir TiROiR →</a>
                </Link>
              </div>
            </>
          )}
        </main>

        {suggestStep && (
          <SuggestModal
            token={token}
            initialStep={suggestStep}
            onClose={() => setSuggestStep(null)}
            onCreated={wish => { dispatch({ type: 'add', wish }); setJustSuggested(true); setView('grid') }}
          />
        )}

        <footer className="footer">
          <Link href="/privacy" legacyBehavior passHref>
            <a className="footer-link">Politique de confidentialité</a>
          </Link>
          <span className="footer-sep">·</span>
          <span className="footer-copy">© 2026 TiROiR</span>
        </footer>
      </div>

      <style jsx>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        .root {
          min-height: 100vh;
          background: #F7F3EE;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          color: #1A1612;
          display: flex; flex-direction: column;
        }

        /* Main */
        .main { flex: 1; max-width: 1200px; margin: 0 auto; padding: 32px 24px; width: 100%; box-sizing: border-box; }

        .back-link {
          background: none; border: 0; cursor: pointer; padding: 0;
          font-size: 14px; font-weight: 600; color: #6B6158;
          margin-bottom: 20px;
        }
        .back-link:hover { color: #F26900; }

        /* Page hero */
        .page-hero {
          display: flex; align-items: flex-end; justify-content: space-between;
          gap: 16px; flex-wrap: wrap; margin-bottom: 28px;
        }
        .page-title { font-size: 28px; font-weight: 800; color: #1A1612; line-height: 1.2; }
        .expiry {
          margin: 6px 0 0; font-size: 13px; font-weight: 600;
          color: #6B6158;
        }
        .expiry.urgent { color: #C2410C; }
        .page-sub { font-size: 14px; color: #A89F96; margin-top: 6px; }

        /* Suggestions */
        .hero-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .suggest-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 9px 16px; border-radius: 999px; border: 0;
          background: #F26900; color: #fff; font-size: 14px; font-weight: 700; cursor: pointer;
        }
        .suggest-btn span { font-size: 18px; line-height: 1; }
        .suggest-btn:hover { background: #D85E00; }
        .suggest-ok {
          background: #FDF1E6; border: 1px solid #F8D2AE; color: #8A3D00;
          border-radius: 12px; padding: 10px 14px; font-size: 14px; margin-bottom: 20px;
        }

        /* View toggle */
        .view-toggle {
          display: flex; gap: 4px; padding: 4px;
          background: #F0EBE3; border-radius: 12px; flex-shrink: 0;
        }
        .view-btn {
          padding: 8px 14px; border-radius: 9px; border: 0; background: transparent;
          color: #6B6158; font-size: 13px; font-weight: 600; cursor: pointer;
          transition: background 0.15s, color 0.15s;
        }
        .view-btn:hover { color: #1A1612; }
        .view-btn.active { background: #fff; color: #1A1612; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }

        /* Table view — scroll horizontal pour absorber toutes les colonnes */
        .table-wrap {
          background: #fff; border-radius: 16px; border: 1px solid #E8E2DA;
          overflow-x: auto; overflow-y: hidden; margin-bottom: 32px;
          -webkit-overflow-scrolling: touch;
        }
        .table { width: 100%; border-collapse: collapse; }
        .table th {
          text-align: left; font-size: 12px; font-weight: 700; color: #A89F96;
          text-transform: uppercase; letter-spacing: 0.4px;
          padding: 14px 16px; border-bottom: 1px solid #E8E2DA; background: #FBF9F6;
          white-space: nowrap;
        }
        .th-cover { width: 64px; }
        .th-value { text-align: right; }
        .th-center { text-align: center; }
        .th-nowrap { white-space: nowrap; }
        .th-sortable { cursor: pointer; user-select: none; white-space: nowrap; }
        .th-sortable:hover { color: #F26900; }
        .table td {
          padding: 12px 16px; border-bottom: 1px solid #F0EBE3;
          font-size: 14px; color: #1A1612; vertical-align: middle;
        }
        .table tbody tr { cursor: pointer; transition: background 0.15s; }
        .table tbody tr:hover { background: #FBF9F6; }
        .table tbody tr:last-child td { border-bottom: 0; }
        .td-cover { width: 64px; }
        .row-thumb { width: 44px; height: 44px; border-radius: 8px; object-fit: cover; display: block; }
        .row-thumb-placeholder {
          width: 44px; height: 44px; border-radius: 8px; background: #F0EBE3;
          display: grid; place-items: center; font-size: 18px;
        }
        .td-title { font-weight: 600; white-space: nowrap; }
        .td-muted { color: #6B6158; }
        .td-nowrap { white-space: nowrap; }
        .td-attr {
          color: #1A1612; max-width: 200px;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .td-center { text-align: center; color: #6B6158; }
        /* La quantité se lit comme un compte, pas comme un montant. */
        .td-qty { font-variant-numeric: tabular-nums; font-weight: 600; color: #1A1612; }
        .td-description {
          color: #6B6158; max-width: 280px;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .td-value { text-align: right; font-weight: 700; color: #F26900; white-space: nowrap; }
        .th-check, .td-check { width: 40px; text-align: center; }
        .th-check input[type="checkbox"], .td-check input[type="checkbox"] {
          -webkit-appearance: checkbox; appearance: auto;
          width: 16px; height: 16px; cursor: pointer; accent-color: #F26900;
        }
        .total-row td { background: #FBF9F6; border-top: 2px solid #E8E2DA; border-bottom: 0; }
        .td-total-label { text-align: right; font-weight: 700; color: #6B6158; text-transform: uppercase; font-size: 12px; letter-spacing: 0.4px; white-space: nowrap; }
        .td-total-value { font-size: 15px; }

        /* Grid */
        .grid {
          display: grid;
          width: 100%;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-bottom: 32px;
        }
        @media (min-width: 700px) { .grid { grid-template-columns: 1fr 1fr 1fr; } }
        @media (min-width: 1000px) { .grid { grid-template-columns: 1fr 1fr 1fr 1fr; } }

        /* Card */
        .card {
          background: #fff;
          border-radius: 16px;
          border: 1px solid #E8E2DA;
          overflow: hidden;
          cursor: pointer;
          transition: box-shadow 0.15s, transform 0.15s;
        }
        .card:hover {
          box-shadow: 0 4px 20px rgba(0,0,0,0.08);
          transform: translateY(-2px);
        }
        .card-cover { aspect-ratio: 1; overflow: hidden; background: #F0EBE3; position: relative; }
        .qty-badge {
          position: absolute; top: 8px; right: 8px;
          padding: 2px 7px; border-radius: 999px;
          background: rgba(26, 22, 18, 0.72); color: #fff;
          font-size: 11px; font-weight: 700; line-height: 1.5;
        }
        .cover-img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .cover-placeholder {
          width: 100%; height: 100%;
          display: grid; place-items: center;
          font-size: 48px;
        }
        .card-body { padding: 16px; display: flex; flex-direction: column; gap: 6px; }
        .card-title { font-size: 15px; font-weight: 600; color: #1A1612; line-height: 1.3; }
        .status-row { display: flex; align-items: center; gap: 6px; }
        .status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .status-label { font-size: 12px; color: #6B6158; }
        .location { font-size: 12px; color: #A89F96; }
        .description { font-size: 13px; color: #6B6158; line-height: 1.5;
          display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
          overflow: hidden; }

        /* Download */
        .download-row { display: flex; justify-content: center; margin-bottom: 32px; }
        .download-btn {
          display: inline-block;
          padding: 12px 24px; border-radius: 12px;
          border: 1.5px solid #F26900; background: transparent;
          color: #F26900; font-weight: 600; font-size: 15px;
          cursor: pointer; text-decoration: none;
        }
        .download-btn:hover { background: #F26900; color: white; }
        .download-btn.btn-disabled { opacity: 0.4; cursor: default; pointer-events: none; }

        /* Export selection panel */
        .export-panel {
          display: flex; flex-direction: column; align-items: center; gap: 12px;
        }
        .export-shortcuts { display: flex; align-items: center; gap: 8px; }
        .text-link {
          background: none; border: 0; padding: 0; cursor: pointer;
          font-size: 13px; font-weight: 600; color: #6B6158; text-decoration: underline;
        }
        .text-link:hover { color: #F26900; }
        .dot-sep { color: #A89F96; font-size: 13px; }
        .export-actions { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; justify-content: center; }
        .export-count { font-size: 14px; color: #1A1612; font-weight: 600; }

        /* App CTA */
        .app-cta {
          background: #fff; border-radius: 20px; border: 1px solid #E8E2DA;
          padding: 40px 24px; text-align: center; margin-bottom: 32px;
        }
        .app-cta-title { font-size: 22px; font-weight: 800; color: #1A1612; }
        .app-cta-sub { font-size: 14px; color: #6B6158; margin: 8px 0 20px; }
        .cta-btn {
          display: inline-block;
          background: #F26900; color: white;
          padding: 14px 28px; border-radius: 999px;
          font-weight: 700; font-size: 15px; text-decoration: none;
          transition: background 0.15s;
        }
        .cta-btn:hover { background: #D85E00; }

        /* Error state */
        .error-state {
          display: flex; flex-direction: column; align-items: center;
          gap: 16px; padding: 80px 24px; text-align: center;
        }
        .error-icon { font-size: 56px; }
        .error-title { font-size: 26px; font-weight: 800; color: #1A1612; }
        .error-sub { font-size: 15px; color: #6B6158; max-width: 340px; line-height: 1.5; }

        /* Footer */
        .footer {
          display: flex; align-items: center; justify-content: center;
          gap: 8px; padding: 20px;
          border-top: 1px solid #E8E2DA;
        }
        .footer-link { font-size: 12px; color: #A89F96; text-decoration: underline; }
        .footer-sep { font-size: 12px; color: #A89F96; }
        .footer-copy { font-size: 12px; color: #A89F96; }

        @media (max-width: 600px) {
          .grid { gap: 12px; }
          .page-title { font-size: 22px; }
        }
      `}</style>
    </>
  )
}
