// Réglages de la brique hybride dans l'app : drapeau de build et projet
// Firebase, par variables d'environnement (voir mobile/.env.example).
// Aucune valeur dans le dépôt.
import type { FirebaseNativeConfig } from '../../../modules/tiroir-hybrid-ai'

/** Drapeau de build « hackathon » : sans lui, la Fiche express n'existe pas dans l'app. */
export const HACKATHON_BUILD = process.env.EXPO_PUBLIC_HACKATHON_BUILD === 'true'

/** Modèle Gemini du cloud. */
export const CLOUD_MODEL = process.env.EXPO_PUBLIC_FIREBASE_AI_CLOUD_MODEL?.trim() || 'gemini-3.5-flash-lite'

export const FIREBASE_CONFIG: FirebaseNativeConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_IOS_API_KEY ?? '',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  appId: process.env.EXPO_PUBLIC_FIREBASE_IOS_APP_ID ?? '',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appCheckDebug: process.env.EXPO_PUBLIC_FIREBASE_APPCHECK_DEBUG === 'true',
}

export const isFirebaseConfigured = () =>
  Boolean(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId && FIREBASE_CONFIG.appId)
