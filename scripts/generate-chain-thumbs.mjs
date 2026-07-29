#!/usr/bin/env node
/**
 * Génère les vignettes produit du convoyeur de la page /concept.
 *
 * Réutilise le modèle image déjà en production dans la fonction
 * enhance-object-photo (gemini-2.5-flash-image) : même endpoint, même
 * clé, même façon de lire la réponse. Rien de nouveau à provisionner.
 *
 *   export GEMINI_API_KEY="…"                 # secret Supabase du projet
 *   node scripts/generate-chain-thumbs.mjs    # ne régénère que les manquants
 *   node scripts/generate-chain-thumbs.mjs --force
 *   node scripts/generate-chain-thumbs.mjs veste montre
 *
 * Les fichiers atterrissent dans web/public/screens/chain/.
 */
import { mkdir, writeFile, access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const MODEL = 'gemini-2.5-flash-image'
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'web', 'public', 'screens', 'chain')
const MAX_ATTEMPTS = 3

// Un sujet unique par image : à 42 px, une scène à quinze objets est illisible.
const PRODUCTS = [
  { slug: 'veste',           subject: 'a folded blue denim jacket' },
  { slug: 'baskets',         subject: 'a pair of white leather sneakers, side by side' },
  { slug: 'montre',          subject: 'a vintage wristwatch with a brown leather strap' },
  { slug: 'appareil-photo',  subject: 'a black vintage 35mm film camera' },
  { slug: 'jean',            subject: 'a pair of folded indigo jeans' },
  { slug: 'casquette',       subject: 'a navy blue baseball cap' },
  { slug: 'guitare',         subject: 'an electric guitar, body and neck, seen from the front' },
  { slug: 'livres',          subject: 'a small stack of five hardcover books' },
]

const prompt = subject => [
  `Product photo of ${subject}, centered, alone.`,
  'Plain warm cream-beige background (#F0E8DC), edge to edge, no vignette.',
  'Soft diffused studio lighting, gentle contact shadow beneath the object.',
  'No props, no text, no watermark, no hands, no background objects.',
  'Minimal 3D product render style, matte materials, muted natural colours.',
  'Square 1:1 composition, subject filling about 70% of the frame.',
].join(' ')

const exists = async p => access(p).then(() => true, () => false)

async function generate(product) {
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt(product.subject) }] }],
  })

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }
    )

    if (res.ok) {
      const json = await res.json()
      const parts = json?.candidates?.[0]?.content?.parts ?? []
      const part = parts.find(p => p.inlineData || p.inline_data)
      const inline = part?.inlineData ?? part?.inline_data
      if (!inline?.data) throw new Error('réponse sans image')
      return Buffer.from(inline.data, 'base64')
    }

    const detail = await res.text().catch(() => '')
    if (attempt === MAX_ATTEMPTS) {
      throw new Error(`HTTP ${res.status} — ${detail.slice(0, 200)}`)
    }
    // Backoff progressif, comme dans la fonction edge.
    await new Promise(r => setTimeout(r, attempt * 1500))
  }
}

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY manquante. Récupère-la dans les secrets Supabase du projet, puis :')
    console.error('  export GEMINI_API_KEY="…"')
    process.exit(1)
  }

  const args = process.argv.slice(2)
  const force = args.includes('--force')
  const only = args.filter(a => !a.startsWith('--'))
  const queue = only.length ? PRODUCTS.filter(p => only.includes(p.slug)) : PRODUCTS

  if (!queue.length) {
    console.error(`Aucun produit ne correspond. Disponibles : ${PRODUCTS.map(p => p.slug).join(', ')}`)
    process.exit(1)
  }

  await mkdir(OUT_DIR, { recursive: true })

  let created = 0, skipped = 0
  const failed = []

  // En série : le quota image de Gemini se fâche vite en parallèle, et
  // huit images ne justifient pas de compliquer le script.
  for (const product of queue) {
    const out = join(OUT_DIR, `${product.slug}.png`)

    if (!force && await exists(out)) {
      console.log(`⊙  ${product.slug} — déjà présent, ignoré`)
      skipped++
      continue
    }

    try {
      process.stdout.write(`…  ${product.slug} `)
      const bytes = await generate(product)
      await writeFile(out, bytes)
      console.log(`✓ ${(bytes.length / 1024).toFixed(0)} Ko`)
      created++
    } catch (e) {
      console.log(`✗ ${e.message}`)
      failed.push(product.slug)
    }
  }

  console.log(`\n${created} générée(s), ${skipped} ignorée(s), ${failed.length} en échec`)
  if (failed.length) {
    console.log(`Relancer les échecs : node scripts/generate-chain-thumbs.mjs ${failed.join(' ')}`)
    process.exit(1)
  }
  console.log(`Fichiers dans ${OUT_DIR}`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
