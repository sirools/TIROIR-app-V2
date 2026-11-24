// Montant collecté, lu sur l'API publique d'Ulule (sans clé, pour un projet
// en ligne : https://api.ulule.com/v1/projects/<id>). Avant la publication,
// l'API répond 401 : on renvoie null, et rien ne s'affiche.
// Seulement côté serveur : la page publique passe par /api/ulule/progress.
import type { SupabaseClient } from '@supabase/supabase-js'
import { CROWDFUNDING } from './crowdfunding'
import { DEFAULT_MILESTONES_CENTS, progressOf, type Progress } from './ulule'

export const FALLBACK_PAGE_URL = CROWDFUNDING.url
/** Adresse de la page si la base est illisible ; la base reste la source. */
export const fallbackPageUrl = () => process.env.ULULE_PAGE_URL || FALLBACK_PAGE_URL

const API = () => process.env.ULULE_API_URL || 'https://api.ulule.com/v1'

/** « https://fr.ulule.com/tiroir-app/ » → « tiroir-app ». */
export function slugFromPageUrl(pageUrl: string): string | null {
  try {
    return new URL(pageUrl).pathname.split('/').filter(Boolean)[0] ?? null
  } catch {
    return null
  }
}

/** Montant en centimes, ou null si Ulule ne répond pas (projet pas encore en ligne, panne). */
export async function fetchUluleAmountCents(projectId: string, pageUrl: string): Promise<number | null> {
  const ids = [projectId, slugFromPageUrl(pageUrl)].filter((v): v is string => !!v)
  for (const id of ids) {
    try {
      const response = await fetch(`${API()}/projects/${encodeURIComponent(id)}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(4000),
      })
      if (!response.ok) continue
      const data = await response.json()
      const raised = Number(data?.amount_raised)
      if (Number.isFinite(raised) && raised >= 0) return Math.round(raised * 100)
    } catch {
      /* essaie l'identifiant suivant */
    }
  }
  return null
}

export type CampaignState = {
  launchAt: string
  pageUrl: string
  milestonesCents: number[]
  progress: Progress | null
}

/** État public de la campagne : date, paliers, et jauge si Ulule répond. */
export async function campaignState(db: SupabaseClient): Promise<CampaignState | null> {
  const { data: campaign } = await db.from('ulule_campaign').select('*').eq('id', 1).maybeSingle()
  if (!campaign) return null
  const milestonesCents: number[] = campaign.milestones_cents?.length
    ? campaign.milestones_cents
    : DEFAULT_MILESTONES_CENTS
  const launched = Date.now() >= new Date(campaign.launch_at).getTime()
  const amount = launched ? await fetchUluleAmountCents(campaign.presale_number, campaign.page_url) : null
  return {
    launchAt: campaign.launch_at,
    pageUrl: campaign.page_url,
    milestonesCents,
    progress: amount === null ? null : progressOf(amount, milestonesCents),
  }
}
