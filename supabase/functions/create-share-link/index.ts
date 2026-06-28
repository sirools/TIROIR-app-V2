import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })

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

    const body = await req.json().catch(() => null)
    const { object_ids, title, options = {} } = body ?? {}
    if (!Array.isArray(object_ids) || object_ids.length === 0) return err(400, 'MISSING_OBJECT_IDS')

    // Hash du mot de passe si fourni
    let passwordHash: string | null = null
    if (options.password_protected && typeof options.password === 'string' && options.password.length >= 4) {
      const encoded = new TextEncoder().encode(options.password)
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
      passwordHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')
    }

    // Vérifier que tous les objets appartiennent à l'utilisateur
    const { data: objects, error: objError } = await supabase
      .from('objects')
      .select('id')
      .in('id', object_ids)
      .eq('user_id', user.id)

    if (objError || !objects || objects.length !== object_ids.length) {
      return err(403, 'FORBIDDEN_OBJECTS')
    }

    // Générer un token court unique (8 chars)
    const token = Array.from(crypto.getRandomValues(new Uint8Array(5)))
      .map(b => b.toString(36).padStart(2, '0'))
      .join('')
      .slice(0, 8)

    const expiresAt = options.expires_days
      ? new Date(Date.now() + options.expires_days * 86400_000).toISOString()
      : null

    const { data: link, error: insertError } = await supabase
      .from('share_links')
      .insert({
        user_id: user.id,
        token,
        object_ids,
        title: title ?? null,
        options: {
          password_protected: options.password_protected ?? false,
          password_hash: passwordHash,
          allow_download: options.allow_download ?? false,
          include_documents: options.include_documents ?? false,
          show_memories: options.show_memories ?? false,
        },
        expires_at: expiresAt,
      })
      .select('token')
      .single()

    if (insertError || !link) return err(500, 'INSERT_FAILED')

    return new Response(JSON.stringify({
      token: link.token,
      url: `https://tiroir.app/s/${link.token}`,
    }), {
      status: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })

  } catch (e) {
    return err(500, 'INTERNAL_ERROR')
  }
})

function err(status: number, code: string) {
  return new Response(JSON.stringify({ error: { code } }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}
