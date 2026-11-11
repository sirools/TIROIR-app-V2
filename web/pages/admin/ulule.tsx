// Campagne Ulule : réglages, ambassadeurs, envoi du pré-lancement, import
// des contributions et merci. Garde : le propriétaire seul.
import { useState, type ChangeEvent } from 'react'
import type { GetServerSideProps } from 'next'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { requireTorixOwnerPage } from '../../lib/adminAuth'
import { adminSupabase } from '../../lib/supabase'
import { adminNavFor, type AdminNav } from '../../lib/adminNav'
import { campaignUrl, DEFAULT_MILESTONES_CENTS, formatEuros, progressOf, toParisInput } from '../../lib/ulule'
import { personalLink, type EmailKind } from '../../lib/ululeServer'
import { fetchUluleAmountCents } from '../../lib/ululeProgress'

type Ambassador = {
  id: string; first_name: string; last_name: string; email: string | null; slug: string; unsubscribed: boolean
  clicks: number; contributions: number; amount_cents: number
  email_status: string | null; sent_at: string | null; opened_at: string | null
  first_click_at: string | null; bounced_at: string | null; link: string
}
type Recent = {
  contributor_name: string; contributor_email: string | null; amount_cents: number; status: string
  is_paid: boolean; contributed_at: string | null; ambassador_slug: string | null; thanks_status: string | null
}
type Props = {
  adminNav: AdminNav
  launchInput: string
  pageUrl: string
  presaleNumber: string
  milestonesInput: string
  milestonesCents: number[]
  ululeAmountCents: number | null
  exampleUrl: string
  hasPostalAddress: boolean
  ambassadors: Ambassador[]
  totals: { paid_count: number; paid_cents: number; unattributed_count: number; other_count: number }
  counts: { prelaunch_failed: number; thanks_sent: number; thanks_failed: number; stuck: number }
  byKind: Record<EmailKind, { sent: number; failed: number; to_send: number }>
  recent: Recent[]
}

// Les quatre envois de la campagne, dans l'ordre du calendrier.
const CAMPAIGN_EMAILS: { kind: EmailKind; title: string; when: string; audience: string }[] = [
  { kind: 'launch', title: 'C’est parti', when: 'mardi 24 novembre, le matin, une fois la page publiée', audience: 'ambassadeurs' },
  { kind: 'reminder', title: 'Relance mi-campagne', when: 'vers le vendredi 4 décembre', audience: 'ambassadeurs' },
  { kind: 'last48h', title: 'Dernières 48 h', when: 'dimanche 13 décembre', audience: 'ambassadeurs' },
  { kind: 'recap', title: 'Bilan et merci', when: 'mercredi 16 décembre, après le dernier import', audience: 'ambassadeurs et contributeurs, une fois par adresse' },
]
type Preview = {
  ok: true; columns: string[]; rows: number; rejected: { line: number; reason: string }[]
  paidCount: number; paidCents: number; attributed: number; withoutEmail: number; forgotten: number
  unknownStatuses: { status: string; count: number }[]
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const guard = await requireTorixOwnerPage(ctx)
  if (!guard.ok) return guard.result as never

  const db = adminSupabase()
  const [{ data: campaign }, { data: dash }, { data: settings }] = await Promise.all([
    db.from('ulule_campaign').select('*').eq('id', 1).single(),
    db.rpc('get_ulule_dashboard'),
    db.from('app_settings').select('email_postal_address').eq('id', 1).single(),
  ])
  if (!campaign || !dash) throw new Error('Tables de la campagne Ulule illisibles : migration appliquée ?')
  const milestonesCents: number[] = campaign.milestones_cents?.length ? campaign.milestones_cents : DEFAULT_MILESTONES_CENTS
  const launched = Date.now() >= new Date(campaign.launch_at).getTime()

  return {
    props: {
      adminNav: adminNavFor(guard.user, guard.isAdmin),
      launchInput: toParisInput(campaign.launch_at),
      pageUrl: campaign.page_url,
      presaleNumber: campaign.presale_number,
      milestonesInput: milestonesCents.map(c => c / 100).join(', '),
      milestonesCents,
      ululeAmountCents: launched ? await fetchUluleAmountCents(campaign.presale_number, campaign.page_url) : null,
      exampleUrl: campaignUrl(campaign.page_url, campaign.presale_number, 'prenom-nom'),
      hasPostalAddress: !!(settings?.email_postal_address ?? '').trim(),
      ambassadors: dash.ambassadors.map((a: Omit<Ambassador, 'link'>) => ({ ...a, link: personalLink(a.slug) })),
      totals: dash.totals,
      counts: dash.email_counts,
      byKind: dash.by_kind,
      recent: dash.recent,
    },
  }
}

const euros = (cents: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100)
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Paris' }) : '—'

async function call(payload: Record<string, unknown>) {
  const response = await fetch('/api/admin/ulule', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw Object.assign(new Error(data.error ?? `Erreur ${response.status}`), { data })
  return data
}

function emailState(a: Ambassador): string {
  if (!a.email) return 'Lien seul'
  if (a.unsubscribed) return 'Désinscrit·e'
  if (a.bounced_at) return 'Rebond'
  if (a.first_click_at) return 'Cliqué'
  if (a.opened_at) return 'Ouvert'
  if (a.email_status === 'sent') return 'Envoyé'
  if (a.email_status === 'failed') return 'Échec'
  if (a.email_status === 'pending') return 'En cours'
  return 'À envoyer'
}

export default function Ulule(p: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [settings, setSettings] = useState({
    launchAt: p.launchInput, pageUrl: p.pageUrl, presaleNumber: p.presaleNumber, milestones: p.milestonesInput,
  })
  const [lines, setLines] = useState('')
  const [forget, setForget] = useState('')
  const [csv, setCsv] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [extraPaid, setExtraPaid] = useState<string[]>([])

  const toSend = p.byKind.prelaunch.to_send
  const progress = p.ululeAmountCents === null ? null : progressOf(p.ululeAmountCents, p.milestonesCents)

  async function run(task: () => Promise<string>) {
    setBusy(true)
    setMessage('')
    try {
      setMessage(await task())
      router.replace(router.asPath, undefined, { scroll: false })
    } catch (e) {
      const data = (e as { data?: { columns?: string[] } }).data
      setMessage(`${(e as Error).message}${data?.columns?.length ? ` Colonnes trouvées : ${data.columns.join(' | ')}` : ''}`)
    } finally {
      setBusy(false)
    }
  }

  async function drain(kind: EmailKind) {
    let sent = 0
    let failed = 0
    for (;;) {
      const r = await call({ action: 'send-batch', kind })
      sent += r.sent
      failed += r.failed
      if (r.stopped) return `${sent} envoyé(s), ${failed} échec(s). Arrêt : ${r.stopped}`
      if (r.done) return `${sent} envoyé(s), ${failed} échec(s).`
      setMessage(`${sent} envoyé(s)…`)
    }
  }

  const sendPrelaunch = () => {
    if (!window.confirm(`Envoyer l'e-mail de pré-lancement à ${toSend} ambassadeur(s) ?`)) return
    run(() => drain('prelaunch'))
  }

  async function chooseFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setCsv(text)
    setPreview(null)
    setExtraPaid([])
    setBusy(true)
    setMessage('')
    try {
      setPreview(await call({ action: 'import', csv: text, dryRun: true, extraPaidStatuses: [] }))
    } catch (err) {
      const data = (err as { data?: { columns?: string[] } }).data
      setMessage(`${(err as Error).message}${data?.columns?.length ? ` Colonnes trouvées : ${data.columns.join(' | ')}` : ''}`)
    } finally {
      setBusy(false)
    }
  }

  async function refreshPreview(next: string[]) {
    setExtraPaid(next)
    setPreview(await call({ action: 'import', csv, dryRun: true, extraPaidStatuses: next }))
  }

  const confirmImport = () => {
    if (!window.confirm(`Importer et envoyer le merci aux nouveaux contributeurs payés ?`)) return
    run(async () => {
      await call({ action: 'import', csv, dryRun: false, extraPaidStatuses: extraPaid })
      const report = await drain('thanks')
      setPreview(null)
      setCsv('')
      return `Import terminé. Merci : ${report}`
    })
  }

  return (
    <main className="page">
      <Head>
        <title>Campagne Ulule — Tiroir</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <h1>Campagne Ulule</h1>
      {message && <p className="message" role="status">{message}</p>}

      <section className="cards">
        <div className="card">
          <span>Sur Ulule, en direct</span>
          <b>{progress ? formatEuros(progress.amountCents) : '—'}</b>
          <small>{progress
            ? progress.nextCents ? `Prochain palier : ${formatEuros(progress.nextCents)}` : 'Tous les paliers atteints'
            : 'Ulule ne répond pas encore (page pas en ligne ?)'}</small>
        </div>
        <div className="card"><span>Contributions payées (importées)</span><b>{p.totals.paid_count}</b></div>
        <div className="card"><span>Collecté</span><b>{euros(p.totals.paid_cents)}</b></div>
        <div className="card"><span>Sans ambassadeur</span><b>{p.totals.unattributed_count}</b></div>
        <div className="card"><span>Mercis envoyés</span><b>{p.counts.thanks_sent}</b></div>
      </section>
      {p.counts.stuck > 0 && (
        <p className="warn">{p.counts.stuck} envoi(s) interrompu(s) en cours de route : vérifie dans Resend s’ils sont partis. Ils ne seront pas renvoyés.</p>
      )}

      <h2>Ambassadeurs</h2>
      <div className="scroll">
        <table>
          <thead><tr><th>Personne</th><th>Lien</th><th>Clics</th><th>Contrib.</th><th>Montant</th><th>E-mail</th><th /></tr></thead>
          <tbody>
            {p.ambassadors.map(a => (
              <tr key={a.id}>
                <td>{a.first_name} {a.last_name}<br /><small>{a.email ?? 'sans e-mail'}</small></td>
                <td><code>{a.link}</code></td>
                <td>{a.clicks}</td>
                <td>{a.contributions}</td>
                <td>{euros(a.amount_cents)}</td>
                <td>{emailState(a)}</td>
                <td>
                  <button className="link" disabled={busy} onClick={() => {
                    if (window.confirm(`Supprimer ${a.first_name} ${a.last_name} et ses clics ?`)) {
                      run(async () => { await call({ action: 'delete-ambassador', id: a.id }); return 'Supprimé.' })
                    }
                  }}>Supprimer</button>
                </td>
              </tr>
            ))}
            {!p.ambassadors.length && <tr><td colSpan={7}>Personne pour l’instant.</td></tr>}
          </tbody>
        </table>
      </div>
      <label htmlFor="lines">Ajouter : une personne par ligne, « Prénom, Nom, e-mail ». Sans e-mail (« Prénom, Nom »), la personne a un lien à lui envoyer toi-même, et ne reçoit aucun e-mail.</label>
      <textarea id="lines" rows={4} value={lines} onChange={e => setLines(e.target.value)} />
      <button disabled={busy || !lines.trim()} onClick={() => run(async () => {
        const r = await call({ action: 'add-ambassadors', lines })
        setLines(r.invalid.join('\n'))
        return `${r.added} ajouté(s), ${r.duplicates} déjà présent(s), ${r.invalid.length} ligne(s) illisible(s).`
      })}>Ajouter</button>

      <h2>E-mail de pré-lancement</h2>
      {!p.hasPostalAddress && <p className="warn">Aucune adresse postale dans les réglages e-mail : le pied de message n’en affichera pas.</p>}
      <div className="row">
        <button disabled={busy} onClick={() => run(async () => {
          const r = await call({ action: 'send-test', kind: 'prelaunch' })
          return `Test envoyé à ${r.to}.`
        })}>M’envoyer un test</button>
        <button className="primary" disabled={busy || !toSend} onClick={sendPrelaunch}>Envoyer à {toSend} ambassadeur(s)</button>
        {p.counts.prelaunch_failed > 0 && (
          <button disabled={busy} onClick={() => run(async () => {
            await call({ action: 'retry-failed', kind: 'prelaunch' })
            return `Échecs remis en file : renvoie quand tu veux.`
          })}>Remettre {p.counts.prelaunch_failed} échec(s) en file</button>
        )}
      </div>

      <h2>E-mails de la campagne</h2>
      <p className="note">Chacun part une seule fois par personne, quand tu cliques. Les personnes sans e-mail et les désinscrites sont écartées. La relance, les 48 h et le bilan donnent le montant lu sur Ulule au moment de l’envoi.</p>
      {CAMPAIGN_EMAILS.map(e => {
        const c = p.byKind[e.kind]
        return (
          <div key={e.kind} className="mail">
            <h3>{e.title}</h3>
            <p className="note">Quand : {e.when}. À qui : {e.audience}. Déjà envoyés : {c.sent}.</p>
            <div className="row">
              <button disabled={busy} onClick={() => run(async () => {
                const r = await call({ action: 'send-test', kind: e.kind })
                return `Test « ${e.title} » envoyé à ${r.to}.`
              })}>M’envoyer un test</button>
              <button className="primary" disabled={busy || !c.to_send} onClick={() => {
                if (window.confirm(`Envoyer « ${e.title} » à ${c.to_send} personne(s) ?`)) run(() => drain(e.kind))
              }}>Envoyer à {c.to_send} personne(s)</button>
              {c.failed > 0 && (
                <button disabled={busy} onClick={() => run(async () => {
                  await call({ action: 'retry-failed', kind: e.kind })
                  return `Échecs remis en file : renvoie quand tu veux.`
                })}>Remettre {c.failed} échec(s) en file</button>
              )}
            </div>
          </div>
        )
      })}

      <h2>Contributions</h2>
      <p className="note">Dans le back-office Ulule, exporte tes contributeurs en CSV, puis dépose le fichier ici. Rien n’est écrit ni envoyé avant ta confirmation. Tu peux réimporter le même fichier sans risque : chacun ne reçoit le merci qu’une fois.</p>
      <div className="row">
        <input type="file" accept=".csv,text/csv" disabled={busy} onChange={chooseFile} />
        <button disabled={busy} onClick={() => run(async () => {
          const r = await call({ action: 'send-test', kind: 'thanks' })
          return `Test envoyé à ${r.to}.`
        })}>M’envoyer le merci en test</button>
        {p.counts.thanks_failed > 0 && (
          <button disabled={busy} onClick={() => run(async () => {
            await call({ action: 'retry-failed', kind: 'thanks' })
            return `Échecs renvoyés : ${await drain('thanks')}`
          })}>Renvoyer {p.counts.thanks_failed} échec(s)</button>
        )}
      </div>

      {preview && (
        <div className="preview">
          <h3>Aperçu</h3>
          <ul>
            <li>{preview.rows} commande(s) lue(s), {preview.rejected.length} rejetée(s)</li>
            <li>{preview.paidCount} payée(s), pour {euros(preview.paidCents)} : vérifie que le total est le bon</li>
            <li>{preview.attributed} attribuée(s) à un ambassadeur</li>
            <li>{preview.withoutEmail} payée(s) sans e-mail, {preview.forgotten} effacée(s) sur demande et ignorée(s)</li>
          </ul>
          {preview.rejected.slice(0, 10).map(r => <p key={r.line} className="warn">Ligne {r.line} : {r.reason}</p>)}
          {preview.unknownStatuses.length > 0 && (
            <>
              <p>Statuts non reconnus comme payés. Coche seulement ceux qui correspondent à un paiement réel :</p>
              {preview.unknownStatuses.map(s => (
                <label key={s.status} className="check">
                  <input type="checkbox" disabled={busy} checked={extraPaid.includes(s.status)} onChange={e => {
                    refreshPreview(e.target.checked ? [...extraPaid, s.status] : extraPaid.filter(x => x !== s.status))
                  }} />
                  {s.status} ({s.count})
                </label>
              ))}
            </>
          )}
          <button className="primary" disabled={busy} onClick={confirmImport}>Importer et envoyer le merci</button>
        </div>
      )}

      <div className="scroll">
        <table>
          <thead><tr><th>Date</th><th>Contributeur</th><th>Montant</th><th>Statut</th><th>Ambassadeur</th><th>Merci</th></tr></thead>
          <tbody>
            {p.recent.map((c, i) => (
              <tr key={i}>
                <td>{when(c.contributed_at)}</td>
                <td>{c.contributor_name}<br /><small>{c.contributor_email ?? 'sans e-mail'}</small></td>
                <td>{euros(c.amount_cents)}</td>
                <td>{c.status}</td>
                <td>{c.ambassador_slug ?? '—'}</td>
                <td>{c.thanks_status === 'sent' ? 'Envoyé' : c.thanks_status === 'failed' ? 'Échec' : c.thanks_status === 'pending' ? 'En cours' : c.is_paid ? 'À envoyer' : '—'}</td>
              </tr>
            ))}
            {!p.recent.length && <tr><td colSpan={6}>Aucune contribution importée.</td></tr>}
          </tbody>
        </table>
      </div>

      <h2>Réglages</h2>
      <label htmlFor="launch">Lancement (heure de Paris) : date affichée dans l’e-mail, et moment où les liens s’ouvrent</label>
      <input id="launch" type="datetime-local" value={settings.launchAt} onChange={e => setSettings({ ...settings, launchAt: e.target.value })} />
      <label htmlFor="url">Page Ulule</label>
      <input id="url" value={settings.pageUrl} onChange={e => setSettings({ ...settings, pageUrl: e.target.value })} />
      <label htmlFor="presale">Numéro de collecte (dans l’adresse du mode édition)</label>
      <input id="presale" value={settings.presaleNumber} onChange={e => setSettings({ ...settings, presaleNumber: e.target.value })} />
      <label htmlFor="milestones">Paliers de la jauge, en euros (bannière de l’accueil et e-mails)</label>
      <input id="milestones" value={settings.milestones} onChange={e => setSettings({ ...settings, milestones: e.target.value })} />
      <p className="note">Exemple de destination : <code>{p.exampleUrl}</code></p>
      <button disabled={busy} onClick={() => run(async () => { await call({ action: 'settings', ...settings }); return 'Enregistré.' })}>Enregistrer</button>

      <h2>Effacer une personne</h2>
      <p className="note">Supprime ses données de la campagne et l’écarte des prochains imports.</p>
      <div className="row">
        <input aria-label="Adresse à effacer" type="email" value={forget} onChange={e => setForget(e.target.value)} />
        <button disabled={busy || !forget.trim()} onClick={() => {
          if (window.confirm(`Effacer définitivement ${forget} ?`)) {
            run(async () => { await call({ action: 'forget', email: forget }); setForget(''); return 'Effacé.' })
          }
        }}>Effacer</button>
      </div>

      <style jsx>{`
        .page { max-width: 1040px; margin: 0 auto; padding: 32px 16px 64px; font-family: var(--font-body); color: var(--ink); background: var(--white); }
        h1 { margin: 0 0 16px; font-size: 28px; }
        h2 { font-size: 18px; margin: 36px 0 12px; }
        h3 { font-size: 16px; margin: 0 0 8px; }
        .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }
        .card { border: 1px solid var(--border-light); border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; }
        .card span, small, .note { color: var(--muted); font-size: 13px; }
        .card b { font-size: 22px; }
        .scroll { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; font-size: 14px; }
        th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid var(--border-light); vertical-align: top; }
        th { color: var(--muted); font-weight: 600; }
        code { background: var(--beige-2); padding: 1px 4px; border-radius: 4px; font-size: 12px; word-break: break-all; }
        td code { white-space: nowrap; word-break: normal; }
        label { display: block; margin: 14px 0 6px; font-size: 14px; }
        .check { display: flex; gap: 8px; align-items: center; margin: 6px 0; }
        input:not([type]), input[type='email'], input[type='datetime-local'], textarea { width: 100%; max-width: 560px; padding: 10px; border: 1px solid var(--border); border-radius: 8px; font: inherit; box-sizing: border-box; display: block; }
        button { margin-top: 10px; padding: 10px 14px; border: 1px solid var(--border); border-radius: 8px; background: var(--white); color: var(--ink); font: inherit; cursor: pointer; }
        button:disabled { opacity: 0.5; cursor: default; }
        .primary { background: var(--orange); border-color: var(--orange); color: var(--white); }
        .link { margin: 0; padding: 0; border: 0; background: none; text-decoration: underline; font-size: 13px; }
        .row { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
        .message { background: var(--beige-2); padding: 10px 12px; border-radius: 8px; }
        .warn { color: var(--orange); font-size: 14px; }
        .mail { border-top: 1px solid var(--border-light); padding: 12px 0; }
        .mail .note { margin: 0; }
        .preview { border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin: 16px 0; }
      `}</style>
    </main>
  )
}
