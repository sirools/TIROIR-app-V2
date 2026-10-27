// Traductions de Tiroir — seule source : design/i18n/ (voir design/i18n/README.md).
//
//   languages.json   la liste des langues (app, site, langue mère d'une langue partielle)
//   app/<langue>.json      textes de l'app (référence : fr)
//   site/<langue>.json     textes du site (référence : fr)
//   system/<langue>.json   textes système de l'app (demandes d'accès iOS)
//   email/<langue>.json    textes des e-mails (partage, présentation) ; gabarits
//                          HTML sans texte dans marketing/emails/gabarits/
//
// Appelé par design/generate.mjs, qui écrit les fichiers ou vérifie (--check)
// qu'ils sont à jour. Sans dépendance. Les clés qui commencent par « $ » sont
// des notes : « $comment » décrit l'objet, « $clé » décrit la clé qui suit.
// Elles deviennent des commentaires dans le TypeScript généré et
// disparaissent des fichiers JSON de l'app.
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const SECTIONS = ['share', 'account', 'about', 'legal']
const SECTION_TYPES = { share: 'ShareCopy', account: 'AccountCopy', about: 'AboutCopy', legal: 'LegalCopy' }

export function loadI18n(root) {
  const dir = join(root, 'design/i18n')
  const read = rel => JSON.parse(readFileSync(join(dir, rel), 'utf8'))
  const meta = read('languages.json')
  const langs = meta.languages
  const load = (kind, code) => (existsSync(join(dir, kind, `${code}.json`)) ? read(`${kind}/${code}.json`) : null)
  return { dir, meta, langs, load }
}

/** Retire les notes « $… » (récursif). */
export function stripNotes(v) {
  if (Array.isArray(v)) return v.map(stripNotes)
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.entries(v).filter(([k]) => !k.startsWith('$')).map(([k, x]) => [k, stripNotes(x)]))
  }
  return v
}

// ── TypeScript (site) ─────────────────────────────────────────────

const IDENT = /^[A-Za-z_$][\w$]*$/
const quote = s => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '\\r')}'`
const commentLines = (text, pad) => text.split('\n').map(l => (l ? `${pad}// ${l}` : `${pad}//`))

function tsValue(v, depth) {
  const pad = '  '.repeat(depth + 1)
  const end = '  '.repeat(depth)
  if (Array.isArray(v)) {
    if (!v.length) return '[]'
    // Tableau court de textes : sur une ligne, comme on l'écrirait à la main.
    const inline = `[${v.map(x => tsValue(x, depth + 1)).join(', ')}]`
    if (v.every(x => typeof x !== 'object' || x === null) && pad.length + inline.length <= 100) return inline
    return `[\n${v.map(x => `${pad}${tsValue(x, depth + 1)},`).join('\n')}\n${end}]`
  }
  if (v && typeof v === 'object') {
    const lines = []
    if (v.$comment) lines.push(...commentLines(v.$comment, pad))
    for (const [k, x] of Object.entries(v)) {
      if (k.startsWith('$')) continue
      if (typeof v['$' + k] === 'string') lines.push(...commentLines(v['$' + k], pad))
      lines.push(`${pad}${IDENT.test(k) ? k : quote(k)}: ${tsValue(x, depth + 1)},`)
    }
    return lines.length ? `{\n${lines.join('\n')}\n${end}}` : '{}'
  }
  if (typeof v === 'string') return quote(v)
  return JSON.stringify(v)
}

const varSuffix = code => code.split('-').map(p => p[0].toUpperCase() + p.slice(1)).join('')
const varName = code => code.replace(/-(\w)/, (_, c) => c.toUpperCase())

function siteFiles(root, header) {
  const { meta, langs, load } = loadI18n(root)
  const ref = meta.reference
  const out = []
  for (const { code } of langs.filter(l => l.site)) {
    const copy = load('site', code)
    if (!copy) throw new Error(`design/i18n/site/${code}.json manquant (langue du site)`)
    const isRef = code === ref
    const head = h => [`// ${header(`site/${code}.json`)}`, ...(h ? ['//', ...commentLines(h, '')] : [])].join('\n')

    for (const s of SECTIONS) {
      const section = copy[s]
      const name = `${s}${varSuffix(code)}`
      const body = tsValue({ ...section, $comment: undefined }, 0)
      out.push([`web/locales/${s}/${code}.ts`, [
        head(section.$comment),
        ...(isRef ? [] : [`import type { ${SECTION_TYPES[s]} } from './${ref}'`, '']),
        `const ${name}${isRef ? '' : `: ${SECTION_TYPES[s]}`} = ${body}`,
        '',
        ...(isRef ? [`export type ${SECTION_TYPES[s]} = typeof ${name}`] : []),
        `export default ${name}`,
        '',
      ].join('\n')])
    }

    const core = Object.fromEntries(Object.entries(copy).filter(([k]) => !SECTIONS.includes(k) && k !== '$comment'))
    const body = tsValue(core, 0).replace(/^\{\n/, `{\n${SECTIONS.map(s => `  ${s},`).join('\n')}\n`)
    const v = varName(code)
    out.push([`web/locales/${code}.ts`, [
      head(copy.$comment),
      ...(isRef ? [] : [`import type { Copy } from './${ref}'`]),
      ...SECTIONS.map(s => `import ${s} from './${s}/${code}'`),
      '',
      `const ${v}${isRef ? '' : ': Copy'} = ${body}`,
      '',
      ...(isRef ? ['export type Copy = typeof fr'] : []),
      `export default ${v}`,
      '',
    ].join('\n')])
  }
  return out
}

// ── Liste des langues (app, site, Edge Functions) ─────────────────

function languagesModule(root, header) {
  const { meta, langs } = loadI18n(root)
  const codes = f => langs.filter(f).map(l => l.code)
  const fallbacks = { default: [meta.default] }
  for (const l of langs) if (l.fallback) fallbacks[l.code] = [l.fallback, meta.default]
  // « pt » + pays → pt-PT ou pt-BR : la variante sans langue mère est celle par défaut.
  const variants = {}
  for (const l of langs.filter(x => x.code.includes('-'))) {
    const base = l.code.split('-')[0]
    variants[base] ??= { default: null, byRegion: {} }
    if (!l.fallback) variants[base].default = l.code
    for (const r of l.regions ?? []) variants[base].byRegion[r] = l.code
  }
  const rec = (pick) => Object.fromEntries(langs.map(l => [l.code, pick(l)]))
  return `// ${header('languages.json')}
/** Langues proposées dans l'app (iOS et Android), dans l'ordre du sélecteur. */
export const APP_LANGUAGES = ${JSON.stringify(codes(l => l.app))} as const
/** Langues proposées sur le site. */
export const SITE_LANGUAGES = ${JSON.stringify(codes(l => l.site))} as const
/** Langues dans lesquelles partent les e-mails. */
export const EMAIL_LANGUAGES = ${JSON.stringify(codes(l => l.email))} as const
/** Langue de référence : toutes les autres suivent ses clés. */
export const REFERENCE_LANGUAGE = ${JSON.stringify(meta.reference)}
/** Langue par défaut quand celle de l'appareil n'est pas proposée. */
export const DEFAULT_LANGUAGE = ${JSON.stringify(meta.default)}
/** Chaque langue écrite dans sa langue (jamais traduite). */
export const LANGUAGE_NAMES: Record<string, string> = ${JSON.stringify(rec(l => l.name))}
/** Balise Intl (formats de prix, de dates, de nombres). */
export const LANGUAGE_INTL: Record<string, string> = ${JSON.stringify(rec(l => l.intl))}
/** Repli clé par clé (i18next) : une langue partielle hérite de sa langue mère, puis de la langue par défaut. */
export const FALLBACKS: Record<string, string[]> = ${JSON.stringify(fallbacks)}
/** Langue à variantes (« pt ») : variante par défaut et variante par pays. */
export const REGIONAL_VARIANTS: Record<string, { default: string; byRegion: Record<string, string> }> = ${JSON.stringify(variants)}
`
}

// ── Sorties ───────────────────────────────────────────────────────

export function i18nOutputs(root) {
  const { langs, load } = loadI18n(root)
  const header = src => `Généré par design/generate.mjs depuis design/i18n/${src} — ne pas modifier à la main.`
  const json = v => JSON.stringify(stripNotes(v), null, 2) + '\n'
  const out = []
  for (const { code } of langs.filter(l => l.app)) {
    const app = load('app', code)
    if (!app) throw new Error(`design/i18n/app/${code}.json manquant (langue de l'app)`)
    out.push([`mobile/src/i18n/locales/${code}.json`, json(app)])
    const system = load('system', code)
    if (!system) throw new Error(`design/i18n/system/${code}.json manquant (textes système de l'app)`)
    out.push([`mobile/locales/${code}.json`, json(system)])
  }
  // Ressources i18next de l'app : imports statiques (exigés par Metro), une
  // langue ajoutée dans languages.json n'a rien à écrire à la main.
  const appCodes = langs.filter(l => l.app).map(l => l.code)
  out.push(['mobile/src/i18n/resources.generated.ts', [
    `// ${header('languages.json et design/i18n/app/')}`,
    ...appCodes.map(c => `import ${varName(c)} from './locales/${c}.json'`),
    '',
    'export const RESOURCES = {',
    ...appCodes.map(c => `  ${IDENT.test(c) ? c : quote(c)}: { translation: ${varName(c)} },`),
    '}',
    '',
  ].join('\n')])
  out.push(...siteFiles(root, header))
  const languages = languagesModule(root, header)
  out.push(['mobile/src/i18n/languages.generated.ts', languages])
  out.push(['web/locales/languages.generated.ts', languages])
  out.push(['supabase/functions/_shared/languages.generated.ts', languages])
  out.push(...emailOutputs(root, header))
  return out
}

// ── E-mails ───────────────────────────────────────────────────────

/** Fusion profonde : les clés de « own » l'emportent (langue partielle sur sa langue mère). */
function merge(base, own) {
  if (!base) return own
  if (!own) return base
  const out = { ...base }
  for (const [k, v] of Object.entries(own)) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' ? merge(base[k], v) : v
  }
  return out
}

/** Textes e-mail d'une langue, langue mère comprise. */
function emailTexts(root, code) {
  const { langs, load } = loadI18n(root)
  const lang = langs.find(l => l.code === code)
  const own = load('email', code)
  if (!own) throw new Error(`design/i18n/email/${code}.json manquant (langue des e-mails)`)
  return lang?.fallback ? merge(emailTexts(root, lang.fallback), own) : own
}

/** Gabarit HTML + textes : chaque [[clé]] est remplacé ; une clé absente fait échouer. */
export function renderLayout(layout, texts, code, src) {
  return layout.replace(/\[\[(\w+)\]\]/g, (_, k) => {
    if (k === 'lang') return code
    if (typeof texts[k] !== 'string') throw new Error(`${src} : texte « ${k} » manquant en ${code}`)
    return texts[k]
  })
}

// Ce qui part chez les destinataires : sans les commentaires de conception
// (Gmail tronque au-delà de 102 Ko, en coupant le lien de désinscription),
// sauf les commentaires conditionnels d'Outlook ; puis échappé pour un
// gabarit littéral JavaScript. Mêmes règles que l'ancien script Python
// qui transcrivait le gabarit (retiré : ce générateur le remplace).
function sentHtml(html) {
  return html.replace(/<!--(?!\[if )(?:(?!-->)[\s\S])*?-->/g, '').replace(/\n{3,}/g, '\n\n')
}
const literal = s => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')

function emailOutputs(root, header) {
  const { langs } = loadI18n(root)
  const codes = langs.filter(l => l.email).map(l => l.code)
  const all = Object.fromEntries(codes.map(c => [c, stripNotes(emailTexts(root, c))]))
  const out = []

  // Partage : des données, mises en forme par _shared/shareEmailCopy.ts.
  const shareKeys = Object.keys(all[codes[0]].share)
  const presentationLangs = codes.filter(c => all[c].presentation)
  const presentation = Object.fromEntries(presentationLangs.map(c => {
    const { html, ...rest } = all[c].presentation
    return [c, rest]
  }))
  out.push(['supabase/functions/_shared/emailCopy.generated.ts', `// ${header('email/')}
/** Langues dans lesquelles partent les e-mails. */
export const EMAIL_LANGUAGES = ${JSON.stringify(codes)} as const
export type EmailLanguage = (typeof EMAIL_LANGUAGES)[number]

export interface ShareEmailTexts {
${shareKeys.map(k => `  ${k}: string`).join('\n')}
}

/** E-mail de partage. Marqueurs {name}, {n}, {sender}, {objects}, {title}. */
export const SHARE_EMAIL_TEXTS: Record<EmailLanguage, ShareEmailTexts> = ${JSON.stringify(Object.fromEntries(codes.map(c => [c, all[c].share])), null, 2)}

export interface PresentationTexts {
  subject: string
  opening: Record<string, string>
  text: { lines: string[] }
}

/** E-mail de présentation : objet, première phrase, version texte (le HTML est dans emailPresentation.ts). */
export const PRESENTATION_TEXTS: Partial<Record<EmailLanguage, PresentationTexts>> = ${JSON.stringify(presentation, null, 2)}
`])

  // Présentation : gabarit sans texte + textes de chaque langue.
  const layoutFile = 'marketing/emails/gabarits/presentation.html'
  const layout = readFileSync(join(root, layoutFile), 'utf8')
  const rendered = Object.fromEntries(presentationLangs.map(c => [c, renderLayout(layout, all[c].presentation.html, c, layoutFile)]))
  // Aperçu : le gabarit rempli en français, toujours ouvrable seul dans un navigateur.
  out.push(['marketing/emails/presentation.html', rendered.fr])
  const sent = Object.fromEntries(presentationLangs.map(c => [c, sentHtml(rendered[c])]))
  const variables = [...new Set([...sent.fr.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]))].sort()
  for (const c of presentationLangs) {
    const v = [...new Set([...sent[c].matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1]))].sort()
    if (v.join() !== variables.join()) throw new Error(`Présentation ${c} : variables ${v} ≠ ${variables}`)
  }
  out.push(['supabase/functions/_shared/emailPresentation.ts', [
    `// ${header('email/ et marketing/emails/gabarits/presentation.html')}`,
    '//',
    "// Rejouer node design/generate.mjs après toute modification du gabarit ou",
    "// des textes, sinon c'est l'ancienne version qui part chez les destinataires.",
    '',
    "/** Variables attendues par le gabarit, dans l'ordre alphabétique. */",
    `export const VARIABLES_PRESENTATION = [${variables.map(v => `'${v}'`).join(', ')}] as const`,
    '',
    `export const HTML_PRESENTATION = \`${literal(sent.fr)}\``,
    '',
    '/** Le même message dans chaque langue où il est traduit (français sinon). */',
    'export const HTML_PRESENTATION_BY_LANG: Record<string, string> = {',
    ...presentationLangs.map(c => c === 'fr' ? '  fr: HTML_PRESENTATION,' : `  ${quote(c)}: \`${literal(sent[c])}\`,`),
    '}',
    '',
  ].join('\n')])
  return out
}

/** mobile/app.json : langues natives (Réglages › Tiroir › Langue) et textes système. */
export function applyLanguagesToAppJson(app, root) {
  const { langs } = loadI18n(root)
  const codes = langs.filter(l => l.app).map(l => l.code)
  const e = app.expo
  e.plugins = e.plugins.map(p => {
    const name = Array.isArray(p) ? p[0] : p
    if (name !== 'expo-localization') return p
    const opts = Array.isArray(p) ? { ...p[1] } : {}
    return ['expo-localization', { ...opts, supportedLocales: { ios: codes, android: codes } }]
  })
  e.locales = Object.fromEntries(codes.map(c => [c, `./locales/${c}.json`]))
  return app
}
