import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface FeatureFlags {
  /** Capture multi-objets par détection. Coûteuse en tokens, donc verrouillée. */
  multiAdd: boolean
  /** Assistant conversationnel. Encore en développement : pas assez fiable
   *  pour être montré, et donc pas encore un argument de vente. */
  assistant: boolean
}

const NONE: FeatureFlags = { multiAdd: false, assistant: false }

/**
 * Drapeaux d'accès aux fonctionnalités, calculés côté serveur.
 *
 * `get_feature_flags()` renvoie des booléens déjà arbitrés : l'audience, le
 * plan et le statut admin ne descendent jamais dans le bundle, donc le client
 * n'a pas de quoi rejouer la décision — ni de quoi la contourner.
 *
 * Par défaut à `false` : tant qu'on ne sait pas, on ne montre pas. Un point
 * d'entrée qui apparaît puis disparaît est pire que celui qui arrive tard.
 */
export function useFeatureFlags(): { flags: FeatureFlags; loaded: boolean } {
  const [flags, setFlags] = useState<FeatureFlags>(NONE)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    supabase.rpc('get_feature_flags').then(({ data, error }) => {
      if (cancelled) return
      if (!error && data?.[0]) setFlags({
        multiAdd: Boolean(data[0].multi_add),
        assistant: Boolean(data[0].assistant),
      })
      setLoaded(true)
    })
    return () => { cancelled = true }
  }, [])

  return { flags, loaded }
}
