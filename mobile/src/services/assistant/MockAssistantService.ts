import { supabase } from '@/lib/supabase'
import { DraftProposedData } from '@/types/database'
import { AssistantService } from './types'

const MOCK_OBJECTS: DraftProposedData[] = [
  {
    title: 'Perceuse visseuse Bosch GSR 18V-55',
    description: 'Perceuse visseuse sans fil 18V avec mandrin automatique 13mm.',
    status: 'owned',
    attributes: {
      brand: 'Bosch',
      model: 'GSR 18V-55',
      category: 'Outillage électroportatif',
      voltage: '18V',
      color: 'Bleu / Noir',
    },
  },
  {
    title: 'Appareil photo Sony Alpha 7 III',
    description: 'Hybride plein format 24,2 Mpx avec stabilisation sur capteur.',
    status: 'owned',
    attributes: {
      brand: 'Sony',
      model: 'Alpha 7 III',
      category: 'Photographie',
      color: 'Noir',
      serial_number: 'SN-DEMO-001',
    },
  },
  {
    title: 'Casque audio Bose QuietComfort 45',
    description: 'Casque circum-auriculaire à réduction de bruit active.',
    status: 'owned',
    attributes: {
      brand: 'Bose',
      model: 'QuietComfort 45',
      category: 'Audio',
      color: 'Triple Black',
    },
  },
  {
    title: "Cafetière De'Longhi Dedica EC685",
    description: 'Machine à expresso 15 bars, ultra-compacte.',
    status: 'owned',
    attributes: {
      brand: "De'Longhi",
      model: 'Dedica EC685',
      category: 'Électroménager',
      color: 'Acier inoxydable',
      voltage: '230V',
    },
  },
]

export class MockAssistantService implements AssistantService {
  async analyzeDraft(draftId: string): Promise<{ draftId: string; proposedData: DraftProposedData }> {
    // Simule le délai de traitement IA
    const delay = 1500 + Math.random() * 1000
    await new Promise(resolve => setTimeout(resolve, delay))

    const proposedData = MOCK_OBJECTS[Math.floor(Math.random() * MOCK_OBJECTS.length)]

    // Appel de l'Edge Function mock-draft-pending pour passer le draft
    // de 'uploading' à 'pending' (côté serveur, avec service_role).
    // En production, chat-turn fera ce travail.
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('Session expirée')

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
    const response = await fetch(`${supabaseUrl}/functions/v1/mock-draft-pending`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
      },
      body: JSON.stringify({ draft_id: draftId, proposed_data: proposedData }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: response.statusText }))
      throw new Error(`Analyse échouée : ${err.error ?? response.statusText}`)
    }

    return { draftId, proposedData }
  }
}
