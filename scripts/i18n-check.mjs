#!/usr/bin/env node
// Contrôle des traductions de l'app (mobile/src/i18n/locales).
//
//   node scripts/i18n-check.mjs            rapport, code de sortie 1 si une langue complète est trouée
//   node scripts/i18n-check.mjs --list     liste toutes les clés de référence (fr)
//
// Ce qui est vérifié :
//   1. chaque langue complète a toutes les clés du français (référence), et rien de plus ;
//   2. une langue partielle (pt-PT) n'a que des clés connues, et aucune copie
//      inutile de sa langue mère (pt-BR) ;
//   3. les variables {{…}} sont les mêmes que dans la référence ;
//   4. le repli pt-PT → pt-BR → en fonctionne vraiment dans i18next (si
//      mobile/node_modules est installé ; sinon, le contrôle est sauté et signalé) ;
//   5. ISO web / mobile : les langues du site (web/next.config.js) et de l'app.
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dir = path.join(root, 'mobile/src/i18n/locales')
const REFERENCE = 'fr'
// Langue partielle → langue dont elle hérite les clés absentes.
const PARTIAL = { 'pt-PT': 'pt-BR' }

const load = lang => JSON.parse(readFileSync(path.join(dir, `${lang}.json`), 'utf8'))

/** { "a.b.c": "texte" } à partir d'un objet imbriqué. */
function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object') flatten(v, key, out)
    else out[key] = v
  }
  return out
}

const vars = s => [...String(s).matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map(m => m[1]).sort().join(',')

const langs = readdirSync(dir).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort()
const ref = flatten(load(REFERENCE))
const refKeys = Object.keys(ref)

if (process.argv.includes('--list')) {
  for (const k of refKeys) console.log(`${k}\t${ref[k]}`)
  process.exit(0)
}

let failed = false
console.log(`Référence : ${REFERENCE} (${refKeys.length} clés)\n`)

for (const lang of langs) {
  if (lang === REFERENCE) continue
  const flat = flatten(load(lang))
  const keys = Object.keys(flat)
  const extra = keys.filter(k => !(k in ref))
  const badVars = keys.filter(k => k in ref && vars(flat[k]) !== vars(ref[k]))
  const parent = PARTIAL[lang]

  if (parent) {
    const parentFlat = flatten(load(parent))
    const copies = keys.filter(k => flat[k] === parentFlat[k])
    console.log(`${lang} (partielle, repli sur ${parent}) : ${keys.length} clés propres`)
    if (copies.length) console.log(`  identiques à ${parent}, inutiles : ${copies.join(', ')}`)
  } else {
    const missing = refKeys.filter(k => !(k in flat))
    console.log(`${lang} : ${keys.length}/${refKeys.length} clés${missing.length ? ` — ${missing.length} MANQUANTES` : ''}`)
    for (const k of missing) console.log(`  manquante : ${k}`)
    if (missing.length) failed = true
  }
  for (const k of extra) console.log(`  inconnue de ${REFERENCE} : ${k}`)
  for (const k of badVars) console.log(`  variables différentes : ${k} (${vars(flat[k])} ≠ ${vars(ref[k])})`)
  if (extra.length || badVars.length) failed = true
}

// ── Repli réel dans i18next ──────────────────────────────────────
console.log('')
const req = createRequire(path.join(root, 'mobile/package.json'))
let i18next = null
try {
  i18next = req('i18next')
  i18next = i18next.default ?? i18next
} catch {
  /* dépendances de l'app non installées */
}
if (!i18next) {
  console.log('Repli i18next : non vérifié (lancer `npm install` dans mobile/, ou NODE_PATH vers un i18next 25)')
} else {
  const resources = Object.fromEntries(langs.map(l => [l, { translation: load(l) }]))
  const inst = i18next.createInstance()
  await inst.init({
    resources,
    lng: 'pt-PT',
    // Même déclaration que mobile/src/i18n/index.ts (FALLBACKS).
    fallbackLng: { 'pt-PT': ['pt-BR', 'en'], default: ['en'] },
    supportedLngs: langs,
    load: 'currentOnly',
    interpolation: { escapeValue: false },
  })
  const pt = flatten(load('pt-PT'))
  const br = flatten(load('pt-BR'))
  const inherited = Object.keys(br).find(k => !(k in pt) && !/_(one|other)$/.test(k))
  const own = Object.keys(pt).find(k => !/_(one|other)$/.test(k))
  const ok1 = inst.t(inherited) === br[inherited]
  const ok2 = inst.t(own) === pt[own]
  // Pluriel hérité : la forme « other » de pt-BR doit sortir pour count = 3.
  const ok3 = inst.t('common.objects', { count: 3 }) === (pt['common.objects_other'] ?? br['common.objects_other']).replace('{{count}}', '3')
  console.log(`Repli i18next ${i18next.default?.VERSION ?? ''}: pt-PT → pt-BR « ${inherited} » ${ok1 ? 'OK' : 'ÉCHEC'} ; clé propre « ${own} » ${ok2 ? 'OK' : 'ÉCHEC'} ; pluriel ${ok3 ? 'OK' : 'ÉCHEC'}`)
  if (!ok1 || !ok2 || !ok3) failed = true
}

// ── ISO web / mobile ─────────────────────────────────────────────
const nextConfig = readFileSync(path.join(root, 'web/next.config.js'), 'utf8')
const webLocales = (nextConfig.match(/locales:\s*\[([^\]]*)\]/)?.[1] ?? '').match(/'[^']+'/g)?.map(s => s.slice(1, -1)) ?? []
const appLangs = langs
const norm = l => l.toLowerCase()
const onlyApp = appLangs.filter(l => !webLocales.some(w => norm(w) === norm(l)))
const onlyWeb = webLocales.filter(w => !appLangs.some(l => norm(l) === norm(w)))
console.log(`\nISO langues — app : ${appLangs.join(', ')} · site : ${webLocales.join(', ')}`)
if (onlyApp.length) console.log(`  seulement dans l'app : ${onlyApp.join(', ')}`)
if (onlyWeb.length) console.log(`  seulement sur le site : ${onlyWeb.join(', ')}`)
if (existsSync(path.join(root, 'mobile/app.json'))) {
  const appJson = JSON.parse(readFileSync(path.join(root, 'mobile/app.json'), 'utf8'))
  const declared = appJson.expo?.ios?.infoPlist?.CFBundleLocalizations ?? []
  const plugin = (appJson.expo?.plugins ?? []).find(p => Array.isArray(p) && p[0] === 'expo-localization')
  const ios = plugin?.[1]?.supportedLocales?.ios ?? declared
  const missingNative = appLangs.filter(l => !ios.includes(l))
  console.log(`  langues natives iOS déclarées : ${ios.join(', ') || '(aucune)'}${missingNative.length ? ` — manquent ${missingNative.join(', ')}` : ''}`)
}

process.exit(failed ? 1 : 0)
