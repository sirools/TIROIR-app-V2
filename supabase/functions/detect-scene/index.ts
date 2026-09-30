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
import { PRICING, costUsd, logAiUsage, quotaUnits } from '../_shared/aiUsage.ts'
import { refundAi, refusal, spendAi } from '../_shared/aiSpend.ts'

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}


/** Modèle par défaut, et repli si un plan inconnu apparaissait. */
const DEFAULT_MODEL = 'claude-haiku-4-5'

/**
 * Le modèle suit le plan.
 *
 * C'est le seul levier qui compte sur cette fonctionnalité : à travail
 * identique, la facture varie d'un facteur 17 entre Haiku et Opus. Ouvrir
 * la détection de scène à tout le monde ne coûte rien tant que le gratuit
 * reste sur Haiku — 0,74 c la scène, soit 7 c pour un quota mensuel
 * entier.
 */
const MODEL_BY_PLAN: Record<string, string> = {
  free: 'claude-haiku-4-5',
  premium: 'claude-sonnet-5',
  pro: 'claude-opus-5',
}

/** Types acceptés par le bucket object-images et par scene_analyses. */
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']

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
      supabase.from('profiles').select('plan, is_admin, pro_expires_at').eq('id', user.id).single(),
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

    // ── Le modèle est une conséquence du plan, pas un choix ────────────
    // L'écart Haiku/Opus est de 1 à 17 en coût. Laisser le client le
    // désigner reviendrait à laisser l'utilisateur fixer sa facture — et
    // il choisirait toujours le plus cher, sans savoir ce que ça change.
    //
    // Un forfait 'pro' périmé retombe en gratuit : sans ça, il garderait
    // Opus avec un quota de compte gratuit.
    const effective = plan === 'pro' && profile?.pro_expires_at
      && profile.pro_expires_at < new Date().toISOString().slice(0, 10)
      ? 'free'
      : plan

    const planModel = MODEL_BY_PLAN[effective] ?? DEFAULT_MODEL

    // Seul un admin peut imposer un modèle : c'est le banc d'essai, il
    // doit rester pilotable pour comparer les sorties.
    const model = isAdmin && typeof body?.model === 'string' && PRICING[body.model]
      ? body.model
      : planModel

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      console.error('[detect-scene] ANTHROPIC_API_KEY manquante')
      return err(500, 'AI_NOT_CONFIGURED')
    }

    // ── Quota, pondéré par le modèle ───────────────────────────────────
    // Une scène en Opus coûte dix-sept fois une scène en Haiku : la
    // décompter pour une seule analyse laisserait la porte ouverte à une
    // facture que personne n'a décidée. Prélevé AVANT l'appel — sinon
    // rien n'empêche d'enchaîner les tentatives — et rendu si le modèle
    // ne produit rien.
    const units = quotaUnits('detect_scene', model)
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
    )

    // Le quota du mois d'abord, puis les crédits achetés (_shared/aiSpend.ts).
    const { spend, error: spendError } = await spendAi(userClient, 'detect_scene', units)
    if (spendError || !spend) {
      console.error('[detect-scene] quota', spendError)
      return err(500, 'INTERNAL_ERROR')
    }
    if (!spend.ok) {
      const r = refusal(spend)
      return err(r.status, r.code,
        `${r.message} Une scène en ${model.includes('opus') ? 'Opus' : model.includes('sonnet') ? 'Sonnet' : 'Haiku'} en consomme ${units}.`)
    }

    // Rendu avec la clé service : le compte ne se rembourse jamais lui-même.
    const refund = () => refundAi({ service: supabase, user: userClient }, spend)

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
      await refund()
      return err(502, 'AI_CALL_FAILED')
    }

    const payload = await anthropicRes.json()

    // Les classificateurs peuvent décliner : content est alors vide.
    if (payload.stop_reason === 'refusal') { await refund(); return err(422, 'AI_REFUSED') }

    const textBlock = (payload.content ?? []).find((b: { type: string }) => b.type === 'text')
    if (!textBlock?.text) { await refund(); return err(502, 'AI_EMPTY_RESPONSE') }

    let result: Record<string, unknown>
    try {
      result = JSON.parse(textBlock.text)
    } catch {
      console.error('[detect-scene] JSON invalide', textBlock.text.slice(0, 500))
      await refund()
      return err(502, 'AI_BAD_JSON')
    }

    // Sortie tronquée : la liste d'objets est incomplète, on le dit plutôt
    // que de laisser croire à un inventaire exhaustif.
    const truncated = payload.stop_reason === 'max_tokens'

    // ── Coût réel ──────────────────────────────────────────────────────
    const usage = payload.usage ?? {}
    const inputTokens = usage.input_tokens ?? 0
    const outputTokens = usage.output_tokens ?? 0
    const cost = costUsd(model, usage)

    // ── Persistance de la scène ────────────────────────────────────────
    // La photo et le résultat sont écrits ICI, pas au moment où l'utilisateur
    // valide le lot. Deux raisons :
    //
    //   1. l'analyse abandonnée est justement celle qu'il faut rattraper —
    //      un placard photographié puis une interruption ne doivent pas
    //      coûter une seconde analyse ;
    //   2. la fonction agit en service_role et tient déjà les octets : le
    //      client n'uploade rien, et aucune policy Storage n'est à assouplir.
    //
    // L'écriture est faite au mieux : une analyse payée en tokens ne doit
    // pas être perdue parce que le stockage a hoqueté. La photo peut manquer
    // (storage_path NULL), les fiches se créeront alors sans image.
    const sceneId = crypto.randomUUID()
    const sceneMime = ALLOWED_MIME.includes(image.media_type) ? image.media_type : 'image/jpeg'
    const sceneExt = sceneMime === 'image/png' ? 'png' : sceneMime === 'image/webp' ? 'webp' : 'jpg'

    let scenePath: string | null = null
    try {
      const binary = atob(image.data)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)

      const path = `${user.id}/scenes/${sceneId}.${sceneExt}`
      const { error: upErr } = await supabase.storage
        .from('object-images')
        .upload(path, bytes, { contentType: sceneMime, upsert: false })
      if (upErr) throw new Error(upErr.message)
      scenePath = path
    } catch (e) {
      console.error('[detect-scene] storage', e instanceof Error ? e.message : e)
    }

    const objects = Array.isArray(result.objects) ? result.objects : []

    const { error: sceneErr } = await supabase.from('scene_analyses').insert({
      id: sceneId,
      user_id: user.id,
      storage_path: scenePath,
      mime_type: sceneMime,
      model,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: cost,
      duration_ms: Date.now() - startedAt,
      result,
      object_count: objects.length,
      truncated,
    })
    if (sceneErr) console.error('[detect-scene] scene_analyses', sceneErr.message)

    logAiUsage(supabase, {
      userId: user.id,
      feature: 'detect_scene',
      model,
      usage,
      durationMs: Date.now() - startedAt,
      meta: {
        object_count: objects.length,
        scene_type: result.scene_type ?? null,
        truncated,
        image_bytes: Math.round((image.data.length * 3) / 4),
        quota_units: units,
        // Rattache le coût à la scène : sans cela, impossible de savoir a
        // posteriori ce qu'une analyse abandonnée a coûté.
        scene_id: sceneErr ? null : sceneId,
      },
    })

    return new Response(JSON.stringify({
      ...result,
      truncated,
      // scene_id NULL si la ligne n'a pas pu être écrite : le client créera
      // alors les fiches sans photo plutôt que d'échouer sur une scène
      // que la RPC ne trouverait pas.
      scene_id: sceneErr ? null : sceneId,
      scene_storage_path: sceneErr ? null : scenePath,
      _meta: {
        model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: Number(cost.toFixed(6)),
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

function err(status: number, code: string, message?: string) {
  return new Response(JSON.stringify({ error: { code, message } }), {
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
