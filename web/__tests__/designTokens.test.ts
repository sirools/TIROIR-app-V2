import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'

const ROOT = path.resolve(__dirname, '../..')
const repo = (p: string) => readFileSync(path.join(ROOT, p), 'utf8')
const tokens = JSON.parse(repo('design/tokens.json'))

describe('design/tokens.json, seule source de vérité', () => {
  test('les fichiers générés (site, app, e-mails) sont à jour', () => {
    const r = spawnSync(process.execPath, [path.join(ROOT, 'design/generate.mjs'), '--check'], { encoding: 'utf8' })
    expect(r.stderr).toBe('')
    expect(r.status).toBe(0)
  })

  test('le site lit les jetons générés, sans les redéfinir à la main', () => {
    const app = repo('web/pages/_app.tsx')
    expect(app).toContain("import '../styles/tokens.generated.css'")
    for (const name of Object.keys(tokens.color)) {
      expect(app, `--${name} redéfini dans _app.tsx`).not.toMatch(new RegExp(`--${name}\\s*:`))
    }
  })

  test('l’app lit les jetons générés, sans aucune couleur écrite en dur', () => {
    const app = repo('mobile/src/components/ui/tokens.ts')
    expect(app).toContain("from './brandTokens.generated'")
    expect(app).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(app).toContain('accent: c.orange')
  })

  test('le site web actuel fait foi : orange #F26900', () => {
    expect(tokens.color.orange.value).toBe('#F26900')
    expect(repo('web/styles/tokens.generated.css')).toContain('--orange: #F26900;')
  })
})
