// Firebase pour la brique hybride : configuration par variables
// d'environnement (voir web/.env.example), App Check obligatoire.
// Aucune valeur dans le dépôt. Navigateur seulement.
import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import { CustomProvider, initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check'

/** Drapeau de build « hackathon » : sans lui, la brique n'existe pas sur le site. */
export const HACKATHON_BUILD = process.env.NEXT_PUBLIC_HACKATHON_BUILD === 'true'

/** Modèle Gemini du cloud ; à défaut, celui que le SDK Firebase prend pour l'hybride. */
export const CLOUD_MODEL = process.env.NEXT_PUBLIC_FIREBASE_AI_CLOUD_MODEL?.trim() || 'gemini-3.5-flash-lite'

// Chaque variable est lue en toutes lettres : Next ne remplace au build
// que les accès écrits ainsi.
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}
const RECAPTCHA_KEY = process.env.NEXT_PUBLIC_FIREBASE_RECAPTCHA_ENTERPRISE_KEY?.trim()
const DEBUG_TOKEN = process.env.NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN?.trim()

/** Vrai si le projet Firebase est renseigné (clé, projet, app). */
export const isFirebaseConfigured = () => Boolean(config.apiKey && config.projectId && config.appId)

const isLocalhost = () => ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname)

/**
 * Le jeton de debug App Check ne sert qu'en local : sur un vrai domaine il
 * est ignoré, même si la variable a été posée par erreur à l'hébergement.
 * `true` : le SDK en crée un et l'affiche dans la console du navigateur,
 * à enregistrer dans Firebase (App Check › Apps › Manage debug tokens).
 */
export function debugTokenFor(token: string | undefined, local: boolean): string | true | undefined {
  if (!token || !local) return undefined
  return token === 'true' ? true : token
}

let app: FirebaseApp | null = null

/** L'app Firebase, App Check déjà actif. Lève si la configuration manque. */
export function firebaseApp(): FirebaseApp {
  if (app) return app
  if (typeof window === 'undefined') throw new Error('Firebase AI Logic : navigateur seulement')
  if (!isFirebaseConfigured()) throw new Error('Firebase non configuré : voir web/.env.example')

  const debug = debugTokenFor(DEBUG_TOKEN, isLocalhost())
  if (debug) (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | true }).FIREBASE_APPCHECK_DEBUG_TOKEN = debug
  if (!debug && !RECAPTCHA_KEY) {
    throw new Error('App Check non configuré : jeton de debug (en local) ou clé reCAPTCHA Enterprise')
  }

  const created = getApps().length ? getApp() : initializeApp(config)
  initializeAppCheck(created, {
    // Avec un jeton de debug et sans clé reCAPTCHA, le fournisseur n'est
    // jamais appelé : le SDK échange le jeton de debug à sa place.
    provider: RECAPTCHA_KEY
      ? new ReCaptchaEnterpriseProvider(RECAPTCHA_KEY)
      : new CustomProvider({ getToken: () => Promise.reject(new Error('App Check : jeton de debug attendu')) }),
    isTokenAutoRefreshEnabled: true,
  })
  app = created
  return app
}
