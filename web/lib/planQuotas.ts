// Les quotas affichés sur la page des tarifs sont ceux RÉELLEMENT appliqués :
// la ligne unique de app_settings, réglée dans le back-office (onglet
// Quotas). Plus de chiffres recopiés à la main qui divergent.
//
// Sans accès à la base (build local, panne), on retombe sur FALLBACK : les
// chiffres qu'affichait la page jusqu'ici.
import { createClient } from '@supabase/supabase-js'

export type PlanQuotas = {
  freeObjects: number
  freeAnalyses: number
  freePhotosPerObject: number
  freeEstimates: number
  premiumAnalyses: number
  premiumEnhances: number
  premiumEstimates: number
  proAnalyses: number
  proEnhances: number
  proEstimates: number
}

export const FALLBACK: PlanQuotas = {
  freeObjects: 100,
  freeAnalyses: 10,
  freePhotosPerObject: 3,
  freeEstimates: 3,
  premiumAnalyses: 60,
  premiumEnhances: 20,
  premiumEstimates: 20,
  proAnalyses: 300,
  proEnhances: 100,
  proEstimates: 60,
}

const COLUMNS: Record<keyof PlanQuotas, string> = {
  freeObjects: 'free_objects_max',
  freeAnalyses: 'free_ai_quota_monthly',
  freePhotosPerObject: 'free_photos_per_object',
  freeEstimates: 'free_value_estimate_monthly',
  premiumAnalyses: 'premium_ai_quota_monthly',
  premiumEnhances: 'premium_photo_enhance_quota_monthly',
  premiumEstimates: 'premium_value_estimate_monthly',
  proAnalyses: 'pro_ai_quota_monthly',
  proEnhances: 'pro_photo_enhance_quota_monthly',
  proEstimates: 'pro_value_estimate_monthly',
}

/** Ligne de app_settings → quotas. PostgREST renvoie les NUMERIC en chaînes. */
export function parseQuotas(raw: Record<string, unknown> | null | undefined): PlanQuotas {
  const out = { ...FALLBACK }
  for (const key of Object.keys(COLUMNS) as (keyof PlanQuotas)[]) {
    const cell = raw?.[COLUMNS[key]]
    if (cell === null || cell === undefined || cell === '') continue
    const v = Number(cell)
    if (Number.isFinite(v) && v >= 0) out[key] = Math.round(v)
  }
  return out
}

export async function fetchPlanQuotas(): Promise<{ quotas: PlanQuotas; live: boolean }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return { quotas: FALLBACK, live: false }
  try {
    // Clé service, côté serveur seulement (getStaticProps) : app_settings
    // n'est pas lisible par les visiteurs.
    const { data, error } = await createClient(url, key, { auth: { persistSession: false } })
      .from('app_settings')
      .select(Object.values(COLUMNS).join(','))
      .eq('id', 1)
      .single()
    if (error || !data) return { quotas: FALLBACK, live: false }
    return { quotas: parseQuotas(data as unknown as Record<string, unknown>), live: true }
  } catch {
    return { quotas: FALLBACK, live: false }
  }
}

const photos = (n: number) => (n <= 1 ? '1 photo par objet' : `Jusqu'à ${n} photos par objet`)

export function featureLists(q: PlanQuotas) {
  const free = [
    `${q.freeObjects} objets`,
    `${q.freeAnalyses} analyses IA / mois`,
    photos(q.freePhotosPerObject),
    'Collections & recherche',
    'Partage par lien',
    `${q.freeEstimates} estimations de valeur / mois`,
  ]
  const premiumHighlights = [
    'Objets illimités',
    `${q.premiumAnalyses} analyses IA / mois`,
    `${q.premiumEnhances} améliorations photo IA / mois`,
    `${q.premiumEstimates} estimations de valeur / mois`,
  ]
  const premium = [
    premiumHighlights[0],
    premiumHighlights[1],
    'Photos multiples par objet',
    premiumHighlights[2],
    premiumHighlights[3],
    'Ajout multiple en rafale',
    'Assistant IA & aide au prix de vente',
    'Documents joints & suivi des assurances',
    'Toutes les futures fonctionnalités',
  ]
  const proHighlights = [
    'Tout le Premium, sans les limites',
    `${q.proAnalyses} analyses IA / mois`,
    `${q.proEnhances} améliorations photo IA / mois`,
    `${q.proEstimates} estimations de valeur / mois`,
  ]
  const pro = [
    ...proHighlights,
    'Inventaires volumineux (brocante, atelier, agence)',
    "Export des inventaires pour un assureur ou un expert",
    'Facturation sur facture, sans commission de store',
    'Support prioritaire & accompagnement à la mise en route',
  ]
  return { free, premium, pro, highlighted: new Set([...premiumHighlights, ...proHighlights]) }
}
