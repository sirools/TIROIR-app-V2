// resend-webhook/index.ts
//
// Reçoit les événements Resend : remise, ouverture, clic, rebond,
// plainte. C'est la seule source possible pour ces informations — un
// e-mail parti ne dit rien de lui-même une fois dans la nature.
//
//   POST /functions/v1/resend-webhook
//
// À déclarer dans le tableau de bord Resend, section Webhooks, avec les
// événements email.delivered / opened / clicked / bounced / complained.
//
// ── Ce que valent réellement ces signaux ──────────────────────────
//
// La REMISE est un fait serveur : le message est arrivé.
//
// L'OUVERTURE est une inférence, reposant sur le chargement d'un pixel.
// Apple Mail Privacy Protection précharge les images de tout le monde et
// déclenche donc des ouvertures qui n'ont pas eu lieu ; à l'inverse, un
// client qui bloque les images n'en déclenche aucune pour une lecture
// bien réelle. Le chiffre est un ordre de grandeur, jamais une mesure.
//
// Le CLIC est le seul signal d'intérêt qui ne mente pas.
//
// La PLAINTE est le plus coûteux : elle abîme la réputation du domaine
// pour tous les envois suivants, y compris transactionnels.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const EVENEMENTS = new Set([
  'email.delivered', 'email.opened', 'email.clicked',
  'email.bounced', 'email.complained',
])

/**
 * Vérification de signature Svix, que Resend utilise.
 *
 * Sans elle, l'URL du webhook est publique : n'importe qui pourrait
 * inventer des ouvertures et des clics, et les chiffres de l'admin ne
 * vaudraient plus rien. Implémentée à la main plutôt qu'avec la
 * bibliothèque : trois lignes de crypto standard contre une dépendance
 * de plus dans une fonction edge.
 *
 * La comparaison est à temps constant. Un `===` sur des signatures fuit
 * leur contenu par le temps de réponse — attaque théorique ici, mais le
 * coût de bien faire est nul.
 */
async function signatureValide(
  secret: string, id: string, timestamp: string, corps: string, entete: string,
): Promise<boolean> {
  // Le secret est fourni sous la forme whsec_<base64>.
  const brut = Uint8Array.from(
    atob(secret.replace(/^whsec_/, '')), c => c.charCodeAt(0),
  )
  const cle = await crypto.subtle.importKey(
    'raw', brut, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const signe = await crypto.subtle.sign(
    'HMAC', cle, new TextEncoder().encode(`${id}.${timestamp}.${corps}`),
  )
  const attendue = btoa(String.fromCharCode(...new Uint8Array(signe)))

  // L'en-tête peut porter plusieurs signatures (rotation de secret) :
  // « v1,<sig> v1,<sig> ».
  return entete.split(' ').some(part => {
    const sig = part.split(',')[1] ?? ''
    if (sig.length !== attendue.length) return false
    let diff = 0
    for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ attendue.charCodeAt(i)
    return diff === 0
  })
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const secret = Deno.env.get('RESEND_WEBHOOK_SECRET')
  if (!secret) {
    console.error('RESEND_WEBHOOK_SECRET manquante')
    return new Response(JSON.stringify({ error: 'non configure' }), { status: 500 })
  }

  const corps = await req.text()
  const id = req.headers.get('svix-id') ?? ''
  const ts = req.headers.get('svix-timestamp') ?? ''
  const sig = req.headers.get('svix-signature') ?? ''

  if (!id || !ts || !sig || !(await signatureValide(secret, id, ts, corps, sig))) {
    return new Response(JSON.stringify({ error: 'signature invalide' }), { status: 401 })
  }

  // Rejeu : au-delà de cinq minutes, on refuse. Une requête interceptée
  // puis rejouée plus tard ne doit pas pouvoir gonfler les compteurs.
  const age = Math.abs(Date.now() / 1000 - Number(ts))
  if (!Number.isFinite(age) || age > 300) {
    return new Response(JSON.stringify({ error: 'horodatage hors fenetre' }), { status: 401 })
  }

  let evenement: { type?: string; created_at?: string; data?: { email_id?: string } }
  try {
    evenement = JSON.parse(corps)
  } catch {
    return new Response(JSON.stringify({ error: 'corps illisible' }), { status: 400 })
  }

  const type = evenement.type ?? ''
  const emailId = evenement.data?.email_id ?? ''

  // Toujours 200 sur un événement qu'on ne traite pas : un 4xx pousse
  // Resend à rejouer indéfiniment quelque chose qu'on ignore volontiers.
  if (!EVENEMENTS.has(type) || !emailId) {
    return new Response(JSON.stringify({ ignore: type }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data, error } = await supabase.rpc('record_email_event', {
    p_provider_id: emailId,
    p_type: type,
    p_at: evenement.created_at ?? new Date().toISOString(),
  })

  if (error) {
    console.error('record_email_event', error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  // `false` signifie que l'identifiant Resend n'est rattaché à aucun
  // envoi connu — un e-mail transactionnel, par exemple. Ce n'est pas une
  // erreur, et répondre 200 évite un rejeu inutile.
  return new Response(JSON.stringify({ type, rattache: data === true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
