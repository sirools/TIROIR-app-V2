import { describe, expect, test } from 'vitest'
import { routeFor } from '../lib/backofficeRouting'

const on = { backofficeHost: 'backoffice.tiroir.app', siteHost: 'tiroir.app' }

describe('sans BACKOFFICE_HOST, rien ne change', () => {
  test.each([
    ['tiroir.app', '/admin'],
    ['tiroir.app', '/'],
    ['192.168.1.23:8151', '/admin/torix-lab'],
  ])('%s%s', (host, path) => {
    expect(routeFor(host, path, '', {})).toEqual({ action: 'next' })
    expect(routeFor(host, path, '', { backofficeHost: '  ' })).toEqual({ action: 'next' })
  })
})

describe('backoffice.tiroir.app', () => {
  test('l’accueil ouvre l’admin', () => {
    expect(routeFor('backoffice.tiroir.app', '/', '', on)).toEqual({ action: 'rewrite', pathname: '/admin', noindex: true })
  })

  test.each([
    '/admin', '/admin/torix-lab', '/api/admin/settings', '/api/track', '/api/torix/ask', '/api/torix/access', '/api/health',
    '/login', '/mot-de-passe-oublie', '/nouveau-mot-de-passe', '/email-confirme',
    '/favicon.ico', '/logo.png', '/_next/data/abc/admin.json',
  ])('%s reste sur le back-office', path => {
    expect(routeFor('backoffice.tiroir.app', path, '', on)).toEqual({ action: 'next', noindex: true })
  })

  test.each(['/pricing', '/s/abc', '/mes-partages', '/profil', '/api/shares/abc/suggestions', '/administration'])(
    '%s renvoie vers le site public', path => {
      expect(routeFor('backoffice.tiroir.app', path, '', on)).toEqual({ action: 'redirect', url: `https://tiroir.app${path}` })
    },
  )

  test('garde la requête et la langue en renvoyant vers le site', () => {
    expect(routeFor('backoffice.tiroir.app', '/pricing', '?plan=pro', on, 'en'))
      .toEqual({ action: 'redirect', url: 'https://tiroir.app/en/pricing?plan=pro' })
  })

  test('majuscules et port ne trompent pas', () => {
    expect(routeFor('BackOffice.Tiroir.app:443', '/', '', on).action).toBe('rewrite')
  })
})

describe('tiroir.app', () => {
  test('/admin renvoie vers l’accueil du back-office', () => {
    expect(routeFor('tiroir.app', '/admin', '', on)).toEqual({ action: 'redirect', url: 'https://backoffice.tiroir.app/' })
    expect(routeFor('www.tiroir.app', '/admin', '?tab=ai', on)).toEqual({ action: 'redirect', url: 'https://backoffice.tiroir.app/?tab=ai' })
  })

  test('/admin/torix-lab garde son chemin', () => {
    expect(routeFor('tiroir.app', '/admin/torix-lab', '', on)).toEqual({ action: 'redirect', url: 'https://backoffice.tiroir.app/admin/torix-lab' })
  })

  test('le reste du site ne bouge pas', () => {
    for (const p of ['/', '/pricing', '/login', '/api/admin/settings', '/administration']) {
      expect(routeFor('tiroir.app', p, '', on)).toEqual({ action: 'next' })
    }
  })

  test('les aperçus Vercel et la preprod gardent leur /admin', () => {
    expect(routeFor('tiroir-git-main-sirools.vercel.app', '/admin', '', on)).toEqual({ action: 'next' })
    expect(routeFor('192.168.1.23:8151', '/admin', '', on)).toEqual({ action: 'next' })
  })

  test('site par défaut : tiroir.app', () => {
    expect(routeFor('tiroir.app', '/admin', '', { backofficeHost: 'backoffice.tiroir.app' }).action).toBe('redirect')
  })
})
