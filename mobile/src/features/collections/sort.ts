import AsyncStorage from '@react-native-async-storage/async-storage'

/**
 * Tri de la liste des collections.
 *
 * L'ordre par défaut est l'ordre d'ajout : une collection créée apparaît
 * à la suite des précédentes, à la place où l'utilisateur vient de la
 * saisir. Trier par `updated_at` ferait bouger la liste à chaque
 * modification, ce qui désoriente dès qu'on a plus de quelques entrées.
 */
export type CollectionSort =
  | 'created_asc'
  | 'created_desc'
  | 'name_asc'
  | 'count_desc'
  | 'count_asc'

export const COLLECTION_SORTS: CollectionSort[] = [
  'created_asc',
  'created_desc',
  'name_asc',
  'count_desc',
  'count_asc',
]

export const DEFAULT_COLLECTION_SORT: CollectionSort = 'created_asc'

/** Clé i18n du libellé d'un tri. */
export const sortLabelKey = (sort: CollectionSort) => `collectionSort.${sort}`

export interface SortableCollection {
  name: string
  created_at: string
  pinned_at: string | null
  object_count: number
}

/**
 * L'épinglage n'est pas un tri de plus : c'est une strate au-dessus.
 * Les collections épinglées forment un bloc en tête, la plus récemment
 * épinglée d'abord ; le tri choisi ne s'applique qu'à l'intérieur du
 * reste de la liste.
 */
export function sortCollections<T extends SortableCollection>(
  items: T[],
  sort: CollectionSort,
): T[] {
  const pinned = items
    .filter(c => c.pinned_at)
    .sort((a, b) => (b.pinned_at ?? '').localeCompare(a.pinned_at ?? ''))

  const rest = items.filter(c => !c.pinned_at).sort(comparator(sort))

  return [...pinned, ...rest]
}

function comparator(sort: CollectionSort) {
  return <T extends SortableCollection>(a: T, b: T): number => {
    switch (sort) {
      case 'created_asc':
        return a.created_at.localeCompare(b.created_at)
      case 'created_desc':
        return b.created_at.localeCompare(a.created_at)
      case 'name_asc':
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      case 'count_desc':
        return b.object_count - a.object_count || a.created_at.localeCompare(b.created_at)
      case 'count_asc':
        return a.object_count - b.object_count || a.created_at.localeCompare(b.created_at)
    }
  }
}

// ── Persistance ───────────────────────────────────────────────────────────────
//
// Préférence d'affichage, pas donnée métier : elle reste sur l'appareil.

const STORAGE_KEY = 'tiroir.collections.sort'

export async function loadCollectionSort(): Promise<CollectionSort> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY)
    if (stored && COLLECTION_SORTS.includes(stored as CollectionSort)) {
      return stored as CollectionSort
    }
  } catch {
    /* AsyncStorage indisponible : on retombe sur le tri par défaut */
  }
  return DEFAULT_COLLECTION_SORT
}

export async function saveCollectionSort(sort: CollectionSort): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, sort)
  } catch {
    /* sans conséquence : le tri reste appliqué pour la session */
  }
}
