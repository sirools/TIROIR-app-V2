import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'

const web = (p: string) => readFileSync(path.resolve(__dirname, '..', p), 'utf8')

// Le code d'une page Next part dans un fichier public, téléchargeable sans
// connexion. Le savoir de Torix ne doit donc jamais être importé côté
// client : seul le serveur le lit (pages/api/torix/ask.ts).
const PRIVATE = ['torix/knowledge', 'torix/directions', 'torix/memory', 'torix/ownership', 'torix/savoir', 'torixSavoir']

function clientImports(src: string): string[] {
  // Imports statiques du module ; le chargement dynamique dans
  // getServerSideProps est retiré du code client par Next.
  return [...src.matchAll(/^import[^;]*?from '([^']+)'/gms)].map(m => m[1])
}

describe('Torix reste privé', () => {
  test('le savoir de Clément n’est pas dans les fichiers publics', () => {
    const { existsSync } = require('node:fs') as typeof import('node:fs')
    expect(existsSync(path.resolve(__dirname, '..', 'components/torix/savoir.md'))).toBe(true)
    expect(existsSync(path.resolve(__dirname, '..', 'public/savoir.md'))).toBe(false)
  })

  test.each(['pages/admin/torix-lab.tsx', 'pages/admin.tsx'])('%s n’importe aucun savoir de Torix', file => {
    const imports = clientImports(web(file))
    for (const p of PRIVATE) expect(imports.some(i => i.includes(p)), `${file} importe ${p}`).toBe(false)
  })

  test('le libellé du lien vers Torix vient du serveur', () => {
    const admin = web('pages/admin.tsx')
    expect(admin).toContain("torixLink: isTorixOwner(session.user) ? { href: '/admin/torix-lab', label: 'Torix Lab' } : null")
    expect(admin).not.toMatch(/>\s*Torix Lab\s*</)
  })

  test('l’API de Torix passe par la garde du propriétaire', () => {
    const api = web('pages/api/torix/ask.ts')
    expect(api).toContain('requireTorixOwnerApi(req, res)')
    expect(api.indexOf('requireTorixOwnerApi(req, res)')).toBeLessThan(api.indexOf('answerQuestion('))
  })
})
