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
