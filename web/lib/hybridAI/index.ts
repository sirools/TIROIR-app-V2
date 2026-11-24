// Point d'entrée de la brique hybride pour le site. Les écrans importent
// d'ici, jamais de `web.ts` ni de Firebase directement.
export { webHybridAI as hybridAI } from './web'
export { HACKATHON_BUILD, isFirebaseConfigured } from './firebase'
export { NoAiReachableError } from './types'
export type {
  AiOptions, AiSource, Enrichment, HybridAI, OnDeviceStatus, Photo, QuickCard, Sourced, ValueEstimate,
} from './types'
