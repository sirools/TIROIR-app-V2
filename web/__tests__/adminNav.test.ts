import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { adminNavFor, siteUrlFor } from '../lib/adminNav'
import { activeSection, breadcrumbsFor, type AdminNavSection } from '../components/admin/adminNavPaths'

const web = (p: string) => readFileSync(path.resolve(__dirname, '..', p), 'utf8')
const confirmed = '2026-01-01T00:00:00Z'
const owner = { email: 'proprio@example.com', email_confirmed_at: confirmed }
const colleague = { email: 'associe@example.com', email_confirmed_at: confirmed }
const marketer = { email: 'pub@example.com', email_confirmed_at: confirmed }
const env = { TORIX_OWNER_EMAIL: process.env.TORIX_OWNER_EMAIL, MARKETING_EMAILS: process.env.MARKETING_EMAILS }

afterEach(() => {
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
})

const keys = (u: typeof owner, isAdmin: boolean) => {
  process.env.TORIX_OWNER_EMAIL = owner.email
  process.env.MARKETING_EMAILS = marketer.email
  return adminNavFor(u, isAdmin).sections.map(s => s.key)
}

describe('sections du header admin', () => {
  test('le propriétaire de Torix voit tout', () => {
    expect(keys(owner, true)).toEqual(['accueil', 'marketing', 'torix'])
  })

  test('un autre admin ne voit pas Torix Lab', () => {
    expect(keys(colleague, true)).toEqual(['accueil', 'marketing'])
  })

  test('MARKETING_EMAILS sans être admin : Marketing seulement', () => {
    expect(keys(marketer, false)).toEqual(['marketing'])
  })

  test('le propriétaire de Torix non admin ne voit pas Torix Lab', () => {
    expect(keys(owner, false)).toEqual([])
  })

  test('le compte affiché est celui de la session', () => {
    expect(adminNavFor(colleague, true).account).toEqual({ email: colleague.email })
  })
})

describe('lien « Voir le site »', () => {
  test('back-office sur son domaine : adresse complète du site public', () => {
    expect(siteUrlFor('backoffice.tiroir.app', undefined)).toBe('https://tiroir.app/')
    expect(siteUrlFor('backoffice.tiroir.app', 'preprod.tiroir.app')).toBe('https://preprod.tiroir.app/')
  })

  test('même domaine (preprod, aperçus, dev) : la racine', () => {
    expect(siteUrlFor(undefined, undefined)).toBe('/')
    expect(siteUrlFor('  ', 'tiroir.app')).toBe('/')
  })

  test('le header affiche le lien, ordinateur et menu mobile', () => {
    const src = web('components/admin/AdminLayout.tsx')
    expect(src.match(/href=\{nav\.siteUrl\}/g)).toHaveLength(2)
  })
})

const SECTIONS: AdminNavSection[] = [
  { key: 'accueil', label: 'Accueil', href: '/admin' },
  { key: 'marketing', label: 'Marketing', href: '/admin/marketing', pages: { campagnes: 'Campagnes' } },
  { key: 'torix', label: 'Torix Lab', href: '/admin/torix-lab' },
]

describe('onglet actif', () => {
  test.each([
    ['/admin', 'accueil'],
    ['/admin/marketing', 'marketing'],
    ['/admin/marketing/campagnes/42', 'marketing'],
    ['/admin/torix-lab', 'torix'],
    ['/admin/autre', 'accueil'],
    ['/admin/marketingue', 'accueil'],
  ])('%s → %s', (p, key) => {
    expect(activeSection(SECTIONS, p)?.key).toBe(key)
  })

  test('hors du back-office : aucun', () => {
    expect(activeSection(SECTIONS, '/pricing')).toBeNull()
  })
})

describe('fil d’Ariane', () => {
  test('absent sur la page d’une section', () => {
    expect(breadcrumbsFor(SECTIONS, '/admin')).toEqual([])
    expect(breadcrumbsFor(SECTIONS, '/admin/marketing')).toEqual([])
  })

  test('sur une sous-page : Back-office › Section › Sous-page', () => {
    expect(breadcrumbsFor(SECTIONS, '/admin/marketing/campagnes/rentree-2026')).toEqual([
      { label: 'Back-office', href: '/admin' },
      { label: 'Marketing', href: '/admin/marketing' },
      { label: 'Campagnes', href: '/admin/marketing/campagnes' },
      { label: 'Rentree 2026', href: '/admin/marketing/campagnes/rentree-2026' },
    ])
  })
})

describe('un seul header', () => {
  test('posé par _app, pour les seules pages qui renvoient adminNav', () => {
    expect(web('pages/_app.tsx')).toContain('<AdminLayout nav={pageProps.adminNav}>')
  })

  test.each(['pages/admin.tsx', 'pages/admin/marketing.tsx', 'pages/admin/torix-lab.tsx'])(
    '%s renvoie adminNav et n’a pas de header à elle',
    file => {
      const src = web(file)
      expect(src).toContain('adminNav: adminNavFor(')
      expect(src).not.toContain('HeaderTiroirWeb')
    },
  )

  test('le code envoyé au navigateur ne lit pas le registre serveur', () => {
    for (const file of ['components/admin/AdminLayout.tsx', 'components/admin/adminNavPaths.ts']) {
      const src = web(file)
      for (const p of ['lib/adminNav', 'torixOwner', 'marketingAccess']) {
        expect(src.includes(`/${p}'`) || src.includes(`${p}'`), `${file} importe ${p}`).toBe(false)
      }
    }
  })
})
