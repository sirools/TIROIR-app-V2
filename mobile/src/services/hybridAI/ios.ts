// Implémentation iOS de la brique hybride. Sur l'appareil : Vision d'Apple
// lit la photo, le modèle embarqué d'Apple (Foundation Models) rédige la
// fiche. Dans le cloud : Gemini par Firebase AI Logic, avec la photo.
// La bascule se décide ici ; le module natif n'expose que les briques.
import native from '../../../modules/tiroir-hybrid-ai'
import { enrichmentPrompt, observationsPrompt, parseEnrichment, parseQuickCard, quickCardPrompt } from './card'
import { CLOUD_MODEL, FIREBASE_CONFIG, isFirebaseConfigured } from './config'
import {
  NoAiReachableError,
  type AiOptions, type Enrichment, type HybridAI, type OnDeviceStatus, type Photo, type QuickCard, type Sourced,
} from './types'

/** Vrai si ce binaire contient le module natif et Firebase (build hackathon). */
export const isInBuild = () => Boolean(native?.hasFirebase())

let configured = false
/** Firebase et App Check, configurés au premier besoin. */
function firebase() {
  if (!native || !native.hasFirebase()) throw new Error('Ce build ne contient pas la brique hybride')
  if (!isFirebaseConfigured()) throw new Error('Firebase non configuré : voir mobile/.env.example')
  if (!configured) {
    native.configure(FIREBASE_CONFIG)
    configured = true
  }
  return native
}

/** Jeton de debug d'App Check de cette installation, ou `null` hors mode debug. */
export function appCheckDebugToken(): string | null {
  if (!FIREBASE_CONFIG.appCheckDebug) return null
  try {
    return firebase().appCheckDebugToken()
  } catch {
    return null
  }
}

async function status(): Promise<OnDeviceStatus> {
  if (!native) return 'unavailable'
  try {
    return (await native.onDeviceStatus()).status
  } catch {
    return 'unavailable'
  }
}

export const iosHybridAI: HybridAI = {
  onDeviceStatus: () => status(),

  async isOnDeviceAvailable() {
    return (await status()) === 'available'
  },

  // Sur iOS, c'est le système qui télécharge le modèle : l'app ne peut pas le déclencher.
  async prepareOnDevice() {},

  async quickCard(photo: Photo, { locale, online }: AiOptions): Promise<Sourced<QuickCard>> {
    if (native && (await status()) === 'available') {
      try {
        const seen = await native.observePhoto(photo.base64)
        const { json } = await native.quickCardOnDevice(observationsPrompt(locale, seen))
        return { data: parseQuickCard(json), source: 'on_device' }
      } catch (error) {
        // Le modèle embarqué a échoué : le cloud prend le relais, sans
        // erreur visible — s'il y a du réseau.
        if (!online) throw error
      }
    }
    if (!online) throw new NoAiReachableError()
    const { json } = await firebase().generateInCloud('quick', quickCardPrompt(locale), photo.base64, CLOUD_MODEL)
    return { data: parseQuickCard(json), source: 'cloud' }
  },

  async enrich(photo: Photo, quick: QuickCard, { locale, online }: AiOptions): Promise<Sourced<Enrichment>> {
    if (!online) throw new NoAiReachableError()
    const { json } = await firebase().generateInCloud('enrich', enrichmentPrompt(locale, quick), photo.base64, CLOUD_MODEL)
    return { data: parseEnrichment(json), source: 'cloud' }
  },
}
