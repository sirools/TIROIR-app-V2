// Jauge publique de la campagne Ulule, pour la bannière de l'accueil.
// Mise en cache 5 minutes par Vercel : Ulule n'est appelé qu'une fois par
// fenêtre, quel que soit le trafic.
import type { NextApiRequest, NextApiResponse } from 'next'
import { adminSupabase } from '../../../lib/supabase'
import { campaignState } from '../../../lib/ululeProgress'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end()
  try {
    const state = await campaignState(adminSupabase())
    if (!state) return res.status(404).json({ error: 'Pas de campagne.' })
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
    return res.status(200).json({
      launchAt: state.launchAt,
      milestonesCents: state.milestonesCents,
      progress: state.progress,
    })
  } catch {
    res.setHeader('Cache-Control', 'public, s-maxage=60')
    return res.status(503).json({ error: 'Indisponible.' })
  }
}
