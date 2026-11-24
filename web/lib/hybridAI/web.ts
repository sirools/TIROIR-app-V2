// Implémentation web de la brique hybride : Firebase AI Logic, avec le
// modèle embarqué de Chrome (Gemini Nano, Prompt API) quand il est là, et
// Gemini dans le cloud sinon. La bascule se décide ici.
import {
  getAI, getGenerativeModel, GoogleAIBackend, InferenceMode, InferenceSource,
  type GenerativeModel, type LanguageModelCreateOptions,
} from 'firebase/ai'
import { CLOUD_MODEL, firebaseApp } from './firebase'
import {
  ENRICHMENT_SCHEMA, QUICK_CARD_SCHEMA, enrichmentPrompt, parseEnrichment, parseQuickCard, quickCardPrompt,
} from './card'
import {
  NoAiReachableError,
  type AiOptions, type AiSource, type Enrichment, type HybridAI, type OnDeviceStatus, type Photo, type QuickCard, type Sourced,
} from './types'

type Mode = (typeof InferenceMode)[keyof typeof InferenceMode]
type JsonSchema = { [key: string]: unknown }

/** L'API de Chrome, interrogée seulement pour connaître l'état du modèle. */
type ChromeLanguageModel = { availability(options?: LanguageModelCreateOptions): Promise<string> }
const chromeModel = (): ChromeLanguageModel | undefined =>
  (globalThis as unknown as { LanguageModel?: ChromeLanguageModel }).LanguageModel

/** Ce que le modèle embarqué doit accepter : une photo et du texte, dans la langue voulue. */
const deviceOptions = (language: string): LanguageModelCreateOptions => ({
  expectedInputs: [{ type: 'image' }, { type: 'text', languages: [language] }],
  expectedOutputs: [{ type: 'text', languages: [language] }],
})

const STATUSES: OnDeviceStatus[] = ['available', 'downloadable', 'downloading']

async function statusFor(language: string): Promise<OnDeviceStatus> {
  try {
    const status = await chromeModel()?.availability(deviceOptions(language))
    return STATUSES.find(s => s === status) ?? 'unavailable'
  } catch {
    return 'unavailable'
  }
}

/**
 * Langue du modèle embarqué : celle de la page si Chrome la gère, sinon
 * l'anglais (la consigne demande de toute façon de répondre dans la
 * langue de la page).
 */
async function deviceLanguage(locale: string): Promise<{ language: string; status: OnDeviceStatus }> {
  const wanted = locale.slice(0, 2)
  const status = await statusFor(wanted)
  if (status !== 'unavailable' || wanted === 'en') return { language: wanted, status }
  return { language: 'en', status: await statusFor('en') }
}

function model(mode: Mode, language: string, schema: JsonSchema): GenerativeModel {
  const ai = getAI(firebaseApp(), { backend: new GoogleAIBackend() })
  return getGenerativeModel(ai, {
    mode,
    inCloudParams: {
      model: CLOUD_MODEL,
      generationConfig: { responseMimeType: 'application/json', responseJsonSchema: schema },
    },
    onDeviceParams: {
      createOptions: deviceOptions(language),
      promptOptions: { responseConstraint: schema },
    },
  })
}

async function ask(mode: Mode, language: string, schema: JsonSchema, prompt: string, photo: Photo) {
  const result = await model(mode, language, schema).generateContent([
    prompt,
    { type: 'inlineData', inlineData: { data: photo.base64, mimeType: photo.mimeType } },
  ])
  // Sans indication du SDK, la provenance est celle que le mode impose.
  const fallback: AiSource = mode === InferenceMode.ONLY_ON_DEVICE ? 'on_device' : 'cloud'
  const told = result.response.inferenceSource
  const source: AiSource = told === InferenceSource.ON_DEVICE ? 'on_device' : told === InferenceSource.IN_CLOUD ? 'cloud' : fallback
  return { text: result.response.text(), source }
}

export const webHybridAI: HybridAI = {
  async onDeviceStatus(locale) {
    return (await deviceLanguage(locale)).status
  },

  async isOnDeviceAvailable(locale) {
    return (await deviceLanguage(locale)).status === 'available'
  },

  async prepareOnDevice(locale, onProgress) {
    const { language, status } = await deviceLanguage(locale)
    if (status === 'unavailable') throw new Error('IA embarquée indisponible sur ce navigateur')
    await model(InferenceMode.ONLY_ON_DEVICE, language, QUICK_CARD_SCHEMA).initializeDeviceModel(onProgress)
  },

  async quickCard(photo: Photo, { locale, online }: AiOptions): Promise<Sourced<QuickCard>> {
    const { language, status } = await deviceLanguage(locale)
    const prompt = quickCardPrompt(locale)

    if (status === 'available') {
      try {
        const { text } = await ask(InferenceMode.ONLY_ON_DEVICE, language, QUICK_CARD_SCHEMA, prompt, photo)
        return { data: parseQuickCard(text), source: 'on_device' }
      } catch (error) {
        // Le modèle embarqué a échoué ou répondu de travers : le cloud
        // prend le relais, sans erreur visible — s'il y a du réseau.
        if (!online) throw error
      }
    }
    if (!online) throw new NoAiReachableError()
    const { text } = await ask(InferenceMode.ONLY_IN_CLOUD, language, QUICK_CARD_SCHEMA, prompt, photo)
    return { data: parseQuickCard(text), source: 'cloud' }
  },

  async enrich(photo: Photo, quick: QuickCard, { locale, online }: AiOptions): Promise<Sourced<Enrichment>> {
    if (!online) throw new NoAiReachableError()
    const language = locale.slice(0, 2)
    const { text } = await ask(InferenceMode.ONLY_IN_CLOUD, language, ENRICHMENT_SCHEMA, enrichmentPrompt(locale, quick), photo)
    return { data: parseEnrichment(text), source: 'cloud' }
  },
}
