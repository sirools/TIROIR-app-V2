import { describe, expect, test } from 'vitest'
import { TOPICS } from '../components/torix/knowledge'
import { canListen, canSpeak, listenOnce, pickFrenchVoice, speak, spokenText } from '../components/torix/voice'

describe('spokenText : une fiche se lit bien à voix haute', () => {
  test('flèches, puces, points médians et tirets deviennent des pauses', () => {
    expect(spokenText('photo → analyse → fiche')).toBe('photo, puis analyse, puis fiche')
    expect(spokenText('Trois niveaux :\n• Fermé — privé.\n• Ouvert — public.'))
      .toBe('Trois niveaux : Fermé, privé. Ouvert, public.')
    expect(spokenText('Portfolio : clementougier.com · Medium')).toBe('Portfolio : clementougier.com, Medium')
  })

  test('un retour à la ligne sans ponctuation devient une fin de phrase', () => {
    expect(spokenText('Une ligne\nUne autre')).toBe('Une ligne. Une autre')
  })

  test('aucune fiche ne garde de symbole illisible', () => {
    for (const t of TOPICS) {
      const s = spokenText(t.answer)
      expect(s, t.id).not.toMatch(/[→•·\n]/)
      expect(s.length, t.id).toBeGreaterThan(0)
    }
  })
})

describe('pickFrenchVoice', () => {
  const v = (lang: string, name: string, localService = true) => ({ lang, name, localService })

  test('préfère le français de France, local', () => {
    const voices = [v('en-US', 'Samantha'), v('fr-CA', 'Amélie'), v('fr-FR', 'Thomas', false), v('fr-FR', 'Audrey')]
    expect(pickFrenchVoice(voices)?.name).toBe('Audrey')
  })

  test('accepte fr_FR (Android) et les autres français à défaut', () => {
    expect(pickFrenchVoice([v('fr_FR', 'Android')])?.name).toBe('Android')
    expect(pickFrenchVoice([v('en-GB', 'Daniel'), v('fr-CA', 'Amélie')])?.name).toBe('Amélie')
  })

  test('sans voix française, rien', () => {
    expect(pickFrenchVoice([v('en-US', 'Samantha')])).toBeNull()
    expect(pickFrenchVoice([])).toBeNull()
  })
})

describe('sans micro ni synthèse, le Lab reste à l’écrit', () => {
  test('rien n’est disponible côté serveur', () => {
    expect(canListen()).toBe(false)
    expect(canSpeak()).toBe(false)
  })

  test('écouter échoue proprement', () => {
    const calls: string[] = []
    listenOnce({ onResult: () => calls.push('result'), onError: r => calls.push(r), onEnd: () => calls.push('end') })
    expect(calls).toEqual(['failed', 'end'])
  })

  test('parler rend la main tout de suite', () => {
    let ended = 0
    speak('Bonjour', () => ended++)
    expect(ended).toBe(1)
  })
})
