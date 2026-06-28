/**
 * Ajoute les photos manquantes aux objets existants sans image.
 * Usage: UNSPLASH_KEY=xxx npx ts-node --project scripts/tsconfig.json scripts/patch-missing-photos.ts --email x --password y
 */
import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import https from 'https'

const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_KEY ?? ''
const SUPABASE_URL = 'https://jsduaelevpwflvwhhhvx.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzZHVhZWxldnB3Zmx2d2hoaHZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNDE4MDUsImV4cCI6MjA5NzcxNzgwNX0.uwmOIuO2CHUT_s6mtXbJPkAy5dQWu_b6uCUJm1XQc0U'

// Termes de recherche par titre d'objet
const SEARCH_TERMS: Record<string, string[]> = {
  'Table de chevet Art déco en palissandre': ['art deco bedside table', 'vintage nightstand wood'],
  'Lampe de bureau articulée Jielde': ['industrial desk lamp', 'articulated metal lamp'],
  'Étagère à corniche style Empire': ['antique wall shelf wood', 'empire style shelf'],
  'Pot à tabac en grès de Beauvaisis': ['stoneware pot antique', 'antique pottery jar'],
  'Machine à écrire Hermès 3000': ['Hermes typewriter', 'vintage portable typewriter'],
  'Baromètre amiral en acajou': ['antique barometer wood', 'vintage mercury barometer'],
  'Assiette en faïence de Quimper (lot de 6)': ['Quimper faience plate', 'hand painted ceramic plate'],
  'Cadre baguette en bois doré (75 × 60 cm)': ['antique gold picture frame', 'ornate gilded frame'],
  'Écritoire de voyage en maroquin rouge': ['leather writing case antique', 'vintage travel writing box'],
  'Chaise longue de jardin en teck': ['teak garden lounger', 'wooden deck chair'],
  'Plateau de service en argent plaqué Sheffield': ['silver serving tray antique', 'vintage butler tray'],
  'Carnet de cuir de Harry Mintz Paris': ['leather notebook vintage', 'antique leather journal'],
  'Paire de vases balustre en porcelaine de Chine': ['chinese blue white porcelain vase', 'oriental ceramic vase'],
  'Montre de gousset Longines or 18K': ['gold pocket watch antique', 'vintage pocket watch chain'],
  'Bureau Mazarin en marqueterie Boulle': ['boulle marquetry desk antique', 'louis XIV writing desk'],
  'Paire de chenets en fonte de Tubalcain': ['antique fireplace andirons', 'cast iron fireplace tools'],
}

async function fetchUrl(query: string): Promise<string | null> {
  return new Promise(resolve => {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=3&orientation=squarish&content_filter=high`
    https.get(url, { headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` } }, res => {
      let raw = ''
      res.on('data', (c: Buffer) => raw += c)
      res.on('end', () => {
        try {
          const results = JSON.parse(raw).results ?? []
          if (!results.length) { resolve(null); return }
          resolve(results[Math.floor(Math.random() * results.length)]?.urls?.regular ?? null)
        } catch { resolve(null) }
      })
    }).on('error', () => resolve(null))
  })
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

async function main() {
  const args = process.argv.slice(2)
  const email = args[args.indexOf('--email') + 1]
  const password = args[args.indexOf('--password') + 1]

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { realtime: { transport: ws } }) as any

  const { error: authErr } = await supabase.auth.signInWithPassword({ email, password })
  if (authErr) { console.error('Auth error:', authErr.message); process.exit(1) }
  const { data: { user } } = await supabase.auth.getUser()
  console.log(`✓ Connecté : ${user.email}`)

  // Objets sans image
  const { data: objectsWithImages } = await supabase.from('object_images').select('object_id')
  const coveredIds = new Set((objectsWithImages ?? []).map((r: any) => r.object_id))

  const { data: allObjects } = await supabase.from('objects').select('id, title').eq('user_id', user.id)
  const missing = (allObjects ?? []).filter((o: any) => !coveredIds.has(o.id))

  console.log(`\n${missing.length} objets sans photo à traiter...\n`)
  let done = 0

  for (const obj of missing) {
    const terms = SEARCH_TERMS[obj.title] ?? [obj.title]
    let imgUrl: string | null = null

    for (const term of terms) {
      imgUrl = await fetchUrl(term)
      if (imgUrl) break
    }

    if (!imgUrl) {
      console.log(`  ✗ "${obj.title}" — aucune photo trouvée`)
      continue
    }

    const buffer = await downloadBuffer(imgUrl)
    const storagePath = `${user.id}/${obj.id}/unsplash-0.jpg`

    const { error: upErr } = await supabase.storage.from('object-images').upload(storagePath, buffer, { contentType: 'image/jpeg', upsert: true })
    if (upErr) { console.log(`  ✗ "${obj.title}" upload: ${upErr.message}`); continue }

    await supabase.from('object_images').insert({
      object_id: obj.id, user_id: user.id, storage_path: storagePath,
      mime_type: 'image/jpeg', size_bytes: buffer.length, position: 0, is_cover: true,
    })

    done++
    console.log(`  ✓ (${done}/${missing.length}) "${obj.title}" 📸`)
  }

  console.log(`\n✅ ${done}/${missing.length} photos ajoutées`)
}

main().catch(e => { console.error(e); process.exit(1) })
