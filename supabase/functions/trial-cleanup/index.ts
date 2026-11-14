// ================================================================
// trial-cleanup/index.ts
// Supprime les essais sans compte échus : la photo d'abord (bucket privé
// trial-images, par l'API de stockage), la ligne ensuite. Un essai dont
// la photo n'a pas pu être supprimée garde sa ligne : il sera repris au
// passage suivant, rien ne reste orphelin.
//
//   POST /functions/v1/trial-cleanup
//   en-tête : x-cron-secret: <secret du Vault>
//
// Appelée toutes les heures par pg_cron (supabase/drafts/essai_sans_compte.sql).
// Même authentification que send-lifecycle-emails : le secret vit dans le
// Vault et se compare en base.
// ================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const BUCKET = 'trial-images'

Deno.serve(async (req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  const { data: allowed, error: secretError } =
    await supabase.rpc('cron_secret_matches', { p_secret: req.headers.get('x-cron-secret') ?? '' })
  if (secretError || allowed !== true) return json(401, { error: 'unauthorized' })

  const { data: expired, error } = await supabase.rpc('trial_expired', { p_limit: 500 })
  if (error) {
    console.error('[trial-cleanup] lecture', error.message)
    return json(500, { error: 'read_failed' })
  }

  const rows = (expired ?? []) as { id: string; photo_path: string | null }[]
  const paths = rows.map(r => r.photo_path).filter((p): p is string => Boolean(p))

  // Une photo déjà absente n'est pas une erreur : remove() l'ignore.
  let photoFailure = false
  for (let i = 0; i < paths.length; i += 100) {
    const { error: removeError } = await supabase.storage.from(BUCKET).remove(paths.slice(i, i + 100))
    if (removeError) {
      console.error('[trial-cleanup] photos', removeError.message)
      photoFailure = true
    }
  }

  // Si une suppression de photo a échoué, seules les lignes sans photo partent.
  const ids = rows.filter(r => !photoFailure || !r.photo_path).map(r => r.id)
  let deleted = 0
  if (ids.length) {
    const { error: deleteError, count } = await supabase
      .from('trial_objects').delete({ count: 'exact' }).in('id', ids)
    if (deleteError) {
      console.error('[trial-cleanup] lignes', deleteError.message)
      return json(500, { error: 'delete_failed' })
    }
    deleted = count ?? ids.length
  }

  console.log('[trial-cleanup]', JSON.stringify({ expired: rows.length, photos: paths.length, deleted, photoFailure }))
  return json(200, { expired: rows.length, deleted })
})

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}
