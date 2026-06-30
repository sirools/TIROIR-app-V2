import { DraftProposedData } from '@/types/database'

export interface AssistantService {
  // Analyse les images d'un draft et passe son statut à 'pending'
  // avec proposed_data rempli. Retourne le draft_id mis à jour.
  analyzeDraft(draftId: string): Promise<{ draftId: string; proposedData: DraftProposedData }>
}
