// ================================================================
// enhance-object-photo/index.ts
// Retouche IA d'une photo d'objet via Gemini 2.5 Flash Image :
// défroissage, recadrage, éclairage/contraste, fond studio.
// Réservé aux comptes premium, plafonné via
// check_and_increment_photo_enhance_quota() (app_settings).
//
// POST /functions/v1/enhance-object-photo
// Body : { object_id: string, image_id: string }
// Auth : JWT utilisateur
// ================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { logAiUsage } from '../_shared/aiUsage.ts'

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GEMINI_MODEL = 'gemini-2.5-flash-image'
const ENHANCE_PROMPT = `Transforme cette photo d'objet en photo produit professionnelle : améliore la netteté et les couleurs, corrige l'éclairage et le contraste, défroisse et repasse virtuellement le tissu si c'est un vêtement, recadre et centre l'objet au milieu de l'image. Remplace l'arrière-plan par un fond dégradé doux et uni dans une teinte qui s'accorde avec les couleurs de l'objet. Ajoute une légère ombre portée douce sous l'objet pour donner du volume. Éclairage studio propre et homogène. Garde la forme, les couleurs et les détails exacts de l'objet (ne change pas sa structure, ses motifs, son style) ; n'invente aucun texte, logo ou marque qui ne serait pas clairement lisible dans la photo d'origine.`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const startedAt = Date.now()
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')

    if (!geminiApiKey) return err(500, 'INTERNAL_ERROR', 'Clé API IA non configurée')

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return err(401, 'AUTH_MISSING', 'Token manquant')

    const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

    const { data: { user }, error: authError } = await adminClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) return err(401, 'AUTH_INVALID', 'Authentification invalide')

    // Client scopé utilisateur, nécessaire pour que auth.uid() résolve
    // correctement dans le RPC SECURITY DEFINER de quota.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    })

    const body = await req.json().catch(() => null)
    const objectId = body?.object_id
    const imageId = body?.image_id
    if (typeof objectId !== 'string' || typeof imageId !== 'string') {
      return err(400, 'MISSING_PARAMS', 'object_id et image_id requis')
    }

    // ── Vérifier propriété de l'objet + récupérer l'image source ──
    const { data: image, error: imageError } = await adminClient
      .from('object_images')
      .select('id, object_id, user_id, storage_path, mime_type, position')
      .eq('id', imageId)
      .eq('object_id', objectId)
      .eq('user_id', user.id)
      .single()

    if (imageError || !image) return err(404, 'IMAGE_NOT_FOUND', 'Photo introuvable ou accès refusé')

    // ── Quota (réservé premium, plafonné) ──────────────────────────
    const { data: quotaResult, error: quotaError } = await userClient.rpc(
      'check_and_increment_photo_enhance_quota'
    )
    if (quotaError) {
      console.error('[enhance-object-photo] quota error', quotaError.message)
      return err(500, 'INTERNAL_ERROR', 'Impossible de vérifier le quota')
    }
    if (quotaResult === 'NOT_PREMIUM') {
      return err(403, 'PREMIUM_REQUIRED', 'Cette fonctionnalité est réservée aux abonnés Premium')
    }
    if (quotaResult === 'QUOTA_EXCEEDED') {
      return err(429, 'QUOTA_EXCEEDED', 'Quota de retouches IA du mois atteint')
    }

    // ── Téléchargement de la photo source ──────────────────────────
    const { data: fileData, error: downloadError } = await adminClient.storage
      .from('object-images')
      .download(image.storage_path)

    if (downloadError || !fileData) {
      console.error('[enhance-object-photo] download error', downloadError?.message)
      return err(500, 'INTERNAL_ERROR', 'Impossible de récupérer la photo source')
    }

    const sourceMime = image.mime_type || 'image/jpeg'
    const arrayBuffer = await fileData.arrayBuffer()
    const sourceB64 = base64Encode(new Uint8Array(arrayBuffer))

    // ── Appel Gemini 2.5 Flash Image (avec retry : l'API renvoie ────
    // parfois des 500/503 transitoires qui passent au 2e/3e essai) ──
    const geminiBody = JSON.stringify({
      contents: [{
        parts: [
          { text: ENHANCE_PROMPT },
          { inline_data: { mime_type: sourceMime, data: sourceB64 } },
        ],
      }],
    })

    let geminiJson: any = null
    const MAX_ATTEMPTS = 3
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiApiKey}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: geminiBody }
      )

      if (geminiResponse.ok) {
        geminiJson = await geminiResponse.json()
        break
      }

      const errText = await geminiResponse.text().catch(() => '')
      console.error(`[enhance-object-photo] Gemini error (attempt ${attempt}/${MAX_ATTEMPTS})`, geminiResponse.status, errText)

      if (attempt < MAX_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, attempt * 1500))
      }
    }

    // Le jeton a été prélevé avant l'appel : une panne du fournisseur ne
    // doit pas être facturée à l'utilisateur.
    const refund = () => userClient.rpc('refund_photo_enhance_quota')

    if (!geminiJson) {
      await refund()
      return err(502, 'GENERATION_FAILED', "L'amélioration a échoué, réessaie plus tard")
    }

    const parts = geminiJson?.candidates?.[0]?.content?.parts ?? []
    const imagePart = parts.find((p: any) => p.inlineData || p.inline_data)
    const inline = imagePart?.inlineData ?? imagePart?.inline_data

    if (!inline?.data) {
      console.error('[enhance-object-photo] no image part in Gemini response')
      await refund()
      return err(502, 'GENERATION_FAILED', "L'amélioration a échoué, réessaie plus tard")
    }

    const outputMime: string = inline.mimeType ?? inline.mime_type ?? 'image/png'
    const outputExt = outputMime.split('/')[1]?.replace('jpeg', 'jpg') ?? 'png'
    const outputBytes = base64Decode(inline.data)

    // ── Upload du résultat + insertion en base ──────────────────────
    const newStoragePath = `${user.id}/${objectId}/${Date.now()}-enhanced.${outputExt}`
    const { error: uploadError } = await adminClient.storage
      .from('object-images')
      .upload(newStoragePath, outputBytes, { contentType: outputMime })

    if (uploadError) {
      console.error('[enhance-object-photo] upload error', uploadError.message)
      await refund()
      return err(500, 'INTERNAL_ERROR', "Impossible d'enregistrer la photo améliorée")
    }

    const { count } = await adminClient
      .from('object_images')
      .select('id', { count: 'exact', head: true })
      .eq('object_id', objectId)

    const { data: newImage, error: insertError } = await adminClient
      .from('object_images')
      .insert({
        object_id: objectId,
        user_id: user.id,
        storage_path: newStoragePath,
        mime_type: outputMime,
        size_bytes: outputBytes.byteLength,
        position: count ?? 0,
        is_cover: false,
      })
      .select()
      .single()

    if (insertError || !newImage) {
      console.error('[enhance-object-photo] insert error', insertError?.message)
      return err(500, 'INTERNAL_ERROR', "Impossible d'enregistrer la photo améliorée")
    }

    // La retouche était comptée au forfait déclaré dans app_settings
    // (3,9 c). C'est le bon ordre de grandeur, mais un forfait ne bouge pas
    // quand le tarif du modèle bouge : on mesure.
    const usage = geminiJson?.usageMetadata ?? {}
    logAiUsage(adminClient, {
      userId: user.id,
      feature: 'photo_enhance',
      model: GEMINI_MODEL,
      usage: {
        input_tokens: usage.promptTokenCount ?? 0,
        output_tokens: usage.candidatesTokenCount ?? 0,
      },
      durationMs: Date.now() - startedAt,
      meta: { object_id: objectId, source_image_id: imageId, bytes: outputBytes.byteLength },
    })

    const { data: signed } = await adminClient.storage
      .from('object-images')
      .createSignedUrl(newStoragePath, 3600)

    return new Response(JSON.stringify({
      image: newImage,
      url: signed?.signedUrl ?? null,
    }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })

  } catch (e) {
    console.error('[enhance-object-photo] unhandled error', e)
    return err(500, 'INTERNAL_ERROR', 'Erreur interne')
  }
})

function err(status: number, code: string, message: string) {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

// Encodage/décodage base64 par chunks pour éviter les limites de pile
// sur les gros buffers (String.fromCharCode(...array) plante au-delà
// de ~100k éléments passés en arguments).
function base64Encode(bytes: Uint8Array): string {
  const CHUNK_SIZE = 8192
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE))
  }
  return btoa(binary)
}

function base64Decode(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}
