import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function err(status: number, code: string, message?: string): Response {
  return new Response(JSON.stringify({ ok: false, code, message }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

function ok(body: Record<string, unknown> = {}): Response {
  return new Response(JSON.stringify({ ok: true, ...body }), {
    status: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })
  if (req.method !== 'POST') return err(405, 'METHOD_NOT_ALLOWED')

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey     = Deno.env.get('SUPABASE_ANON_KEY')!

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return err(401, 'AUTH_MISSING')

  // Vérifier l'identité via le token utilisateur (jamais faire confiance au body)
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  })
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) return err(401, 'AUTH_INVALID')

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  console.log(`[delete-account] Début suppression pour user ${user.id}`)

  // 1. Supprimer les fichiers Storage (object-images)
  const { data: storageFiles } = await adminClient.storage
    .from('object-images')
    .list(user.id, { limit: 1000 })

  if (storageFiles && storageFiles.length > 0) {
    // Récupérer récursivement tous les fichiers sous user.id/
    const { data: allObjects } = await adminClient
      .from('object_images')
      .select('storage_path')
      .eq('user_id', user.id)

    const { data: draftImages } = await adminClient
      .from('ai_draft_images')
      .select('storage_path')
      .eq('user_id', user.id)

    const paths = [
      ...(allObjects ?? []).map((r: { storage_path: string }) => r.storage_path),
      ...(draftImages ?? []).map((r: { storage_path: string }) => r.storage_path),
    ]

    // Photos de profil : toutes celles du dossier, pas seulement la
    // courante, au cas où un remplacement aurait laissé l'ancienne.
    const { data: avatarFiles } = await adminClient.storage
      .from('object-images')
      .list(`${user.id}/avatar`, { limit: 100 })
    paths.push(...(avatarFiles ?? []).map((f: { name: string }) => `${user.id}/avatar/${f.name}`))

    if (paths.length > 0) {
      await adminClient.storage.from('object-images').remove(paths)
    }
  }

  // 2. Supprimer les données dans l'ordre (FK oblige)
  await adminClient.from('share_links').delete().eq('user_id', user.id)
  await adminClient.from('object_images').delete().eq('user_id', user.id)
  await adminClient.from('ai_draft_images').delete().eq('user_id', user.id)
  await adminClient.from('ai_drafts').delete().eq('user_id', user.id)
  await adminClient.from('objects').delete().eq('user_id', user.id)
  await adminClient.from('collections').delete().eq('user_id', user.id)
  await adminClient.from('drawers').delete().eq('user_id', user.id)
  await adminClient.from('profiles').delete().eq('id', user.id)

  // 3. Supprimer le compte Auth (irréversible)
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id)
  if (deleteError) {
    console.error(`[delete-account] Erreur suppression Auth: ${deleteError.message}`)
    return err(500, 'DELETE_FAILED', deleteError.message)
  }

  console.log(`[delete-account] Compte supprimé avec succès: ${user.id}`)
  return ok({ message: 'Compte supprimé' })
})
