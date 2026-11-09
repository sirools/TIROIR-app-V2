#!/usr/bin/env node
/**
 * Garde-fou clavier — `npm run check:keyboard` (lancé aussi avant chaque
 * build EAS).
 *
 * Toute la gestion du clavier vit dans src/components/ui/keyboard
 * (FormScreen, FormSheet…). Ce script casse si :
 *  1. un fichier gère le clavier lui-même (KeyboardAvoidingView ou Keyboard
 *     de react-native, keyboardVerticalOffset, react-native-keyboard-controller
 *     importé hors du dossier partagé) ;
 *  2. un fichier affiche un champ (<TextInput>, <Input>) sans passer par un
 *     conteneur partagé — sauf composant « hébergé » déclaré plus bas, dont
 *     chaque écran hôte doit lui-même utiliser un conteneur partagé ;
 *  3. une <Modal> contient un champ (elle doit être une <FormSheet>).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(import.meta.url), '..', '..')
const SHARED_DIR = ['src', 'components', 'ui', 'keyboard'].join(sep)

/** Le champ lui-même : il est posé par les écrans, jamais seul. */
const FIELD_COMPONENTS = new Set([['src', 'components', 'ui', 'Input.tsx'].join('/')])

/**
 * Composants qui contiennent un champ mais n'occupent qu'un morceau d'écran :
 * c'est l'écran (ou la sheet) qui les accueille qui gère le clavier. Tout
 * fichier qui les affiche doit figurer ici comme hôte.
 */
const HOSTED = {
  CollectionComposer: {
    file: 'src/components/ui/CollectionComposer.tsx',
    hosts: [
      'app/(app)/index.tsx',
      'app/(app)/collections/index.tsx',
      'src/components/ui/CollectionPickerSheet.tsx',
    ],
  },
  InsurancesSection: {
    file: 'src/components/InsurancesSection.tsx',
    hosts: ['app/(app)/objects/[id].tsx'],
  },
}

const CONTAINERS = [
  'FormScreen', 'FormScrollView', 'FormFlatList',
  'FormSheet', 'SheetScrollView', 'SheetFlatList',
]

const FIELD_RE = /<(TextInput|Input)\b/
const containerRe = new RegExp(`<(${CONTAINERS.join('|')})\\b`)

function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return walk(p)
    return /\.(tsx|ts)$/.test(name) ? [p] : []
  })
}

const files = [...walk(join(ROOT, 'app')), ...walk(join(ROOT, 'src'))]
const rel = p => relative(ROOT, p).split(sep).join('/')
const errors = []
const fail = (file, msg) => errors.push(`${file} — ${msg}`)

// Retire commentaires et chaînes simples pour ne pas se laisser piéger
// par un mot cité dans un commentaire.
const strip = src => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1')

const sources = new Map(files.map(f => [rel(f), strip(readFileSync(f, 'utf8'))]))
const usesContainer = file => containerRe.test(sources.get(file) ?? '')

for (const [file, src] of sources) {
  if (file.startsWith(SHARED_DIR.split(sep).join('/'))) continue

  // 1. Gestion du clavier faite à la main.
  const rnImport = src.match(/import\s*\{([^}]*)\}\s*from\s*'react-native'/)
  if (rnImport) {
    const names = rnImport[1].split(',').map(n => n.trim())
    if (names.includes('KeyboardAvoidingView')) {
      fail(file, 'KeyboardAvoidingView de react-native : utiliser FormScreen ou FormSheet.')
    }
    if (names.includes('Keyboard')) {
      fail(file, 'Keyboard de react-native : utiliser dismissKeyboard / focusNextField.')
    }
  }
  if (/keyboardVerticalOffset/.test(src)) {
    fail(file, 'keyboardVerticalOffset : le décalage est géré par FormScreen.')
  }
  if (/from\s*'react-native-keyboard-controller'/.test(src)) {
    fail(file, 'react-native-keyboard-controller importé hors de src/components/ui/keyboard.')
  }

  // 3. Champ dans une <Modal> brute.
  for (const m of src.matchAll(/<Modal\b[\s\S]*?<\/Modal>/g)) {
    if (FIELD_RE.test(m[0])) {
      fail(file, 'champ dans une <Modal> : remplacer la Modal par <FormSheet>.')
    }
  }

  // 2. Champ hors conteneur partagé.
  if (!FIELD_RE.test(src) || FIELD_COMPONENTS.has(file)) continue
  const hosted = Object.entries(HOSTED).find(([, h]) => h.file === file)
  if (hosted) continue
  if (!usesContainer(file)) {
    fail(file, 'champ de saisie hors de FormScreen / FormSheet / FormScrollView '
      + '(src/components/ui/keyboard). Si c\'est un morceau d\'écran, le déclarer '
      + 'dans HOSTED de scripts/check-keyboard.mjs avec ses écrans hôtes.')
  }
}

// Composants hébergés : chaque fichier qui les affiche est un hôte déclaré,
// et chaque hôte gère le clavier.
for (const [name, { file, hosts }] of Object.entries(HOSTED)) {
  if (!sources.has(file)) fail(file, `HOSTED.${name} : fichier introuvable.`)
  const tag = new RegExp(`<${name}\\b`)
  for (const [f, src] of sources) {
    if (f === file || !tag.test(src)) continue
    if (!hosts.includes(f)) {
      fail(f, `affiche <${name}> (champ de saisie) sans être déclaré hôte dans HOSTED.`)
    } else if (!usesContainer(f)) {
      fail(f, `hôte de <${name}> sans FormScreen / FormSheet / FormScrollView.`)
    }
  }
}

if (errors.length) {
  console.error(`Clavier : ${errors.length} problème(s)\n`)
  for (const e of errors) console.error(`  ✗ ${e}`)
  console.error('\nVoir src/components/ui/keyboard/FormScreen.tsx.')
  process.exit(1)
}
console.log(`Clavier : ${sources.size} fichiers vérifiés, aucun champ hors du composant partagé.`)
