#!/usr/bin/env npx ts-node
/**
 * Génère des images IA (Replicate/Flux) pour les objets de la collection
 * "Prépa tournage juillet" et les uploade dans Supabase Storage.
 *
 * Usage:
 *   REPLICATE_KEY=r8_xxx npx ts-node scripts/patch-images-tournage.ts
 */

import { createClient } from '@supabase/supabase-js'
import https from 'https'
import ws from 'ws'

const REPLICATE_API_TOKEN = process.env.REPLICATE_KEY ?? ''
const SUPABASE_URL = 'https://jsduaelevpwflvwhhhvx.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? ''
const USER_ID = 'd521a8bc-9613-4f6b-9870-b052b7fd47b5'

if (!REPLICATE_API_TOKEN) { console.error('❌ REPLICATE_KEY manquant'); process.exit(1) }
if (!SUPABASE_SERVICE_KEY) { console.error('❌ SUPABASE_SERVICE_KEY manquant'); process.exit(1) }

const OBJECTS: { id: string; title: string; prompt: string }[] = [
  {
    id: '3bd18913-6ed1-4c85-9299-3941d36e88a3',
    title: 'Sony FX3 Cinema Line',
    prompt: 'Sony FX3 cinema camera, professional video camera, isolated on white background, product photography, studio lighting, sharp focus',
  },
  {
    id: '4af75823-0977-4965-a7c8-e4dfecd79056',
    title: 'Sony FE 24-70mm f/2.8 GM II',
    prompt: 'Sony 24-70mm camera lens, professional zoom lens isolated on white background, product photography, studio lighting, high resolution',
  },
  {
    id: '2ce5997a-09b6-4103-9fb9-e1e4d021b849',
    title: 'Sony FE 85mm f/1.4 GM',
    prompt: 'Sony 85mm portrait lens, professional prime lens isolated on white background, product photography, studio lighting, sharp focus',
  },
  {
    id: 'd9f44e8a-16fd-432c-868e-c89d91f181cd',
    title: 'Aputure 300X LED',
    prompt: 'Aputure 300X LED video light, professional film lighting equipment, isolated on white background, product photography, studio',
  },
  {
    id: '49dd20e2-34e2-4d89-91f3-b35beeffa52b',
    title: 'Godox SL150W II',
    prompt: 'Godox LED panel video light, professional continuous lighting, isolated on white background, product photography, studio lighting',
  },
  {
    id: '1a7c68fb-d8f2-4286-b00c-17357752c6ea',
    title: 'DJI Ronin RS3 Pro',
    prompt: 'DJI Ronin gimbal stabilizer, 3-axis camera stabilizer, isolated on white background, product photography, studio lighting, sharp',
  },
  {
    id: '02530c5e-e3f2-4452-9368-541d89db2a62',
    title: 'Canon EOS R5',
    prompt: 'Canon EOS R5 mirrorless camera, professional hybrid camera isolated on white background, product photography, studio lighting',
  },
  {
    id: '76b7b584-e2e0-4e65-92fb-754ff5dcc8ea',
    title: 'Rode NTG5',
    prompt: 'Rode NTG5 shotgun microphone, professional film microphone isolated on white background, product photography, studio lighting',
  },
  {
    id: 'e1b91d7b-2dac-4fa1-a6e2-533544de7ebe',
    title: 'Atomos Shogun 7',
    prompt: 'Atomos Shogun monitor recorder, 7 inch video field monitor isolated on white background, product photography, studio lighting',
  },
  {
    id: '09f8635e-3949-48e3-b0b8-bb933cf474fd',
    title: 'Manfrotto 504X',
    prompt: 'Manfrotto video tripod with fluid head, professional carbon fiber tripod isolated on white background, product photography',
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function replicateFlux(prompt: string): Promise<string | null> {
  const body = JSON.stringify({
    input: { prompt, aspect_ratio: '1:1', output_format: 'jpg', output_quality: 90 },
  })

  const predictionId = await new Promise<string | null>((resolve) => {
    const req = https.request(
      {
        hostname: 'api.replicate.com',
        path: '/v1/models/black-forest-labs/flux-schnell/predictions',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      res => {
        let raw = ''
        res.on('data', (c: Buffer) => raw += c)
        res.on('end', () => {
          try { resolve(JSON.parse(raw).id ?? null) } catch { resolve(null) }
        })
      }
    )
    req.on('error', () => resolve(null))
    req.write(body)
    req.end()
  })

  if (!predictionId) { console.log('    ⚠ Pas de prediction ID'); return null }

  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 3000))
    const result = await new Promise<any>((resolve) => {
      https.get(
        {
          hostname: 'api.replicate.com',
          path: `/v1/predictions/${predictionId}`,
          headers: { Authorization: `Bearer ${REPLICATE_API_TOKEN}` },
        },
        res => {
          let raw = ''
          res.on('data', (c: Buffer) => raw += c)
          res.on('end', () => { try { resolve(JSON.parse(raw)) } catch { resolve(null) } })
        }
      ).on('error', () => resolve(null))
    })
    if (!result) break
    if (result.status === 'succeeded') {
      const output = result.output
      return Array.isArray(output) ? output[0] : (output ?? null)
    }
    if (result.status === 'failed' || result.status === 'canceled') {
      console.log(`    ⚠ Replicate status: ${result.status}`)
      break
    }
    process.stdout.write('.')
  }
  return null
}

async function downloadBuffer(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks)))
    }).on('error', reject)
  })
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
    realtime: { transport: ws },
  })

  console.log(`🎬 Génération d'images pour ${OBJECTS.length} objets...\n`)

  for (const obj of OBJECTS) {
    console.log(`📷 ${obj.title}`)

    // Générer avec Flux
    console.log('    → Génération Flux...')
    const imageUrl = await replicateFlux(obj.prompt)
    if (!imageUrl) {
      console.log('    ❌ Génération échouée, on passe\n')
      continue
    }
    console.log(`    ✓ Image générée`)

    // Télécharger
    const buffer = await downloadBuffer(imageUrl)
    const storagePath = `${USER_ID}/${obj.id}/ai-generated-0.jpg`

    // Upload Supabase Storage
    const { error: upErr } = await supabase.storage
      .from('object-images')
      .upload(storagePath, buffer, { contentType: 'image/jpeg', upsert: true })

    if (upErr) {
      console.log(`    ❌ Upload échoué: ${upErr.message}\n`)
      continue
    }
    console.log(`    ✓ Upload OK → ${storagePath}`)

    // Supprime une éventuelle image existante à cette position, puis insère
    await supabase.from('object_images').delete().eq('object_id', obj.id).eq('position', 0)
    const { error: dbErr } = await supabase.from('object_images').insert({
      object_id: obj.id,
      user_id: USER_ID,
      storage_path: storagePath,
      mime_type: 'image/jpeg',
      position: 0,
      is_cover: true,
    })

    if (dbErr) {
      console.log(`    ❌ DB insert échoué: ${dbErr.message}\n`)
    } else {
      console.log(`    ✓ object_images mis à jour\n`)
    }

    // Rate limit : 12s entre chaque appel Replicate
    if (obj !== OBJECTS[OBJECTS.length - 1]) {
      console.log('    ⏳ Pause 12s (rate limit)...')
      await new Promise(r => setTimeout(r, 12000))
    }
  }

  console.log('✅ Terminé !')
}

main().catch(console.error)
