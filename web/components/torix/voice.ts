// La voix de Torix — sans modèle, sans serveur d'IA.
//
// Écoute : reconnaissance vocale du navigateur (webkitSpeechRecognition ;
// sur iPhone, Safari la fait passer par Apple). Parole : synthèse vocale
// du navigateur (speechSynthesis), en français. Rien n'est envoyé à
// Tiroir ni conservé. Si le navigateur ne sait pas faire, le Lab reste à
// l'écrit.

/** Le strict nécessaire de l'API, absente des types DOM de TypeScript. */
type Recognition = {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  continuous: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  abort: () => void
}

type RecognitionCtor = new () => Recognition

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function canListen(): boolean {
  return recognitionCtor() !== null
}

export function canSpeak(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

export type ListenHandlers = {
  onResult: (text: string) => void
  /** `denied` : micro refusé ; `silence` : rien entendu ; `failed` : le reste. */
  onError: (reason: 'denied' | 'silence' | 'failed') => void
  onEnd: () => void
}

/** Écoute une phrase, en français. Renvoie de quoi l'interrompre. */
export function listenOnce(handlers: ListenHandlers): () => void {
  const Ctor = recognitionCtor()
  if (!Ctor) {
    handlers.onError('failed')
    handlers.onEnd()
    return () => {}
  }
  const rec = new Ctor()
  rec.lang = 'fr-FR'
  rec.interimResults = false
  rec.maxAlternatives = 1
  rec.continuous = false
  let heard = false
  rec.onresult = e => {
    const text = e.results[0]?.[0]?.transcript?.trim() ?? ''
    if (text) {
      heard = true
      handlers.onResult(text)
    }
  }
  rec.onerror = e => {
    if (e.error === 'aborted') return
    heard = true
    handlers.onError(
      e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'denied'
        : e.error === 'no-speech' ? 'silence'
          : 'failed',
    )
  }
  rec.onend = () => {
    if (!heard) handlers.onError('silence')
    handlers.onEnd()
  }
  try {
    rec.start()
  } catch {
    handlers.onError('failed')
    handlers.onEnd()
  }
  return () => rec.abort()
}

/**
 * Texte d'une fiche → texte à dire : les puces, flèches et séparateurs
 * se lisent mal à voix haute.
 */
export function spokenText(text: string): string {
  return text
    .replace(/\s*→\s*/g, ', puis ')
    .replace(/\s*·\s*/g, ', ')
    .replace(/^\s*•\s*/gm, '')
    .replace(/\s*—\s*/g, ', ')
    .replace(/\s*\n+\s*/g, (_, offset: number, all: string) => (/[.!?:;,]$/.test(all.slice(0, offset).trimEnd()) ? ' ' : '. '))
    .replace(/\s{2,}/g, ' ')
    .trim()
}

type VoiceLike = { lang: string; name: string; localService?: boolean }

/** Une voix française, de France de préférence, locale si possible. */
export function pickFrenchVoice<V extends VoiceLike>(voices: readonly V[]): V | null {
  const fr = voices.filter(v => v.lang.toLowerCase().replace('_', '-').startsWith('fr'))
  const rank = (v: V) =>
    (v.lang.toLowerCase().replace('_', '-') === 'fr-fr' ? 0 : 2) + (v.localService === false ? 1 : 0)
  return [...fr].sort((a, b) => rank(a) - rank(b))[0] ?? null
}

/**
 * Sur iPhone, Safari ne parle qu'après un geste de l'utilisateur. Appelé
 * dans le geste (toucher le micro), cet énoncé vide débloque la parole
 * pour la réponse qui arrive après la réflexion de Torix.
 */
export function unlockSpeech(): void {
  if (!canSpeak()) return
  try {
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(''))
  } catch {
    // Pas de voix : le Lab reste à l'écrit.
  }
}

/** Dit le texte ; `onEnd` est appelé une fois, qu'il ait parlé ou non. */
export function speak(text: string, onEnd: () => void): () => void {
  let done = false
  const finish = () => {
    if (done) return
    done = true
    onEnd()
  }
  if (!canSpeak()) {
    finish()
    return () => {}
  }
  try {
    const synth = window.speechSynthesis
    synth.cancel()
    const u = new SpeechSynthesisUtterance(spokenText(text))
    u.lang = 'fr-FR'
    const voice = pickFrenchVoice(synth.getVoices())
    if (voice) u.voice = voice
    u.onend = finish
    u.onerror = finish
    synth.speak(u)
  } catch {
    finish()
  }
  return () => {
    try { window.speechSynthesis.cancel() } catch { /* rien à couper */ }
    finish()
  }
}
