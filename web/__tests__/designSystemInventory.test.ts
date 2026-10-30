import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import inventory from '../lib/designSystem/inventory.generated.json'
import { designSystemView } from '../lib/designSystem/inventory'

const ROOT = path.resolve(__dirname, '../..')

function tsx(dir: string): string[] {
  const abs = path.join(ROOT, dir)
  return readdirSync(abs).flatMap(name => {
    if (name === 'node_modules' || name.startsWith('.')) return []
    const p = path.join(abs, name)
    const rel = path.relative(ROOT, p).split(path.sep).join('/')
    if (statSync(p).isDirectory()) return tsx(rel)
    return name.endsWith('.tsx') && !name.endsWith('.test.tsx') ? [rel] : []
  })
}

describe('inventaire du design system (page /admin/design-system)', () => {
  test('aucun composant du site ni de l’app ne manque', () => {
    const web = [...tsx('web/components'), ...tsx('web/pages').filter(f => !f.startsWith('web/pages/api/'))]
    const native = [...tsx('mobile/app'), ...tsx('mobile/src')]
    expect(inventory.web.components.map(c => c.file).sort()).toEqual(web.sort())
    expect(inventory.native.components.map(c => c.file).sort()).toEqual(native.sort())
  })

  test('les textes repérés se retrouvent : bouton de l’app et accroche du site', () => {
    const settings = inventory.native.components.find(c => c.file === 'mobile/app/(app)/settings.tsx')
    expect(settings?.keys.length).toBeGreaterThan(10)
    const hero = inventory.web.components.find(c => c.file === 'web/components/home/Hero.tsx')
    expect(hero?.keys.some(k => k.startsWith('home.hero.'))).toBe(true)
  })

  test('le sélecteur de langue traduit, se replie et signale les écarts ISO', () => {
    const en = designSystemView('en', 'native')
    expect(en.lang).toBe('en')
    expect(en.summary.native.available).toBe(true)
    const row = en.components.flatMap(c => c.texts).find(t => t.value !== null && t.ref !== undefined)
    expect(row).toBeDefined()

    // pt-PT : langue partielle, le reste vient de pt-BR.
    const ptPT = designSystemView('pt-PT', 'native')
    expect(ptPT.components.flatMap(c => c.texts).some(t => t.from === 'pt-BR')).toBe(true)

    // Danois : sur le site, pas dans l'app.
    expect(designSystemView('da', 'web').summary.web.available).toBe(true)
    expect(designSystemView('da', 'native').summary.native.available).toBe(false)
  })

  test('paramètres inconnus : langue de référence, support web', () => {
    const v = designSystemView('xx', 'ios')
    expect(v.lang).toBe('fr')
    expect(v.support).toBe('web')
  })

  test('la page ne reçoit rien d’indéfini (sérialisation Next)', () => {
    const v = designSystemView('pt-PT', 'native')
    expect(JSON.stringify(v)).toBe(JSON.stringify(JSON.parse(JSON.stringify(v))))
    const hasUndefined = (o: unknown): boolean =>
      o === undefined || (typeof o === 'object' && o !== null && Object.values(o).some(hasUndefined))
    expect(hasUndefined(v)).toBe(false)
  })
})
