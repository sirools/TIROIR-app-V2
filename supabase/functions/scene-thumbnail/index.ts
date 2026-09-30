// ================================================================
// scene-thumbnail/index.ts
// Vignette travaillée d'un objet détecté dans une scène.
//
// Deux modes, dans cet ordre d'intérêt :
//
//   cutout   — l'objet est détouré depuis SA découpe et posé sur fond
//              blanc. C'est encore la photo du propriétaire : on nettoie,
//              on n'invente pas.
//   generate — la photo ne donne rien d'exploitable (pas de boîte, objet
//              masqué). On produit une illustration à partir de la
//              description. Ce n'est plus son objet, et la fiche devra le
//              dire — d'où le drapeau is_illustration côté base.
//
// POST /functions/v1/scene-thumbnail
//   { scene_id, index, mode: 'cutout' | 'generate', image?: { data, media_type } }
//
// `image` est la découpe faite sur l'appareil : le serveur n'a pas de
// quoi découper une image, et la redemander au modèle coûterait un aller
// de plus pour un travail déjà fait.
//
// Même quota que la retouche photo : c'est le même modèle, le même coût,
// et rien ne justifierait deux compteurs pour une seule dépense.
// ================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { refundAi, refusal, spendAi } from '../_shared/aiSpend.ts'

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GEMINI_MODEL = 'gemini-2.5-flash-image'

/**
 * Détourage. La consigne insiste sur la fidélité : une vignette qui
 * embellit l'objet ferait mentir l'inventaire, et sur une revente
 * l'acheteur découvrirait autre chose que ce qu'il a vu.
 */
const CUTOUT_PROMPT = `Isole l'objet principal de cette image et place-le seul sur un fond blanc uni (#FFFFFF), centré, avec une marge régulière autour de lui.

Garde EXACTEMENT sa forme, ses couleurs, ses matières, son usure et ses détails : ne l'embellis pas, ne le répare pas, ne le repeins pas, n'ajoute aucun élément. Supprime uniquement l'arrière-plan et les objets voisins.

N'invente aucun texte, logo ni marque. Si l'objet principal est ambigu, garde le sujet le plus au centre.`

/**
 * Génération. Le prompt dit explicitement « illustration » : le modèle
 * ne doit pas chercher à imiter une photo prise par quelqu'un, et le
 * résultat ne doit pas pouvoir passer pour une pièce d'inventaire.
 */
function generatePrompt(o: Record<string, unknown>): string {
  const parts = [
    String(o.title ?? '').trim(),
    String(o.variant ?? '').trim(),
    String(o.category ?? '').trim(),
  ].filter(Boolean)

  return `Illustration de catalogue représentant : ${parts.join(' — ')}.

Objet seul, centré sur fond blanc uni (#FFFFFF), éclairage studio neutre, rendu sobre et réaliste. Aucun texte, aucun logo, aucune marque, aucune personne, aucun décor.

C'est une illustration générique destinée à représenter une catégorie d'objet, pas la photographie d'un exemplaire précis.`
}

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp']

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY')

    if (!geminiApiKey) return err(500, 'AI_NOT_CONFIGURED', 'Clé API image non configurée')

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return err(401, 'AUTH_MISSING', 'Token manquant')

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
    const { data: { user }, error: authError } = await admin.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) return err(401, 'AUTH_INVALID', 'Authentification invalide')

    const body = await req.json().catch(() => null)
    const sceneId = body?.scene_id
    const index = body?.index
    const mode = body?.mode

    if (typeof sceneId !== 'string' || !Number.isInteger(index) || index < 0) {
      return err(400, 'MISSING_PARAMS', 'scene_id et index requis')
    }
    if (mode !== 'cutout' && mode !== 'generate') {
      return err(400, 'MISSING_PARAMS', 'mode doit valoir cutout ou generate')
    }

    // ── La scène doit être à nous, l'objet doit exister ──────────────
    const { data: scene, error: sceneError } = await admin
      .from('scene_analyses')
      .select('id, user_id, result, thumbnails')
      .eq('id', sceneId)
      .eq('user_id', user.id)
      .single()

    if (sceneError || !scene) return err(404, 'SCENE_NOT_FOUND', 'Analyse introuvable')

    const objects = (scene.result?.objects ?? []) as Record<string, unknown>[]
    const object = objects[index]
    if (!object) return err(404, 'OBJECT_NOT_FOUND', 'Objet introuvable dans cette analyse')

    // ── Quota (partagé avec la retouche photo) ───────────────────────
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    })

    // Quota du mois (Premium) d'abord, puis crédits achetés : un compte
    // gratuit peut désormais payer une image en crédits (_shared/aiSpend.ts).
    const { spend, error: spendError } = await spendAi(userClient, 'scene_thumbnail')
    if (spendError || !spend) {
      console.error('[scene-thumbnail] quota error', spendError)
      return err(500, 'INTERNAL_ERROR', 'Impossible de vérifier le quota')
    }
    if (!spend.ok) { const r = refusal(spend); return err(r.status, r.code, r.message) }

    // ── Requête Gemini ───────────────────────────────────────────────
    const parts: Record<string, unknown>[] = []

    if (mode === 'cutout') {
      const image = body?.image
      if (!image?.data || typeof image.data !== 'string') {
        return err(400, 'MISSING_IMAGE', 'La découpe est requise pour un détourage')
      }
      const mime = ALLOWED_MIME.includes(image.media_type) ? image.media_type : 'image/jpeg'
      parts.push({ text: CUTOUT_PROMPT })
      parts.push({ inline_data: { mime_type: mime, data: image.data } })
    } else {
      parts.push({ text: generatePrompt(object) })
    }

    const startedAt = Date.now()
    let geminiJson: Record<string, any> | null = null
    let lastDetail = ''
    const MAX_ATTEMPTS = 3

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts }] }),
        },
      )

      if (res.ok) { geminiJson = await res.json(); break }

      lastDetail = `${res.status} ${(await res.text().catch(() => '')).slice(0, 300)}`
      console.error(`[scene-thumbnail] Gemini (${attempt}/${MAX_ATTEMPTS})`, lastDetail)
      if (attempt < MAX_ATTEMPTS) await new Promise(r => setTimeout(r, attempt * 1500))
    }

    // Le jeton a été prélevé avant l'appel — il le fallait, sinon rien
    // n'empêche d'enchaîner les tentatives. Mais une panne du fournisseur
    // ne doit pas être facturée à l'utilisateur.
    // Rendu avec la clé service : le compte ne se rembourse jamais lui-même.
    const refund = () => refundAi({ service: admin, user: userClient }, spend)

    if (!geminiJson) {
      await refund()
      return err(502, 'GENERATION_FAILED', 'La génération a échoué, réessaie')
    }

    const outParts = geminiJson?.candidates?.[0]?.content?.parts ?? []
    const imagePart = outParts.find((p: any) => p.inlineData || p.inline_data)
    const inline = imagePart?.inlineData ?? imagePart?.inline_data

    if (!inline?.data) {
      console.error('[scene-thumbnail] pas d’image dans la réponse')
      await refund()
      return err(502, 'GENERATION_FAILED', 'La génération a échoué, réessaie')
    }

    const outMime: string = inline.mimeType ?? inline.mime_type ?? 'image/png'
    const outExt = outMime.split('/')[1]?.replace('jpeg', 'jpg') ?? 'png'
    const bytes = base64Decode(inline.data)

    // ── Rangée avec la scène ─────────────────────────────────────────
    // L'image est payée : la garder avec l'analyse évite de la refaire
    // quand l'utilisateur revient dessus par l'historique.
    const path = `${user.id}/scenes/${sceneId}/${index}-${mode}-${Date.now()}.${outExt}`
    const { error: upErr } = await admin.storage
      .from('object-images')
      .upload(path, bytes, { contentType: outMime, upsert: false })

    if (upErr) {
      console.error('[scene-thumbnail] upload', upErr.message)
      await refund()
      return err(500, 'INTERNAL_ERROR', 'Impossible d’enregistrer la vignette')
    }

    const previous = (scene.thumbnails ?? {}) as Record<string, { path?: string }>
    const stale = previous[String(index)]?.path

    const { error: updErr } = await admin
      .from('scene_analyses')
      .update({
        thumbnails: { ...previous, [String(index)]: { path, kind: mode, mime: outMime } },
      })
      .eq('id', sceneId)
      .eq('user_id', user.id)

    if (updErr) console.error('[scene-thumbnail] scene_analyses', updErr.message)

    // Refaire une vignette remplace la précédente : la laisser derrière
    // ferait grossir le bucket d'images que plus personne n'affiche.
    if (stale && stale !== path) {
      await admin.storage.from('object-images').remove([stale])
    }

    // Coût réel, comme pour la détection : une image générée coûte plus
    // cher que l'analyse qui l'a fait naître, on ne pilote pas ça au forfait.
    const usage = geminiJson?.usageMetadata ?? {}
    const inputTokens = usage.promptTokenCount ?? 0
    const outputTokens = usage.candidatesTokenCount ?? 0

    admin.from('ai_usage').insert({
      user_id: user.id,
      feature: 'scene_thumbnail',
      model: GEMINI_MODEL,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: (inputTokens / 1_000_000) * 0.30 + (outputTokens / 1_000_000) * 30.0,
      duration_ms: Date.now() - startedAt,
      meta: { scene_id: sceneId, index, kind: mode },
    }).then(({ error }) => {
      if (error) console.error('[scene-thumbnail] ai_usage', error.message)
    })

    const { data: signed } = await admin.storage
      .from('object-images')
      .createSignedUrl(path, 3600)

    return new Response(JSON.stringify({
      index,
      kind: mode,
      storage_path: path,
      mime_type: outMime,
      url: signed?.signedUrl ?? null,
      duration_ms: Date.now() - startedAt,
    }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })

  } catch (e) {
    console.error('[scene-thumbnail]', e)
    return err(500, 'INTERNAL_ERROR', 'Erreur interne')
  }
})

function err(status: number, code: string, message: string) {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

function base64Decode(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}
