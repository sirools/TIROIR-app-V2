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
    const { object_ids, title, options = {}, contact = {} } = body ?? {}
    if (!Array.isArray(object_ids) || object_ids.length === 0) return err(400, 'MISSING_OBJECT_IDS')

    const contactName = typeof contact?.name === 'string' ? contact.name.trim().slice(0, 200) : ''
    const contactEmail = typeof contact?.email === 'string' ? contact.email.trim().slice(0, 320) : ''
    const contactPhone = typeof contact?.phone === 'string' ? contact.phone.trim().slice(0, 40) : ''
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)

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
          // Blocs d'informations exposés par le partage. Absent = tout est
          // visible : les liens créés avant cette option ne changent pas.
          fields: {
            values: options.fields?.values ?? true,
            location: options.fields?.location ?? true,
            attributes: options.fields?.attributes ?? true,
            description: options.fields?.description ?? true,
            insurance: options.fields?.insurance ?? true,
          },
          contact_name: contactName || null,
          contact_email: isValidEmail ? contactEmail : null,
          contact_phone: contactPhone || null,
        },
        expires_at: expiresAt,
      })
      .select('token')
      .single()

    if (insertError || !link) return err(500, 'INSERT_FAILED')

    const shareUrl = `https://tiroir.app/s/${link.token}`
    let emailSent = false
    if (isValidEmail) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .single()
      emailSent = await sendShareEmail({
        to: contactEmail,
        recipientName: contactName,
        senderName: profile?.display_name || 'Un utilisateur Tiroir',
        title: title ?? null,
        objectCount: object_ids.length,
        url: shareUrl,
        passwordProtected: Boolean(passwordHash),
      })
    }

    return new Response(JSON.stringify({
      token: link.token,
      url: shareUrl,
      email_sent: emailSent,
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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function sendShareEmail(params: {
  to: string
  recipientName: string
  senderName: string
  title: string | null
  objectCount: number
  url: string
  passwordProtected: boolean
}): Promise<boolean> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) {
    console.error('RESEND_API_KEY missing — skipping share email send')
    return false
  }

  const { to, recipientName, senderName, title, objectCount, url, passwordProtected } = params
  const safeSender = escapeHtml(senderName)
  const safeRecipient = escapeHtml(recipientName || '')
  const safeTitle = title ? escapeHtml(title) : null
  const greeting = safeRecipient ? `Bonjour ${safeRecipient},` : 'Bonjour,'
  const objectLabel = objectCount > 1 ? `${objectCount} objets` : '1 objet'
  const collectionMention = safeTitle ? ` « ${safeTitle} »` : ''

  const html = `
  <!DOCTYPE html>
  <html lang="fr">
  <body style="margin:0;padding:0;background-color:#F7F3EE;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7F3EE;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#FFFFFF;border-radius:16px;overflow:hidden;max-width:480px;width:100%;">
            <tr>
              <td style="background-color:#2D5016;padding:28px 32px;">
                <span style="color:#FFFFFF;font-size:20px;font-weight:700;letter-spacing:0.5px;">Tiroir</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px;color:#1A1612;font-size:16px;line-height:1.5;">${greeting}</p>
                <p style="margin:0 0 24px;color:#1A1612;font-size:16px;line-height:1.5;">
                  <strong>${safeSender}</strong> vient de partager une liste de ${objectLabel}${collectionMention} avec vous sur Tiroir.
                </p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
                  <tr>
                    <td style="border-radius:10px;background-color:#2D5016;">
                      <a href="${url}" style="display:inline-block;padding:14px 28px;color:#FFFFFF;font-size:15px;font-weight:700;text-decoration:none;letter-spacing:0.3px;">
                        VOIR LES OBJETS PARTAGÉS
                      </a>
                    </td>
                  </tr>
                </table>
                ${passwordProtected
                  ? '<p style="margin:0 0 24px;color:#6B6158;font-size:13px;line-height:1.5;">🔒 Ce lien est protégé par un mot de passe que vous devez avoir reçu séparément.</p>'
                  : ''
                }
                <p style="margin:0;color:#A89F96;font-size:12px;line-height:1.5;">
                  Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br/>
                  <a href="${url}" style="color:#2D5016;word-break:break-all;">${url}</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background-color:#F0EBE3;">
                <p style="margin:0;color:#A89F96;font-size:11px;line-height:1.5;">
                  Tiroir — l'inventaire de vos objets, simplement.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>`

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Tiroir <partage@tiroir.app>',
        to: [to],
        subject: `${senderName} a partagé des objets avec vous sur Tiroir`,
        html,
      }),
    })
    if (!response.ok) {
      console.error('Resend send failed', response.status, await response.text())
      return false
    }
    return true
  } catch (e) {
    console.error('Resend send error', e)
    return false
  }
}
