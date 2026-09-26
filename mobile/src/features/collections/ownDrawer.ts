import { supabase } from '@/lib/supabase'

/**
 * Identifiant du Tiroir personnel de l'utilisateur, celui où ranger ses
 * nouvelles collections.
 *
 * Ne pas écrire `from('drawers').select('id').single()` : cette lecture ne
 * tient que tant que la RLS ne laisse voir qu'un seul Tiroir. Avec les
 * Tiroirs partagés (V4.0, v4/docs/migration-tiroirs-partages.md), un membre
 * verra aussi ceux des autres, et `.single()` échouerait — y compris dans
 * les versions de l'app déjà installées. On filtre donc explicitement sur
 * le propriétaire, et on prend le plus ancien s'il en possède plusieurs.
 */
export async function fetchOwnDrawerId(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('drawers')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return data?.id ?? null
}
