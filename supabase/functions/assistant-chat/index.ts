// ================================================================
// assistant-chat/index.ts
// Assistant conversationnel Tiroir (MVP texte) : recherche dans
// l'inventaire réel de l'utilisateur (search_objects) puis formule
// une réponse via Claude, à partir des résultats trouvés uniquement.
//
// POST /functions/v1/assistant-chat
// Body : { message: string, history?: { role: 'user'|'assistant', content: string }[] }
// Auth : JWT utilisateur
// ================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { logAiUsage } from '../_shared/aiUsage.ts'

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages'
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001'
const ANTHROPIC_VERSION = '2023-06-01'
const MAX_HISTORY = 6
const MAX_MESSAGE_LEN = 500

const SYSTEM_PROMPT = `Tu es l'assistant de Tiroir, une application d'inventaire personnel. L'utilisateur te pose des questions sur SES objets (où ils sont rangés, combien il en a, leur statut, etc.).

La liste d'objets fournie dans le message vient d'une recherche textuelle ET floue (tolérante aux variations de formulation, couleur, matière) — ce ne sont pas forcément des correspondances exactes.

Règles :
- Réponds UNIQUEMENT à partir des objets listés dans le message (issus de l'inventaire réel). N'invente jamais un objet qui n'y figure pas.
- Si un objet correspond clairement à la demande, réponds directement (emplacement, statut...).
- Si RIEN ne correspond exactement mais qu'un ou plusieurs objets de la liste s'en rapprochent (même catégorie, couleur proche, matière similaire), propose-les explicitement comme suggestions : nomme l'objet, explique brièvement en quoi il diffère de la demande, et demande si c'est celui-ci. Fais des recommandations, pas des affirmations catégoriques.
- Ne dis "je n'ai rien trouvé" que si la liste est vraiment vide ou que rien ne s'en approche même vaguement.
- Sois concis, direct, chaleureux, comme un bon vendeur qui connaît le stock par cœur. Pas de blabla, pas de formules creuses.
- Réponds toujours en français.
- Tu n'as aucune capacité en dehors de la consultation de l'inventaire de l'utilisateur : pas de météo, pas d'actualités, pas de calculs génériques. Recentre poliment si la question sort de ce cadre.
- L'application affiche automatiquement un lien cliquable vers la fiche de chaque objet que tu mentionnes, sous ta réponse. Ne dis donc jamais que tu ne peux pas donner de lien : contente-toi de nommer l'objet clairement, l'app fait le lien.`

// Mots vides français à retirer avant la recherche, pour éviter qu'une
// question naturelle ("je cherche un manteau, tu l'as ?") ne force un ET
// logique impossible entre "je", "cherche", "tu", "l'as" et le titre réel.
const STOPWORDS = new Set([
  'je', 'tu', 'il', 'elle', 'on', 'nous', 'vous', 'ils', 'elles',
  'le', 'la', 'les', 'l', 'un', 'une', 'des', 'de', 'du', 'au', 'aux',
  'ce', 'cet', 'cette', 'ces', 'mon', 'ma', 'mes', 'ton', 'ta', 'tes',
  'son', 'sa', 'ses', 'notre', 'nos', 'votre', 'vos', 'leur', 'leurs',
  'et', 'ou', 'mais', 'donc', 'or', 'ni', 'car', 'que', 'qui', 'quoi',
  'dont', 'où', 'est', 'es', 'suis', 'sommes', 'êtes', 'sont',
  'ai', 'as', 'a', 'avons', 'avez', 'ont', 'as-tu', 'j', 'moi',
  'cherche', 'cherches', 'cherchons', 'cherchez', 'cherchent',
  'trouve', 'trouves', 'trouvons', 'trouvez', 'trouvent',
  'avoir', 'être', 'pas', 'ne', 'pour', 'dans', 'sur', 'sous',
  'avec', 'sans', 'par', 'vers', 'chez', 'se', 's',
  'sais', 'sait', 'savons', 'savez', 'savent',
  'fais', 'fait', 'faisons', 'faites', 'font',
  'peux', 'peut', 'pouvons', 'pouvez', 'peuvent',
  'veux', 'veut', 'voulons', 'voulez', 'veulent',
  'stp', 'svp', 'merci', 'bonjour', 'salut', 'euh',
  'en', 'y', 'à', 'quelque', 'quelques', 'part', 'vu', 'voir', 'vois',
  'dis', 'dis-moi', 'dit', 'aurais', 'aurait', 'auriez',
])

function extractKeywords(message: string): string {
  const words = message
    .replace(/[?!.,;:'"()\-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOPWORDS.has(w.toLowerCase()))
  return words.length > 0 ? words.join(' ') : message
}

// "status" n'est pas indexé dans search_vector (colonne enum séparée) :
// une question comme "qu'est-ce qui est prêté ?" ne matche jamais en
// plein-texte ou en flou. Détection explicite + filtre direct.
const STATUS_KEYWORDS: Record<string, string> = {
  'prêté': 'loaned', 'prete': 'loaned', 'préte': 'loaned', 'emprunté': 'loaned', 'emprunte': 'loaned',
  'vendu': 'sold', 'vendus': 'sold', 'vente': 'sold',
  'donné': 'given', 'donne': 'given', 'donnés': 'given',
  'perdu': 'lost', 'perdus': 'lost', 'égaré': 'lost', 'egare': 'lost',
  'stocké': 'stored', 'stocke': 'stored', 'rangé': 'stored', 'range': 'stored', 'stockage': 'stored',
  'possédé': 'owned', 'possede': 'owned', 'utilisé': 'owned', 'utilise': 'owned',
}

function detectStatus(message: string): string | null {
  const lower = message.toLowerCase()
  for (const [word, status] of Object.entries(STATUS_KEYWORDS)) {
    if (lower.includes(word)) return status
  }
  return null
}

// Une demande de comptage ("combien de X ai-je") a besoin de voir TOUS
// les objets correspondants, pas juste un échantillon de 8 — sinon le
// dénombrement de Claude peut être faux sans qu'il le sache.
function isCountingQuery(message: string): boolean {
  return /\bcombien\b/i.test(message)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })

  const startedAt = Date.now()

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY')

    if (!anthropicApiKey) return err(500, 'INTERNAL_ERROR', 'Clé API IA non configurée')

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return err(401, 'AUTH_MISSING', 'Token manquant')

    const adminClient = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
    const { data: { user }, error: authError } = await adminClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    )
    if (authError || !user) return err(401, 'AUTH_INVALID', 'Authentification invalide')

    // Client scopé utilisateur : nécessaire pour que search_objects (SECURITY
    // INVOKER, filtré sur auth.uid()) ne renvoie que SES objets, et pour que
    // auth.uid() résolve dans la RPC de quota.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    })

    // Accès ET plafond journalier en un seul appel. L'assistant est encore
    // en développement : il vit derrière le drapeau `assistant_audience`,
    // sur 'admin' par défaut. Le masquage côté client ne suffit pas — l'API
    // doit refuser d'elle-même.
    //
    // Journalier et non mensuel : une conversation est une rafale, un
    // plafond mensuel se viderait en un après-midi.
    const { data: gate, error: gateError } = await userClient.rpc(
      'check_and_increment_assistant_quota',
    )
    if (gateError) {
      console.error('[assistant-chat] quota', gateError.message)
      return err(500, 'INTERNAL_ERROR', 'Impossible de vérifier l’accès')
    }
    if (gate === 'NOT_ALLOWED') {
      return err(403, 'FEATURE_NOT_AVAILABLE', 'Cette fonctionnalité n’est pas encore disponible')
    }
    if (gate === 'QUOTA_EXCEEDED') {
      return err(429, 'QUOTA_EXCEEDED', 'Limite de messages du jour atteinte')
    }

    const body = await req.json().catch(() => null)
    const message = typeof body?.message === 'string' ? body.message.trim().slice(0, MAX_MESSAGE_LEN) : ''
    const history = Array.isArray(body?.history) ? body.history.slice(-MAX_HISTORY) : []

    if (!message) return err(400, 'MISSING_MESSAGE', 'message requis')

    // ── Recherche dans l'inventaire réel de l'utilisateur ──────────
    // Inclut le dernier tour utilisateur pour les relances courtes
    // ("et la bleue ?") qui n'ont pas de sens hors contexte.
    const lastUserTurn = [...history].reverse().find((m: any) => m.role === 'user')?.content ?? ''
    const searchBasis = lastUserTurn && lastUserTurn !== message ? `${lastUserTurn} ${message}` : message
    const keywords = extractKeywords(searchBasis)

    const counting = isCountingQuery(message)
    const resultLimit = counting ? 30 : 8

    const status = detectStatus(message)

    const searchCalls: Promise<any>[] = [
      userClient.rpc('search_objects', { p_query: keywords, p_limit: resultLimit }),
      userClient.rpc('search_objects_fuzzy', { p_query: keywords, p_limit: resultLimit }),
    ]
    if (status) {
      searchCalls.push(
        userClient.from('objects')
          .select('id, title, description, location_note, status, collection_id, attributes')
          .eq('status', status)
          .limit(resultLimit)
      )
    }

    const results = await Promise.all(searchCalls)
    results.forEach((r, i) => {
      if (r.error) console.error(`[assistant-chat] search pass ${i} error`, r.error.message)
    })

    const seen = new Set<string>()
    const matches = results.flatMap(r => r.data ?? []).filter((o: any) => {
      if (seen.has(o.id)) return false
      seen.add(o.id)
      return true
    })

    const countNote = counting
      ? `Nombre total d'objets correspondants trouvés : ${matches.length}. Cite ce chiffre exact si la question porte sur un dénombrement.\n`
      : ''

    const contextText = matches.length > 0
      ? countNote + matches.map((o: any) => {
          const parts = [`Titre: ${o.title}`]
          parts.push(`Emplacement: ${o.location_note?.trim() || 'non renseigné'}`)
          if (o.status) parts.push(`Statut: ${o.status}`)
          return `- ${parts.join(' | ')}`
        }).join('\n')
      : "Aucun objet trouvé (même approximativement) dans l'inventaire pour cette recherche."

    const userTurn = `Objets potentiellement liés trouvés dans l'inventaire (correspondance exacte ou approximative) :\n${contextText}\n\nQuestion de l'utilisateur : ${message}`

    const claudeMessages = [
      ...history
        .filter((m: any) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
        .map((m: any) => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_LEN) })),
      { role: 'user', content: userTurn },
    ]

    const claudeResponse = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': anthropicApiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages: claudeMessages,
      }),
    })

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text().catch(() => '')
      console.error('[assistant-chat] Claude error', claudeResponse.status, errText)
      return err(502, 'ASSISTANT_FAILED', "L'assistant n'a pas pu répondre, réessaie.")
    }

    const claudeJson = await claudeResponse.json()
    const reply = claudeJson?.content?.find((c: any) => c.type === 'text')?.text?.trim()
      ?? "Je n'ai pas pu formuler de réponse, réessaie."

    // Objets référencés dans le contexte fourni à Claude, pour que l'app
    // puisse afficher des liens directs vers leur fiche sous la réponse.
    // Plafonné même si la recherche (comptage) en a récupéré davantage,
    // pour ne pas noyer l'écran de chips.
    const referencedObjects = matches.slice(0, 12).map((o: any) => ({ id: o.id, title: o.title }))

    // Mesuré avant d'être ouvert : c'est tout l'intérêt de le garder
    // derrière un drapeau plutôt que de le retirer.
    logAiUsage(adminClient, {
      userId: user.id,
      feature: 'assistant_chat',
      model: CLAUDE_MODEL,
      usage: claudeJson?.usage ?? {},
      durationMs: Date.now() - startedAt,
      meta: { matches: matches.length, history_turns: history.length },
    })

    return new Response(JSON.stringify({ reply, objects: referencedObjects }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })

  } catch (e) {
    console.error('[assistant-chat] unhandled error', e)
    return err(500, 'INTERNAL_ERROR', 'Erreur interne')
  }
})

function err(status: number, code: string, message: string) {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}
