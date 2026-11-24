// Brouillons de la « Fiche express », gardés sur l'appareil : une fiche
// créée hors ligne reste lisible, et s'enrichit au retour du réseau.
import type { Enrichment, Photo, QuickCard, Sourced } from './types'

export type Draft = {
  id: string
  createdAt: number
  photo: Photo
  /** Fiche rapide ; `null` tant qu'aucune IA n'a pu répondre. */
  quick: Sourced<QuickCard> | null
  /** Enrichissement du cloud ; `null` tant qu'il n'a pas eu lieu. */
  enrichment: Sourced<Enrichment> | null
  /** Identifiant de l'objet créé dans l'inventaire, une fois la fiche ajoutée au Tiroir. */
  objectId?: string
}

/** Ce qu'il reste à faire pour un brouillon. */
export type DraftStep = 'quick' | 'enrich' | 'done'
export const nextStep = (d: Draft): DraftStep => (!d.quick ? 'quick' : !d.enrichment ? 'enrich' : 'done')

/**
 * Ce qu'une fiche express devient dans l'inventaire (table `objects`).
 * La valeur retenue est le milieu de la fourchette ; la fourchette et sa
 * justification restent dans `value_sources`, avec une confiance « faible » :
 * l'estimation vient du modèle seul, sans annonces à l'appui.
 */
export function inventoryFields(draft: Draft, now: Date) {
  if (!draft.quick) throw new Error('Fiche sans nom : rien à ajouter au Tiroir')
  const { name, category, description } = draft.quick.data
  const value = draft.enrichment?.data.value ?? null
  const middle = value ? Math.round((value.low + value.high) / 2) : null
  return {
    title: name,
    description: draft.enrichment?.data.detailedDescription || description || null,
    attributes: category ? { category } : {},
    ...(value && middle !== null
      ? {
          market_value: middle,
          // La colonne garde le symbole, comme le reste de l'app.
          value_currency: '€',
          value_estimated_at: now.toISOString(),
          value_sources: {
            sources: [],
            confidence: 'low' as const,
            value_min: value.low,
            value_max: value.high,
            summary: value.note,
            ai_value: middle,
          },
        }
      : {}),
  }
}

export const DRAFTS_KEY = 'tiroir.ficheExpress.drafts'
/** Les photos pèsent : on ne garde que les derniers brouillons. */
export const MAX_DRAFTS = 8

type Store = Pick<Storage, 'getItem' | 'setItem'>

export function loadDrafts(store: Store): Draft[] {
  try {
    const parsed: unknown = JSON.parse(store.getItem(DRAFTS_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter(d => d && typeof d.id === 'string' && d.photo?.base64) : []
  } catch {
    return []
  }
}

/**
 * Enregistre les brouillons, les plus récents d'abord. Si le stockage est
 * plein, les plus anciens sont abandonnés jusqu'à ce que ça tienne.
 * Renvoie la liste réellement gardée.
 */
export function saveDrafts(store: Store, drafts: Draft[]): Draft[] {
  let kept = [...drafts].sort((a, b) => b.createdAt - a.createdAt).slice(0, MAX_DRAFTS)
  for (;;) {
    try {
      store.setItem(DRAFTS_KEY, JSON.stringify(kept))
      return kept
    } catch {
      if (kept.length === 0) return kept
      kept = kept.slice(0, -1)
    }
  }
}

export const upsertDraft = (drafts: Draft[], draft: Draft): Draft[] =>
  [draft, ...drafts.filter(d => d.id !== draft.id)]
