import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'

const PAGES = path.resolve(__dirname, '../pages')

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(f => {
    const p = path.join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) ? [p] : []
  })
}

// getSession() lit le cookie de session sans en vérifier la signature : côté
// serveur, un cookie fabriqué passerait. Tout code serveur (API, et pages avec
// getServerSideProps) doit passer par getUser().
describe('aucune authentification serveur sur un cookie non vérifié', () => {
  const serverFiles = walk(PAGES).filter(f => {
    const src = readFileSync(f, 'utf8')
    return f.includes(`${path.sep}api${path.sep}`) || src.includes('getServerSideProps')
  })

  test.each(serverFiles.map(f => [path.relative(PAGES, f), f]))('%s', (_name, file) => {
    const code = readFileSync(file, 'utf8').split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
    expect(code).not.toMatch(/auth\.getSession\(\)/)
  })
})

describe('en-têtes de sécurité', () => {
  const config = readFileSync(path.resolve(__dirname, '../next.config.js'), 'utf8')
  test('back-office et Torix jamais dans un cadre', () => {
    expect(config).toContain("{ source: '/admin/:path*', headers: locked }")
    expect(config).toContain("{ source: '/api/torix/:path*', headers: locked }")
    expect(config).toContain("frame-ancestors 'none'")
  })
})

describe('partages protégés : seule une clé signée ouvre', () => {
  const read = (p: string) => readFileSync(path.resolve(__dirname, '..', p), 'utf8')
  const code = (p: string) => read(p).split('\n').filter(l => !l.trim().startsWith('//')).join('\n')

  test.each([
    'pages/s/[token].tsx', 'pages/s/[token]/[objectId].tsx',
    'pages/share/[slug].tsx', 'pages/share/o/[shareSlug]/[objectId].tsx',
  ])('%s exige hasSignedCookie, plus de cookie « faible »', p => {
    const src = code(p)
    expect(src).toContain('hasSignedCookie(')
    expect(src).not.toMatch(/hasValidCookie\(/)
    expect(src).not.toMatch(/weakAuthorized/)
  })

  test('l’export vérifie la signature, pas seulement la présence du cookie', () => {
    expect(code('lib/shareExportData.ts')).toContain('return hasSignedCookie(token, req)')
  })

  test('les deux routes de vérification posent une clé signée', () => {
    expect(code('pages/api/shares/verify.ts')).not.toContain('`${Date.now()}.ok`')
    expect(code('pages/api/shares/verify.ts')).toContain('signedCookieValue(slug)')
    expect(code('pages/api/shares/[token]/verify.ts')).toContain('signedCookieValue(token)')
  })
})

describe('une clé fabriquée à la main est refusée', () => {
  test('ancien format `<horodatage>.ok`, signature inventée, autre partage', async () => {
    process.env.SHARE_COOKIE_SECRET = 'secret-de-test'
    const { isSignedCookieValid, signedCookieValue } = await import('../lib/shareCookieSignature')
    expect(isSignedCookieValid('abc', `${Date.now()}.ok`)).toBe(false)
    expect(isSignedCookieValid('abc', `${Date.now()}.inventee.ok`)).toBe(false)
    expect(isSignedCookieValid('autre', signedCookieValue('abc'))).toBe(false)
    expect(isSignedCookieValid('abc', signedCookieValue('abc'))).toBe(true)
  })
})
