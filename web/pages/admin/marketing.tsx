// Marketing — les chiffres solides, pour qui s'occupe de la marque et de la
// publicité : visites, sources, inscriptions, activation. Rien de secret :
// ni Torix, ni coûts, ni trésorerie, ni adresse ou objet d'un utilisateur
// (seulement des totaux). Garde : requireMarketingPage (admins et
// MARKETING_EMAILS).
import type { GetServerSideProps } from 'next'
import Head from 'next/head'
import { requireMarketingPage } from '../../lib/adminAuth'
import { adminSupabase } from '../../lib/supabase'
import { parseAcquisition, signupsBySource, type SourceRow } from '../../lib/attribution'

type Props = {
  generatedAt: string
  visits30d: number
  visitors30d: number
  visitSources: { source: string; visites: number }[]
  accounts: number
  newAccounts30d: number
  activated: number
  paying: number
  signups: SourceRow[]
  signups30d: SourceRow[]
}

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : '—')
const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n)

export default function Marketing(p: Props) {
  return (
    <main className="page">
      <Head>
        <title>Marketing — Tiroir</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <header className="head">
        <h1>Marketing</h1>
        <p className="sub">
          Chiffres agrégés, mis à jour à chaque ouverture ({new Date(p.generatedAt).toLocaleString('fr-FR')}).
        </p>
      </header>

      <section className="cards">
        <Card label="Visiteurs uniques (30 j)" value={fmt(p.visitors30d)} hint={`${fmt(p.visits30d)} pages vues`} />
        <Card label="Comptes" value={fmt(p.accounts)} hint={`+${fmt(p.newAccounts30d)} en 30 jours`} />
        <Card label="Comptes activés" value={pct(p.activated, p.accounts)} hint={`${fmt(p.activated)} avec au moins un objet`} />
        <Card label="Abonnés payants" value={fmt(p.paying)} hint="Premium et Pro" />
      </section>

      <h2>Inscriptions par source — 30 derniers jours</h2>
      <SourceTable rows={p.signups30d} />

      <h2>Inscriptions par source — depuis le début</h2>
      <SourceTable rows={p.signups} />
      <p className="note">
        La source est celle du premier passage sur le site : un lien de campagne
        (<code>?utm_source=instagram&amp;utm_campaign=rentree</code>) ou, à défaut, le site d’où
        l’on arrive. « app ou inconnue » : comptes créés dans l’app (stores) ou avant ce suivi.
      </p>

      <h2>Visites par source — 30 derniers jours</h2>
      <table>
        <thead><tr><th>Source</th><th>Pages vues</th></tr></thead>
        <tbody>
          {p.visitSources.map(r => (
            <tr key={r.source}><td>{r.source}</td><td>{fmt(r.visites)}</td></tr>
          ))}
        </tbody>
      </table>

      <style jsx>{`
        .page { max-width: 880px; margin: 0 auto; padding: 32px 16px 64px; font-family: var(--font-body); color: var(--ink); background: var(--white); }
        .head h1 { margin: 0; font-size: 28px; }
        .sub { margin: 6px 0 24px; color: var(--muted); font-size: 14px; }
        .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 32px; }
        h2 { font-size: 18px; margin: 32px 0 12px; }
        table { width: 100%; border-collapse: collapse; font-size: 14px; }
        th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid var(--border-light); }
        th { color: var(--muted); font-weight: 600; }
        .note { font-size: 13px; color: var(--muted); line-height: 1.5; }
        code { background: var(--beige-2); padding: 1px 4px; border-radius: 4px; }
      `}</style>
    </main>
  )
}

function Card({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="card">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      <div className="hint">{hint}</div>
      <style jsx>{`
        .card { background: var(--beige-2); border: 1px solid var(--border-light); border-radius: var(--radius); padding: 16px; }
        .label { font-size: 13px; color: var(--muted); }
        .value { font-size: 26px; font-weight: 800; margin: 4px 0; }
        .hint { font-size: 12px; color: var(--text-tertiary); }
      `}</style>
    </div>
  )
}

function SourceTable({ rows }: { rows: SourceRow[] }) {
  if (!rows.length) return <p className="empty">Aucune inscription sur la période.<style jsx>{`.empty { color: var(--muted); font-size: 14px; }`}</style></p>
  return (
    <table>
      <thead><tr><th>Source</th><th>Comptes</th><th>Activés</th><th>Taux</th></tr></thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.source}><td>{r.source}</td><td>{fmt(r.comptes)}</td><td>{fmt(r.actives)}</td><td>{r.taux} %</td></tr>
        ))}
      </tbody>
      <style jsx>{`
        table { width: 100%; border-collapse: collapse; font-size: 14px; }
        th, td { text-align: left; padding: 10px 8px; border-bottom: 1px solid var(--border-light); }
        th { color: var(--muted); font-weight: 600; }
      `}</style>
    </table>
  )
}

export const getServerSideProps: GetServerSideProps<Props> = async ctx => {
  const guard = await requireMarketingPage(ctx)
  if (!guard.ok) return guard.result

  const admin = adminSupabase()
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  const [{ data: views }, { data: objects }, { count: paying }] = await Promise.all([
    admin.from('site_pageviews').select('source, visitor_id, ip_hash').gte('created_at', since30d.toISOString()),
    admin.from('objects').select('user_id'),
    admin.from('profiles').select('*', { count: 'exact', head: true }).neq('plan', 'free'),
  ])

  // Comptes : seulement l'identifiant, la date et la source — jamais
  // l'adresse ni le nom, qui ne quittent pas ce serveur.
  const users: { id: string; createdAt: string; acq: ReturnType<typeof parseAcquisition> }[] = []
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error || !data?.users?.length) break
    for (const u of data.users) users.push({ id: u.id, createdAt: u.created_at, acq: parseAcquisition(u.user_metadata?.acq) })
    if (data.users.length < 1000) break
  }

  const activeIds = new Set((objects ?? []).map(o => o.user_id as string))
  const recent = users.filter(u => new Date(u.createdAt) >= since30d)

  const sourceCounts = new Map<string, number>()
  for (const v of views ?? []) sourceCounts.set(v.source ?? 'direct', (sourceCounts.get(v.source ?? 'direct') ?? 0) + 1)

  return {
    props: {
      generatedAt: new Date().toISOString(),
      visits30d: views?.length ?? 0,
      visitors30d: new Set((views ?? []).map(v => v.visitor_id || v.ip_hash).filter(Boolean)).size,
      visitSources: Array.from(sourceCounts.entries())
        .map(([source, visites]) => ({ source, visites }))
        .sort((a, b) => b.visites - a.visites)
        .slice(0, 15),
      accounts: users.length,
      newAccounts30d: recent.length,
      activated: users.filter(u => activeIds.has(u.id)).length,
      paying: paying ?? 0,
      signups: signupsBySource(users, activeIds),
      signups30d: signupsBySource(recent, activeIds),
    },
  }
}
