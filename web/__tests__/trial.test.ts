import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import {
  cleanLocation, decodeJpegDataUrl, estimateOf, isClaimCode, isExpired, LOCATION_MAX, MAX_PHOTO_BYTES,
  parseTrialCookie, SAVE_PATH, trialView, type TrialRow,
} from '../lib/trial'
import { safeNext } from '../lib/authFlow'
import { isTranslated } from '../lib/localeRouting'
import { cardsFor } from '../lib/dashboard'
import { PERSONAS } from '../lib/personas'
import { isUserProfile, profileFromPersona, suggestedOffer, toned, toneOf, USER_PROFILES } from '../lib/userProfile'
import { COPIES } from '../locales'

const repo = (p: string) => readFileSync(path.resolve(__dirname, '../..', p), 'utf8')
const part = (c: string) => c.repeat(43)

describe('cookie de l’essai', () => {
  test('deux secrets de 43 caractères, rien d’autre', () => {
    expect(parseTrialCookie(`${part('a')}.${part('b')}`)).toEqual({ token: part('a'), claim: part('b') })
    expect(parseTrialCookie(part('a'))).toBeNull()
    expect(parseTrialCookie(`${part('a')}.${part('b')}.${part('c')}`)).toBeNull()
    expect(parseTrialCookie(`${part('a')}.court`)).toBeNull()
    expect(parseTrialCookie(`${part('a')}.${'b'.repeat(42)}!`)).toBeNull()
    expect(parseTrialCookie(undefined)).toBeNull()
  })

  test('code de rattachement venu des métadonnées : vérifié avant usage', () => {
    expect(isClaimCode(part('x'))).toBe(true)
    expect(isClaimCode("x' or 1=1")).toBe(false)
    expect(isClaimCode(42)).toBe(false)
  })
})

describe('photo envoyée', () => {
  const jpeg = (size: number) => {
    const bytes = Buffer.alloc(size, 1)
    bytes[0] = 0xff; bytes[1] = 0xd8; bytes[2] = 0xff
    return bytes
  }
  const url = (bytes: Buffer, mime = 'image/jpeg') => `data:${mime};base64,${bytes.toString('base64')}`

  test('un JPEG de taille raisonnable passe', () => {
    expect(decodeJpegDataUrl(url(jpeg(5000)))?.length).toBe(5000)
  })
  test('la signature du fichier est vérifiée, pas son étiquette', () => {
    expect(decodeJpegDataUrl(url(Buffer.alloc(5000, 1)))).toBeNull()
    expect(decodeJpegDataUrl(url(jpeg(5000), 'image/png'))).toBeNull()
    expect(decodeJpegDataUrl(url(jpeg(5000), 'image/svg+xml'))).toBeNull()
  })
  test('trop lourde, vide ou illisible : refusée', () => {
    expect(decodeJpegDataUrl(url(jpeg(MAX_PHOTO_BYTES + 1)))).toBeNull()
    expect(decodeJpegDataUrl(url(jpeg(10)))).toBeNull()
    expect(decodeJpegDataUrl('https://exemple.fr/photo.jpg')).toBeNull()
    expect(decodeJpegDataUrl(null)).toBeNull()
  })
})

describe('emplacement', () => {
  test('une ligne, bornée ; vide → null', () => {
    expect(cleanLocation('  tiroir \n du   bureau ')).toBe('tiroir du bureau')
    expect(cleanLocation('   ')).toBeNull()
    expect(cleanLocation(12)).toBeNull()
    expect(cleanLocation('x'.repeat(500))).toHaveLength(LOCATION_MAX)
  })
})

describe('ce que la page reçoit', () => {
  const row: TrialRow = {
    id: 'secret-id', status: 'estimated', attempts: 1, photo_path: 'secret-id.jpg', title: 'Lampe', category: 'Luminaire',
    estimate: { value: 120, value_min: 90, value_max: 150, confidence: 'medium', summary: 'Bon état.' },
    location_note: 'bureau', expires_at: '2030-01-01T00:00:00Z', claimed_by: null, object_id: null,
  }

  test('rien d’interne ne sort (identifiant, chemin de la photo)', () => {
    const view = trialView(row, 'https://signee')
    expect(JSON.stringify(view)).not.toContain('secret-id')
    expect(view.estimate).toEqual({ value: 120, min: 90, max: 150, confidence: 'medium', summary: 'Bon état.' })
    expect(view.canRetry).toBe(false)
  })
  test('seconde photo seulement si la première n’a rien donné', () => {
    expect(trialView({ ...row, status: 'pending', estimate: null }, null).canRetry).toBe(true)
    expect(trialView({ ...row, status: 'pending', estimate: null, attempts: 2 }, null).canRetry).toBe(false)
  })
  test('estimation incohérente : fourchette ramenée à la valeur', () => {
    expect(estimateOf({ value: 50, value_min: 80, value_max: 10 })).toMatchObject({ min: 50, max: 50, confidence: 'low' })
    expect(estimateOf({ value: 0 })).toBeNull()
    expect(estimateOf(null)).toBeNull()
  })
  test('expiration', () => {
    expect(isExpired({ expires_at: '2020-01-01T00:00:00Z' })).toBe(true)
    expect(isExpired({ expires_at: '2999-01-01T00:00:00Z' })).toBe(false)
  })
})

describe('retour après inscription', () => {
  test('la page de sauvegarde est un retour interne accepté, traduite partout', () => {
    expect(safeNext(SAVE_PATH)).toBe(SAVE_PATH)
    for (const l of ['de', 'es'] as const) {
      expect(isTranslated(l, '/essai')).toBe(true)
      expect(isTranslated(l, SAVE_PATH)).toBe(true)
    }
  })
})

describe('type de profil', () => {
  test('trois profils, les mêmes en base et dans l’app', () => {
    const sql = repo('supabase/drafts/essai_sans_compte.sql')
    const mobile = repo('mobile/src/features/profile/userProfile.ts')
    for (const p of USER_PROFILES) {
      expect(sql).toContain(`'${p}'`)
      expect(mobile).toContain(`'${p}'`)
    }
    expect(isUserProfile('personal')).toBe(true)
    expect(isUserProfile('vip')).toBe(false)
  })

  test('ton : tu pour le grand public, vous pour créatif et entreprise', () => {
    expect(toneOf('personal')).toBe('tu')
    expect(toneOf(null)).toBe('tu')
    expect(toneOf('creative')).toBe('vous')
    expect(toneOf('business')).toBe('vous')
  })

  test('toned : seules les clés de « formal » changent', () => {
    const home = COPIES.fr.inventory.home
    expect(toned(home, 'tu').intro).toBe(home.intro)
    expect(toned(home, 'vous').intro).toBe(home.formal.intro)
    expect(toned(home, 'vous').hello).toBe(home.hello)
    expect(home.intro).toMatch(/\bTon\b/)
    expect(home.formal.intro).toMatch(/\bVotre\b/)
  })

  test('vouvoiement : aucune trace de tutoiement en français', () => {
    // « le ton » (nom) n'est pas un tutoiement.
    const tu = /\b(tu|ta|tes|toi)\b|(?<!le )\bton\b/i
    const { home, profileType } = COPIES.fr.inventory
    for (const text of [...Object.values(home.formal), ...Object.values(profileType.formal), profileType.offers.creative, profileType.offers.business]) {
      expect(text).not.toMatch(tu)
    }
  })

  test('un métier déjà déclaré répond à la question, comme le rattrapage SQL', () => {
    const sql = repo('supabase/drafts/essai_sans_compte.sql')
    const sqlProfile = (persona: string) =>
      new RegExp(`WHEN persona IN \\(([^)]*'${persona}'[^)]*)\\) THEN '(\\w+)'`).exec(sql)?.[2] ?? null
    for (const persona of PERSONAS) expect(profileFromPersona(persona)).toBe(sqlProfile(persona))
    expect(profileFromPersona('autre')).toBeNull()
    expect(profileFromPersona(null)).toBeNull()
  })

  test('cartes de l’accueil : le métier d’abord, sinon le type de profil', () => {
    expect(cardsFor({ plan: 'free', userProfile: 'creative' })).toEqual(cardsFor({ plan: 'free', profile: 'videaste' }))
    expect(cardsFor({ plan: 'free', userProfile: 'business' })).toEqual(cardsFor({ plan: 'free', profile: 'artisan' }))
    expect(cardsFor({ plan: 'free', userProfile: 'personal' })).toEqual(cardsFor({ plan: 'free' }))
    expect(cardsFor({ plan: 'free', profile: 'brocanteur', userProfile: 'creative' })).toEqual(cardsFor({ plan: 'free', profile: 'brocanteur' }))
  })

  test('offre suggérée : aux comptes gratuits seulement, jamais au grand public', () => {
    expect(suggestedOffer('creative', 'free')).toBe('creative')
    expect(suggestedOffer('business', 'free')).toBe('business')
    expect(suggestedOffer('personal', 'free')).toBeNull()
    expect(suggestedOffer('creative', 'premium')).toBeNull()
  })
})

describe('garde-fous de l’essai', () => {
  test('l’estimation n’accepte que la clé service', () => {
    const fn = repo('supabase/functions/trial-estimate/index.ts')
    expect(fn).toContain('isAuthorized(req.headers.get(\'Authorization\'), `Bearer ${serviceKey}`)')
    expect(fn).toContain("rpc('trial_begin_estimate'")
    expect(fn.indexOf("rpc('trial_begin_estimate'")).toBeLessThan(fn.indexOf('api.anthropic.com'))
  })
  test('les essais ne sont lisibles que par le serveur', () => {
    const sql = repo('supabase/drafts/essai_sans_compte.sql')
    expect(sql).toContain('REVOKE ALL ON public.trial_objects FROM PUBLIC, anon, authenticated')
    expect(sql).not.toMatch(/CREATE POLICY/)
  })
  test('aucune page ne lit la table des essais avec le client du navigateur', () => {
    for (const page of ['web/pages/essai/index.tsx', 'web/components/account/ProfileTypeChoice.tsx']) {
      expect(repo(page)).not.toContain('trial_objects')
    }
  })
})
