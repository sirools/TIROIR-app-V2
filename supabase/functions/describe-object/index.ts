// ================================================================
// describe-object/index.ts
// Rédige la description d'une fiche à partir de ce qu'elle contient déjà :
// ses photos, son titre, ses caractéristiques.
//
// POST /functions/v1/describe-object
//   { object_id: string, locale?: 'fr' | 'en' | 'es' | 'de' }
//
// Deux règles portent tout le reste :
//
//   1. On ne décrit QUE ce qui se voit ou ce qui est déjà écrit. Une
//      description inventée contaminerait l'estimation de valeur, qui
//      travaille à partir d'elle, et se retrouverait dans une annonce de
//      revente ou une déclaration d'assurance.
//
//   2. Les images générées sont écartées. Décrire un objet d'après une
//      illustration de synthèse reviendrait à blanchir l'invention en
//      texte — et plus rien, ensuite, ne dirait que ce n'est pas l'objet.
//
// Même quota que les autres analyses : c'est une analyse d'images.
// ================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CLAUDE_MODEL = 'claude-haiku-4-5'

/** Tarifs en dollars par MILLION de tokens, au 2026-08-07. */
const PRICING = { input: 1.0, output: 5.0 }

/** Trois photos suffisent : la quatrième coûte des tokens sans rien
 *  apprendre de plus sur un objet déjà vu sous trois angles. */
const MAX_IMAGES = 3

const LANGUAGES: Record<string, string> = {
  fr: 'français',
  en: 'anglais',
  es: 'espagnol',
  de: 'allemand',
}

function systemPrompt(language: string): string {
  return `Tu rédiges la description d'un objet dans un inventaire personnel.

Tu écris en ${language}, en 2 à 4 phrases, au présent, sans titre ni liste ni mise en forme.

CE QUE TU DÉCRIS
Ce que montrent les photos et ce que disent les informations déjà saisies :
matière, couleur, forme, état apparent, usure visible, éléments notables.
Tu peux dire à quoi l'objet sert si c'est évident.

CE QUE TU N'INVENTES JAMAIS
Marque, modèle, référence, année, dimensions, prix, matière incertaine,
provenance. Si une marque n'est pas lisible sur la photo ou déjà saisie dans
la fiche, elle n'existe pas pour toi. Cette description sert à estimer une
valeur et peut se retrouver dans une annonce de revente : un détail inventé
y devient un mensonge.

Un défaut visible se dit. Une fiche d'inventaire qui embellit ne sert à rien
à son propriétaire.

Si les photos sont trop pauvres pour décrire quoi que ce soit, tiens-t'en aux
informations saisies plutôt que de meubler.

Réponds UNIQUEMENT par la description, sans guillemets ni préambule.`
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })

  const startedAt = Date.now()

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')

    if (!apiKey) return err(500, 'AI_NOT_CONFIGURED', 'Clé API non configurée')

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return err(401, 'AUTH_MISSING', 'Token manquant')

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
    const { data: { user }, error: authError } = await admin.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) return err(401, 'AUTH_INVALID', 'Authentification invalide')

    const body = await req.json().catch(() => null)
    const objectId = body?.object_id
    if (typeof objectId !== 'string') return err(400, 'MISSING_PARAMS', 'object_id requis')

    const language = LANGUAGES[String(body?.locale ?? '').slice(0, 2)] ?? LANGUAGES.fr

    // ── L'objet doit être à nous ─────────────────────────────────────
    const { data: obj, error: objError } = await admin
      .from('objects')
      .select('id, title, description, attributes, status, quantity, location_note, purchase_date')
      .eq('id', objectId)
      .eq('user_id', user.id)
      .single()

    if (objError || !obj) return err(404, 'OBJECT_NOT_FOUND', 'Objet introuvable')

    // ── Quota (le même que les autres analyses d'images) ─────────────
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    })

    const { data: quotaOk, error: quotaError } = await userClient.rpc('check_and_increment_ai_quota')
    if (quotaError) {
      console.error('[describe-object] quota', quotaError.message)
      return err(500, 'INTERNAL_ERROR', 'Impossible de vérifier le quota')
    }
    if (quotaOk === false) return err(429, 'QUOTA_EXCEEDED', 'Quota d’analyses IA du mois atteint')

    const refund = () => userClient.rpc('refund_ai_quota')

    // ── Photos : les vraies uniquement ───────────────────────────────
    const { data: images } = await admin
      .from('object_images')
      .select('storage_path, mime_type, is_cover, position, is_illustration')
      .eq('object_id', objectId)
      .eq('user_id', user.id)
      .eq('is_illustration', false)
      .order('is_cover', { ascending: false })
      .order('position', { ascending: true })
      .limit(MAX_IMAGES)

    const content: Record<string, unknown>[] = []

    for (const img of images ?? []) {
      const { data: file } = await admin.storage.from('object-images').download(img.storage_path)
      if (!file) continue
      const bytes = new Uint8Array(await file.arrayBuffer())
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: img.mime_type || 'image/jpeg',
          data: base64Encode(bytes),
        },
      })
    }

    // ── Ce que la fiche sait déjà ────────────────────────────────────
    const attrs = (obj.attributes ?? {}) as Record<string, unknown>
    const known: string[] = [`Titre : ${obj.title}`]
    for (const [key, value] of Object.entries(attrs)) {
      const text = String(value ?? '').trim()
      if (text) known.push(`${key} : ${text}`)
    }
    if (obj.quantity > 1) known.push(`Quantité : ${obj.quantity} exemplaires`)
    if (obj.location_note) known.push(`Emplacement : ${obj.location_note}`)
    if (obj.purchase_date) known.push(`Date d'achat : ${obj.purchase_date}`)

    const hasPhotos = content.length > 0
    content.push({
      type: 'text',
      text: `Informations saisies dans la fiche :\n${known.join('\n')}\n\n${
        hasPhotos
          ? `Rédige la description de cet objet à partir des ${content.length - 1} photo(s) ci-dessus et de ces informations.`
          : `Aucune photo exploitable n'est disponible : rédige la description à partir de ces seules informations, sans rien y ajouter.`
      }`,
    })

    // ── Appel du modèle ──────────────────────────────────────────────
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 600,
        system: systemPrompt(language),
        messages: [{ role: 'user', content }],
      }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error('[describe-object] Anthropic', res.status, detail.slice(0, 300))
      await refund()
      return err(502, 'AI_CALL_FAILED', 'La rédaction a échoué, réessaie')
    }

    const payload = await res.json()
    if (payload.stop_reason === 'refusal') {
      await refund()
      return err(422, 'AI_REFUSED', 'Le modèle n’a pas pu décrire cet objet')
    }

    const description = (payload.content ?? [])
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { text: string }) => b.text)
      .join('\n')
      .trim()

    if (!description) {
      await refund()
      return err(502, 'AI_EMPTY_RESPONSE', 'La rédaction a échoué, réessaie')
    }

    const { error: updError } = await admin
      .from('objects')
      .update({ description })
      .eq('id', objectId)
      .eq('user_id', user.id)

    if (updError) {
      console.error('[describe-object] update', updError.message)
      return err(500, 'INTERNAL_ERROR', 'Impossible d’enregistrer la description')
    }

    const usage = payload.usage ?? {}
    const inputTokens = usage.input_tokens ?? 0
    const outputTokens = usage.output_tokens ?? 0

    admin.from('ai_usage').insert({
      user_id: user.id,
      feature: 'describe_object',
      model: CLAUDE_MODEL,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
      cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
      cost_usd: (inputTokens / 1_000_000) * PRICING.input + (outputTokens / 1_000_000) * PRICING.output,
      duration_ms: Date.now() - startedAt,
      meta: { object_id: objectId, images: content.length - 1, rewrite: Boolean(obj.description) },
    }).then(({ error }) => {
      if (error) console.error('[describe-object] ai_usage', error.message)
    })

    return new Response(JSON.stringify({
      description,
      images_used: content.length - 1,
      duration_ms: Date.now() - startedAt,
    }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })

  } catch (e) {
    console.error('[describe-object]', e)
    return err(500, 'INTERNAL_ERROR', 'Erreur interne')
  }
})

function err(status: number, code: string, message: string) {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

/** Par morceaux : String.fromCharCode(...tableau) explose la pile au-delà
 *  d'une centaine de milliers d'arguments. */
function base64Encode(bytes: Uint8Array): string {
  const CHUNK = 8192
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}
