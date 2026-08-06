// detect-scene/index.ts
//
// Détection multi-objets sur une photo de scène.
//
// Une image → N objets typés, avec une quantité par type. Distinct de
// chat-turn, qui analyse UN objet : prompt différent, schéma de sortie
// différent, et surtout profil de coût différent — d'où une fonction à
// part, la seule façon de rendre ce coût mesurable.
//
// POST /functions/v1/detect-scene
//   { image: { data: <base64>, media_type: 'image/jpeg' }, model?: string }
//
// Réservé au drapeau `multi_add_audience` (défaut : admin).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Tarifs en dollars par MILLION de tokens, au 2026-08-07.
 *
 * Codés ici et non en base : le coût est calculé à l'écriture, donc un
 * changement de tarif ne réécrit pas l'historique déjà mesuré.
 *
 * NB : Sonnet 5 est à 2 $/10 $ en tarif d'introduction jusqu'au 2026-08-31.
 * On retient le tarif plein — sous-estimer un coût est plus dangereux que
 * le surestimer quand il sert de garde-fou budgétaire.
 */
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5': { input: 1.0, output: 5.0 },
  'claude-sonnet-5': { input: 3.0, output: 15.0 },
  'claude-opus-5': { input: 5.0, output: 25.0 },
}

/** Modèle de production. Les autres ne servent qu'au banc d'essai. */
const DEFAULT_MODEL = 'claude-haiku-4-5'

const SYSTEM_PROMPT = `Tu inventories une photo de rangement pour une application d'inventaire personnel.
Tu listes les objets présents et tu comptes leurs exemplaires.

REGROUPEMENT
Un "type" regroupe les objets de MÊME RÉFÉRENCE — pas seulement les objets
pixel pour pixel identiques. Vingt-cinq figurines de la même escouade, peintes
de la même façon, sont un seul type même si leurs poses diffèrent.
La "variante" est ce qui distingue deux objets AU SEIN d'un même type :
couleur, finition, taille. Deux pulvérisateurs de même modèle, l'un rose et
l'autre turquoise, sont un type "pulvérisateur" avec deux variantes.

Renvoie TOUJOURS la granularité la plus fine que tu perçois : une entrée par
couple (type, variante). Ne regroupe jamais toi-même deux variantes distinctes
— l'application s'en charge à l'affichage, et elle ne peut pas inventer une
distinction que tu aurais effacée.

COMPTAGE
Compte les exemplaires réellement visibles. Tu as le DROIT de ne pas savoir :
si les objets sont empilés, enchevêtrés ou masqués au point qu'un humain ne
pourrait pas les compter en regardant la photo, mets quantity_certain à false
et donne ta meilleure estimation. Un chiffre inventé qui a l'air fiable est
pire qu'un chiffre annoncé comme incertain.

Si une partie de la scène n'est pas dénombrable du tout — un nœud de câbles,
un amas de tissu —, décris-la dans "uncountable" au lieu d'inventer des
entrées. Exemple : "amas de câbles noirs enchevêtrés, non dénombrable".

NE COMPTE JAMAIS un nombre imprimé sur un emballage. Un coffret DVD portant
la mention "3 DVD" sur sa tranche est UN objet, pas trois. La quantité se lit
sur les objets présents, jamais sur ce qui est écrit dessus.

TITRES
Le titre est TOUJOURS au singulier et ne contient jamais de nombre.
"Chaise de salle à manger beige", jamais "Lot de 6 chaises". La quantité vit
dans son champ ; un titre au pluriel fausserait l'estimation de valeur, qui
travaille à partir du titre et rendrait le prix du lot au lieu de l'unité.

SCÈNE HÉTÉROGÈNE
Si la photo est un fouillis d'objets disparates dont peu sont identifiables
(tiroir à bazar, boîte de câbles), ne produis pas vingt entrées inutiles :
mets scene_type à "container", propose un titre de contenant dans
container_title (ex. "Tiroir chargeurs et adaptateurs") et liste ce que tu
identifies dans container_contents. Renseigne quand même "objects" avec ce
que tu reconnais clairement — l'utilisateur tranchera.

DÉCOUPAGE
bbox = [x, y, largeur, hauteur] normalisés entre 0 et 1, pour découper une
vignette de l'objet. Ne renseigne une bbox QUE si l'objet est nettement
délimité et occupe au moins 5 % de l'image. Sinon renvoie un tableau vide :
un découpage flou et mal cadré est pire que la photo entière.

ORIENTATION
La photo peut être tournée, voire tête-bêche. Lis le texte dans son sens réel
et ne laisse pas l'orientation te faire manquer des objets.

Réponds en français.`

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })

  const startedAt = Date.now()

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return err(401, 'AUTH_MISSING')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) return err(401, 'AUTH_INVALID')

    // ── Drapeau d'accès ────────────────────────────────────────────────
    // La logique est rejouée ici plutôt qu'appelée via get_feature_flags() :
    // cette fonction agit en service_role, auth.uid() y est nul.
    const [{ data: settings }, { data: profile }] = await Promise.all([
      supabase.from('app_settings').select('multi_add_audience').eq('id', 1).single(),
      supabase.from('profiles').select('plan, is_admin').eq('id', user.id).single(),
    ])

    const audience = settings?.multi_add_audience ?? 'admin'
    const isAdmin = Boolean(profile?.is_admin)
    const plan = profile?.plan ?? 'free'
    const allowed =
      audience === 'all' ? true :
      audience === 'premium' ? isAdmin || plan === 'premium' || plan === 'pro' :
      audience === 'pro' ? isAdmin || plan === 'pro' :
      isAdmin
    if (!allowed) return err(403, 'FEATURE_NOT_AVAILABLE')

    const body = await req.json().catch(() => null)
    const image = body?.image
    if (!image?.data || typeof image.data !== 'string') return err(400, 'MISSING_IMAGE')

    const model = typeof body?.model === 'string' && PRICING[body.model]
      ? body.model
      : DEFAULT_MODEL

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      console.error('[detect-scene] ANTHROPIC_API_KEY manquante')
      return err(500, 'AI_NOT_CONFIGURED')
    }

    // ── Appel du modèle ────────────────────────────────────────────────
    // Sortie structurée : le schéma est garanti par l'API, il n'y a pas de
    // texte libre à parser ni de réponse à moitié valide à rattraper.
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: 8000,
        system: SYSTEM_PROMPT,
        output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: image.media_type ?? 'image/jpeg',
                data: image.data,
              },
            },
            { type: 'text', text: 'Inventorie cette scène.' },
          ],
        }],
      }),
    })

    if (!anthropicRes.ok) {
      const detail = await anthropicRes.text()
      console.error('[detect-scene] Anthropic', anthropicRes.status, detail)
      return err(502, 'AI_CALL_FAILED')
    }

    const payload = await anthropicRes.json()

    // Les classificateurs peuvent décliner : content est alors vide.
    if (payload.stop_reason === 'refusal') return err(422, 'AI_REFUSED')

    const textBlock = (payload.content ?? []).find((b: { type: string }) => b.type === 'text')
    if (!textBlock?.text) return err(502, 'AI_EMPTY_RESPONSE')

    let result: Record<string, unknown>
    try {
      result = JSON.parse(textBlock.text)
    } catch {
      console.error('[detect-scene] JSON invalide', textBlock.text.slice(0, 500))
      return err(502, 'AI_BAD_JSON')
    }

    // Sortie tronquée : la liste d'objets est incomplète, on le dit plutôt
    // que de laisser croire à un inventaire exhaustif.
    const truncated = payload.stop_reason === 'max_tokens'

    // ── Coût réel ──────────────────────────────────────────────────────
    const usage = payload.usage ?? {}
    const inputTokens = usage.input_tokens ?? 0
    const outputTokens = usage.output_tokens ?? 0
    const price = PRICING[model]
    const costUsd =
      (inputTokens / 1_000_000) * price.input +
      (outputTokens / 1_000_000) * price.output

    // Jamais bloquant : une écriture de télémétrie ne doit pas faire
    // échouer une analyse que l'utilisateur a déjà payée en tokens.
    supabase.from('ai_usage').insert({
      user_id: user.id,
      feature: 'detect_scene',
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
      cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
      cost_usd: costUsd,
      duration_ms: Date.now() - startedAt,
      meta: {
        object_count: Array.isArray(result.objects) ? result.objects.length : 0,
        scene_type: result.scene_type ?? null,
        truncated,
        image_bytes: Math.round((image.data.length * 3) / 4),
      },
    }).then(({ error }) => {
      if (error) console.error('[detect-scene] ai_usage', error.message)
    })

    return new Response(JSON.stringify({
      ...result,
      truncated,
      _meta: {
        model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: Number(costUsd.toFixed(6)),
        duration_ms: Date.now() - startedAt,
      },
    }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })

  } catch (e) {
    console.error('[detect-scene]', e)
    return err(500, 'INTERNAL_ERROR')
  }
})

function err(status: number, code: string) {
  return new Response(JSON.stringify({ error: { code } }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

/**
 * Schéma de sortie.
 *
 * Aucun champ nullable : les unions de types passent mal en sortie
 * structurée. Une absence se dit par une chaîne vide ou un tableau vide,
 * ce qui laisse un seul cas à traiter côté client.
 */
const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['scene_type', 'container_title', 'container_contents', 'uncountable', 'objects'],
  properties: {
    scene_type: {
      type: 'string',
      enum: ['objects', 'container'],
      description: '"container" si la scène est un fouillis hétérogène peu identifiable.',
    },
    container_title: {
      type: 'string',
      description: 'Titre de la fiche contenant si scene_type vaut "container", sinon chaîne vide.',
    },
    container_contents: {
      type: 'string',
      description: 'Contenu identifié du contenant, en une phrase. Chaîne vide sinon.',
    },
    uncountable: {
      type: 'string',
      description: "Ce qui n'est pas dénombrable dans la scène. Chaîne vide s'il n'y a rien.",
    },
    objects: {
      type: 'array',
      description: 'Une entrée par couple (type, variante).',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['type', 'variant', 'title', 'category', 'quantity', 'quantity_certain', 'discernable', 'confidence', 'bbox'],
        properties: {
          type: {
            type: 'string',
            description: 'Clé de regroupement, en minuscules. Ex. "chaise", "pulvérisateur".',
          },
          variant: {
            type: 'string',
            description: 'Ce qui distingue cet objet des autres du même type. Chaîne vide si aucune.',
          },
          title: {
            type: 'string',
            description: 'Titre de la fiche, TOUJOURS au singulier et sans nombre.',
          },
          category: { type: 'string' },
          quantity: {
            type: 'integer',
            description: "Nombre d'exemplaires visibles de ce couple (type, variante).",
          },
          quantity_certain: {
            type: 'boolean',
            description: 'false si empilement, enchevêtrement ou masquage empêchent un comptage fiable.',
          },
          discernable: {
            type: 'boolean',
            description: 'true si les exemplaires sont distinguables les uns des autres sur cette photo.',
          },
          confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
          bbox: {
            type: 'array',
            description: '[x, y, largeur, hauteur] normalisés 0-1. Tableau vide si le découpage serait illisible.',
            items: { type: 'number' },
          },
        },
      },
    },
  },
} as const
