// Pont vers le module natif iOS de la brique hybride. `null` quand le
// module n'est pas dans le binaire (Android, Expo Go, build sans le
// drapeau hackathon) : l'appelant le traite comme « pas d'IA embarquée ».
import { requireOptionalNativeModule } from 'expo'

export type FirebaseNativeConfig = {
  apiKey: string
  projectId: string
  appId: string
  messagingSenderId: string
  /** Vrai : fournisseur de debug d'App Check (jeton à enregistrer dans Firebase). */
  appCheckDebug: boolean
}

/** `reason` précise un `unavailable` : appareil, réglage Apple Intelligence, version d'iOS. */
export type NativeOnDeviceStatus = {
  status: 'available' | 'downloading' | 'unavailable'
  reason: string
}

export type NativeGeneration = {
  /** Réponse du modèle, en JSON. */
  json: string
  /** Modèle qui a répondu. */
  model: string
}

export type TiroirHybridAINative = {
  /** Faux si le binaire a été compilé sans Firebase (build sans le drapeau). */
  hasFirebase(): boolean
  /** Configure Firebase et App Check ; sans effet au second appel. */
  configure(config: FirebaseNativeConfig): void
  /** Jeton de debug d'App Check de cette installation, à enregistrer dans Firebase. */
  appCheckDebugToken(): string | null
  onDeviceStatus(): Promise<NativeOnDeviceStatus>
  /** Vision d'Apple : étiquettes d'image et texte lisible, sur l'appareil. */
  observePhoto(base64: string): Promise<{ labels: string[]; texts: string[] }>
  /** Fiche rapide par le modèle embarqué d'Apple (Foundation Models). */
  quickCardOnDevice(prompt: string): Promise<NativeGeneration>
  /** Gemini dans le cloud par Firebase AI Logic. `kind` choisit le schéma de réponse. */
  generateInCloud(kind: 'quick' | 'enrich', prompt: string, base64: string, model: string): Promise<NativeGeneration>
}

export default requireOptionalNativeModule<TiroirHybridAINative>('TiroirHybridAI')
