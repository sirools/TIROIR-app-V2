import { DraftProposedData } from '@/types/database'

const cache = new Map<string, DraftProposedData>()

export const draftCache = {
  set(draftId: string, data: DraftProposedData) { cache.set(draftId, data) },
  get(draftId: string): DraftProposedData | undefined { return cache.get(draftId) },
  clear(draftId: string) { cache.delete(draftId) },
}
