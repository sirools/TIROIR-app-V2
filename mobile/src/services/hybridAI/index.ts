// Point d'entrée de la brique hybride pour l'app. Les écrans importent
// d'ici, jamais du module natif ni de Firebase directement.
export { iosHybridAI as hybridAI, appCheckDebugToken, isInBuild } from './ios'
export { HACKATHON_BUILD, isFirebaseConfigured } from './config'
export { NoAiReachableError } from './types'
export type {
  AiOptions, AiSource, Enrichment, HybridAI, OnDeviceStatus, Photo, QuickCard, Sourced, ValueEstimate,
} from './types'
