import { describe, expect, test } from 'vitest'
import { CROWDFUNDING, crowdfundingLink, crowdfundingLive } from '../lib/crowdfunding'
import { TOPICS } from '../components/torix/knowledge'
import { FALLBACK_PAGE_URL } from '../lib/ululeProgress'
import fr from '../locales/fr'
import en from '../locales/en'
import es from '../locales/es'
import de from '../locales/de'

describe('collecte Ulule : une seule config', () => {
  test('ouverte entre la mise en ligne et la fin, fermée après', () => {
    const end = Date.parse(CROWDFUNDING.endDate)
    expect(crowdfundingLive(Date.parse('2026-11-19T12:00:00+01:00'))).toBe(true)
    expect(crowdfundingLive(end - 1)).toBe(true)
    expect(crowdfundingLive(end)).toBe(false)
    expect(crowdfundingLive(Date.parse('2026-12-26T00:00:00+01:00'))).toBe(false)
    expect(crowdfundingLive(Date.parse('2026-11-18T12:00:00+01:00'))).toBe(false)
  })

  test('le lien du toast mène à la page Ulule, avec son suivi', () => {
    const url = new URL(crowdfundingLink('toast'))
    expect(url.origin + url.pathname).toBe('https://fr.ulule.com/tiroir-app/')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      utm_source: 'tiroir.app', utm_medium: 'toast', utm_campaign: 'ulule',
    })
  })

  test('le repli des liens d’ambassadeurs et la fiche de Torix lisent la config', () => {
    expect(FALLBACK_PAGE_URL).toBe(CROWDFUNDING.url)
    const fiche = TOPICS.find(t => t.id === 'collecte')!
    expect(fiche.answer).toContain(CROWDFUNDING.url)
    expect(fiche.answer).toContain('21 décembre 2026')
    expect(fiche.answer).toMatch(/4\s000 €/)
  })

  test('le toast existe dans les quatre langues du site, sans mention interdite', () => {
    for (const copy of [fr, en, es, de]) {
      const t = copy.home.ululeInvite
      expect(t.text).toContain('Ulule')
      expect(t.text.trim().endsWith('→')).toBe(true)
      expect(JSON.stringify(t)).not.toMatch(/famille|postale|t-shirt|soirée/i)
    }
  })
})
