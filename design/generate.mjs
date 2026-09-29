#!/usr/bin/env node
// Génère, depuis design/tokens.json (seule source de vérité), les jetons de
// chaque support : site web, app (iOS et Android), e-mails.
//
//   node design/generate.mjs          écrit les fichiers
//   node design/generate.mjs --check  échoue si l'un d'eux n'est plus à jour
//
// Sans dépendance. Ne jamais modifier les fichiers générés à la main.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const tokens = JSON.parse(readFileSync(join(ROOT, 'design/tokens.json'), 'utf8'))

const HEADER = 'Généré par design/generate.mjs depuis design/tokens.json — ne pas modifier à la main.'

const HEX = /^#[0-9a-fA-F]{6}$/
for (const [name, t] of Object.entries(tokens.color)) {
  if (!HEX.test(t.value)) throw new Error(`Couleur « ${name} » invalide : ${t.value}`)
}

const camel = s => s.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase())
const px = t => (t.unit === 'px' ? `${t.value}px` : String(t.value))
// Échelle { clé: valeur } → littéral TS, sans les clés de métadonnées ($…).
const scale = obj =>
  '{ ' + Object.entries(obj).filter(([k]) => !k.startsWith('$'))
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? `'${v}'` : v}`).join(', ') + ' }'

function css() {
  const lines = [
    ...Object.entries(tokens.color).map(([n, t]) => `  --${n}: ${t.value};`),
    `  --font-body: ${tokens.font.body.value};`,
    `  --radius: ${px(tokens.radius.default)};`,
    `  --shadow: ${tokens.shadow.default.value};`,
    `  --max: ${px(tokens.layout.max)};`,
  ]
  return `/* ${HEADER} */\n:root {\n${lines.join('\n')}\n}\n`
}

function ts() {
  const colors = Object.entries(tokens.color)
    .map(([n, t]) => `    /** ${t.role} */\n    ${camel(n)}: '${t.value}',`)
    .join('\n')
  return `// ${HEADER}
export const Brand = {
  color: {
${colors}
  },
  /** ${tokens.font.body.role} */
  fontBody: ${JSON.stringify(tokens.font.body.value)},
  /** ${tokens.radius.default.role} */
  radius: ${tokens.radius.default.value},
  /** ${tokens.shadow.default.role} */
  shadow: '${tokens.shadow.default.value}',
  space: ${scale(tokens.space)},
  radiusScale: ${scale(tokens.radiusScale)},
  type: {
    size: ${scale(tokens.type.size)},
    weight: ${scale(tokens.type.weight)},
    lineHeight: ${scale(tokens.type.lineHeight)},
  },
} as const
`
}

const OUTPUTS = [
  ['web/styles/tokens.generated.css', css()],
  ['mobile/src/components/ui/brandTokens.generated.ts', ts()],
  ['supabase/functions/_shared/brandTokens.generated.ts', ts()],
]

// app.json de l'app (Expo) : seules ses couleurs viennent des jetons —
// fond de l'écran de démarrage = fond de l'app, fond de l'icône Android =
// orange. Remplacement ciblé, pour ne pas reformater le reste du fichier.
function appJson() {
  const file = join(ROOT, 'mobile/app.json')
  let src = readFileSync(file, 'utf8')
  const set = (re, value, what) => {
    if (!re.test(src)) throw new Error(`mobile/app.json : ${what} introuvable`)
    src = src.replace(re, `$1${value}$2`)
  }
  set(/("splash":\s*\{[^}]*?"backgroundColor":\s*")#[0-9A-Fa-f]{6}(")/s, tokens.color['beige-2'].value, 'splash.backgroundColor')
  set(/("adaptiveIcon":\s*\{[^}]*?"backgroundColor":\s*")#[0-9A-Fa-f]{6}(")/s, tokens.color.orange.value, 'android.adaptiveIcon.backgroundColor')
  return src
}
OUTPUTS.push(['mobile/app.json', appJson()])

const check = process.argv.includes('--check')
let stale = 0
for (const [rel, content] of OUTPUTS) {
  const file = join(ROOT, rel)
  const current = existsSync(file) ? readFileSync(file, 'utf8') : null
  if (current === content) continue
  if (check) {
    console.error(`✗ ${rel} n'est pas à jour : lancer node design/generate.mjs`)
    stale++
  } else {
    writeFileSync(file, content)
    console.log(`✓ ${rel}`)
  }
}
if (check && stale) process.exit(1)
if (check) console.log('✓ Jetons à jour sur le site, l’app et les e-mails.')
