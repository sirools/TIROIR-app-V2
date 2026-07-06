import type { GetServerSideProps } from 'next'
import { useState, useEffect } from 'react'
import { Settings } from 'lucide-react'
import HeaderTiroirWeb from '../components/layout/HeaderTiroirWeb'
import { serverSupabase, adminSupabase } from '../lib/supabase'

interface AppSettings {
  free_ai_quota_monthly: number
  free_objects_max: number
  free_photos_per_object: number
  premium_ai_quota_monthly: number
  premium_photo_enhance_quota_monthly: number
  supabase_db_limit_mb: number
  supabase_storage_limit_mb: number
  estimated_cost_per_ai_analysis_usd: number
  estimated_cost_per_photo_enhance_usd: number
  monthly_ai_spend_alert_usd: number
}

interface KPIs {
  siteVisits24h: number
  siteVisits7d: number
  siteVisits30d: number
  uniqueVisitors30d: number
  totalAccounts: number
  newAccounts30d: number
  totalObjects: number
  accountsWithObjects: number
  medianObjectsPerActiveUser: number
  aiAnalysesThisMonth: number
  photoEnhanceThisMonth: number
  quotaExceeded30d: number
  events: { action: string; count: number }[]
  dbSizeMb: number
  storageSizeMb: number
  aiAnalysesLifetime: number
  photoEnhanceLifetime: number
}

interface Props {
  kpis: KPIs
  settings: AppSettings
}

export default function Admin({ kpis, settings: initialSettings }: Props) {
  const conversionPct = kpis.totalAccounts > 0
    ? ((kpis.accountsWithObjects / kpis.totalAccounts) * 100).toFixed(1)
    : '0'

  const [tab, setTab] = useState<TabKey>('dashboard')
  const [settings, setSettings] = useState(initialSettings)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [sim, setSim] = useState<SimulationInputs>(DEFAULT_SIM)
  const [simMode, setSimMode] = useState<SimMode>('launch')
  const [mixOpen, setMixOpen] = useState(false)
  const r = computeSimulation(sim, simMode, settings)
  const setSimField = (k: keyof SimulationInputs) => (v: number) => setSim(s => ({ ...s, [k]: v }))
  // Éditer un nombre d'abonnés depuis un launch pur bascule en « base installée »
  // (en hybride/base installée, on conserve le mode choisi).
  const setDirectField = (k: keyof SimulationInputs) => (v: number) => {
    setSimMode(m => (m === 'launch' ? 'installed' : m))
    setSim(s => ({ ...s, [k]: v }))
  }
  // Observé (KPIs réels) — sert de repère face aux hypothèses
  const observed = deriveObserved(kpis)

  // Persistance locale des hypothèses (localStorage — pas de base, pas de SSR)
  const [simSaved, setSimSaved] = useState(false)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SIM_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as { sim?: Partial<SimulationInputs>; mode?: string }
      if (parsed.sim) setSim(prev => ({ ...prev, ...parsed.sim }))
      if (parsed.mode === 'launch' || parsed.mode === 'installed' || parsed.mode === 'hybrid') {
        setSimMode(parsed.mode)
      }
    } catch { /* stockage indisponible ou JSON invalide : on garde les défauts */ }
  }, [])
  function saveSim() {
    try {
      localStorage.setItem(SIM_STORAGE_KEY, JSON.stringify({ sim, mode: simMode }))
      setSimSaved(true)
      setTimeout(() => setSimSaved(false), 2500)
    } catch { /* stockage indisponible : ignore */ }
  }
  function resetSim() {
    setSim(DEFAULT_SIM)
    setSimMode('launch')
    try { localStorage.removeItem(SIM_STORAGE_KEY) } catch { /* ignore */ }
  }

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

  const monthlyAiCost = kpis.aiAnalysesThisMonth * settings.estimated_cost_per_ai_analysis_usd
    + kpis.photoEnhanceThisMonth * settings.estimated_cost_per_photo_enhance_usd
  const lifetimeAiCost = kpis.aiAnalysesLifetime * settings.estimated_cost_per_ai_analysis_usd
    + kpis.photoEnhanceLifetime * settings.estimated_cost_per_photo_enhance_usd
  const costAlert = monthlyAiCost > settings.monthly_ai_spend_alert_usd

  const dbPct = settings.supabase_db_limit_mb > 0 ? (kpis.dbSizeMb / settings.supabase_db_limit_mb) * 100 : 0
  const storagePct = settings.supabase_storage_limit_mb > 0 ? (kpis.storageSizeMb / settings.supabase_storage_limit_mb) * 100 : 0

  return (
    <main style={s.root}>
      <HeaderTiroirWeb />

      <div style={s.content}>
        <h1 style={s.title}>{TAB_META[tab].title}</h1>
        <p style={s.subtitle}>{TAB_META[tab].subtitle}</p>

        {/* ── Onglets ── */}
        <div style={s.tabBar}>
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{ ...s.tabBtn, ...(tab === t ? s.tabBtnActive : {}) }}
            >
              {TAB_META[t].label}
            </button>
          ))}
        </div>

        {tab === 'dashboard' && (<>
        {/* ── Site web ── */}
        <div style={s.grid}>
          <Kpi label="Visiteurs uniques (30j)" value={kpis.uniqueVisitors30d} highlight={kpis.uniqueVisitors30d > 0} />
          <Kpi label="Visites (24h)" value={kpis.siteVisits24h} />
          <Kpi label="Visites (7j)" value={kpis.siteVisits7d} />
          <Kpi label="Visites (30j)" value={kpis.siteVisits30d} />
        </div>

        {/* ── KPIs ── */}
        <div style={s.grid}>
          <Kpi label="Comptes créés" value={kpis.totalAccounts} />
          <Kpi label="Nouveaux comptes (30j)" value={kpis.newAccounts30d} />
          <Kpi label="Objets créés" value={kpis.totalObjects} />
          <Kpi label="Comptes avec ≥1 objet" value={`${kpis.accountsWithObjects} (${conversionPct}%)`} />
          <Kpi label="Médiane objets / user actif" value={kpis.medianObjectsPerActiveUser} />
          <Kpi label="Analyses IA (ce mois)" value={kpis.aiAnalysesThisMonth} />
          <Kpi label="Améliorations photo IA (ce mois)" value={kpis.photoEnhanceThisMonth} />
          <Kpi label="Quota IA atteint (30j)" value={kpis.quotaExceeded30d} highlight={kpis.quotaExceeded30d > 0} />
        </div>

        {/* ── Infrastructure & coûts IA ── */}
        <h2 style={s.sectionTitle}>Infrastructure & coûts IA</h2>
        <p style={{ fontSize: 13, color: '#5b5b5b', marginBottom: 16 }}>
          Les coûts IA sont des <strong>estimations</strong> basées sur un coût moyen configurable par appel (pas un total exact issu de la facturation Anthropic/Google — aucun tracking de tokens réel pour l&apos;instant).
        </p>

        <div style={s.grid}>
          <div style={s.gaugeCard}>
            <div style={s.gaugeHeader}>
              <span style={s.gaugeLabel}>Base de données</span>
              <span style={s.gaugeValue}>{kpis.dbSizeMb.toFixed(1)} / {settings.supabase_db_limit_mb} Mo</span>
            </div>
            <GaugeBar pct={dbPct} />
          </div>
          <div style={s.gaugeCard}>
            <div style={s.gaugeHeader}>
              <span style={s.gaugeLabel}>Storage</span>
              <span style={s.gaugeValue}>{kpis.storageSizeMb.toFixed(1)} / {settings.supabase_storage_limit_mb} Mo</span>
            </div>
            <GaugeBar pct={storagePct} />
          </div>
          <div style={{ ...s.kpiCard, ...(costAlert ? s.kpiCardAlert : {}) }}>
            <span style={s.kpiValue}>{monthlyAiCost.toFixed(2)} $</span>
            <span style={s.kpiLabel}>Coût IA estimé (ce mois)</span>
            {costAlert && <span style={s.alertText}>⚠ Dépasse le seuil de {settings.monthly_ai_spend_alert_usd} $</span>}
          </div>
          <Kpi label="Coût IA estimé (depuis le lancement)" value={`${lifetimeAiCost.toFixed(2)} $`} />
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
        </>)}

        {tab === 'quotas' && (<>
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
          <div style={s.settingsDivider} />
          <div style={s.settingsRow}>
            <div>
              <div style={s.settingsLabel}>Améliorations photo IA</div>
              <div style={s.settingsHint}>Fonctionnalité premium uniquement — fixé à 0 pour le gratuit, non modifiable</div>
            </div>
            <span style={s.settingsLocked}>0 🔒</span>
          </div>
        </div>

        {/* ── Quotas premium pilotables ── */}
        <h2 style={s.sectionTitle}>Quotas plan premium</h2>
        <p style={{ fontSize: 13, color: '#5b5b5b', marginBottom: 16 }}>
          Appliqué en direct à tous les comptes premium via les RPC de quota (aucun déploiement). Objets et photos par objet restent illimités en premium.
        </p>
        <div style={s.settingsCard}>
          <QuotaField
            label="Analyses IA / mois"
            hint="Plafond premium — évite un coût API non maîtrisé sur les gros utilisateurs"
            value={settings.premium_ai_quota_monthly}
            onChange={v => setSettings(s => ({ ...s, premium_ai_quota_monthly: v }))}
          />
          <div style={s.settingsDivider} />
          <QuotaField
            label="Améliorations photo IA / mois"
            hint="Retouche photo (Gemini) — réservée au premium, jamais illimitée"
            value={settings.premium_photo_enhance_quota_monthly}
            onChange={v => setSettings(s => ({ ...s, premium_photo_enhance_quota_monthly: v }))}
          />
        </div>

        {/* ── Infra & coûts pilotables ── */}
        <h2 style={s.sectionTitle}>Limites infra & hypothèses de coût</h2>
        <p style={{ fontSize: 13, color: '#5b5b5b', marginBottom: 16 }}>
          À ajuster quand tu changes de plan Supabase ou que les prix des API IA évoluent.
        </p>
        <div style={s.settingsCard}>
          <QuotaField
            label="Limite base de données (Mo)"
            hint="500 Mo = plan Supabase Free"
            value={settings.supabase_db_limit_mb}
            onChange={v => setSettings(s => ({ ...s, supabase_db_limit_mb: v }))}
          />
          <div style={s.settingsDivider} />
          <QuotaField
            label="Limite Storage (Mo)"
            hint="1024 Mo = plan Supabase Free"
            value={settings.supabase_storage_limit_mb}
            onChange={v => setSettings(s => ({ ...s, supabase_storage_limit_mb: v }))}
          />
          <div style={s.settingsDivider} />
          <QuotaField
            label="Coût estimé / analyse IA ($)"
            hint="Coût moyen d'un appel Claude (approximatif)"
            value={settings.estimated_cost_per_ai_analysis_usd}
            step={0.001}
            onChange={v => setSettings(s => ({ ...s, estimated_cost_per_ai_analysis_usd: v }))}
          />
          <div style={s.settingsDivider} />
          <QuotaField
            label="Coût estimé / amélioration photo ($)"
            hint="Prix Gemini 2.5 Flash Image : 0,039 $"
            value={settings.estimated_cost_per_photo_enhance_usd}
            step={0.001}
            onChange={v => setSettings(s => ({ ...s, estimated_cost_per_photo_enhance_usd: v }))}
          />
          <div style={s.settingsDivider} />
          <QuotaField
            label="Seuil d'alerte dépense IA / mois ($)"
            hint="Le KPI ci-dessus s'affiche en rouge au-delà"
            value={settings.monthly_ai_spend_alert_usd}
            step={1}
            onChange={v => setSettings(s => ({ ...s, monthly_ai_spend_alert_usd: v }))}
          />
        </div>

        {/* ── Barre d'enregistrement globale ── */}
        <div style={s.saveBar}>
          <span style={s.saveBarHint}>Enregistre l&apos;ensemble des quotas et hypothèses de coût.</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {saved && <span style={s.savedBadge}>✓ Enregistré</span>}
            <button onClick={saveSettings} disabled={saving} style={s.saveBtn}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </div>
        </>)}

        {tab === 'simulation' && (<>
        <p style={{ fontSize: 13, color: '#5b5b5b', marginBottom: 16 }}>
          Simulation décisionnelle : aucune donnée n&apos;est enregistrée côté serveur. Les coûts IA sont des estimations moyennes, pas une facture réelle — le tracking token réel n&apos;est pas encore implémenté. Coûts unitaires de capture objet et de retouche photo repris de l&apos;onglet <strong>Quotas</strong> (mis à jour en direct). Coûts approximés à parité $≈€.
        </p>

        {/* Sauvegarde locale des hypothèses */}
        <div style={s.simToolbar}>
          <span style={s.settingsHint}>Les hypothèses sont mémorisées dans ce navigateur et restaurées à ton retour.</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {simSaved && <span style={s.savedBadge}>✓ Sauvegardé</span>}
            <button style={s.scenarioBtn} onClick={resetSim}>Réinitialiser</button>
            <button style={s.saveBtn} onClick={saveSim}>Sauvegarder</button>
          </div>
        </div>

        {/* Scénarios rapides */}
        <div style={s.scenarioRow}>
          <span style={s.scenarioLabel}>Scénarios rapides :</span>
          {SCENARIOS.map(n => (
            <button
              key={n}
              onClick={() => setSimField('visitors')(n)}
              style={{ ...s.scenarioBtn, ...(sim.visitors === n ? s.scenarioBtnActive : {}) }}
            >
              {n.toLocaleString('fr-FR')} visiteurs
            </button>
          ))}
        </div>

        {/* Mode de scénario */}
        <div style={s.settingsCard}>
          <div style={s.modeSeg}>
            <button onClick={() => setSimMode('launch')}
              style={{ ...s.modeSegBtn, ...(simMode === 'launch' ? s.modeSegBtnActive : {}) }}>Launch / funnel</button>
            <button onClick={() => setSimMode('installed')}
              style={{ ...s.modeSegBtn, ...(simMode === 'installed' ? s.modeSegBtnActive : {}) }}>Base installée</button>
            <button onClick={() => setSimMode('hybrid')}
              style={{ ...s.modeSegBtn, ...(simMode === 'hybrid' ? s.modeSegBtnActive : {}) }}>Hybride</button>
          </div>
          <div style={s.settingsHint}>
            {simMode === 'launch'
              ? 'Les abonnés sont calculés depuis visiteurs → comptes → activés → conversion payante (Pro/Entreprise à 0).'
              : simMode === 'installed'
              ? 'Les abonnés saisis manuellement représentent une base installée ou un scénario commercial, pas automatiquement les conversions du trafic simulé.'
              : 'Hybride : acquisition simulée (conversion du trafic) + abonnés existants saisis manuellement.'}
          </div>
        </div>

        {/* Résumé financier */}
        <div style={s.grid3}>
          <SimStat label="MRR total brut" value={fmtMoney(r.mrrGross)} />
          <SimStat label="MRR total net" value={fmtMoney(r.mrrNet)} sub="frais par canal déduits" highlight={r.mrrNet > 0} />
          <SimStat label="Coût IA total" value={fmtMoney(r.costAiTotal)} />
          <SimStat label="Coût variable total" value={fmtMoney(r.costVariable)} sub="IA + storage" />
          <SimStat label="Marge variable" value={fmtMoney(r.marginVariable)} sub={fmtPct(r.marginPct)}
            tone={r.marginVariable < 0 ? 'bad' : 'good'} />
          <div style={{ ...s.simStatCard, ...healthCardStyle(r.status) }}>
            <span style={{ ...s.simStatValue, ...healthTextStyle(r.status) }}>{healthLabel(r.status)}</span>
            <span style={s.kpiLabel}>Statut du scénario</span>
          </div>
        </div>

        <div style={s.simLayout}>
          {/* ── HYPOTHÈSES : paramètres par catégories ── */}
          <div style={s.simParamsCol}>
            <SimGroup title="A. Acquisition">
              <SimSlider label="Visiteurs simulés" value={sim.visitors} min={0} max={20000} step={25}
                onChange={setSimField('visitors')} format={v => v.toLocaleString('fr-FR')} />
              <SimSlider label="Conversion visite → compte" value={sim.convVisitToAccount} min={0} max={100} step={0.5}
                onChange={setSimField('convVisitToAccount')} suffix="%" />
              <SimSlider label="Activation compte → 1er objet" value={sim.convAccountToActivated} min={0} max={100} step={1}
                onChange={setSimField('convAccountToActivated')} suffix="%" last />
              {observed.accounts > 0 && (
                <div style={s.observedBox}>
                  <div style={s.observedRow}>
                    <span><Badge kind="hypo" />Activation : hypothèse <strong>{fmtPct(sim.convAccountToActivated)}</strong></span>
                    <span><Badge kind="observed" />observé <strong>{fmtPct(observed.activationPct)}</strong></span>
                  </div>
                  <button style={s.linkBtn} onClick={() => setSimField('convAccountToActivated')(Math.round(observed.activationPct))}>
                    Aligner sur observé
                  </button>
                </div>
              )}
            </SimGroup>

            <SimGroup title="B. Revenus & abonnements">
              {(simMode === 'launch' || simMode === 'hybrid') && (
                <SimSlider label="Conversion premium (des activés)" value={sim.convToPremium} min={0} max={100} step={0.5}
                  onChange={setSimField('convToPremium')} suffix="%" />
              )}
              <SimSlider label="Prix Premium" value={sim.premiumPrice} min={0} max={30} step={0.5}
                onChange={setSimField('premiumPrice')} suffix=" €" />
              <SimSlider label="Prix Pro" value={sim.proPrice} min={0} max={100} step={1}
                onChange={setSimField('proPrice')} suffix=" €" />
              <SimSlider label="Prix Entreprise / API" value={sim.enterprisePrice} min={0} max={500} step={5}
                onChange={setSimField('enterprisePrice')} suffix=" €" />
              <div style={{ ...s.settingsHint, margin: '2px 0 12px' }}>Frais appliqués par canal (pas la même commission pour tous) :</div>
              <SimSlider label="Commission Premium mobile" value={sim.premiumFeePct} min={0} max={30} step={1}
                onChange={setSimField('premiumFeePct')} suffix="%" />
              <SimSlider label="Frais Pro web" value={sim.proFeePct} min={0} max={15} step={0.5}
                onChange={setSimField('proFeePct')} suffix="%" />
              <SimSlider label="Frais Entreprise / API" value={sim.enterpriseFeePct} min={0} max={15} step={0.5}
                onChange={setSimField('enterpriseFeePct')} suffix="%" last />
            </SimGroup>

            <SimGroup title="C. Usage IA (par utilisateur / mois)">
              <SimSlider label="Capture objet — gratuit (Claude Vision)" value={sim.captureAiFreePerUser} min={0} max={100} step={1}
                onChange={setSimField('captureAiFreePerUser')} />
              <SimSlider label="Capture objet — payant" value={sim.captureAiPremiumPerUser} min={0} max={300} step={5}
                onChange={setSimField('captureAiPremiumPerUser')} />
              <SimSlider label="Messages assistant — payant (Claude)" value={sim.assistantMsgPremiumPerUser} min={0} max={300} step={5}
                onChange={setSimField('assistantMsgPremiumPerUser')} />
              <SimSlider label="Estimations de valeur — payant (Sonnet)" value={sim.valueEstimatePremiumPerUser} min={0} max={100} step={1}
                onChange={setSimField('valueEstimatePremiumPerUser')} />
              <SimSlider label="Retouches photo — payant (Gemini)" value={sim.photoEnhancePremiumPerUser} min={0} max={200} step={5}
                onChange={setSimField('photoEnhancePremiumPerUser')} />
              <SimSlider label="Multiplicateur de retry IA" value={sim.aiRetryMultiplier} min={1} max={1.5} step={0.05}
                onChange={setSimField('aiRetryMultiplier')} format={v => v.toFixed(2)} suffix="×" last />
            </SimGroup>

            <SimGroup title="D. Coûts unitaires IA">
              <div style={{ ...s.settingsHint, marginBottom: 14 }}>
                Capture objet ({fmtMoney(settings.estimated_cost_per_ai_analysis_usd)}) et retouche photo ({fmtMoney(settings.estimated_cost_per_photo_enhance_usd)}) proviennent de l’onglet Quotas. Les deux ci-dessous sont locaux et non persistés.
              </div>
              <SimSlider label="Coût moyen message assistant" value={sim.costAssistantMsgUsd} min={0} max={0.05} step={0.001}
                onChange={setSimField('costAssistantMsgUsd')} format={v => v.toFixed(3)} suffix=" $" />
              <SimSlider label="Coût moyen estimation de valeur" value={sim.costValueEstimateUsd} min={0} max={0.1} step={0.005}
                onChange={setSimField('costValueEstimateUsd')} format={v => v.toFixed(3)} suffix=" $" last />
            </SimGroup>

            <SimGroup title="E. Infra & stockage">
              <SimSlider label="Stockage / utilisateur gratuit (Mo)" value={sim.storageFreeMb} min={0} max={500} step={5}
                onChange={setSimField('storageFreeMb')} />
              <SimSlider label="Stockage / utilisateur premium (Mo)" value={sim.storagePremiumMb} min={0} max={1000} step={10}
                onChange={setSimField('storagePremiumMb')} />
              <SimSlider label="Stockage / utilisateur Pro/Entreprise (Mo)" value={sim.storageProMb} min={0} max={2000} step={10}
                onChange={setSimField('storageProMb')} />
              <SimSlider label="Coût storage" value={sim.storageCostPerGbUsd} min={0} max={0.2} step={0.001}
                onChange={setSimField('storageCostPerGbUsd')} format={v => v.toFixed(3)} suffix=" $/Go" />
              <SimSlider label="Bande passante / utilisateur actif (Mo, optionnel)" value={sim.bandwidthPerActiveUserMb} min={0} max={500} step={5}
                onChange={setSimField('bandwidthPerActiveUserMb')} last />
            </SimGroup>

            <SimGroup title="F. Résultat business réaliste">
              <SimSlider label="Coûts fixes mensuels (outils, infra, compta…)" value={sim.fixedCostsMonthly} min={0} max={3000} step={50}
                onChange={setSimField('fixedCostsMonthly')} suffix=" €" />
              <SimSlider label="Provision charges / taxes / sécurité" value={sim.taxProvisionPct} min={0} max={70} step={1}
                onChange={setSimField('taxProvisionPct')} suffix="%" />
              <SimSlider label="Objectif de rémunération nette / mois" value={sim.targetNetIncome} min={0} max={10000} step={100}
                onChange={setSimField('targetNetIncome')} suffix=" €" last />
            </SimGroup>
          </div>

          {/* ── RÉSULTATS ── */}
          <div style={s.simResultsCol}>
            {/* Qualité de l'hypothèse */}
            <div style={{ ...s.settingsCard, ...plausCardStyle(r.plausibility.plausibility) }}>
              <div style={s.simGroupHeaderRow}>
                <span style={s.simGroupTitle}>Qualité de l’hypothèse</span>
                <span style={{ ...s.plausBadge, ...plausBadgeStyle(r.plausibility.plausibility) }}>
                  Plausibilité {r.plausibility.plausibility}
                </span>
              </div>
              <div style={{ ...s.settingsHint, marginBottom: 10 }}>
                Type de scénario détecté : <strong>{r.plausibility.scenarioType}</strong>
              </div>
              <div style={s.plausSubtitle}>Raisons principales</div>
              <ul style={s.plausList}>
                {r.plausibility.reasons.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
              {r.plausibility.recommendations.length > 0 && (<>
                <div style={s.plausSubtitle}>Recommandations</div>
                <ul style={s.plausList}>
                  {r.plausibility.recommendations.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
              </>)}
            </div>

            {/* Abonnements */}
            <div style={s.settingsCard}>
              <div style={s.simGroupHeaderRow}>
                <span style={s.simGroupTitle}>Abonnements ({simMode === 'launch' ? 'launch / funnel' : simMode === 'installed' ? 'base installée' : 'hybride'})</span>
                <button onClick={() => setMixOpen(o => !o)} style={s.gearBtn} title="Répartition abonnements" aria-label="Répartition abonnements">
                  <Settings size={16} />
                </button>
              </div>
              <div style={s.grid3}>
                <SimStat label="Premium" value={fmtInt(r.premium)} highlight={r.premium >= 1} />
                <SimStat label="Pro" value={fmtInt(r.pro)} />
                <SimStat label="Entreprise / API" value={fmtInt(r.enterprise)} />
                <SimStat label="Total payants" value={fmtInt(r.paidTotal)} sub={`${fmtInt(r.activatedFree)} gratuits actifs`} />
              </div>
              {mixOpen && (
                <div style={s.mixPanel}>
                  <div style={s.simGroupTitle}>Répartition abonnements (base installée)</div>
                  <div style={{ ...s.settingsHint, marginBottom: 12 }}>
                    Ces nombres représentent une base installée ou un scénario commercial. Les éditer depuis un launch pur bascule en mode « Base installée ».
                  </div>
                  <SimNumberField label="Abonnés Premium" value={sim.directPremium} onChange={setDirectField('directPremium')} />
                  <SimNumberField label="Abonnés Pro" value={sim.directPro} onChange={setDirectField('directPro')} />
                  <SimNumberField label="Abonnés Entreprise / API" value={sim.directEnterprise} onChange={setDirectField('directEnterprise')} />
                </div>
              )}
            </div>

            {/* Ratios clés */}
            <div style={s.settingsCard}>
              <div style={s.simGroupTitle}>Ratios clés (cohérence funnel)</div>
              <RatioRow label="Visite → compte" value={fmtPct(r.ratios.visitToAccountPct)} />
              <RatioRow label="Compte → activé" value={fmtPct(r.ratios.accountToActivatedPct)} />
              <RatioRow label="Activé → payant" value={fmtPct(r.ratios.activatedToPaidPct)}
                warn={r.ratios.flags.activatedToPaidOver100 || r.ratios.flags.premiumConvOver10}
                hint={r.ratios.flags.activatedToPaidOver100 ? '> 100 % : incohérent hors base installée' : r.ratios.flags.premiumConvOver10 ? '> 10 % : très optimiste en B2C' : undefined} />
              <RatioRow label="Visite → payant" value={fmtPct(r.ratios.visitToPaidPct)}
                warn={r.ratios.flags.visitToPaidOver5} hint={r.ratios.flags.visitToPaidOver5 ? '> 5 % : irréaliste' : undefined} />
              <RatioRow label="Répartition payants (P / Pro / Ent.)"
                value={`${fmtPct(r.ratios.sharePremium)} / ${fmtPct(r.ratios.sharePro)} / ${fmtPct(r.ratios.shareEnterprise)}`} />
              <RatioRow label="ARPU payant" value={fmtMoney(r.ratios.arpuPaid)} />
              <RatioRow label="Marge variable / payant" value={fmtMoney(r.ratios.marginPerPaid)}
                warn={r.ratios.marginPerPaid < 0} />
              <RatioRow label="Coût IA / activé" value={fmtMoney(r.ratios.costAiPerActivated)}
                warn={r.ratios.flags.aiCostOverRevenue} hint={r.ratios.flags.aiCostOverRevenue ? 'dépasse le revenu net / activé' : undefined} />
              <RatioRow label="Coût IA / payant" value={fmtMoney(r.ratios.costAiPerPaid)} last />
            </div>

            {/* Revenus */}
            <div style={s.settingsCard}>
              <div style={s.simGroupTitle}>Revenus (brut → net par offre)</div>
              <div style={s.grid3}>
                <SimStat label="Premium brut" value={fmtMoney(r.mrrPremiumGross)} sub={`net ${fmtMoney(r.mrrPremiumNet)}`} />
                <SimStat label="Pro brut" value={fmtMoney(r.mrrProGross)} sub={`net ${fmtMoney(r.mrrProNet)}`} />
                <SimStat label="Entreprise/API brut" value={fmtMoney(r.mrrEnterpriseGross)} sub={`net ${fmtMoney(r.mrrEnterpriseNet)}`} />
                <SimStat label="MRR total brut" value={fmtMoney(r.mrrGross)} />
                <SimStat label="MRR total net" value={fmtMoney(r.mrrNet)} highlight={r.mrrNet > 0} />
                <SimStat label="ARPU payant" value={fmtMoney(r.arpuPaid)} />
                <SimStat label="Revenu net / activé" value={fmtMoney(r.netRevenuePerActivated)} />
              </div>
            </div>

            {/* Coûts IA */}
            <div style={s.settingsCard}>
              <div style={s.simGroupTitle}>Coûts IA</div>
              <div style={s.grid3}>
                <SimStat label="Capture objet (Claude)" value={fmtMoney(r.costCapture)} />
                <SimStat label="Assistant (Claude)" value={fmtMoney(r.costAssistant)} />
                <SimStat label="Estimation valeur (Sonnet)" value={fmtMoney(r.costValueEstimate)} />
                <SimStat label="Retouches photo (Gemini)" value={fmtMoney(r.costPhoto)} />
                <SimStat label="Coût IA total" value={fmtMoney(r.costAiTotal)} />
                <SimStat label="Coût IA / activé" value={fmtMoney(r.costAiPerActivated)} />
                <SimStat label="Coût IA / payant" value={fmtMoney(r.costAiPerPaid)} />
              </div>
            </div>

            {/* Infra */}
            <div style={s.settingsCard}>
              <div style={s.simGroupTitle}>Infra & stockage</div>
              <div style={s.grid3}>
                <SimStat label="Stockage total" value={`${fmtInt(r.storageMb)} Mo`} sub={`${fmtPct(r.storagePctOfLimit)} de la limite`} />
                <SimStat label="Coût storage estimé" value={fmtMoney(r.costStorage)} />
                <SimStat label="Coût bande passante" value={fmtMoney(r.costBandwidth)} sub="hors marge variable" />
              </div>
              <div style={{ marginTop: 12 }}>
                <div style={s.gaugeHeader}>
                  <span style={s.gaugeLabel}>Stockage vs limite déclarée</span>
                  <span style={s.gaugeValue}>{fmtInt(r.storageMb)} / {settings.supabase_storage_limit_mb} Mo</span>
                </div>
                <CompareBar value={r.storagePctOfLimit} max={100} color={r.storagePctOfLimit >= 90 ? '#C0392B' : r.storagePctOfLimit >= 70 ? '#D97706' : '#2e7d32'} />
              </div>
            </div>

            {/* Résultat business réaliste */}
            <div style={s.settingsCard}>
              <div style={s.simGroupTitle}>Résultat business réaliste</div>
              <div style={{ ...s.settingsHint, marginBottom: 12 }}>
                Ce bloc ne remplace pas une simulation comptable. Il sert à relier le MRR à une rémunération potentielle.
              </div>
              <div style={s.grid3}>
                <SimStat label="Marge variable" value={fmtMoney(r.marginVariable)} tone={r.marginVariable < 0 ? 'bad' : 'good'} />
                <SimStat label="Marge après coûts fixes" value={fmtMoney(r.business.marginAfterFixed)} tone={r.business.marginAfterFixed < 0 ? 'bad' : 'good'} />
                <SimStat label="Rémunération potentielle" value={fmtMoney(r.business.potentialNetIncome)} sub={`objectif ${fmtMoney(sim.targetNetIncome)}`} />
                <SimStat label="Écart avec objectif" value={fmtMoney(r.business.incomeGap)} tone={r.business.incomeGap < 0 ? 'bad' : 'good'} />
                <SimStat label="Premium équiv. pour l’objectif"
                  value={r.business.premiumEquivNeeded === null ? '—' : fmtInt(r.business.premiumEquivNeeded)}
                  sub={r.business.premiumEquivNeeded === null ? 'contribution unitaire ≤ 0' : 'abonnés Premium'} />
              </div>
            </div>

            {/* Comparaison MRR net vs coût variable + alertes actionnables */}
            <div style={s.settingsCard}>
              <div style={s.gaugeHeader}>
                <span style={s.gaugeLabel}>MRR net</span>
                <span style={s.gaugeValue}>{fmtMoney(r.mrrNet)}</span>
              </div>
              <CompareBar value={r.mrrNet} max={Math.max(r.mrrNet, r.costVariable, 1)} color="#2e7d32" />
              <div style={{ ...s.gaugeHeader, marginTop: 12 }}>
                <span style={s.gaugeLabel}>Coût variable</span>
                <span style={s.gaugeValue}>{fmtMoney(r.costVariable)}</span>
              </div>
              <CompareBar value={r.costVariable} max={Math.max(r.mrrNet, r.costVariable, 1)} color="#D97706" />

              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {r.alerts.map((a, i) => (
                  <div key={i} style={a.level === 'bad' ? s.simAlert : a.level === 'warn' ? s.simWarn : s.simOk}>
                    {a.level === 'bad' ? '⚠ ' : a.level === 'warn' ? 'ℹ ' : '✓ '}{a.text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        </>)}
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

function GaugeBar({ pct }: { pct: number }) {
  const clamped = Math.min(pct, 100)
  const color = pct >= 90 ? '#C0392B' : pct >= 70 ? '#D97706' : '#2e7d32'
  return (
    <div style={s.gaugeTrack}>
      <div style={{ ...s.gaugeFill, width: `${clamped}%`, background: color }} />
    </div>
  )
}

function QuotaField({ label, hint, value, onChange, step = 1 }: {
  label: string; hint: string; value: number; onChange: (v: number) => void; step?: number
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
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={s.settingsInput}
      />
    </div>
  )
}

// ── Onglets ─────────────────────────────────────────────────────────────
type TabKey = 'dashboard' | 'quotas' | 'simulation'
const TABS: TabKey[] = ['dashboard', 'quotas', 'simulation']
const TAB_META: Record<TabKey, { label: string; title: string; subtitle: string }> = {
  dashboard: { label: 'Tableau de bord', title: 'Tableau de bord', subtitle: 'Données en temps réel depuis Supabase' },
  quotas: { label: 'Quotas', title: 'Quotas & coûts', subtitle: 'Modifie les valeurs et enregistre — appliqué instantanément sans déploiement.' },
  simulation: { label: 'Simulation économique', title: 'Simulation économique', subtitle: 'Simule l’impact d’un lancement sur les coûts infra/IA et les revenus premium.' },
}

// ── Simulation économique ──────────────────────────────────────────────
// Cockpit business local (aucune persistance). Modélise plusieurs offres
// (Premium / Pro / Entreprise-API), tous les usages IA de l'app, et évalue
// la crédibilité des hypothèses.
type SimMode = 'launch' | 'installed' | 'hybrid'

interface SimulationInputs {
  // A. Acquisition
  visitors: number
  convVisitToAccount: number          // % visite → compte
  convAccountToActivated: number      // % compte → 1er objet
  // B. Revenus & abonnements
  convToPremium: number               // % des activés → premium (funnel)
  premiumPrice: number                // € / mois
  proPrice: number                    // € / mois
  enterprisePrice: number             // € / mois
  premiumFeePct: number               // commission mobile (App/Play Store)
  proFeePct: number                   // frais paiement web (Stripe…)
  enterpriseFeePct: number            // frais Entreprise / API
  directPremium: number               // abonnés Premium existants (base installée)
  directPro: number                   // abonnés Pro existants
  directEnterprise: number            // abonnés Entreprise/API existants
  // C. Usage IA (par utilisateur / mois)
  captureAiFreePerUser: number        // analyses capture objet — gratuit (Claude Vision)
  captureAiPremiumPerUser: number     // analyses capture objet — payant
  assistantMsgPremiumPerUser: number  // messages assistant IA — payant (Claude)
  valueEstimatePremiumPerUser: number // estimations de valeur — payant (Sonnet + web search)
  photoEnhancePremiumPerUser: number  // retouches photo — payant (Gemini)
  aiRetryMultiplier: number           // retries transitoires Claude/Gemini (≈1.0–1.2)
  // D. Coûts unitaires IA (local, non persisté)
  costAssistantMsgUsd: number         // coût moyen message assistant
  costValueEstimateUsd: number        // coût moyen estimation de valeur
  // E. Infra & stockage
  storageFreeMb: number               // Mo / utilisateur gratuit
  storagePremiumMb: number            // Mo / utilisateur premium
  storageProMb: number                // Mo / utilisateur Pro/Entreprise
  storageCostPerGbUsd: number         // coût storage / Go / mois
  bandwidthPerActiveUserMb: number    // bande passante / utilisateur actif / mois (optionnel)
  bandwidthCostPerGbUsd: number       // coût bande passante / Go
  // F. Résultat business réaliste
  fixedCostsMonthly: number           // coûts fixes mensuels (outils, infra, compta, support)
  taxProvisionPct: number             // provision charges / taxes / sécurité
  targetNetIncome: number             // objectif de rémunération nette / mois
}

const DEFAULT_SIM: SimulationInputs = {
  visitors: 1000,
  convVisitToAccount: 8,
  convAccountToActivated: 60,
  convToPremium: 4,
  premiumPrice: 6.99,
  proPrice: 29,
  enterprisePrice: 149,
  premiumFeePct: 30,
  proFeePct: 3,
  enterpriseFeePct: 1,
  directPremium: 50,
  directPro: 5,
  directEnterprise: 1,
  captureAiFreePerUser: 10,
  captureAiPremiumPerUser: 40,
  assistantMsgPremiumPerUser: 30,
  valueEstimatePremiumPerUser: 5,
  photoEnhancePremiumPerUser: 15,
  aiRetryMultiplier: 1.1,
  costAssistantMsgUsd: 0.003,
  costValueEstimateUsd: 0.02,
  storageFreeMb: 20,
  storagePremiumMb: 80,
  storageProMb: 200,
  storageCostPerGbUsd: 0.021, // ~ Supabase storage au-delà du quota gratuit
  bandwidthPerActiveUserMb: 0,
  bandwidthCostPerGbUsd: 0.09,
  fixedCostsMonthly: 100,
  taxProvisionPct: 35,
  targetNetIncome: 2000,
}

const SCENARIOS = [25, 50, 100, 1000, 10000]

// Clé de persistance locale des hypothèses de simulation (navigateur uniquement)
const SIM_STORAGE_KEY = 'tiroir.admin.sim.v1'

// ── Types de sortie ────────────────────────────────────────────────────
interface FunnelResult {
  visitors: number; accounts: number; activated: number
  visitToAccountPct: number; accountToActivatedPct: number
}
interface SubscriberResult {
  accounts: number; activated: number; activatedFree: number
  funnelPremium: number
  premium: number; pro: number; enterprise: number; paidTotal: number
}
interface RevenueResult {
  mrrPremiumGross: number; mrrProGross: number; mrrEnterpriseGross: number; mrrGross: number
  mrrPremiumNet: number; mrrProNet: number; mrrEnterpriseNet: number; mrrNet: number
  arpuPaid: number; netRevenuePerActivated: number
}
interface CostResult {
  captureAnalyses: number; assistantMsgs: number; valueEstimates: number; photoEnhances: number
  costCapture: number; costAssistant: number; costValueEstimate: number; costPhoto: number
  costAiTotal: number; costAiPerActivated: number; costAiPerPaid: number; freeCaptureCost: number
}
interface InfraResult {
  storageMb: number; costStorage: number; bandwidthMb: number; costBandwidth: number; storagePctOfLimit: number
}
type HealthStatus = 'rentable' | 'fragile' | 'déficitaire'
interface SimAlert { level: 'bad' | 'warn' | 'ok'; text: string }
interface HealthResult {
  costVariable: number; marginVariable: number; marginPct: number; status: HealthStatus; alerts: SimAlert[]
}
interface BusinessOutcome {
  marginVariable: number; marginAfterFixed: number
  potentialNetIncome: number; incomeGap: number
  perPremiumContribution: number; premiumEquivNeeded: number | null
}
interface RatiosResult {
  visitToAccountPct: number; accountToActivatedPct: number; activatedToPaidPct: number; visitToPaidPct: number
  sharePremium: number; sharePro: number; shareEnterprise: number
  arpuPaid: number; marginPerPaid: number; costAiPerActivated: number; costAiPerPaid: number
  flags: { activatedToPaidOver100: boolean; visitToPaidOver5: boolean; premiumConvOver10: boolean; aiCostOverRevenue: boolean }
}
type Plausibility = 'forte' | 'moyenne' | 'faible'
interface PlausibilityResult {
  plausibility: Plausibility; scenarioType: string; reasons: string[]; recommendations: string[]
}
interface ObservedKpis {
  accounts: number; activatedAccounts: number; activationPct: number
  aiThisMonth: number; photoThisMonth: number; storageMb: number
}

// ── Fonctions pures ───────────────────────────────────────────────────
function calculateFunnel(inp: SimulationInputs): FunnelResult {
  const accounts = inp.visitors * (inp.convVisitToAccount / 100)
  const activated = accounts * (inp.convAccountToActivated / 100)
  return {
    visitors: inp.visitors, accounts, activated,
    visitToAccountPct: inp.visitors > 0 ? (accounts / inp.visitors) * 100 : 0,
    accountToActivatedPct: accounts > 0 ? (activated / accounts) * 100 : 0,
  }
}

function calculateSubscribers(funnel: FunnelResult, inp: SimulationInputs, mode: SimMode): SubscriberResult {
  // Conversions issues du trafic simulé (launch + hybride uniquement)
  const funnelPremium = (mode === 'launch' || mode === 'hybrid')
    ? funnel.activated * (inp.convToPremium / 100) : 0
  // Abonnés existants saisis manuellement (base installée + hybride)
  const directPremium = (mode === 'installed' || mode === 'hybrid') ? inp.directPremium : 0
  const directPro = (mode === 'installed' || mode === 'hybrid') ? inp.directPro : 0
  const directEnterprise = (mode === 'installed' || mode === 'hybrid') ? inp.directEnterprise : 0

  const premium = funnelPremium + directPremium
  const pro = directPro
  const enterprise = directEnterprise
  const paidTotal = premium + pro + enterprise
  // Les gratuits actifs = activés du funnel n'ayant pas converti via le funnel.
  const activatedFree = Math.max(funnel.activated - funnelPremium, 0)
  return { accounts: funnel.accounts, activated: funnel.activated, activatedFree, funnelPremium, premium, pro, enterprise, paidTotal }
}

function calculateRevenue(sub: SubscriberResult, inp: SimulationInputs): RevenueResult {
  const mrrPremiumGross = sub.premium * inp.premiumPrice
  const mrrProGross = sub.pro * inp.proPrice
  const mrrEnterpriseGross = sub.enterprise * inp.enterprisePrice
  const mrrGross = mrrPremiumGross + mrrProGross + mrrEnterpriseGross
  // Frais/commission propres à chaque canal de paiement
  const mrrPremiumNet = mrrPremiumGross * (1 - inp.premiumFeePct / 100)
  const mrrProNet = mrrProGross * (1 - inp.proFeePct / 100)
  const mrrEnterpriseNet = mrrEnterpriseGross * (1 - inp.enterpriseFeePct / 100)
  const mrrNet = mrrPremiumNet + mrrProNet + mrrEnterpriseNet
  const arpuPaid = sub.paidTotal > 0 ? mrrGross / sub.paidTotal : 0
  const netRevenuePerActivated = sub.activated > 0 ? mrrNet / sub.activated : 0
  return { mrrPremiumGross, mrrProGross, mrrEnterpriseGross, mrrGross,
    mrrPremiumNet, mrrProNet, mrrEnterpriseNet, mrrNet, arpuPaid, netRevenuePerActivated }
}

function calculateAiCosts(sub: SubscriberResult, inp: SimulationInputs, settings: AppSettings): CostResult {
  const retry = inp.aiRetryMultiplier
  // Les usages "payants" (assistant, estimation, retouche, capture premium)
  // s'appliquent à l'ensemble des abonnés payants (Premium + Pro + Entreprise).
  const captureAnalyses = (sub.activatedFree * inp.captureAiFreePerUser + sub.paidTotal * inp.captureAiPremiumPerUser) * retry
  const assistantMsgs = sub.paidTotal * inp.assistantMsgPremiumPerUser * retry
  const valueEstimates = sub.paidTotal * inp.valueEstimatePremiumPerUser * retry
  const photoEnhances = sub.paidTotal * inp.photoEnhancePremiumPerUser * retry

  const costCapture = captureAnalyses * settings.estimated_cost_per_ai_analysis_usd
  const costAssistant = assistantMsgs * inp.costAssistantMsgUsd
  const costValueEstimate = valueEstimates * inp.costValueEstimateUsd
  const costPhoto = photoEnhances * settings.estimated_cost_per_photo_enhance_usd
  const costAiTotal = costCapture + costAssistant + costValueEstimate + costPhoto

  const costAiPerActivated = sub.activated > 0 ? costAiTotal / sub.activated : 0
  const costAiPerPaid = sub.paidTotal > 0 ? costAiTotal / sub.paidTotal : 0
  const freeCaptureCost = sub.activatedFree * inp.captureAiFreePerUser * retry * settings.estimated_cost_per_ai_analysis_usd

  return { captureAnalyses, assistantMsgs, valueEstimates, photoEnhances,
    costCapture, costAssistant, costValueEstimate, costPhoto, costAiTotal,
    costAiPerActivated, costAiPerPaid, freeCaptureCost }
}

function calculateInfraCosts(sub: SubscriberResult, inp: SimulationInputs, settings: AppSettings): InfraResult {
  const storageMb = sub.activatedFree * inp.storageFreeMb
    + sub.premium * inp.storagePremiumMb
    + (sub.pro + sub.enterprise) * inp.storageProMb
  const costStorage = (storageMb / 1024) * inp.storageCostPerGbUsd
  const bandwidthMb = sub.activated * inp.bandwidthPerActiveUserMb
  const costBandwidth = (bandwidthMb / 1024) * inp.bandwidthCostPerGbUsd
  const storagePctOfLimit = settings.supabase_storage_limit_mb > 0
    ? (storageMb / settings.supabase_storage_limit_mb) * 100 : 0
  return { storageMb, costStorage, bandwidthMb, costBandwidth, storagePctOfLimit }
}

function calculateScenarioHealth(
  sub: SubscriberResult, rev: RevenueResult, ai: CostResult, infra: InfraResult, settings: AppSettings,
): HealthResult {
  // Coût variable = coût IA total + coût storage estimé
  const costVariable = ai.costAiTotal + infra.costStorage
  const marginVariable = rev.mrrNet - costVariable
  const marginPct = rev.mrrNet > 0 ? (marginVariable / rev.mrrNet) * 100 : (costVariable > 0 ? -100 : 0)

  let status: HealthStatus
  if (marginVariable < 0) status = 'déficitaire'
  else if (marginPct < 40) status = 'fragile'
  else status = 'rentable'

  const alerts: SimAlert[] = []
  if (costVariable > rev.mrrNet) {
    alerts.push({ level: 'bad', text: `Marge négative : le coût variable (${fmtMoney(costVariable)}) dépasse le MRR net (${fmtMoney(rev.mrrNet)}). → Augmenter le prix Pro, réduire l'usage IA gratuit ou limiter les retouches photo.` })
  }
  if (ai.costAiTotal > settings.monthly_ai_spend_alert_usd) {
    alerts.push({ level: 'bad', text: `Dépense IA élevée : coût IA total (${fmtMoney(ai.costAiTotal)}) au-dessus du seuil configuré (${settings.monthly_ai_spend_alert_usd} $). → Réduire temporairement le quota gratuit ou augmenter le seuil de spend Anthropic.` })
  }
  if (sub.activatedFree > 0 && ai.freeCaptureCost > rev.mrrNet) {
    alerts.push({ level: 'warn', text: `Analyses gratuites coûteuses (${fmtMoney(ai.freeCaptureCost)} > MRR net). → Baisser temporairement le quota gratuit (actuellement ${settings.free_ai_quota_monthly}/mois) ou améliorer la conversion.` })
  }
  if (sub.activated > 0 && sub.paidTotal / sub.activated < 0.02 && costVariable > rev.mrrNet) {
    alerts.push({ level: 'warn', text: `Acquisition coûteuse : peu d'abonnés payants (${fmtInt(sub.paidTotal)}) pour ${fmtInt(sub.activatedFree)} gratuits actifs. → Concentrer l'acquisition sur des canaux qui convertissent, ou brider l'IA gratuite.` })
  }
  if (infra.storagePctOfLimit >= 90) {
    alerts.push({ level: 'bad', text: `Stockage simulé à ${fmtPct(infra.storagePctOfLimit)} de la limite déclarée (${settings.supabase_storage_limit_mb} Mo). → Passer Supabase à un plan supérieur ou réduire la taille moyenne des uploads.` })
  } else if (infra.storagePctOfLimit >= 70) {
    alerts.push({ level: 'warn', text: `Stockage simulé à ${fmtPct(infra.storagePctOfLimit)} de la limite déclarée (${settings.supabase_storage_limit_mb} Mo). → Surveiller la croissance et anticiper un plan supérieur.` })
  }
  if (alerts.length === 0) {
    alerts.push({ level: 'ok', text: 'Aucune alerte de coût : scénario sain dans les hypothèses actuelles.' })
  }

  return { costVariable, marginVariable, marginPct, status, alerts }
}

function calculateBusinessOutcome(
  rev: RevenueResult, health: HealthResult, ai: CostResult, inp: SimulationInputs,
): BusinessOutcome {
  const marginVariable = health.marginVariable
  const marginAfterFixed = marginVariable - inp.fixedCostsMonthly
  // Provision (charges/taxes) appliquée uniquement sur une marge positive
  const potentialNetIncome = marginAfterFixed > 0
    ? marginAfterFixed * (1 - inp.taxProvisionPct / 100)
    : marginAfterFixed
  const incomeGap = potentialNetIncome - inp.targetNetIncome

  // Contribution nette approximative d'un abonné Premium supplémentaire
  const perPremiumNet = inp.premiumPrice * (1 - inp.premiumFeePct / 100)
  const perPremiumVarCost = ai.costAiPerPaid + (inp.storagePremiumMb / 1024) * inp.storageCostPerGbUsd
  const perPremiumContribution = perPremiumNet - perPremiumVarCost
  let premiumEquivNeeded: number | null = null
  if (perPremiumContribution > 0 && inp.taxProvisionPct < 100) {
    const requiredMarginAfterFixed = inp.targetNetIncome / (1 - inp.taxProvisionPct / 100)
    const requiredContribution = requiredMarginAfterFixed + inp.fixedCostsMonthly
    premiumEquivNeeded = Math.ceil(requiredContribution / perPremiumContribution)
  }
  return { marginVariable, marginAfterFixed, potentialNetIncome, incomeGap, perPremiumContribution, premiumEquivNeeded }
}

function calculateRatios(
  funnel: FunnelResult, sub: SubscriberResult, rev: RevenueResult, ai: CostResult, health: HealthResult,
): RatiosResult {
  const activatedToPaidPct = funnel.activated > 0 ? (sub.paidTotal / funnel.activated) * 100 : 0
  const visitToPaidPct = funnel.visitors > 0 ? (sub.paidTotal / funnel.visitors) * 100 : 0
  const marginPerPaid = sub.paidTotal > 0 ? health.marginVariable / sub.paidTotal : 0
  return {
    visitToAccountPct: funnel.visitToAccountPct,
    accountToActivatedPct: funnel.accountToActivatedPct,
    activatedToPaidPct, visitToPaidPct,
    sharePremium: sub.paidTotal > 0 ? (sub.premium / sub.paidTotal) * 100 : 0,
    sharePro: sub.paidTotal > 0 ? (sub.pro / sub.paidTotal) * 100 : 0,
    shareEnterprise: sub.paidTotal > 0 ? (sub.enterprise / sub.paidTotal) * 100 : 0,
    arpuPaid: rev.arpuPaid, marginPerPaid,
    costAiPerActivated: ai.costAiPerActivated, costAiPerPaid: ai.costAiPerPaid,
    flags: {
      activatedToPaidOver100: activatedToPaidPct > 100,
      visitToPaidOver5: visitToPaidPct > 5,
      premiumConvOver10: activatedToPaidPct > 10,
      aiCostOverRevenue: rev.netRevenuePerActivated > 0
        ? ai.costAiPerActivated > rev.netRevenuePerActivated
        : ai.costAiPerActivated > 0,
    },
  }
}

function evaluateScenarioPlausibility(
  funnel: FunnelResult, sub: SubscriberResult, ratios: RatiosResult, mode: SimMode, inp: SimulationInputs,
): PlausibilityResult {
  const reasons: string[] = []
  const recommendations: string[] = []
  let majorFlags = 0, minorFlags = 0

  let scenarioType = mode === 'hybrid' ? 'Hybride'
    : mode === 'installed' ? 'Base installée' : 'Launch / Acquisition'

  const b2bPaid = sub.pro + sub.enterprise
  if (b2bPaid > 0 && (funnel.activated < 50 || b2bPaid / Math.max(funnel.activated, 1) > 0.2)) {
    scenarioType = 'Commercial ciblé (B2B)'
    reasons.push('Abonnés Pro/Entreprise significatifs avec peu d’utilisateurs activés grand public : ressemble à une vente commerciale ciblée, pas à un lancement Product Hunt.')
  }

  // 1. Abonnés payants > activés (launch/hybride)
  if (sub.paidTotal > funnel.activated && (mode === 'launch' || mode === 'hybrid')) {
    majorFlags++
    reasons.push('Les abonnés payants dépassent les utilisateurs activés. Cohérent seulement pour une base installée, pas pour un lancement acquisition.')
    recommendations.push('Basculer en mode « Base installée » ou réduire le nombre d’abonnés directs.')
  }
  // 2. Visite → payant (pertinent seulement quand les abonnés viennent du funnel)
  if (mode === 'launch' || mode === 'hybrid') {
    if (ratios.visitToPaidPct > 5) {
      majorFlags++
      reasons.push(`Taux visite → payant de ${fmtPct(ratios.visitToPaidPct)} : irréaliste pour un lancement (repère sain < 2–3 %).`)
      recommendations.push('Réduire la conversion premium ou augmenter le volume de visiteurs.')
    } else if (ratios.visitToPaidPct > 3) {
      minorFlags++
      reasons.push(`Taux visite → payant de ${fmtPct(ratios.visitToPaidPct)} : optimiste pour un lancement.`)
    }
  }
  // 3. Activation très élevée
  if (inp.convAccountToActivated > 80) {
    minorFlags++
    reasons.push(`Activation compte → objet de ${fmtPct(inp.convAccountToActivated)} : très ambitieuse.`)
    recommendations.push('Comparer avec le taux d’activation observé et l’aligner si besoin.')
  }
  // 4. Conversion premium B2C très optimiste
  if ((mode === 'launch' || mode === 'hybrid') && inp.convToPremium > 10) {
    minorFlags++
    reasons.push(`Conversion premium de ${fmtPct(inp.convToPremium)} : très optimiste en B2C (repère 2–5 %).`)
    recommendations.push('Ramener la conversion premium autour de 2–5 %.')
  }
  // 5. Coût IA / activé > revenu net / activé
  if (ratios.flags.aiCostOverRevenue && sub.paidTotal > 0) {
    minorFlags++
    reasons.push('Le coût IA par utilisateur activé dépasse le revenu net par activé.')
    recommendations.push('Réduire l’usage IA gratuit, baisser le quota gratuit ou augmenter la conversion.')
  }

  let plausibility: Plausibility
  if (majorFlags >= 1 || minorFlags >= 2) plausibility = 'faible'
  else if (minorFlags === 1) plausibility = 'moyenne'
  else plausibility = 'forte'

  if (reasons.length === 0) reasons.push('Ratios du funnel dans des plages crédibles.')
  return { plausibility, scenarioType, reasons, recommendations }
}

function deriveObserved(kpis: KPIs): ObservedKpis {
  return {
    accounts: kpis.totalAccounts,
    activatedAccounts: kpis.accountsWithObjects,
    activationPct: kpis.totalAccounts > 0 ? (kpis.accountsWithObjects / kpis.totalAccounts) * 100 : 0,
    aiThisMonth: kpis.aiAnalysesThisMonth,
    photoThisMonth: kpis.photoEnhanceThisMonth,
    storageMb: kpis.storageSizeMb,
  }
}

function computeSimulation(inp: SimulationInputs, mode: SimMode, settings: AppSettings) {
  const funnel = calculateFunnel(inp)
  const sub = calculateSubscribers(funnel, inp, mode)
  const rev = calculateRevenue(sub, inp)
  const ai = calculateAiCosts(sub, inp, settings)
  const infra = calculateInfraCosts(sub, inp, settings)
  const health = calculateScenarioHealth(sub, rev, ai, infra, settings)
  const business = calculateBusinessOutcome(rev, health, ai, inp)
  const ratios = calculateRatios(funnel, sub, rev, ai, health)
  const plausibility = evaluateScenarioPlausibility(funnel, sub, ratios, mode, inp)
  return { ...funnel, ...sub, ...rev, ...ai, ...infra, ...health, business, ratios, plausibility }
}

function fmtInt(n: number) {
  return Math.round(n).toLocaleString('fr-FR')
}
function fmtMoney(n: number) {
  return `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
}
function fmtPct(n: number) {
  return `${n.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} %`
}

function healthLabel(status: HealthStatus) {
  return status === 'rentable' ? '✓ Rentable' : status === 'fragile' ? '~ Fragile' : '✗ Déficitaire'
}
function healthCardStyle(status: HealthStatus): React.CSSProperties {
  if (status === 'rentable') return s.simStatGood
  if (status === 'déficitaire') return s.simStatBad
  return { borderColor: '#D97706', boxShadow: '0 4px 16px rgba(217,119,6,0.15)' }
}
function healthTextStyle(status: HealthStatus): React.CSSProperties {
  const color = status === 'rentable' ? '#2e7d32' : status === 'déficitaire' ? '#C0392B' : '#8A5A00'
  return { color, fontSize: 22 }
}

function SimSlider({ label, value, min, max, step, onChange, suffix = '', format, last }: {
  label: string; value: number; min: number; max: number; step: number
  onChange: (v: number) => void; suffix?: string; format?: (v: number) => string; last?: boolean
}) {
  return (
    <div>
      <div style={s.simSliderHeader}>
        <span style={s.settingsLabel}>{label}</span>
        <span style={s.simSliderValue}>{format ? format(value) : value}{suffix}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={s.simRange}
      />
      {!last && <div style={s.settingsDivider} />}
    </div>
  )
}

function SimGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={s.simGroup}>
      <div style={s.simGroupTitle}>{title}</div>
      {children}
    </div>
  )
}

function SimNumberField({ label, value, onChange, step = 1 }: {
  label: string; value: number; onChange: (v: number) => void; step?: number
}) {
  return (
    <div style={s.mixRow}>
      <span style={s.settingsLabel}>{label}</span>
      <input
        type="number"
        min={0}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={s.settingsInput}
      />
    </div>
  )
}

function SimStat({ label, value, sub, highlight, tone }: {
  label: string; value: string; sub?: string; highlight?: boolean; tone?: 'good' | 'bad'
}) {
  const toneStyle = tone === 'bad' ? s.simStatBad : tone === 'good' ? s.simStatGood : {}
  return (
    <div style={{ ...s.simStatCard, ...(highlight ? s.kpiCardHighlight : {}), ...toneStyle }}>
      <span style={s.simStatValue}>{value}</span>
      <span style={s.kpiLabel}>{label}</span>
      {sub && <span style={s.simStatSub}>{sub}</span>}
    </div>
  )
}

function CompareBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((Math.max(value, 0) / max) * 100, 100) : 0
  return (
    <div style={s.gaugeTrack}>
      <div style={{ ...s.gaugeFill, width: `${pct}%`, background: color }} />
    </div>
  )
}

function Badge({ kind }: { kind: 'observed' | 'hypo' | 'warning' }) {
  const style = kind === 'observed' ? s.badgeObserved : kind === 'hypo' ? s.badgeHypo : s.badgeWarn
  const label = kind === 'observed' ? 'observé' : kind === 'hypo' ? 'hypothèse' : 'warning'
  return <span style={style}>{label}</span>
}

function RatioRow({ label, value, warn, hint, last }: {
  label: string; value: string; warn?: boolean; hint?: string; last?: boolean
}) {
  return (
    <div>
      <div style={s.ratioRow}>
        <span style={s.ratioLabel}>{label}</span>
        <span style={{ ...s.ratioValue, ...(warn ? s.ratioValueWarn : {}) }}>
          {warn && '⚠ '}{value}
        </span>
      </div>
      {hint && <div style={s.ratioHint}>{hint}</div>}
      {!last && <div style={s.settingsDivider} />}
    </div>
  )
}

function plausCardStyle(p: Plausibility): React.CSSProperties {
  if (p === 'forte') return s.simStatGood
  if (p === 'faible') return s.simStatBad
  return { borderColor: '#D97706', boxShadow: '0 4px 16px rgba(217,119,6,0.15)' }
}
function plausBadgeStyle(p: Plausibility): React.CSSProperties {
  if (p === 'forte') return { background: '#EAF5EA', color: '#2e7d32' }
  if (p === 'faible') return { background: '#FDECEA', color: '#C0392B' }
  return { background: '#FFF4E0', color: '#8A5A00' }
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
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: siteVisits24h },
    { count: siteVisits7d },
    { count: siteVisits30d },
    { data: siteVisitors30d },
    { count: totalAccounts },
    { count: newAccounts30d },
    { data: objectsByUser },
    { data: profilesUsage },
    { count: quotaExceeded30d },
    { data: events },
    { data: appSettings },
    { data: infraStats },
  ] = await Promise.all([
    admin.from('site_pageviews').select('*', { count: 'exact', head: true }).gte('created_at', since24h),
    admin.from('site_pageviews').select('*', { count: 'exact', head: true }).gte('created_at', since7d),
    admin.from('site_pageviews').select('*', { count: 'exact', head: true }).gte('created_at', since30d),
    admin.from('site_pageviews').select('visitor_id, ip_hash').gte('created_at', since30d),
    admin.from('profiles').select('*', { count: 'exact', head: true }),
    admin.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', since30d),
    admin.from('objects').select('user_id'),
    admin.from('profiles').select('ai_analyses_used, photo_enhance_used'),
    admin.from('activity_log').select('*', { count: 'exact', head: true }).eq('action', 'quota.exceeded').gte('created_at', since30d),
    admin.from('activity_log').select('action').gte('created_at', since30d),
    admin.from('app_settings')
      .select('free_ai_quota_monthly,free_objects_max,free_photos_per_object,premium_ai_quota_monthly,premium_photo_enhance_quota_monthly,supabase_db_limit_mb,supabase_storage_limit_mb,estimated_cost_per_ai_analysis_usd,estimated_cost_per_photo_enhance_usd,monthly_ai_spend_alert_usd')
      .eq('id', 1).single(),
    admin.rpc('get_admin_infra_stats').single(),
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
  const photoEnhanceThisMonth = (profilesUsage ?? []).reduce((sum, p) => sum + (p.photo_enhance_used ?? 0), 0)

  const eventCounts = new Map<string, number>()
  for (const e of events ?? []) eventCounts.set(e.action, (eventCounts.get(e.action) ?? 0) + 1)
  const eventsArr = Array.from(eventCounts.entries())
    .map(([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count)

  const uniqueVisitors30d = new Set(
    (siteVisitors30d ?? [])
      .map(row => row.visitor_id || row.ip_hash)
      .filter(Boolean)
  ).size

  const infra = infraStats as {
    db_size_bytes: number
    storage_size_bytes: number
    ai_analyses_lifetime: number
    photo_enhance_lifetime: number
  } | null

  return {
    props: {
      kpis: {
        siteVisits24h: siteVisits24h ?? 0,
        siteVisits7d: siteVisits7d ?? 0,
        siteVisits30d: siteVisits30d ?? 0,
        uniqueVisitors30d,
        totalAccounts: totalAccounts ?? 0,
        newAccounts30d: newAccounts30d ?? 0,
        totalObjects,
        accountsWithObjects: countsPerUser.size,
        medianObjectsPerActiveUser,
        aiAnalysesThisMonth,
        photoEnhanceThisMonth,
        quotaExceeded30d: quotaExceeded30d ?? 0,
        events: eventsArr,
        dbSizeMb: (infra?.db_size_bytes ?? 0) / 1024 / 1024,
        storageSizeMb: (infra?.storage_size_bytes ?? 0) / 1024 / 1024,
        aiAnalysesLifetime: infra?.ai_analyses_lifetime ?? 0,
        photoEnhanceLifetime: infra?.photo_enhance_lifetime ?? 0,
      },
      settings: appSettings ?? {
        free_ai_quota_monthly: 30,
        free_objects_max: 30,
        free_photos_per_object: 1,
        premium_ai_quota_monthly: 150,
        premium_photo_enhance_quota_monthly: 50,
        supabase_db_limit_mb: 500,
        supabase_storage_limit_mb: 1024,
        estimated_cost_per_ai_analysis_usd: 0.01,
        estimated_cost_per_photo_enhance_usd: 0.039,
        monthly_ai_spend_alert_usd: 50,
      },
    },
  }
}

const s: Record<string, React.CSSProperties> = {
  root:              { minHeight: '100vh', background: '#FAFAF7' },
  content:           { maxWidth: 960, margin: '0 auto', padding: '40px 24px' },
  title:             { fontSize: 28, fontWeight: 800, color: '#121212', marginBottom: 4 },
  subtitle:          { fontSize: 14, color: '#5b5b5b', marginBottom: 28 },
  grid:              { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 40 },
  kpiCard:           { background: 'white', borderRadius: 16, padding: '20px 24px', boxShadow: '0 4px 16px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 6 },
  kpiCardHighlight:  { borderColor: '#F26900', boxShadow: '0 4px 16px rgba(242,105,0,0.15)' },
  kpiCardAlert:      { borderColor: '#C0392B', boxShadow: '0 4px 16px rgba(192,57,43,0.18)' },
  alertText:         { fontSize: 12, color: '#C0392B', fontWeight: 700 },
  kpiValue:          { fontSize: 28, fontWeight: 800, color: '#121212' },
  kpiLabel:          { fontSize: 13, color: '#5b5b5b', fontWeight: 600 },
  sectionTitle:      { fontSize: 18, fontWeight: 700, color: '#121212', marginBottom: 8 },
  gaugeCard:         { background: 'white', borderRadius: 16, padding: '20px 24px', boxShadow: '0 4px 16px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 10 },
  gaugeHeader:       { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' },
  gaugeLabel:        { fontSize: 13, color: '#5b5b5b', fontWeight: 600 },
  gaugeValue:        { fontSize: 13, color: '#121212', fontWeight: 700 },
  gaugeTrack:        { height: 8, borderRadius: 99, background: '#F0EBE3', overflow: 'hidden' },
  gaugeFill:         { height: '100%', borderRadius: 99, transition: 'width 200ms ease' },
  settingsCard:      { background: 'white', borderRadius: 16, padding: '24px', boxShadow: '0 4px 16px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.06)', marginBottom: 40 },
  settingsRow:       { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 },
  settingsDivider:   { height: 1, background: 'rgba(0,0,0,0.04)', margin: '16px 0' },
  settingsLabel:     { fontSize: 15, fontWeight: 600, color: '#121212' },
  settingsHint:      { fontSize: 13, color: '#5b5b5b', marginTop: 2 },
  settingsInput:     { width: 80, padding: '8px 12px', borderRadius: 10, border: '1.5px solid #e0e0e0', fontSize: 16, fontWeight: 700, textAlign: 'right', outline: 'none' },
  settingsLocked:    { width: 80, padding: '8px 12px', fontSize: 16, fontWeight: 700, textAlign: 'right', color: '#999' },
  saveBtn:           { padding: '10px 24px', borderRadius: 10, background: '#F26900', color: 'white', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer' },
  savedBadge:        { fontSize: 14, color: '#2e7d32', fontWeight: 600 },
  eventsTable:       { background: 'white', borderRadius: 16, padding: '8px 24px', boxShadow: '0 4px 16px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.06)', marginBottom: 40 },
  eventRow:          { display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid rgba(0,0,0,0.04)' },
  eventAction:       { fontSize: 14, color: '#121212', fontWeight: 600 },
  eventCount:        { fontSize: 14, color: '#F26900', fontWeight: 700 },
  footnote:          { fontSize: 13, color: '#999' },
  tabBar:            { display: 'flex', gap: 4, marginBottom: 28, background: 'white', padding: 4, borderRadius: 12, border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 4px 16px rgba(0,0,0,0.05)', width: 'fit-content', flexWrap: 'wrap' },
  tabBtn:            { padding: '9px 18px', borderRadius: 9, background: 'transparent', color: '#5b5b5b', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer' },
  tabBtnActive:      { background: '#F26900', color: 'white' },
  saveBar:           { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', background: 'white', borderRadius: 16, padding: '16px 24px', boxShadow: '0 4px 16px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.06)', marginBottom: 40 },
  saveBarHint:       { fontSize: 13, color: '#5b5b5b', fontWeight: 600 },
  simToolbar:        { display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 20 },
  scenarioRow:       { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 20 },
  scenarioLabel:     { fontSize: 13, color: '#5b5b5b', fontWeight: 600, marginRight: 4 },
  scenarioBtn:       { padding: '7px 14px', borderRadius: 999, background: 'white', color: '#121212', fontWeight: 700, fontSize: 13, border: '1.5px solid #e0e0e0', cursor: 'pointer' },
  scenarioBtnActive: { background: '#F26900', color: 'white', borderColor: '#F26900' },
  simLayout:         { display: 'grid', gridTemplateColumns: 'minmax(280px, 1fr) minmax(300px, 1.4fr)', gap: 20, marginBottom: 40, alignItems: 'start' },
  simSliderHeader:   { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 },
  simSliderValue:    { fontSize: 15, fontWeight: 800, color: '#F26900' },
  simRange:          { width: '100%', accentColor: '#F26900', cursor: 'pointer' },
  grid3:             { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 },
  simStatCard:       { background: 'white', borderRadius: 14, padding: '16px 18px', boxShadow: '0 4px 16px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', gap: 4 },
  simStatValue:      { fontSize: 22, fontWeight: 800, color: '#121212' },
  simStatGood:       { borderColor: '#2e7d32', boxShadow: '0 4px 16px rgba(46,125,50,0.12)' },
  simStatBad:        { borderColor: '#C0392B', boxShadow: '0 4px 16px rgba(192,57,43,0.15)' },
  simAlert:          { fontSize: 13, fontWeight: 700, color: '#C0392B', background: '#FDECEA', borderRadius: 10, padding: '10px 12px' },
  simWarn:           { fontSize: 13, fontWeight: 600, color: '#8A5A00', background: '#FFF4E0', borderRadius: 10, padding: '10px 12px' },
  simOk:             { fontSize: 13, fontWeight: 700, color: '#2e7d32', background: '#EAF5EA', borderRadius: 10, padding: '10px 12px' },
  simParamsCol:      { display: 'flex', flexDirection: 'column', gap: 16 },
  simResultsCol:     { display: 'flex', flexDirection: 'column', gap: 16 },
  simGroup:          { background: 'white', borderRadius: 16, padding: '20px 24px', boxShadow: '0 4px 16px rgba(0,0,0,0.05)', border: '1px solid rgba(0,0,0,0.06)' },
  simGroupTitle:     { fontSize: 14, fontWeight: 800, color: '#121212', marginBottom: 14 },
  simGroupHeaderRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12 },
  simStatSub:        { fontSize: 12, color: '#8a8a8a', fontWeight: 600 },
  modeSeg:           { display: 'flex', gap: 4, background: '#F0EBE3', padding: 4, borderRadius: 10, marginBottom: 12 },
  modeSegBtn:        { flex: 1, padding: '8px 10px', borderRadius: 7, background: 'transparent', border: 'none', fontSize: 13, fontWeight: 700, color: '#5b5b5b', cursor: 'pointer' },
  modeSegBtnActive:  { background: 'white', color: '#F26900', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },
  gearBtn:           { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 8, border: '1px solid #e0e0e0', background: 'white', color: '#5b5b5b', cursor: 'pointer', flexShrink: 0 },
  mixPanel:          { marginTop: 8, padding: 16, background: '#FAF7F2', borderRadius: 12, border: '1px solid rgba(0,0,0,0.06)' },
  mixRow:            { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '8px 0' },
  observedBox:       { marginTop: 14, padding: 12, background: '#FAF7F2', borderRadius: 10, border: '1px solid rgba(0,0,0,0.06)' },
  observedRow:       { display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8, fontSize: 13, color: '#5b5b5b', marginBottom: 8 },
  linkBtn:           { background: 'none', border: 'none', color: '#F26900', fontWeight: 700, fontSize: 13, cursor: 'pointer', padding: 0 },
  badgeObserved:     { display: 'inline-block', fontSize: 11, fontWeight: 700, color: '#2f5b8a', background: '#E7F0FA', padding: '2px 7px', borderRadius: 999, marginRight: 6 },
  badgeHypo:         { display: 'inline-block', fontSize: 11, fontWeight: 700, color: '#F26900', background: '#FFE4CC', padding: '2px 7px', borderRadius: 999, marginRight: 6 },
  badgeWarn:         { display: 'inline-block', fontSize: 11, fontWeight: 700, color: '#8A5A00', background: '#FFF4E0', padding: '2px 7px', borderRadius: 999, marginRight: 6 },
  plausBadge:        { fontSize: 12, fontWeight: 800, padding: '4px 12px', borderRadius: 999, textTransform: 'capitalize' },
  plausSubtitle:     { fontSize: 12, fontWeight: 800, color: '#121212', textTransform: 'uppercase', letterSpacing: 0.3, marginTop: 8, marginBottom: 4 },
  plausList:         { margin: '0 0 4px', paddingLeft: 18, fontSize: 13, color: '#5b5b5b', lineHeight: 1.5 },
  ratioRow:          { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  ratioLabel:        { fontSize: 13, color: '#5b5b5b', fontWeight: 600 },
  ratioValue:        { fontSize: 14, color: '#121212', fontWeight: 800 },
  ratioValueWarn:    { color: '#C0392B' },
  ratioHint:         { fontSize: 12, color: '#C0392B', marginTop: 2 },
}
