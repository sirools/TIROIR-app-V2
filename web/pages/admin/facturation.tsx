// Back-office › Facturation : les abonnements réels par canal (site, iOS,
// Play Store, Pro sur facture : lib/subscriptionRevenue.ts), ce que Stripe
// encaisse (crédits du site, factures Business), le MRR Business, une
// projection à date, et la
// gestion des clients Business (création, démarrage de l'abonnement,
// resynchronisation des sièges).
//
// Données : tables synchronisées par le webhook Stripe
// (stripe_credit_purchases, billing_invoices, organizations), lues avec la
// clé service après la garde admin. Calculs : lib/revenue.ts.
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useState } from 'react'
import type { GetServerSideProps } from 'next'
import { requireAdminPage } from '../../lib/adminAuth'
import { adminNavFor, type AdminNav } from '../../lib/adminNav'
import { adminSupabase } from '../../lib/supabase'
import { stripeEnv } from '../../lib/stripeConfig'
import { paymentMethodLabel } from '../../lib/stripe/business'
import {
  billingLines, businessMrr, eurosFromCents, monthlyCollected, nextChristmas, projectRevenue,
  type BillingLine, type CreditPurchaseRow, type InvoiceRevenueRow, type Projection,
} from '../../lib/revenue'
import type { RevenueReport } from '../../lib/subscriptionRevenue'
import { loadRevenueReport } from '../../lib/revenueLoad'

type OrgLine = {
  id: string; name: string; billing_email: string; subscription_status: string | null
  seat_quantity: number | null; members: number; pro_access_until: string | null; hasSubscription: boolean
}
type Props = {
  adminNav: AdminNav
  stripeMode: 'test' | 'live' | null
  mrr: number
  months: { month: string; credits: number; business: number; total: number }[]
  projection: Projection
  lines: BillingLine[]
  orgs: OrgLine[]
  thisMonth: number
  revenue: RevenueReport
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

export default function Facturation({ stripeMode, mrr, months, projection, lines, orgs, thisMonth, revenue }: Props) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})

  async function post(body: Record<string, unknown>) {
    setBusy(true); setMsg(null)
    const res = await fetch('/api/admin/business', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const json = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setMsg(json.error ?? 'Échec'); return false }
    router.replace(router.asPath)
    return true
  }

  const field = (key: string, label: string, required = false) => (
    <label style={s.field}>
      <span>{label}{required ? ' *' : ''}</span>
      <input required={required} value={form[key] ?? ''} onChange={e => setForm({ ...form, [key]: e.target.value })} style={s.input} />
    </label>
  )

  return (
    <>
      <Head><title>Facturation — Back-office Tiroir</title></Head>
      <main style={s.main}>
        <h1 style={s.h1}>Facturation</h1>
        <p style={s.muted}>
          Stripe : <strong>{stripeMode === 'live' ? 'mode réel' : stripeMode === 'test' ? 'mode test' : 'non configuré'}</strong>.
          Abonnements : MRR hors taxes, tous canaux (site et stores). Business et encaissements : montants TTC
          encaissés par Stripe, avant frais ; les achats faits dans l’app n’y sont pas.
        </p>

        <h2 style={s.h2}>Abonnements</h2>
        <section style={s.tiles}>
          <Tile label="MRR abonnements (HT)" value={eurosFromCents(revenue.mrrHt)}
            hint={revenue.mrrHtEstimated > 0 ? `dont ${eurosFromCents(revenue.mrrHtEstimated)} estimés (stores)` : undefined} />
          <Tile label="Abonnés payants" value={String(revenue.subscribers.total)}
            hint={`${revenue.subscribers.premium} Premium · ${revenue.subscribers.pro} Pro`} />
          <Tile label="Résiliations" value={String(revenue.churn.ended30d)}
            hint={`terminées sur 30 j · ${revenue.churn.scheduled} programmée${revenue.churn.scheduled > 1 ? 's' : ''}`} />
          <Tile label={`Crédits vendus (${revenue.credits.month})`} value={eurosFromCents(revenue.credits.site.ttc + revenue.credits.app.ttc)}
            hint={`site ${revenue.credits.site.count} achat${revenue.credits.site.count > 1 ? 's' : ''} · ${eurosFromCents(revenue.credits.site.ttc)} — app ${revenue.credits.app.count} · ≈ ${eurosFromCents(revenue.credits.app.ttc)} (TTC)`} />
        </section>
        <div style={{ overflowX: 'auto' }}>
          <table style={s.table}>
            <thead><tr><th style={s.th}>Canal</th><th style={s.thR}>Premium</th><th style={s.thR}>Pro</th><th style={s.thR}>MRR HT</th></tr></thead>
            <tbody>
              {revenue.channels.length === 0 && <tr><td style={s.td} colSpan={4}>Aucun abonné payant.</td></tr>}
              {revenue.channels.map(c => (
                <tr key={c.channel}>
                  <td style={s.td}>{c.label}</td>
                  <td style={s.tdR}>{c.premium}</td>
                  <td style={s.tdR}>{c.pro}</td>
                  <td style={s.tdR}>{c.mrrHt === null ? 'hors Stripe' : `${c.estimated ? '≈ ' : ''}${eurosFromCents(c.mrrHt)}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={s.muted}>
          MRR hors taxes à la grille du site (annuel ramené au mois). Stores : estimation avant commission d’Apple / Google ;
          le magasin exact n’est connu que pour les abonnements enregistrés depuis le 08/11/2026.
          Les crédits de l’app sont estimés au prix des packs.
        </p>

        <h2 style={s.h2}>Business et encaissements</h2>
        <section style={s.tiles}>
          <Tile label="MRR Business" value={eurosFromCents(mrr)} />
          <Tile label={`Projection d’ici le ${fmtDate(projection.target)}`} value={eurosFromCents(projection.total)}
            hint={`Business ${eurosFromCents(projection.business)} · crédits ${eurosFromCents(projection.credits)} · à encaisser ${eurosFromCents(projection.outstanding)} · ${projection.days} j`} />
          <Tile label="Encaissé ce mois-ci" value={eurosFromCents(thisMonth)} />
        </section>
        <form style={s.inline} onSubmit={e => { e.preventDefault(); const v = (e.currentTarget.elements.namedItem('jusqua') as HTMLInputElement).value; router.push({ query: v ? { jusqua: v } : {} }) }}>
          <span style={s.muted}>Projection jusqu’au</span>
          <input type="date" name="jusqua" defaultValue={projection.target} style={s.input} />
          <button type="submit" style={s.btnGhost}>Recalculer</button>
        </form>
        <p style={s.muted}>Projection sans croissance : MRR actuel prolongé, crédits au rythme moyen des 90 derniers jours, factures ouvertes encaissées.</p>

        <h2 style={s.h2}>Par mois</h2>
        <table style={s.table}>
          <thead><tr><th style={s.th}>Mois</th><th style={s.thR}>Crédits</th><th style={s.thR}>Business</th><th style={s.thR}>Total</th></tr></thead>
          <tbody>
            {months.length === 0 && <tr><td style={s.td} colSpan={4}>Rien d’encaissé pour l’instant.</td></tr>}
            {months.slice(0, 12).map(m => (
              <tr key={m.month}><td style={s.td}>{m.month}</td><td style={s.tdR}>{eurosFromCents(m.credits)}</td><td style={s.tdR}>{eurosFromCents(m.business)}</td><td style={{ ...s.tdR, fontWeight: 700 }}>{eurosFromCents(m.total)}</td></tr>
            ))}
          </tbody>
        </table>

        <h2 style={s.h2}>Export TVA</h2>
        <p style={s.muted}>
          Factures Stripe payées dans le mois (abonnements, crédits, Business) avec HT, TVA et TTC, pour la déclaration.
          Les ventes des stores n’y sont pas : Apple et Google reversent eux-mêmes la TVA.
        </p>
        <form method="get" action="/api/admin/vat-export" style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0 24px' }}>
          <input type="month" name="month" required defaultValue={new Date().toISOString().slice(0, 7)} style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.15)' }} />
          <button type="submit" style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--orange)', color: 'white', fontWeight: 700, cursor: 'pointer' }}>Télécharger le CSV</button>
        </form>

        <h2 style={s.h2}>Qui facture qui</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={s.table}>
            <thead><tr><th style={s.th}>Date</th><th style={s.th}>Client</th><th style={s.th}>Quoi</th><th style={s.thR}>Montant</th><th style={s.th}>Moyen</th><th style={s.th}>Statut</th></tr></thead>
            <tbody>
              {lines.length === 0 && <tr><td style={s.td} colSpan={6}>Aucune vente.</td></tr>}
              {lines.map((l, i) => (
                <tr key={i}>
                  <td style={s.td}>{fmtDate(l.date)}</td>
                  <td style={s.td}>{l.client}</td>
                  <td style={s.td}>{l.what}</td>
                  <td style={s.tdR}>{eurosFromCents(l.amount)}</td>
                  <td style={s.td}>{paymentMethodLabel(l.method)}</td>
                  <td style={s.td}>{l.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 style={s.h2}>Clients Business</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={s.table}>
            <thead><tr><th style={s.th}>Organisation</th><th style={s.th}>Abonnement</th><th style={s.thR}>Membres</th><th style={s.thR}>Sièges facturés</th><th style={s.th}>Pro jusqu’au</th><th style={s.th} /></tr></thead>
            <tbody>
              {orgs.length === 0 && <tr><td style={s.td} colSpan={6}>Aucun client Business.</td></tr>}
              {orgs.map(o => (
                <tr key={o.id}>
                  <td style={s.td}><strong>{o.name}</strong><div style={s.muted}>{o.billing_email}</div></td>
                  <td style={s.td}>{o.subscription_status ?? '—'}</td>
                  <td style={s.tdR}>{o.members}</td>
                  <td style={{ ...s.tdR, color: o.hasSubscription && o.seat_quantity !== o.members ? 'var(--error)' : undefined }}>{o.seat_quantity ?? '—'}</td>
                  <td style={s.td}>{o.pro_access_until ? fmtDate(o.pro_access_until) : '—'}</td>
                  <td style={s.td}>
                    {(!o.hasSubscription || o.subscription_status === 'canceled') && (
                      <button type="button" disabled={busy || !stripeMode} style={s.btn}
                        onClick={() => { if (window.confirm(`Démarrer l’abonnement de ${o.name} (${o.members} siège(s), facture à 30 jours) ?`)) post({ action: 'subscribe', org_id: o.id }) }}>
                        Démarrer l’abonnement
                      </button>
                    )}
                    {o.hasSubscription && o.seat_quantity !== o.members && (
                      <button type="button" disabled={busy} style={s.btnGhost} onClick={() => post({ action: 'resync_seats', org_id: o.id })}>Resynchroniser les sièges</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 style={s.h3}>Nouveau client Business</h3>
        <form style={s.grid} onSubmit={async e => { e.preventDefault(); if (await post({ action: 'create', ...form })) setForm({}) }}>
          {field('name', 'Nom affiché', true)}
          {field('owner_email', 'Compte Tiroir du propriétaire', true)}
          {field('billing_email', 'E-mail de facturation', true)}
          {field('legal_name', 'Raison sociale')}
          {field('siren', 'SIREN')}
          {field('vat_number', 'N° TVA intracommunautaire')}
          {field('address_line1', 'Adresse')}
          {field('postal_code', 'Code postal')}
          {field('city', 'Ville')}
          <div style={{ alignSelf: 'end' }}><button type="submit" disabled={busy} style={s.btn}>Créer</button></div>
        </form>
        {msg && <p role="alert" style={s.error}>{msg}</p>}
      </main>
    </>
  )
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div style={s.tile}>
      <div style={s.tileLabel}>{label}</div>
      <div style={s.tileValue}>{value}</div>
      {hint && <div style={s.muted}>{hint}</div>}
    </div>
  )
}

export const getServerSideProps: GetServerSideProps<Props> = async ctx => {
  const guard = await requireAdminPage(ctx)
  if (!guard.ok) return guard.result

  const db = adminSupabase()
  const [{ data: purchases }, { data: invoices }, { data: orgs }, { data: members }] = await Promise.all([
    db.from('stripe_credit_purchases')
      .select('paid_at, customer_email, pack, credits, amount_total, amount_refunded, payment_method, status')
      .order('paid_at', { ascending: false }).limit(2000),
    db.from('billing_invoices')
      .select('number, status, amount_due, amount_paid, amount_remaining, seats, created_at, due_date, paid_at, payment_method, organizations(name)')
      .order('created_at', { ascending: false }).limit(2000),
    db.from('organizations')
      .select('id, name, billing_email, subscription_status, seat_quantity, seat_unit_amount, pro_access_until, stripe_subscription_id')
      .order('created_at', { ascending: false }),
    db.from('org_members').select('org_id').eq('status', 'active'),
  ])

  const creditRows = (purchases ?? []) as CreditPurchaseRow[]
  const invoiceRows: InvoiceRevenueRow[] = ((invoices ?? []) as (Omit<InvoiceRevenueRow, 'org_name'> & { organizations: { name: string } | { name: string }[] | null })[])
    .map(({ organizations, ...i }) => ({ ...i, org_name: (Array.isArray(organizations) ? organizations[0]?.name : organizations?.name) ?? null }))
  const orgRows = (orgs ?? []) as (OrgLine & { seat_unit_amount: number | null; stripe_subscription_id: string | null })[]
  const counts = new Map<string, number>()
  for (const m of (members ?? []) as { org_id: string }[]) counts.set(m.org_id, (counts.get(m.org_id) ?? 0) + 1)

  const now = new Date()
  const asked = typeof ctx.query.jusqua === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(ctx.query.jusqua) ? new Date(`${ctx.query.jusqua}T00:00:00Z`) : null
  const mrr = businessMrr(orgRows)
  const months = monthlyCollected(creditRows, invoiceRows)
  const revenue = await loadRevenueReport(db, now)

  return {
    props: {
      adminNav: adminNavFor(guard.user, guard.isAdmin),
      stripeMode: stripeEnv()?.mode ?? null,
      revenue,
      mrr,
      months,
      thisMonth: months.find(m => m.month === now.toISOString().slice(0, 7))?.total ?? 0,
      projection: projectRevenue({ now, target: asked ?? nextChristmas(now), mrr, purchases: creditRows, invoices: invoiceRows }),
      lines: billingLines(creditRows, invoiceRows).slice(0, 300),
      orgs: orgRows.map(o => ({
        id: o.id, name: o.name, billing_email: o.billing_email, subscription_status: o.subscription_status,
        seat_quantity: o.seat_quantity, members: counts.get(o.id) ?? 0, pro_access_until: o.pro_access_until,
        hasSubscription: !!o.stripe_subscription_id,
      })),
    },
  }
}

const s: Record<string, React.CSSProperties> = {
  main:      { maxWidth: 1100, margin: '0 auto', padding: '24px 16px 64px' },
  h1:        { fontSize: 28, fontWeight: 800, color: 'var(--ink)', marginBottom: 6 },
  h2:        { fontSize: 20, fontWeight: 800, color: 'var(--ink)', margin: '32px 0 12px' },
  h3:        { fontSize: 16, fontWeight: 700, color: 'var(--ink)', margin: '24px 0 10px' },
  muted:     { fontSize: 13, color: 'var(--muted)' },
  tiles:     { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, margin: '20px 0 12px' },
  tile:      { background: 'var(--white)', border: '1px solid var(--border-light)', borderRadius: 14, padding: 16, display: 'flex', flexDirection: 'column', gap: 4 },
  tileLabel: { fontSize: 12, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px' },
  tileValue: { fontSize: 26, fontWeight: 800, color: 'var(--ink)' },
  inline:    { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 4 },
  table:     { width: '100%', borderCollapse: 'collapse', fontSize: 14, background: 'var(--white)' },
  th:        { textAlign: 'left', padding: '8px 10px', borderBottom: '1px solid var(--border)', color: 'var(--muted)', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' },
  thR:       { textAlign: 'right', padding: '8px 10px', borderBottom: '1px solid var(--border)', color: 'var(--muted)', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' },
  td:        { padding: '8px 10px', borderBottom: '1px solid var(--border-light)', color: 'var(--ink)', verticalAlign: 'top' },
  tdR:       { padding: '8px 10px', borderBottom: '1px solid var(--border-light)', color: 'var(--ink)', textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'top' },
  grid:      { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 },
  field:     { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: 'var(--muted)', fontWeight: 600 },
  input:     { padding: '8px 12px', borderRadius: 10, border: '1px solid var(--border)', fontSize: 14, fontFamily: 'inherit' },
  btn:       { padding: '8px 14px', borderRadius: 10, background: 'var(--orange)', color: 'var(--white)', fontWeight: 700, fontSize: 13, border: 'none', cursor: 'pointer', fontFamily: 'inherit' },
  btnGhost:  { padding: '7px 12px', borderRadius: 10, background: 'var(--white)', color: 'var(--ink)', fontWeight: 700, fontSize: 13, border: '1.5px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' },
  error:     { fontSize: 14, color: 'var(--error)', background: 'var(--error-light)', borderRadius: 8, padding: '8px 12px', marginTop: 10 },
}
