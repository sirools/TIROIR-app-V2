// send-lifecycle-emails/index.ts
//
// Envoie le message de présentation aux comptes qui atteignent J+3.
//
// Appelée par pg_cron toutes les heures. Ne prend aucun paramètre côté
// destinataires : c'est la base qui décide qui est éligible, réserve les
// lignes et garantit qu'un compte ne peut pas être servi deux fois.
//
//   POST /functions/v1/send-lifecycle-emails
//   en-tête : x-cron-secret: <CRON_SECRET>
//   corps   : { limit?: number, dry_run?: boolean }
//
// Le partage des responsabilités est délibéré : SQL choisit et réserve,
// la fonction rend et expédie. Sélectionner les destinataires ici aurait
// ouvert une fenêtre entre le choix et la réservation, pendant laquelle
// deux exécutions du cron auraient pu servir les mêmes personnes.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { HTML_PRESENTATION } from '../_shared/emailPresentation.ts'

const CAMPAGNE = 'presentation'
const EXPEDITEUR = 'Clément de Tiroir <clement@tiroir.app>'
const SUJET = 'On ne s’est jamais vraiment présentés'
const SITE = 'https://www.tiroir.app'
const COUVERTURE = `${SITE}/emails/couverture-presentation.jpg`

/**
 * La première phrase affirme un fait datable : elle change selon la
 * raison de l'envoi. Une formulation unique obligerait à mentir dans un
 * des deux cas — sur la phrase même où l'on demande qu'on nous fasse
 * confiance.
 */
const OUVERTURE: Record<string, string> = {
  j3: 'Vous avez créé un compte Tiroir il y a trois jours.',
  backfill: 'Vous avez créé un compte Tiroir — il y a un moment déjà.',
}

interface Destinataire {
  user_id: string
  email: string
  display_name: string
  reason: string
  unsubscribe_token: string
}

/**
 * Substitution stricte : toute variable non fournie fait échouer le
 * rendu au lieu de partir telle quelle. Un « {{adresse_postale}} » visible
 * dans la boîte de réception de deux cents personnes ne se rattrape pas.
 */
function rendre(gabarit: string, valeurs: Record<string, string>): string {
  const sortie = gabarit.replace(/\{\{(\w+)\}\}/g, (_, cle: string) => {
    const v = valeurs[cle]
    if (v === undefined) throw new Error(`VARIABLE_MANQUANTE: ${cle}`)
    return v
  })
  const restants = sortie.match(/\{\{\w+\}\}/g)
  if (restants) throw new Error(`VARIABLES_NON_RESOLUES: ${restants.join(', ')}`)
  return sortie
}

/** Version texte, exigée par les filtres anti-spam autant que par les lecteurs. */
function versionTexte(ouverture: string, desinscription: string, adresse: string): string {
  return [
    'ON NE S’EST JAMAIS VRAIMENT PRÉSENTÉS',
    '',
    `${ouverture} C’est le premier message que je vous envoie, et il n’y en aura pas trente : je voulais simplement vous dire à quoi sert cette application.`,
    '',
    'Vous possédez des centaines d’objets. Vous n’en avez la liste nulle part. Ce n’est pas gênant au quotidien — ça le devient le jour d’un cambriolage, d’un dégât des eaux, d’un déménagement, d’une succession.',
    '',
    'Tiroir fabrique cette liste à votre place. Vous photographiez un objet, l’application le reconnaît et rédige sa fiche : titre, description, caractéristiques, valeur estimée. Rien à saisir au clavier. Si la photo montre toute une étagère, Tiroir crée une fiche par objet qu’il y reconnaît.',
    '',
    `Commencer : ${SITE}`,
    '',
    'Tiroir est développé par une seule personne, et je lis tout ce qui arrive dans cette boîte. Répondez à ce message si quelque chose ne va pas.',
    '',
    'Clément, fondateur de Tiroir',
    '',
    '—',
    'Vous recevez ce message parce que vous avez créé un compte sur tiroir.app.',
    'Au plus un message par mois.',
    adresse,
    `Me désinscrire : ${desinscription}`,
  ].join('\n')
}

async function envoyer(params: {
  apiKey: string
  to: string
  html: string
  texte: string
  desinscription: string
}): Promise<{ ok: true; id: string } | { ok: false; erreur: string }> {
  try {
    const reponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EXPEDITEUR,
        to: [params.to],
        subject: SUJET,
        html: params.html,
        text: params.texte,
        // Désinscription en un clic depuis l'interface du client mail.
        // Gmail et Yahoo l'EXIGENT pour tout expéditeur de volume depuis
        // 2024 ; sans elle, la seule sortie offerte au lecteur agacé est
        // le bouton « spam », qui coûte la réputation du domaine.
        headers: {
          'List-Unsubscribe': `<${params.desinscription}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      }),
    })
    if (!reponse.ok) {
      return { ok: false, erreur: `resend ${reponse.status}: ${(await reponse.text()).slice(0, 300)}` }
    }
    const corps = await reponse.json()
    return { ok: true, id: corps?.id ?? '' }
  } catch (e) {
    return { ok: false, erreur: `resend exception: ${(e as Error).message}` }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'RESEND_API_KEY manquante' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Secret partagé plutôt que JWT : l'appelant est pg_cron, pas un
  // utilisateur. Un JWT anonyme est un JWT valide — `verify_jwt` seul
  // laisserait donc n'importe qui déclencher une fonction qui expédie du
  // courrier.
  //
  // Le secret n'est ni dans l'environnement, ni dans la commande du
  // cron : il vit dans le Vault, et la comparaison se fait EN BASE. Ni
  // ce code, ni `cron.job`, ni un journal de déploiement n'en détiennent
  // donc une copie en clair.
  const presente = req.headers.get('x-cron-secret') ?? ''
  const { data: autorise, error: erreurSecret } =
    await supabase.rpc('cron_secret_matches', { p_secret: presente })

  if (erreurSecret || autorise !== true) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    })
  }

  let limite: number | null = null
  let simulation = false
  let cible: string | null = null
  try {
    const corps = await req.json()
    if (typeof corps?.limit === 'number') limite = Math.min(200, Math.max(1, corps.limit))
    simulation = corps?.dry_run === true
    // Un exemplaire vers un compte precis, pour controler le rendu dans
    // un vrai client mail avant d'ouvrir la campagne.
    if (typeof corps?.only_user === 'string') cible = corps.only_user
  } catch { /* corps vide : on prend les réglages de la base */ }

  // L'adresse postale est lue ici uniquement pour le rendu ; c'est la
  // fonction de réservation qui refuse de servir quoi que ce soit
  // lorsqu'elle est vide.
  const { data: reglages } = await supabase
    .from('app_settings').select('email_postal_address').eq('id', 1).single()
  const adressePostale = (reglages?.email_postal_address ?? '').trim()

  // La couverture est vérifiée UNE fois par exécution, pas par
  // destinataire. Un e-mail dont l'image de couverture renvoie une
  // erreur affiche un cadre cassé en tout premier, et ce premier envoi
  // n'a pas de seconde chance.
  const couverture = await fetch(COUVERTURE, { method: 'HEAD' }).catch(() => null)
  if (!couverture?.ok) {
    return new Response(JSON.stringify({
      error: 'COUVERTURE_INDISPONIBLE',
      url: COUVERTURE,
      detail: 'Déposer l’image avant tout envoi : elle est la première chose affichée.',
    }), { status: 503, headers: { 'Content-Type': 'application/json' } })
  }

  const { data: destinataires, error } = await supabase
    .rpc('claim_lifecycle_recipients', {
      p_campaign: CAMPAGNE, p_limit: limite, p_only_user: cible,
    })

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }

  const liste = (destinataires ?? []) as Destinataire[]
  let envoyes = 0
  const echecs: { email: string; erreur: string }[] = []

  for (const d of liste) {
    const desinscription = `${SITE}/desinscription?t=${d.unsubscribe_token}`
    const ouverture = OUVERTURE[d.reason] ?? OUVERTURE.j3

    let html: string
    try {
      html = rendre(HTML_PRESENTATION, {
        ouverture,
        lien_app: SITE,
        adresse_postale: adressePostale,
        lien_preferences: desinscription,
        lien_desinscription: desinscription,
      })
    } catch (e) {
      // Rendu impossible : on rend sa place au destinataire plutôt que
      // de le laisser réservé pour toujours avec un envoi jamais parti.
      await supabase.rpc('mark_lifecycle_send', {
        p_user_id: d.user_id, p_campaign: CAMPAGNE,
        p_status: 'failed', p_error: (e as Error).message,
      })
      echecs.push({ email: d.email, erreur: (e as Error).message })
      continue
    }

    if (simulation) {
      await supabase.rpc('mark_lifecycle_send', {
        p_user_id: d.user_id, p_campaign: CAMPAGNE,
        p_status: 'skipped', p_error: 'dry_run',
      })
      continue
    }

    const resultat = await envoyer({
      apiKey, to: d.email, html,
      texte: versionTexte(ouverture, desinscription, adressePostale),
      desinscription,
    })

    await supabase.rpc('mark_lifecycle_send', {
      p_user_id: d.user_id,
      p_campaign: CAMPAGNE,
      p_status: resultat.ok ? 'sent' : 'failed',
      p_provider_id: resultat.ok ? resultat.id : null,
      p_error: resultat.ok ? null : resultat.erreur,
    })

    if (resultat.ok) envoyes++
    else echecs.push({ email: d.email, erreur: resultat.erreur })
  }

  return new Response(JSON.stringify({
    campagne: CAMPAGNE,
    reserves: liste.length,
    envoyes,
    echecs,
    simulation,
  }), { headers: { 'Content-Type': 'application/json' } })
})
