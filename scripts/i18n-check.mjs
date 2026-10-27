#!/usr/bin/env node
// Contrôle des traductions de Tiroir — source unique design/i18n/.
//
//   node scripts/i18n-check.mjs                  rapport ; sortie 1 si une langue est trouée
//   node scripts/i18n-check.mjs --list [app|site]  liste les clés de référence (fr) et leur texte
//
// Ce qui est vérifié, pour l'app (design/i18n/app), le site (design/i18n/site)
// et les e-mails (design/i18n/email) :
//   1. chaque langue complète a toutes les clés de la référence, et rien de plus ;
//   2. une langue partielle (« fallback » dans languages.json, ex. pt-PT) n'a
//      que des clés connues, et aucune copie inutile de sa langue mère ;
//   3. les variables {{…}} (app) et {…} (site) sont les mêmes que dans la référence ;
//   4. textes système (design/i18n/system) : une version par langue de l'app ;
//   5. le repli de l'app fonctionne vraiment dans i18next (si mobile/node_modules
//      est installé ; sinon, le contrôle est sauté et signalé) ;
//   6. ISO web / mobile : langues de l'app et du site (languages.json), et
//      liste écrite à la main dans web/next.config.js.
// Les fichiers générés (app, site) sont vérifiés par node design/generate.mjs --check.
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dir = path.join(root, 'design/i18n')
const meta = JSON.parse(readFileSync(path.join(dir, 'languages.json'), 'utf8'))
const REFERENCE = meta.reference
const load = (kind, code) => {
  const f = path.join(dir, kind, `${code}.json`)
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null
}

/** { "a.b.c": "texte" } à partir d'un objet imbriqué ; les notes « $… » sont ignorées. */
function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj ?? {})) {
    if (k.startsWith('$')) continue
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object') flatten(v, key, out)
    else out[key] = v
  }
  return out
}

const VARS = {
  app: s => [...String(s).matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map(m => m[1]).sort().join(','),
  site: s => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(','),
}

const list = process.argv.indexOf('--list')
if (list > -1) {
  const kind = process.argv[list + 1] === 'site' ? 'site' : 'app'
  for (const [k, v] of Object.entries(flatten(load(kind, REFERENCE)))) console.log(`${k}\t${v}`)
  process.exit(0)
}

let failed = false

for (const kind of ['app', 'site']) {
  const langs = meta.languages.filter(l => l[kind])
  const ref = flatten(load(kind, REFERENCE))
  const refKeys = Object.keys(ref)
  console.log(`── ${kind === 'app' ? 'App' : 'Site'} — référence ${REFERENCE} : ${refKeys.length} clés`)
  for (const lang of langs) {
    if (lang.code === REFERENCE) continue
    const data = load(kind, lang.code)
    if (!data) { console.log(`${lang.code} : FICHIER MANQUANT (design/i18n/${kind}/${lang.code}.json)`); failed = true; continue }
    const flat = flatten(data)
    const keys = Object.keys(flat)
    const extra = keys.filter(k => !(k in ref))
    const badVars = keys.filter(k => k in ref && VARS[kind](flat[k]) !== VARS[kind](ref[k]))
    if (lang.fallback) {
      const parent = flatten(load(kind, lang.fallback))
      const copies = keys.filter(k => flat[k] === parent[k])
      console.log(`${lang.code} (partielle, repli sur ${lang.fallback}) : ${keys.length} clés propres`)
      if (copies.length) console.log(`  identiques à ${lang.fallback}, inutiles : ${copies.join(', ')}`)
    } else {
      // Le site type ses textes sur le français : un texte vide ou recopié tel
      // quel n'est pas une traduction, mais il compile. On ne compte que l'absence.
      const missing = refKeys.filter(k => !(k in flat))
      console.log(`${lang.code} : ${keys.length - extra.length}/${refKeys.length} clés${missing.length ? ` — ${missing.length} MANQUANTES` : ''}`)
      for (const k of missing) console.log(`  manquante : ${k}`)
      if (missing.length) failed = true
    }
    for (const k of extra) console.log(`  inconnue de ${REFERENCE} : ${k}`)
    for (const k of badVars) console.log(`  variables différentes : ${k} (${VARS[kind](flat[k])} ≠ ${VARS[kind](ref[k])})`)
    if (extra.length || badVars.length) failed = true
  }
  console.log('')
}

// ── E-mails ──────────────────────────────────────────────────────
// Partage : complet dans chaque langue des e-mails (langue mère comprise).
// Présentation : on liste les langues traduites ; les autres reçoivent le français.
{
  const emailLangs = meta.languages.filter(l => l.email)
  const merged = code => {
    const l = meta.languages.find(x => x.code === code)
    const own = load('email', code) ?? {}
    if (!l?.fallback) return own
    const base = merged(l.fallback)
    return { ...base, ...own, share: { ...base.share, ...own.share } }
  }
  const ref = flatten(load('email', REFERENCE)?.share)
  const refPres = flatten(load('email', REFERENCE)?.presentation)
  const withPres = []
  console.log(`── E-mails — partage : ${Object.keys(ref).length} textes`)
  for (const l of emailLangs) {
    const data = merged(l.code)
    const flat = flatten(data.share)
    const missing = Object.keys(ref).filter(k => !(k in flat))
    const badVars = Object.keys(flat).filter(k => k in ref && VARS.site(flat[k]) !== VARS.site(ref[k]))
    if (missing.length) { console.log(`${l.code} : ${missing.length} MANQUANTES — ${missing.join(', ')}`); failed = true }
    for (const k of badVars) { console.log(`  variables différentes : ${l.code} share.${k}`); failed = true }
    if (data.presentation) {
      withPres.push(l.code)
      const p = flatten(data.presentation)
      const miss = Object.keys(refPres).filter(k => !(k in p))
      if (miss.length) { console.log(`${l.code} présentation : ${miss.length} MANQUANTES — ${miss.join(', ')}`); failed = true }
      for (const k of Object.keys(p).filter(k => k in refPres && (VARS.app(p[k]) !== VARS.app(refPres[k]) || VARS.site(p[k]) !== VARS.site(refPres[k])))) {
        console.log(`  variables différentes : ${l.code} presentation.${k}`); failed = true
      }
    }
  }
  console.log(`Partage : ${emailLangs.map(l => l.code).join(', ')} · présentation traduite : ${withPres.join(', ')} (les autres comptes la reçoivent en ${REFERENCE})\n`)
}

// ── Textes système de l'app ──────────────────────────────────────
const sysRef = Object.keys(flatten(load('system', REFERENCE))).sort().join(',')
for (const l of meta.languages.filter(x => x.app)) {
  const sys = load('system', l.code)
  if (!sys) { console.log(`Textes système : ${l.code} MANQUANT`); failed = true; continue }
  if (Object.keys(flatten(sys)).sort().join(',') !== sysRef) { console.log(`Textes système : ${l.code} n'a pas les mêmes clés que ${REFERENCE}`); failed = true }
}
console.log(`Textes système (demandes d'accès iOS) : ${meta.languages.filter(x => x.app).map(x => x.code).join(', ')}`)

// ── Repli réel dans i18next ──────────────────────────────────────
const req = createRequire(path.join(root, 'mobile/package.json'))
let i18next = null
try {
  i18next = req('i18next')
  i18next = i18next.default ?? i18next
} catch {
  /* dépendances de l'app non installées */
}
const partial = meta.languages.find(l => l.app && l.fallback)
if (!i18next) {
  console.log('Repli i18next : non vérifié (lancer `npm install` dans mobile/, ou NODE_PATH vers un i18next 25)')
} else if (partial) {
  const appLangs = meta.languages.filter(l => l.app).map(l => l.code)
  const fallbackLng = { default: [meta.default] }
  for (const l of meta.languages) if (l.fallback) fallbackLng[l.code] = [l.fallback, meta.default]
  const inst = i18next.createInstance()
  await inst.init({
    resources: Object.fromEntries(appLangs.map(c => [c, { translation: load('app', c) }])),
    lng: partial.code,
    fallbackLng,
    supportedLngs: appLangs,
    load: 'currentOnly',
    interpolation: { escapeValue: false },
  })
  const own = flatten(load('app', partial.code))
  const parent = flatten(load('app', partial.fallback))
  const inherited = Object.keys(parent).find(k => !(k in own) && !/_(one|other)$/.test(k))
  const ownKey = Object.keys(own).find(k => !/_(one|other)$/.test(k))
  const ok1 = inst.t(inherited) === parent[inherited]
  const ok2 = inst.t(ownKey) === own[ownKey]
  const ok3 = inst.t('common.objects', { count: 3 }) === (own['common.objects_other'] ?? parent['common.objects_other']).replace('{{count}}', '3')
  console.log(`Repli i18next : ${partial.code} → ${partial.fallback} « ${inherited} » ${ok1 ? 'OK' : 'ÉCHEC'} ; clé propre « ${ownKey} » ${ok2 ? 'OK' : 'ÉCHEC'} ; pluriel ${ok3 ? 'OK' : 'ÉCHEC'}`)
  if (!ok1 || !ok2 || !ok3) failed = true
}

// ── ISO web / mobile ─────────────────────────────────────────────
const app = meta.languages.filter(l => l.app).map(l => l.code)
const site = meta.languages.filter(l => l.site).map(l => l.code)
console.log(`\nISO langues — app : ${app.join(', ')} · site : ${site.join(', ')}`)
const onlyApp = app.filter(c => !site.includes(c))
const onlySite = site.filter(c => !app.includes(c))
if (onlyApp.length) console.log(`  seulement dans l'app : ${onlyApp.join(', ')}`)
if (onlySite.length) console.log(`  seulement sur le site : ${onlySite.join(', ')}`)
const nextConfig = readFileSync(path.join(root, 'web/next.config.js'), 'utf8')
const nextLocales = (nextConfig.match(/locales:\s*\[([^\]]*)\]/)?.[1] ?? '').match(/'[^']+'/g)?.map(s => s.slice(1, -1)) ?? []
if ([...nextLocales].sort().join() !== [...site].sort().join()) {
  console.log(`  web/next.config.js (${nextLocales.join(', ')}) ≠ languages.json (${site.join(', ')})`)
  failed = true
}

process.exit(failed ? 1 : 0)
