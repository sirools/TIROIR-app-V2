// Campagne Ulule, côté serveur : envois par lots et import de l'export.
import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { DEFAULT_SITE_HOST } from './backofficeRouting'
import { CROWDFUNDING } from './crowdfunding'
import { firstNameOf, formatEuros, formatLaunchDate, parseExport, type ExportOrder } from './ulule'
import { renderCampaign, renderPrelaunch, renderThanks, type CampaignKind, type RenderedEmail } from './ululeEmails'
import { fetchUluleAmountCents } from './ululeProgress'

export const EMAIL_KINDS = ['prelaunch', 'launch', 'reminder', 'last48h', 'recap', 'thanks'] as const
export type EmailKind = typeof EMAIL_KINDS[number]
export const isEmailKind = (v: unknown): v is EmailKind => EMAIL_KINDS.includes(v as EmailKind)

const FROM = 'Clément de Tiroir <hello@tiroir.app>'
// Assez court pour tenir dans le délai d'une fonction Vercel : la page
// rappelle la route tant que `done` est faux.
const BATCH_SIZE = 10
const PAUSE_MS = 550

export const publicSite = () => `https://${process.env.SITE_HOST || DEFAULT_SITE_HOST}`
export const personalLink = (slug: string) => `${publicSite()}/u/${slug}`
export const emailHash = (email: string) => createHash('sha256').update(email).digest('hex')

type SendResult = { ok: true; id: string } | { ok: false; error: string; rateLimited: boolean }

export async function sendEmail(params: {
  to: string
  email: RenderedEmail
  headers?: Record<string, string>
  idempotencyKey?: string
  /** Expéditeur affiché ; par défaut celui de la campagne. */
  from?: string
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { ok: false, error: 'RESEND_API_KEY manquante', rateLimited: true }
  try {
    const response = await fetch(`${process.env.RESEND_API_URL || 'https://api.resend.com'}/emails`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(params.idempotencyKey ? { 'Idempotency-Key': params.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: params.from ?? FROM,
        to: [params.to],
        reply_to: 'hello@tiroir.app',
        subject: params.email.subject,
        html: params.email.html,
        text: params.email.text,
        headers: params.headers,
      }),
    })
    if (!response.ok) {
      return {
        ok: false,
        error: `resend ${response.status}: ${(await response.text()).slice(0, 300)}`,
        rateLimited: response.status === 429,
      }
    }
    return { ok: true, id: (await response.json())?.id ?? '' }
  } catch (e) {
    return { ok: false, error: `resend exception: ${(e as Error).message}`, rateLimited: false }
  }
}

type Context = {
  campaign: { launch_at: string; page_url: string; presale_number: string; paid_statuses: string[]; milestones_cents?: number[] }
  adresse: string
  /** Montant lu sur Ulule une fois par lot ; null si Ulule ne répond pas. */
  amountCents: number | null
}

async function campaignContext(db: SupabaseClient, kind?: EmailKind): Promise<Context> {
  const [{ data: campaign, error }, { data: settings }] = await Promise.all([
    db.from('ulule_campaign').select('*').eq('id', 1).single(),
    db.from('app_settings').select('email_postal_address').eq('id', 1).single(),
  ])
  if (error || !campaign) throw new Error(`Campagne illisible : ${error?.message}`)
  const needsAmount = kind === 'reminder' || kind === 'last48h' || kind === 'recap'
  return {
    campaign,
    adresse: (settings?.email_postal_address ?? '').trim() as string,
    amountCents: needsAmount ? await fetchUluleAmountCents(campaign.presale_number, campaign.page_url) : null,
  }
}

const unsubscribeLink = (token: string) => `${publicSite()}/desinscription?t=${token}`
// Gmail et Yahoo exigent la désinscription en un clic.
const oneClick = (url: string) => ({ 'List-Unsubscribe': `<${url}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' })

type Recipient = { name: string; slug: string | null; token: string | null }

/** Le message d'une personne, pour un e-mail donné. */
function messageFor(kind: EmailKind, r: Recipient, ctx: Context): { email: RenderedEmail; headers?: Record<string, string> } {
  if (kind === 'thanks') return { email: renderThanks({ prenom: firstNameOf(r.name) }) }
  if (kind === 'prelaunch') return prelaunchFor({ name: r.name, slug: r.slug!, token: r.token! }, ctx.campaign.launch_at, ctx.adresse)

  const desinscription = r.token ? unsubscribeLink(r.token) : null
  const email = renderCampaign(kind as CampaignKind, {
    prenom: firstNameOf(r.name),
    lien: r.slug ? personalLink(r.slug) : null,
    montant: ctx.amountCents === null ? null : formatEuros(ctx.amountCents),
    // Tout ou rien : la jauge des e-mails se mesure à l'objectif de la collecte.
    objectifAtteint: (ctx.amountCents ?? 0) >= CROWDFUNDING.goalEuros * 100,
    desinscription,
    adresse: ctx.adresse,
  })
  return {
    email,
    headers: desinscription
      ? oneClick(desinscription)
      : { 'List-Unsubscribe': '<mailto:hello@tiroir.app?subject=stop>' },
  }
}

function prelaunchFor(r: { name: string; slug: string; token: string }, launchAt: string, adresse: string) {
  const desinscription = unsubscribeLink(r.token)
  return {
    email: renderPrelaunch({
      prenom: r.name, date: formatLaunchDate(launchAt), lien: personalLink(r.slug), desinscription, adresse,
    }),
    headers: oneClick(desinscription),
  }
}

export async function sendTest(db: SupabaseClient, kind: EmailKind, to: string, prenom: string) {
  const ctx = await campaignContext(db, kind)
  const { email } = messageFor(kind, { name: prenom, slug: 'test', token: 'test' }, ctx)
  return sendEmail({ to, email: { ...email, subject: `[Test] ${email.subject}` } })
}

export type BatchReport = { sent: number; failed: number; done: boolean; stopped: string | null }

export async function sendBatch(db: SupabaseClient, kind: EmailKind): Promise<BatchReport> {
  const ctx = await campaignContext(db, kind)
  const { data: todo, error } = await db.rpc('ulule_next_recipients', { p_kind: kind, p_limit: BATCH_SIZE })
  if (error) throw new Error(error.message)
  const recipients = (todo ?? []) as {
    email: string; name: string; ambassador_id: string | null; slug: string | null; unsubscribe_token: string | null
  }[]

  let sent = 0
  let failed = 0
  for (const r of recipients) {
    // Réserver AVANT d'envoyer : la contrainte d'unicité décide seule.
    const { data: claimed, error: claimError } = await db.from('ulule_emails')
      .upsert({ kind, recipient_email: r.email, ambassador_id: r.ambassador_id },
        { onConflict: 'kind,recipient_email', ignoreDuplicates: true })
      .select('id')
    if (claimError) throw new Error(claimError.message)
    if (!claimed?.length) continue
    const id = claimed[0].id as number

    const message = messageFor(kind, { name: r.name, slug: r.slug, token: r.unsubscribe_token }, ctx)

    const result = await sendEmail({ to: r.email, ...message, idempotencyKey: `ulule-${kind}-${id}` })

    if (result.ok) {
      await db.from('ulule_emails')
        .update({ status: 'sent', provider_id: result.id, sent_at: new Date().toISOString() }).eq('id', id)
      sent++
    } else if (result.rateLimited) {
      // Quota ou clé absente : rien n'est parti, la personne reste à servir.
      await db.from('ulule_emails').delete().eq('id', id)
      return { sent, failed, done: true, stopped: result.error }
    } else {
      await db.from('ulule_emails').update({ status: 'failed', error: result.error }).eq('id', id)
      failed++
    }
    await new Promise(resolve => setTimeout(resolve, PAUSE_MS))
  }
  return { sent, failed, done: recipients.length < BATCH_SIZE, stopped: null }
}

/** Remet les échecs dans la file : ils repartiront au prochain lot. */
export async function resetFailed(db: SupabaseClient, kind: EmailKind) {
  const { error } = await db.from('ulule_emails').delete().eq('kind', kind).eq('status', 'failed')
  if (error) throw new Error(error.message)
}

export type ImportSummary = {
  ok: true
  columns: string[]
  rows: number
  rejected: { line: number; reason: string }[]
  paidCount: number
  paidCents: number
  attributed: number
  withoutEmail: number
  forgotten: number
  unknownStatuses: { status: string; count: number }[]
}

export async function importExport(
  db: SupabaseClient,
  csv: string,
  options: { dryRun: boolean; extraPaidStatuses: string[] },
): Promise<ImportSummary | { ok: false; error: string; columns: string[] }> {
  const parsed = parseExport(csv)
  if (!parsed.ok) return parsed

  const { campaign } = await campaignContext(db)
  const paidStatuses = new Set<string>([...campaign.paid_statuses, ...options.extraPaidStatuses])

  const { data: ambassadors } = await db.from('ambassadors').select('slug')
  const slugs = new Set((ambassadors ?? []).map(a => a.slug as string))

  const { data: forgottenRows } = await db.from('ulule_forgotten').select('email_sha256')
  const forgottenHashes = new Set((forgottenRows ?? []).map(f => f.email_sha256 as string))

  const kept: ExportOrder[] = []
  let forgotten = 0
  for (const order of parsed.orders) {
    if (order.email && forgottenHashes.has(emailHash(order.email))) forgotten++
    else kept.push(order)
  }

  const unknown = new Map<string, number>()
  for (const order of kept) {
    if (!paidStatuses.has(order.status)) unknown.set(order.status, (unknown.get(order.status) ?? 0) + 1)
  }
  const paid = kept.filter(o => paidStatuses.has(o.status))

  if (!options.dryRun) {
    if (options.extraPaidStatuses.length) {
      const { error } = await db.from('ulule_campaign')
        .update({ paid_statuses: Array.from(paidStatuses) }).eq('id', 1)
      if (error) throw new Error(error.message)
    }
    const rows = kept.map(o => ({
      ulule_order_id: o.orderId,
      contributor_name: o.name,
      contributor_email: o.email,
      amount_cents: o.amountCents,
      status: o.status,
      is_paid: paidStatuses.has(o.status),
      contributed_at: o.contributedAt,
      ambassador_slug: o.utmSource && slugs.has(o.utmSource) ? o.utmSource : null,
      utm_source: o.utmSource,
      utm_medium: o.utmMedium,
      imported_at: new Date().toISOString(),
    }))
    if (rows.length) {
      const { error } = await db.from('contributions').upsert(rows, { onConflict: 'ulule_order_id' })
      if (error) throw new Error(error.message)
    }
  }

  return {
    ok: true,
    columns: parsed.columns,
    rows: parsed.orders.length,
    rejected: parsed.rejected,
    paidCount: paid.length,
    paidCents: paid.reduce((sum, o) => sum + o.amountCents, 0),
    attributed: paid.filter(o => o.utmSource && slugs.has(o.utmSource)).length,
    withoutEmail: paid.filter(o => !o.email).length,
    forgotten,
    unknownStatuses: Array.from(unknown, ([status, count]) => ({ status, count })),
  }
}

/** Efface tout ce qui concerne une adresse, et empêche un import de la recréer. */
export async function forgetEmail(db: SupabaseClient, email: string) {
  const steps = await Promise.all([
    db.from('ambassadors').delete().eq('email', email),
    db.from('contributions').delete().eq('contributor_email', email),
    db.from('ulule_emails').delete().eq('recipient_email', email),
    db.from('ulule_forgotten').upsert({ email_sha256: emailHash(email) }),
  ])
  const failure = steps.find(s => s.error)
  if (failure?.error) throw new Error(failure.error.message)
}
