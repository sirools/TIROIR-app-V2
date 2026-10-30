// Inventaire des composants de Tiroir — site web (Next.js) et app native
// (Expo, iOS et Android) —, avec les textes que chacun affiche, dans toutes
// les langues de design/i18n/. Lu par la page « Design system » du
// back-office (web/pages/admin/design-system.tsx).
//
// Appelé par design/generate.mjs : un composant ajouté, renommé ou supprimé,
// ou un texte modifié, se reporte en relançant `node design/generate.mjs`
// (le test designTokens casse sinon, comme pour les jetons et les textes).
//
// Lecture statique du code, sans dépendance ni compilation :
// - app : les clés passées à t('…') (i18next), et toute chaîne littérale du
//   fichier qui est une clé de design/i18n/app/ (clés rangées dans un objet,
//   puis traduites plus loin) ;
// - site : les liaisons de `const { t: { home: { hero: t } } } = useCopy()`,
//   puis les accès `t.title`, `t.items[i]`… ; un objet transmis en entier
//   (`<Rail t={t} />`) compte pour tous ses textes.
// Une clé construite à l'exécution (t(`status.${s}`)) donne son préfixe :
// tous les textes sous `status` sont rattachés au composant.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, basename, dirname } from 'node:path'

const OUT = 'web/lib/designSystem/inventory.generated.json'

// ── Textes ────────────────────────────────────────────────────────────────

/** Feuilles d'un JSON de traduction : { 'home.hero.title': 'Bonjour' }. */
function flatten(node, prefix = '', out = {}) {
  if (Array.isArray(node)) node.forEach((v, i) => flatten(v, prefix ? `${prefix}.${i}` : String(i), out))
  else if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith('$')) continue
      flatten(v, prefix ? `${prefix}.${k}` : k, out)
    }
  } else if (typeof node === 'string') out[prefix] = node
  return out
}

function loadTexts(root, kind, codes) {
  const texts = {}
  for (const code of codes) {
    const file = join(root, 'design/i18n', kind, `${code}.json`)
    texts[code] = flatten(JSON.parse(readFileSync(file, 'utf8')))
  }
  return texts
}

/** Clés du texte de référence sous un chemin (le chemin lui-même compris). */
function under(refKeys, path) {
  if (!path) return refKeys
  return refKeys.filter(k => k === path || k.startsWith(`${path}.`))
}

// i18next : `objects` couvre aussi `objects_one`, `objects_other`…
const PLURAL = /_(zero|one|two|few|many|other)$/

// ── Fichiers ──────────────────────────────────────────────────────────────

function walk(root, dir, keep) {
  const abs = join(root, dir)
  const out = []
  for (const name of readdirSync(abs).sort()) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const p = join(abs, name)
    if (statSync(p).isDirectory()) out.push(...walk(root, relative(root, p), keep))
    else if (keep(name)) out.push(relative(root, p).split('\\').join('/'))
  }
  return out
}

const isTsx = n => n.endsWith('.tsx') && !n.endsWith('.test.tsx') && !n.endsWith('.d.tsx')

/** Composants déclarés dans le fichier : exportés d'abord, puis internes. */
function componentNames(src, file) {
  const exported = new Set()
  const all = new Set()
  for (const m of src.matchAll(/export\s+default\s+(?:async\s+)?function\s+([A-Z]\w*)/g)) exported.add(m[1])
  for (const m of src.matchAll(/export\s+(?:async\s+)?function\s+([A-Z]\w*)/g)) exported.add(m[1])
  for (const m of src.matchAll(/export\s+const\s+([A-Z]\w*)\s*(?::[^=]+)?=\s*(?:React\.)?(?:memo\(|forwardRef\(|\(|async\s*\(|function)/g)) exported.add(m[1])
  for (const m of src.matchAll(/export\s+default\s+(?:React\.)?(?:memo\()?([A-Z]\w*)\)?\s*;?\s*$/gm)) exported.add(m[1])
  for (const m of src.matchAll(/(?:^|\n)\s*(?:async\s+)?function\s+([A-Z]\w*)\s*[(<]/g)) all.add(m[1])
  for (const m of src.matchAll(/(?:^|\n)\s*const\s+([A-Z]\w*)\s*(?::[^=\n]+)?=\s*(?:React\.)?(?:memo\(|forwardRef\(|\([^)]*\)\s*=>|function)/g)) all.add(m[1])
  // Écran ou page sans nom de fonction (export default () => …) : le fichier.
  if (!exported.size && /export\s+default/.test(src)) exported.add(fileTitle(file))
  const names = [...exported]
  const sub = [...all].filter(n => !exported.has(n))
  return { names, sub }
}

function fileTitle(file) {
  const b = basename(file, '.tsx')
  if (b === 'index') return basename(dirname(file))
  return b
}

/** Nombre approché de textes écrits en dur dans le JSX (hors traductions). */
function hardcodedCount(src) {
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
  let n = 0
  for (const m of code.matchAll(/>\s*([^<>{}\n]*[A-Za-zÀ-ÿ]{2,}[^<>{}\n]*?)\s*</g)) {
    const text = m[1].trim()
    // Ni opérateur (a > b && c < d), ni entité seule.
    if (!text || /&&|\|\||=>|[=;()]/.test(text) || /^&\w+;$/.test(text)) continue
    n++
  }
  return n
}

// ── App native : t('…') ───────────────────────────────────────────────────

function nativeKeys(src, refKeys, refSet) {
  const keys = new Set()
  const dynamic = new Set()
  const add = k => {
    if (refSet.has(k)) keys.add(k)
    else {
      const forms = refKeys.filter(r => r.replace(PLURAL, '') === k)
      if (forms.length) forms.forEach(f => keys.add(f))
      else if (under(refKeys, k).length) under(refKeys, k).forEach(f => keys.add(f))
    }
  }
  for (const m of src.matchAll(/\bt\(\s*(['"`])((?:(?!\1)[^\\]|\\.)*?)\1/g)) {
    const raw = m[2]
    if (m[1] === '`' && raw.includes('${')) {
      const prefix = raw.slice(0, raw.indexOf('${')).replace(/\.$/, '')
      if (prefix && under(refKeys, prefix).length) {
        dynamic.add(prefix)
        under(refKeys, prefix).forEach(f => keys.add(f))
      }
    } else add(raw)
  }
  // Clés rangées dans des objets puis traduites ailleurs dans le fichier.
  for (const m of src.matchAll(/(['"`])([a-zA-Z]\w*(?:\.\w+)+)\1/g)) {
    const k = m[2]
    if (refSet.has(k) || refKeys.some(r => r.replace(PLURAL, '') === k)) add(k)
  }
  return { keys: [...keys].sort(), dynamic: [...dynamic].sort(), whole: [] }
}

// ── Site : useCopy() ──────────────────────────────────────────────────────

/** `{ home: { hero: t }, layout }` → { t: 'home.hero', layout: 'layout' }. */
function parsePattern(text, base, out) {
  const s = text.trim()
  if (!s.startsWith('{')) {
    const id = s.match(/^\w+/)?.[0]
    if (id) out[id] = base
    return
  }
  // Découpe au premier niveau d'accolades.
  const body = s.slice(1, s.lastIndexOf('}'))
  let depth = 0, start = 0
  const parts = []
  for (let i = 0; i < body.length; i++) {
    const c = body[i]
    if (c === '{') depth++
    else if (c === '}') depth--
    else if (c === ',' && depth === 0) { parts.push(body.slice(start, i)); start = i + 1 }
  }
  parts.push(body.slice(start))
  for (const part of parts) {
    const p = part.trim()
    if (!p || p.startsWith('...')) continue
    const colon = p.indexOf(':')
    if (colon === -1) {
      const id = p.match(/^\w+/)?.[0]
      if (id) out[id] = base ? `${base}.${id}` : id
    } else {
      const key = p.slice(0, colon).trim()
      parsePattern(p.slice(colon + 1), base ? `${base}.${key}` : key, out)
    }
  }
}

/** Chaque `const { … } = useCopy()` : motif de déstructuration et position. */
function copyDecls(src) {
  const out = []
  for (const m of src.matchAll(/\}\s*=\s*useCopy\(\)/g)) {
    let depth = 0
    let i = m.index
    for (; i >= 0; i--) {
      if (src[i] === '}') depth++
      else if (src[i] === '{' && --depth === 0) break
    }
    if (i < 0) continue
    out.push({ pattern: src.slice(i, m.index + 1), start: i, end: m.index + m[0].length })
  }
  return out
}

function webKeys(src, refKeys) {
  const keys = new Set()
  const dynamic = new Set()
  const whole = new Set()
  for (const decl of copyDecls(src)) {
    // Le membre `t: …` porte les textes ; `locale` n'en est pas un.
    const inner = decl.pattern
    const bindings = {}
    parsePattern(inner, '', bindings)
    for (const [name, path] of Object.entries(bindings)) {
      if (!path.startsWith('t')) continue
      const base = path === 't' ? '' : path.slice(2)
      if (!under(refKeys, base).length && base) continue
      const rest = src.slice(0, decl.start) + ' '.repeat(decl.end - decl.start) + src.slice(decl.end)
      // Accès t.a.b, t?.a, t.items[i]…
      for (const m of rest.matchAll(new RegExp(`(?<![\\w.$'"])${name}((?:\\??\\.[A-Za-z_]\\w*|\\[\\d+\\])+)(\\[)?`, 'g'))) {
        const segs = m[1].replace(/\?/g, '').split(/\.|\[|\]/).filter(Boolean)
        let path = base
        let found = null
        for (const seg of segs) {
          const next = path ? `${path}.${seg}` : seg
          if (!under(refKeys, next).length) break
          path = next
          found = next
        }
        if (!found) continue
        const leaves = under(refKeys, found)
        leaves.forEach(k => keys.add(k))
        if (m[2] || leaves.length > 1 && !leaves.includes(found)) dynamic.add(found)
      }
      // Objet transmis en entier : <Rail t={t} />, f(t), [...t.items]
      const bare = new RegExp(`(?<![\\w.$'"-])${name}(?![\\w$]|\\s*:|\\??\\.|\\s*=[^=>])`, 'g')
      if (bare.test(rest) && base) {
        whole.add(base)
        under(refKeys, base).forEach(k => keys.add(k))
      }
    }
  }
  return { keys: [...keys].sort(), dynamic: [...dynamic].sort(), whole: [...whole].sort() }
}

// ── Classement ────────────────────────────────────────────────────────────

function webKind(file) {
  if (/^web\/pages\/(_app|_document)\.tsx$/.test(file)) return 'structure'
  if (file.startsWith('web/pages/admin') || file.startsWith('web/components/admin/')) return 'back-office'
  if (file.startsWith('web/pages/')) return 'page'
  return 'composant'
}

function webGroup(file) {
  if (file.startsWith('web/pages/')) {
    const rest = file.slice('web/pages/'.length)
    if (rest.startsWith('admin')) return 'Back-office'
    if (/^(s|share)\//.test(rest)) return 'Partage'
    if (/^(login|inscription|bienvenue|mon-compte|profil|mes-partages|mot-de-passe-oublie|nouveau-mot-de-passe|email-confirme|merci|desinscription)\.tsx$/.test(rest)) return 'Compte'
    if (/^(cgu|privacy|about)\.tsx$/.test(rest)) return 'À propos et juridique'
    if (/^(404|500)\.tsx$/.test(rest)) return 'Erreurs'
    if (/^_/.test(rest)) return 'Structure'
    return 'Vitrine'
  }
  const dir = file.slice('web/components/'.length).split('/')
  return {
    home: 'Vitrine', layout: 'Mise en page', share: 'Partage', legal: 'À propos et juridique',
    admin: 'Back-office', torix: 'Torix',
  }[dir.length > 1 ? dir[0] : ''] ?? 'Commun'
}

function nativeKind(file) {
  if (/\/_layout\.tsx$/.test(file) || file.startsWith('mobile/src/features/')) return 'structure'
  if (file.startsWith('mobile/app/')) return 'écran'
  return 'composant'
}

function nativeGroup(file) {
  if (file.startsWith('mobile/src/components/ui/')) return 'Briques UI'
  if (file.startsWith('mobile/src/components/')) return 'Composants métier'
  if (file.startsWith('mobile/src/')) return 'Structure'
  const rest = file.slice('mobile/app/'.length)
  if (rest.startsWith('(auth)')) return 'Connexion'
  const seg = rest.replace('(app)/', '').split('/')[0].replace(/\.tsx$/, '')
  return {
    assistant: 'Torix', capture: 'Capture', collections: 'Collections', objects: 'Objets',
    index: 'Accueil', search: 'Recherche', settings: 'Réglages', profile: 'Réglages', paywall: 'Offres',
    shares: 'Partage', s: 'Partage', onboarding: 'Accueil', privacy: 'Réglages', 'reset-password': 'Connexion',
    _layout: 'Structure',
  }[seg] ?? 'Autres écrans'
}

/** Corps juridiques écrits une fois par langue : FrBody, EnBody… */
const PER_LANGUAGE = /\/(Fr|En|Es|De|Da|PtBr|PtPt)Body\.tsx$/
const BODY_LANG = { Fr: 'fr', En: 'en', Es: 'es', De: 'de', Da: 'da', PtBr: 'pt-BR', PtPt: 'pt-PT' }

// ── Qui utilise qui ───────────────────────────────────────────────────────

/** Chemin (sans extension) visé par un import relatif ou `@/` (alias de l'app). */
function resolveSpec(from, spec) {
  if (spec.startsWith('@/')) return `mobile/src/${spec.slice(2)}`
  return join(dirname(from), spec).split('\\').join('/')
}

/** Noms exportés par un fichier (composants, hooks, constantes). */
function exportNames(src) {
  const names = new Set()
  for (const m of src.matchAll(/export\s+(?:default\s+)?(?:async\s+)?(?:function|const|class)\s+(\w+)/g)) names.add(m[1])
  return names
}

const IMPORT = /import\s+(type\s+)?([\s\S]*?)\s+from\s*['"](\.{1,2}\/[^'"]+|@\/[^'"]+)['"]|import\(\s*['"](\.{1,2}\/[^'"]+|@\/[^'"]+)['"]\s*\)/g

/**
 * Pour chaque composant, les fichiers qui l'importent : directement, ou par
 * un index.ts qui le réexporte (mobile/src/components/ui, web/components/legal/cgu…).
 * Les fichiers .ts comptent comme importeurs, pas comme composants.
 */
function importers(root, files, scanDirs) {
  const used = Object.fromEntries(files.map(f => [f, new Set()]))
  const byStem = new Map(files.map(f => [f.replace(/\.tsx$/, ''), f]))
  const sources = scanDirs.flatMap(d => walk(root, d, n => /\.(tsx?|mjs)$/.test(n) && !n.endsWith('.d.ts')))
  const read = f => readFileSync(join(root, f), 'utf8')

  // Index : chemin de l'index → composants qu'il réexporte, avec leurs noms.
  const barrels = new Map()
  for (const f of sources.filter(f => /\/index\.tsx?$/.test(f))) {
    const targets = []
    for (const m of read(f).matchAll(/from\s*['"](\.\/[^'"]+)['"]/g)) {
      const target = byStem.get(resolveSpec(f, m[1]))
      if (target) targets.push({ file: target, names: exportNames(read(target)) })
    }
    if (targets.length) barrels.set(f.replace(/\/index\.tsx?$/, ''), { targets, own: exportNames(read(f)) })
  }

  for (const f of sources) {
    for (const m of read(f).matchAll(IMPORT)) {
      if (m[1]) continue // import type : rien d'affiché
      const spec = resolveSpec(f, m[3] ?? m[4])
      const direct = byStem.get(spec)
      if (direct && direct !== f) { used[direct].add(f); continue }
      const barrel = barrels.get(spec) ?? barrels.get(spec.replace(/\/index$/, ''))
      if (!barrel) continue
      const imported = new Set((m[2] ?? '').match(/\w+/g) ?? [])
      const hits = barrel.targets.filter(t => [...t.names].some(n => imported.has(n)))
      // Table définie par l'index lui-même (CGU_BODIES…) : vaut pour tout ce qu'il rassemble.
      const table = [...barrel.own].some(n => imported.has(n)) ? barrel.targets : []
      for (const t of new Set([...hits, ...table])) if (t.file !== f) used[t.file].add(f)
    }
  }
  return Object.fromEntries(Object.entries(used).map(([k, v]) => [k, [...v].sort()]))
}

// ── Sortie ────────────────────────────────────────────────────────────────

export function componentsOutputs(root) {
  const meta = JSON.parse(readFileSync(join(root, 'design/i18n/languages.json'), 'utf8'))
  const langs = meta.languages
  const appCodes = langs.filter(l => l.app).map(l => l.code)
  const siteCodes = langs.filter(l => l.site).map(l => l.code)
  const ref = meta.reference

  const appTexts = loadTexts(root, 'app', appCodes)
  const siteTexts = loadTexts(root, 'site', siteCodes)
  const appRef = Object.keys(appTexts[ref])
  const siteRef = Object.keys(siteTexts[ref])
  const appRefSet = new Set(appRef)

  const webFiles = [
    ...walk(root, 'web/components', isTsx),
    ...walk(root, 'web/pages', isTsx).filter(f => !f.startsWith('web/pages/api/')),
  ]
  const nativeFiles = [...walk(root, 'mobile/app', isTsx), ...walk(root, 'mobile/src', isTsx)]
  const webUsers = importers(root, webFiles, ['web/components', 'web/pages', 'web/lib', 'web/locales'])
  const nativeUsers = importers(root, nativeFiles, ['mobile/app', 'mobile/src'])

  const entry = (file, kind, group, src, found, usedBy) => {
    const { names, sub } = componentNames(src, file)
    const perLanguage = PER_LANGUAGE.test(file) ? BODY_LANG[file.match(PER_LANGUAGE)[1]] : undefined
    return {
      file,
      name: names[0] ?? fileTitle(file),
      kind,
      group,
      ...(names.length > 1 ? { also: names.slice(1) } : {}),
      ...(sub.length ? { sub } : {}),
      ...(perLanguage ? { perLanguage } : {}),
      keys: found.keys,
      ...(found.dynamic.length ? { dynamic: found.dynamic } : {}),
      ...(found.whole.length ? { whole: found.whole } : {}),
      hardcoded: hardcodedCount(src),
      // Page du site ou écran de l'app : ouvert par son adresse, pas importé.
      ...(/^(web\/pages|mobile\/app)\//.test(file) ? { entry: true } : {}),
      usedBy,
    }
  }

  const web = webFiles.map(f => {
    const src = readFileSync(join(root, f), 'utf8')
    return entry(f, webKind(f), webGroup(f), src, webKeys(src, siteRef), webUsers[f])
  })
  const native = nativeFiles.map(f => {
    const src = readFileSync(join(root, f), 'utf8')
    return entry(f, nativeKind(f), nativeGroup(f), src, nativeKeys(src, appRef, appRefSet), nativeUsers[f])
  })

  // Textes : seulement ceux qu'un composant affiche, dans chaque langue.
  const pick = (entries, texts, codes) => {
    const used = new Set(entries.flatMap(e => e.keys))
    const out = {}
    for (const key of [...used].sort()) {
      out[key] = {}
      for (const code of codes) if (texts[code][key] !== undefined) out[key][code] = texts[code][key]
    }
    return out
  }

  const usedApp = new Set(native.flatMap(e => e.keys))
  const usedSite = new Set(web.flatMap(e => e.keys))
  const inventory = {
    $comment: 'Généré par design/generate.mjs (design/components.mjs) — ne pas modifier à la main.',
    reference: ref,
    languages: langs.map(l => ({
      code: l.code, name: l.name, app: !!l.app, site: !!l.site,
      ...(l.fallback ? { fallback: l.fallback } : {}),
    })),
    web: {
      components: web,
      texts: pick(web, siteTexts, siteCodes),
      totalKeys: siteRef.length,
      unusedKeys: siteRef.filter(k => !usedSite.has(k)).length,
    },
    native: {
      components: native,
      texts: pick(native, appTexts, appCodes),
      totalKeys: appRef.length,
      unusedKeys: appRef.filter(k => !usedApp.has(k)).length,
    },
  }
  return [[OUT, JSON.stringify(inventory, null, 1) + '\n']]
}
