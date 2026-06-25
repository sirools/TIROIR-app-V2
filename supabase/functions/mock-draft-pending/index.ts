// Edge Function : mock-draft-pending
// Remplace temporairement chat-turn pour les tests MVP.
// Passe un draft de 'uploading' à 'pending' avec des proposed_data fournis.
// À retirer ou remplacer quand chat-turn est déployé.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Authentifier l'appelant
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization manquante' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Client avec service_role pour bypasser RLS sur ai_drafts
    const adminClient = createClient(supabaseUrl, serviceKey)

    // Client anon pour vérifier l'identité de l'appelant
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Non authentifié' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { draft_id, proposed_data } = await req.json()
    if (!draft_id || !proposed_data) {
      return new Response(JSON.stringify({ error: 'draft_id et proposed_data requis' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Vérifier que le draft appartient à l'utilisateur et est en statut uploading
    const { data: draft, error: draftError } = await adminClient
      .from('ai_drafts')
      .select('id, status, user_id')
      .eq('id', draft_id)
      .eq('user_id', user.id)
      .single()

    if (draftError || !draft) {
      return new Response(JSON.stringify({ error: 'Draft introuvable' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (draft.status !== 'uploading') {
      return new Response(
        JSON.stringify({ error: `Draft déjà en statut '${draft.status}'` }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Passer en pending avec les données proposées
    const { error: updateError } = await adminClient
      .from('ai_drafts')
      .update({ status: 'pending', proposed_data, updated_at: new Date().toISOString() })
      .eq('id', draft_id)
      .eq('user_id', user.id)

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true, draft_id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
