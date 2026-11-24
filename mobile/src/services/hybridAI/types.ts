// Brique d'IA hybride de Tiroir (« Fiche express ») — contrat commun.
//
// Le même contrat vaut pour le site (Chrome, Prompt API) et pour l'app iOS
// (Apple Foundation Models) : les écrans ne connaissent que `HybridAI`.
// La bascule appareil → cloud vit dans les implémentations, jamais dans
// les écrans. Toute l'IA passe par Firebase AI Logic.

/** D'où vient une information : le modèle embarqué, ou le cloud. */
export type AiSource = 'on_device' | 'cloud'

/** Photo prête pour le modèle : JPEG ou PNG, en base64 sans préfixe `data:`. */
export type Photo = { base64: string; mimeType: 'image/jpeg' | 'image/png' }

/** Fiche rapide : ce que l'appareil propose tout de suite. */
export type QuickCard = { name: string; category: string; description: string }

/** Fourchette de valeur d'occasion, en euros. */
export type ValueEstimate = { low: number; high: number; currency: 'EUR'; note: string }

/** Enrichissement fait dans le cloud, signé Torix. */
export type Enrichment = { detailedDescription: string; value: ValueEstimate | null }

/** Un résultat et sa provenance (le badge de l'interface). */
export type Sourced<T> = { data: T; source: AiSource }

/**
 * État du modèle embarqué :
 * - `available`     prêt à répondre, sans réseau ;
 * - `downloadable`  l'appareil est compatible, le modèle reste à télécharger ;
 * - `downloading`   téléchargement en cours ;
 * - `unavailable`   appareil ou navigateur non compatible : tout part dans le cloud.
 */
export type OnDeviceStatus = 'available' | 'downloadable' | 'downloading' | 'unavailable'

export type AiOptions = {
  /** Langue des textes produits (fr, en, es, de). */
  locale: string
  /** Faux hors ligne : seul le modèle embarqué peut répondre. */
  online: boolean
}

/** Levée quand il n'y a ni réseau ni modèle embarqué : la fiche attend. */
export class NoAiReachableError extends Error {
  constructor() {
    super('Ni réseau ni IA embarquée : la demande attend le retour du réseau.')
    this.name = 'NoAiReachableError'
  }
}

export interface HybridAI {
  /** L'IA embarquée peut-elle répondre maintenant, sans réseau ? */
  isOnDeviceAvailable(locale: string): Promise<boolean>
  /** État détaillé du modèle embarqué (pour proposer son téléchargement). */
  onDeviceStatus(locale: string): Promise<OnDeviceStatus>
  /** Télécharge le modèle embarqué ; à appeler depuis un clic. */
  prepareOnDevice(locale: string, onProgress?: (ratio: number) => void): Promise<void>
  /** Fiche rapide : sur l'appareil si possible, sinon dans le cloud. */
  quickCard(photo: Photo, options: AiOptions): Promise<Sourced<QuickCard>>
  /** Enrichissement : toujours dans le cloud (description détaillée, valeur). */
  enrich(photo: Photo, quick: QuickCard, options: AiOptions): Promise<Sourced<Enrichment>>
}
