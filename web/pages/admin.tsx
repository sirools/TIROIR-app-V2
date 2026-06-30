import type { GetServerSideProps } from 'next'
import Link from 'next/link'
import { useState } from 'react'
import { serverSupabase, adminSupabase } from '../lib/supabase'

interface AppSettings {
  free_ai_quota_monthly: number
  free_objects_max: number
  free_photos_per_object: number
}

interface KPIs {
  totalAccounts: number
  newAccounts30d: number
  totalObjects: number
  accountsWithObjects: number
  medianObjectsPerActiveUser: number
  aiAnalysesThisMonth: number
  quotaExceeded30d: number
  events: { action: string; count: number }[]
}

interface Props {
  kpis: KPIs
  settings: AppSettings
}

export default function Admin({ kpis, settings: initialSettings }: Props) {
  const conversionPct = kpis.totalAccounts > 0
    ? ((kpis.accountsWithObjects / kpis.totalAccounts) * 100).toFixed(1)
    : '0'

  const [settings, setSettings] = useState(initialSettings)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function saveSettings() {
    setSaving(true)
    setSaved(false)
    await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <main style={s.root}>
      <header style={s.header}>
        <div style={s.logo}>
          <div style={s.logoBox}>T</div>
          <strong style={s.logoText}>TiROiR</strong>
          <span style={s.badge}>Admin</span>
        </div>
        <Link href="/" style={s.backLink}>← Retour au site</Link>
      </header>

      <div style={s.content}>
        <h1 style={s.title}>Tableau de bord</h1>
        <p style={s.subtitle}>Données en temps réel depuis Supabase</p>

        {/* ── KPIs ── */}
        <div style={s.grid}>
          <Kpi label="Comptes créés" value={kpis.totalAccounts} />
          <Kpi label="Nouveaux comptes (30j)" value={kpis.newAccounts30d} />
          <Kpi label="Objets créés" value={kpis.totalObjects} />
          <Kpi label="Comptes avec ≥1 objet" value={`${kpis.accountsWithObjects} (${conversionPct}%)`} />
          <Kpi label="Médiane objets / user actif" value={kpis.medianObjectsPerActiveUser} />
          <Kpi label="Analyses IA (ce mois)" value={kpis.aiAnalysesThisMonth} />
          <Kpi label="Quota IA atteint (30j)" value={kpis.quotaExceeded30d} highlight={kpis.quotaExceeded30d > 0} />
        </div>

        {/* ── Quotas pilotables ── */}
        <h2 style={s.sectionTitle}>Quotas plan gratuit</h2>
        <p style={{ fontSize: 13, color: '#5b5b5b', marginBottom: 16 }}>
          Modifie les valeurs et clique Enregistrer — appliqué instantanément sans déploiement.
        </p>
        <div style={s.settingsCard}>
          <QuotaField
            label="Analyses IA / mois"
            hint="Actuellement 30 — à tester avec tes beta TestFlight"
            value={settings.free_ai_quota_monthly}
            onChange={v => setSettings(s => ({ ...s, free_ai_quota_monthly: v }))}
          />
          <div style={s.settingsDivider} />
          <QuotaField
            label="Objets max"
            hint="Limite d'objets par compte gratuit"
            value={settings.free_objects_max}
            onChange={v => setSettings(s => ({ ...s, free_objects_max: v }))}
          />
          <div style={s.settingsDivider} />
          <QuotaField
            label="Photos par objet"
            hint="1 = incite à passer premium pour plus de photos"
            value={settings.free_photos_per_object}
            onChange={v => setSettings(s => ({ ...s, free_photos_per_object: v }))}
          />
          <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={saveSettings} disabled={saving} style={s.saveBtn}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            {saved && <span style={s.savedBadge}>✓ Enregistré</span>}
          </div>
        </div>

        {/* ── Activité ── */}
        <h2 style={s.sectionTitle}>Activité (30 derniers jours)</h2>
        <div style={s.eventsTable}>
          {kpis.events.length === 0 && <p style={{ fontSize: 14, color: '#5b5b5b', padding: '16px 0' }}>Aucun événement sur cette période.</p>}
          {kpis.events.map(e => (
            <div key={e.action} style={s.eventRow}>
              <span style={s.eventAction}>{e.action}</span>
              <span style={s.eventCount}>{e.count}</span>
            </div>
          ))}
        </div>

        <p style={s.footnote}>
          Taux de conversion paywall et rétention J7/J30 arriveront avec le lancement du paywall IAP.
        </p>
      </div>
    </main>
  )
}

function Kpi({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div style={{ ...s.kpiCard, ...(highlight ? s.kpiCardHighlight : {}) }}>
      <span style={s.kpiValue}>{value}</span>
      <span style={s.kpiLabel}>{label}</span>
    </div>
  )
}

function QuotaField({ label, hint, value, onChange }: {
  label: string; hint: string; value: number; onChange: (v: number) => void
}) {
  return (
    <div style={s.settingsRow}>
      <div>
        <div style={s.settingsLabel}>{label}</div>
        <div style={s.settingsHint}>{hint}</div>
      </div>
      <input
        type="number"
        min={0}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={s.settingsInput}
      />
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const supabase = serverSupabase(ctx)
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return { redirect: { destination: '/login', permanent: false } }
  }

  const admin = adminSupabase()
  const { data: profile } = await admin
    .from('profiles')
    .select('is_admin')
    .eq('id', session.user.id)
    .single()

  if (!profile?.is_admin) return { notFound: true }

  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: totalAccounts },
    { count: newAccounts30d },
    { data: objectsByUser },
    { data: profilesUsage },
    { count: quotaExceeded30d },
    { data: events },
    { data: appSettings },
  ] = await Promise.all([
    admin.from('profiles').select('*', { count: 'exact', head: true }),
    admin.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', since30d),
    admin.from('objects').select('user_id'),
    admin.from('profiles').select('ai_analyses_used'),
    admin.from('activity_log').select('*', { count: 'exact', head: true }).eq('action', 'quota.exceeded').gte('created_at', since30d),
    admin.from('activity_log').select('action').gte('created_at', since30d),
    admin.from('app_settings').select('free_ai_quota_monthly,free_objects_max,free_photos_per_object').eq('id', 1).single(),
  ])

  const totalObjects = objectsByUser?.length ?? 0
  const countsPerUser = new Map<string, number>()
  for (const row of objectsByUser ?? []) {
    countsPerUser.set(row.user_id, (countsPerUser.get(row.user_id) ?? 0) + 1)
  }
  const activeCounts = Array.from(countsPerUser.values()).sort((a, b) => a - b)
  const medianObjectsPerActiveUser = activeCounts.length
    ? activeCounts[Math.floor(activeCounts.length / 2)] : 0

  const aiAnalysesThisMonth = (profilesUsage ?? []).reduce((sum, p) => sum + (p.ai_analyses_used ?? 0), 0)

  const eventCounts = new Map<string, number>()
  for (const e of events ?? []) eventCounts.set(e.action, (eventCounts.get(e.action) ?? 0) + 1)
  const eventsArr = Array.from(eventCounts.entries())
    .map(([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count)

  return {
    props: {
      kpis: {
        totalAccounts: totalAccounts ?? 0,
        newAccounts30d: newAccounts30d ?? 0,
        totalObjects,
        accountsWithObjects: countsPerUser.size,
        medianObjectsPerActiveUser,
        aiAnalysesThisMonth,
        quotaExceeded30d: quotaExceeded30d ?? 0,
        events: eventsArr,
      },
      settings: appSettings ?? { free_ai_quota_monthly: 30, free_objects_max: 30, free_photos_per_object: 1 },
    },
  }
}

const s: Record<string, React.CSSProperties> = {
  root:              { minHeight: '100vh', background: '#FAFAF7' },
  header:            { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: 'white', borderBottom: '1px solid rgba(0,0,0,0.06)' },
  logo:              { display: 'flex', alignItems: 'center', gap: 10 },
  logoBox:           { width: 32, height: 32, borderRadius: 9, background: '#F26900', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 },
  logoText:          { fontSize: 17, fontWeight: 800, color: '#121212' },
  badge:             { fontSize: 12, fontWeight: 700, color: '#F26900', background: '#FFE4CC', padding: '3px 10px', borderRadius: 999 },
  backLink:          { fontSize: 14, color: '#5b5b5b', textDecoration: 'none' },
  content:           { maxWidth: 960, margin: '0 auto', padding: '40px 24px' },
  title:             { fontSize: 28, fontWeight: 800, color: '#121212', marginBottom: 4 },
  subtitle:          { fontSize: 14, color: '#5b5b5b', marginBottom: 28 },
  grid:              { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 40 },
  kpiCard:           { background: 'white', borderRadius: 16, padding: '20px 24px', boxShadow: '0 4px 16px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 6 },
  kpiCardHighlight:  { borderColor: '#F26900', boxShadow: '0 4px 16px rgba(242,105,0,0.15)' },
  kpiValue:          { fontSize: 28, fontWeight: 800, color: '#121212' },
  kpiLabel:          { fontSize: 13, color: '#5b5b5b', fontWeight: 600 },
  sectionTitle:      { fontSize: 18, fontWeight: 700, color: '#121212', marginBottom: 8 },
  settingsCard:      { background: 'white', borderRadius: 16, padding: '24px', boxShadow: '0 4px 16px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.06)', marginBottom: 40 },
  settingsRow:       { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 },
  settingsDivider:   { height: 1, background: 'rgba(0,0,0,0.04)', margin: '16px 0' },
  settingsLabel:     { fontSize: 15, fontWeight: 600, color: '#121212' },
  settingsHint:      { fontSize: 13, color: '#5b5b5b', marginTop: 2 },
  settingsInput:     { width: 80, padding: '8px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 16, fontWeight: 700, textAlign: 'right', outline: 'none' },
  saveBtn:           { padding: '10px 24px', borderRadius: 10, background: '#F26900', color: 'white', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer' },
  savedBadge:        { fontSize: 14, color: '#2e7d32', fontWeight: 600 },
  eventsTable:       { background: 'white', borderRadius: 16, padding: '8px 24px', boxShadow: '0 4px 16px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.06)', marginBottom: 40 },
  eventRow:          { display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(0,0,0,0.04)' },
  eventAction:       { fontSize: 14, color: '#121212', fontWeight: 600 },
  eventCount:        { fontSize: 14, color: '#F26900', fontWeight: 700 },
  footnote:          { fontSize: 13, color: '#999' },
}
