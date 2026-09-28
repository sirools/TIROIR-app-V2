// lib/suggestions.ts — idées et suggestions d'une collection partagée.
//
// Logique pure, partagée par le navigateur et le serveur : validation du
// formulaire de suggestion et état du tri (garder / écarter / annuler).
// Le schéma correspondant est v4/supabase/drafts/0003_collection_suggestions.sql.

/**
 * Les trois états d'un objet dans la grille d'une collection. `owned` reste
 * la table `objects` ; `idea` et `suggested` viennent de `collection_wishes`.
 */
export type ObjectKind = 'owned' | 'idea' | 'suggested'

/** Statut stocké d'une ligne de `collection_wishes`. */
export type WishStatus = 'suggested' | 'idea' | 'dismissed'

export interface WishAuthor {
  id: string
  /** Prénom affiché : premier mot du nom de profil. */
  firstName: string
  displayName: string | null
  avatarUrl: string | null
}

export interface Wish {
  id: string
  status: WishStatus
  title: string
  url: string | null
  price: number | null
  currency: string
  createdAt: string
  author: WishAuthor | null
}

export const TITLE_MAX = 120
export const URL_MAX = 2000
export const PRICE_MAX = 10_000_000

export interface SuggestionInput {
  title: string
  url: string | null
  price: number | null
}

export type SuggestionInputError = 'title_required' | 'title_too_long' | 'url_invalid' | 'price_invalid'

export const INPUT_ERROR_LABEL: Record<SuggestionInputError, string> = {
  title_required: 'Donne un nom à l’objet.',
  title_too_long: `Le nom ne doit pas dépasser ${TITLE_MAX} caractères.`,
  url_invalid: 'Le lien doit commencer par http:// ou https://.',
  price_invalid: 'Le prix doit être un nombre positif.',
}

/**
 * Valide le formulaire « Suggérer un objet ». Accepte un prix saisi à la
 * française (« 12,50 », « 1 200 € »). Même fonction côté client et côté API :
 * le serveur ne fait jamais confiance au navigateur.
 */
export function parseSuggestionInput(raw: {
  title?: unknown
  url?: unknown
  price?: unknown
}): { ok: true; value: SuggestionInput } | { ok: false; error: SuggestionInputError } {
  const title = typeof raw.title === 'string' ? raw.title.trim().replace(/\s+/g, ' ') : ''
  if (!title) return { ok: false, error: 'title_required' }
  if (title.length > TITLE_MAX) return { ok: false, error: 'title_too_long' }

  let url: string | null = null
  const rawUrl = typeof raw.url === 'string' ? raw.url.trim() : ''
  if (rawUrl) {
    const candidate = /^[a-z][a-z0-9+.-]*:/i.test(rawUrl) ? rawUrl : `https://${rawUrl}`
    try {
      const parsed = new URL(candidate)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('protocol')
      if (!parsed.hostname.includes('.')) throw new Error('host')
      url = parsed.toString()
    } catch {
      return { ok: false, error: 'url_invalid' }
    }
    if (url.length > URL_MAX) return { ok: false, error: 'url_invalid' }
  }

  let price: number | null = null
  if (typeof raw.price === 'number') {
    price = raw.price
  } else if (typeof raw.price === 'string' && raw.price.trim()) {
    const normalized = raw.price.replace(/[€\s  ]/g, '').replace(',', '.')
    price = /^\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : NaN
  }
  if (price !== null) {
    if (!Number.isFinite(price) || price < 0 || price > PRICE_MAX) return { ok: false, error: 'price_invalid' }
    price = Math.round(price * 100) / 100
  }

  return { ok: true, value: { title, url, price } }
}

/** Prénom affiché pour un auteur : premier mot du nom de profil. */
export function firstNameOf(displayName: string | null | undefined): string {
  const first = (displayName ?? '').trim().split(/\s+/)[0]
  return first || 'Quelqu’un'
}

/** Domaine lisible d'un lien (« amazon.fr »), ou null. */
export function linkHost(url: string | null): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

// ── Tri des suggestions ─────────────────────────────────────────────────────

export type TriageDecision = 'keep' | 'dismiss'

export interface TriageState {
  wishes: Wish[]
  /** Décisions prises pendant la session, la plus récente en dernier. */
  history: { id: string; decision: TriageDecision }[]
}

export type TriageAction =
  | { type: 'decide'; id: string; decision: TriageDecision }
  | { type: 'undo' }
  /** Le serveur a refusé une décision ou une annulation : on remet l'état d'avant. */
  | { type: 'rollback'; id: string; status: WishStatus; history: TriageState['history'] }
  | { type: 'add'; wish: Wish }

export function initialTriageState(wishes: Wish[]): TriageState {
  return { wishes, history: [] }
}

/** Suggestions en attente, la plus ancienne d'abord : l'ordre de la pile. */
export function pendingWishes(state: TriageState): Wish[] {
  return state.wishes
    .filter(w => w.status === 'suggested')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

/** Ce que la grille montre : idées et suggestions en attente, jamais les écartées. */
export function visibleWishes(state: TriageState): Wish[] {
  return state.wishes.filter(w => w.status !== 'dismissed')
}

function withStatus(wishes: Wish[], id: string, status: WishStatus): Wish[] {
  return wishes.map(w => (w.id === id ? { ...w, status } : w))
}

export function triageReducer(state: TriageState, action: TriageAction): TriageState {
  switch (action.type) {
    case 'decide': {
      const wish = state.wishes.find(w => w.id === action.id)
      if (!wish || wish.status !== 'suggested') return state
      return {
        wishes: withStatus(state.wishes, action.id, action.decision === 'keep' ? 'idea' : 'dismissed'),
        history: [...state.history, { id: action.id, decision: action.decision }],
      }
    }
    case 'undo': {
      const last = state.history[state.history.length - 1]
      if (!last) return state
      return {
        wishes: withStatus(state.wishes, last.id, 'suggested'),
        history: state.history.slice(0, -1),
      }
    }
    case 'rollback':
      return { wishes: withStatus(state.wishes, action.id, action.status), history: action.history }
    case 'add':
      if (state.wishes.some(w => w.id === action.wish.id)) return state
      return { ...state, wishes: [...state.wishes, action.wish] }
  }
}

/**
 * Le module de tri n'apparaît que s'il reste une suggestion en attente. Il
 * reste affiché après la dernière décision de la session, le temps de
 * pouvoir l'annuler ; au rechargement, la règle stricte s'applique.
 */
export function showTriage(state: TriageState): boolean {
  return pendingWishes(state).length > 0 || state.history.length > 0
}
