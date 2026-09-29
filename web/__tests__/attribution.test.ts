import { describe, expect, test } from 'vitest'
import { acquisitionFrom, parseAcquisition, signupsBySource, sourceFromReferrer } from '../lib/attribution'
import { isMarketingMember, marketingEmails } from '../lib/marketingAccess'

describe('source d’une visite', () => {
  test('le lien de campagne passe avant le site d’origine', () => {
    expect(acquisitionFrom('?utm_source=Instagram&utm_medium=bio&utm_campaign=Rentree', 'https://www.google.com/'))
      .toEqual({ source: 'instagram', medium: 'bio', campaign: 'rentree' })
  })

  test('sans campagne : le site d’origine, ou « direct »', () => {
    expect(acquisitionFrom('', 'https://www.linkedin.com/feed/').source).toBe('linkedin')
    expect(acquisitionFrom('', 'https://l.instagram.com/?u=x').source).toBe('instagram')
    expect(acquisitionFrom('', null).source).toBe('direct')
    expect(sourceFromReferrer('https://tiroir.app/pricing', 'tiroir.app')).toBe('direct')
    expect(sourceFromReferrer('https://t.co/abc')).toBe('x')
    expect(sourceFromReferrer('pas une url')).toBe('unknown')
  })

  test('une source stockée mal formée est ignorée', () => {
    expect(parseAcquisition('{"source":"LinkedIn","landing":"/"}')).toMatchObject({ source: 'linkedin', landing: '/' })
    expect(parseAcquisition('pas du json')).toBeNull()
    expect(parseAcquisition({ source: '' })).toBeNull()
    expect(parseAcquisition(null)).toBeNull()
  })
})

describe('inscriptions par source', () => {
  test('compte, activés et taux ; les comptes sans source à part', () => {
    const rows = signupsBySource(
      [
        { id: 'a', acq: { source: 'instagram' } },
        { id: 'b', acq: { source: 'instagram' } },
        { id: 'c', acq: { source: 'linkedin' } },
        { id: 'd', acq: null },
      ],
      new Set(['a', 'c']),
    )
    expect(rows).toEqual([
      { source: 'instagram', comptes: 2, actives: 1, taux: 50 },
      { source: 'app ou inconnue', comptes: 1, actives: 0, taux: 0 },
      { source: 'linkedin', comptes: 1, actives: 1, taux: 100 },
    ])
  })
})

describe('accès à la page Marketing', () => {
  const raw = ' Adrien@Example.com, pas-une-adresse ,autre@example.com'
  test('liste propre, en minuscules', () => {
    expect(marketingEmails(raw)).toEqual(['adrien@example.com', 'autre@example.com'])
    expect(marketingEmails(undefined)).toEqual([])
  })

  test('adresse listée ET confirmée', () => {
    expect(isMarketingMember({ email: 'adrien@example.com', email_confirmed_at: '2026-10-01' }, raw)).toBe(true)
    expect(isMarketingMember({ email: 'adrien@example.com', email_confirmed_at: null }, raw)).toBe(false)
    expect(isMarketingMember({ email: 'intrus@example.com', email_confirmed_at: '2026-10-01' }, raw)).toBe(false)
    expect(isMarketingMember(null, raw)).toBe(false)
  })
})
