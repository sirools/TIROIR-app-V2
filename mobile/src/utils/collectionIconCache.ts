/**
 * Cache synchrone des icônes modifiées localement.
 * Permet à la liste de refléter immédiatement un changement fait dans le détail,
 * même si le round-trip Supabase n'est pas encore terminé.
 */

interface IconOverride {
  emoji: string
  icon_color: string
}

const cache: Record<string, IconOverride> = {}

export function setIconOverride(collectionId: string, emoji: string, icon_color: string) {
  cache[collectionId] = { emoji, icon_color }
}

export function applyIconOverride(collectionId: string, emoji: string, icon_color: string) {
  return {
    emoji: cache[collectionId]?.emoji ?? emoji,
    icon_color: cache[collectionId]?.icon_color ?? icon_color,
  }
}
