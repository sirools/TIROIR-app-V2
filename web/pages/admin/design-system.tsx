// Design system — inventaire exhaustif des composants du site (Next.js) et
// de l'app native (Expo, iOS et Android), avec les textes que chacun
// affiche, dans la langue choisie. Sert à vérifier l'ISO web / mobile et
// les traductions, composant par composant.
//
// Source : design/components.mjs (lecture du code) et design/i18n/, via
// `node design/generate.mjs`. Garde : requireAdminPage (admins).
import { useMemo, useState } from 'react'
import type { GetServerSideProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { requireAdminPage } from '../../lib/adminAuth'
import { adminNavFor, type AdminNav } from '../../lib/adminNav'
import { designSystemView } from '../../lib/designSystem/inventory'
import {
  SUPPORTS,
  type ComponentView,
  type DesignSystemView,
  type Language,
  type Support,
} from '../../lib/designSystem/types'

const SUPPORT_LABEL: Record<Support, string> = { web: 'Web', native: 'Natif' }
const SUPPORT_HINT: Record<Support, string> = { web: 'site et back-office', native: 'app iOS et Android' }
const SUPPORT_OF: Record<Support, string> = { web: 'du site', native: 'de l’app' }
const SUPPORT_IN: Record<Support, string> = { web: 'sur le site', native: 'dans l’app' }

const fmt = (n: number) => new Intl.NumberFormat('fr-FR').format(n)
const pct = (a: number, b: number) => (b ? `${Math.floor((a / b) * 1000) / 10} %` : '—')

const href = (lang: string, support: Support) => ({ pathname: '/admin/design-system', query: { lang, support } })

export default function DesignSystem(v: DesignSystemView) {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('')
  const [onlyMissing, setOnlyMissing] = useState(false)
  const [withTexts, setWithTexts] = useState(false)

  const language = v.languages.find(l => l.code === v.lang)
  const current = v.summary[v.support]
  const groups = useMemo(() => [...new Set(v.components.map(c => c.group))], [v.components])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return v.components.filter(c => {
      if (group && c.group !== group) return false
      if (onlyMissing && !c.missing) return false
      if (withTexts && !c.texts.length) return false
      if (!q) return true
      if (`${c.name} ${c.file} ${(c.also ?? []).join(' ')} ${(c.sub ?? []).join(' ')}`.toLowerCase().includes(q)) return true
      return c.texts.some(t => t.key.toLowerCase().includes(q) || (t.value ?? '').toLowerCase().includes(q))
    })
  }, [v.components, query, group, onlyMissing, withTexts])

  const byGroup = useMemo(() => {
    const map = new Map<string, ComponentView[]>()
    for (const c of shown) map.set(c.group, [...(map.get(c.group) ?? []), c])
    return [...map.entries()]
  }, [shown])

  return (
    <main className="page">
      <Head>
        <title>Design system — Tiroir</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <header className="head">
        <h1>Design system</h1>
        <p className="sub">
          Tous les composants du site et de l’app, avec les textes qu’ils affichent. Choisir une langue
          pour les relire tels que les voit un utilisateur.
        </p>
      </header>

      <nav className="langs" aria-label="Langue">
        {v.languages.map(l => (
          <LangPill key={l.code} l={l} active={l.code === v.lang} support={v.support} reference={v.reference} />
        ))}
      </nav>

      <nav className="tabs" aria-label="Support">
        {SUPPORTS.map(s => (
          <Link key={s} href={href(v.lang, s)} className={`tab${s === v.support ? ' on' : ''}`} aria-current={s === v.support ? 'page' : undefined}>
            <span className="tabName">{SUPPORT_LABEL[s]}</span>
            <span className="tabHint">{SUPPORT_HINT[s]} · {fmt(v.summary[s].components)}</span>
          </Link>
        ))}
      </nav>

      <section className="cards">
        <Card label="Composants" value={fmt(current.components)} hint={`pages, écrans, briques et structure ${SUPPORT_OF[v.support]}`} />
        <Card label="Textes affichés" value={fmt(current.texts)} hint={`${fmt(current.unusedKeys)} texte${current.unusedKeys > 1 ? 's' : ''} de design/i18n affiché${current.unusedKeys > 1 ? 's' : ''} nulle part`} />
        <Card
          label={`Couverture — ${language?.name ?? v.lang}`}
          value={current.available ? pct(current.covered, current.texts) : 'Non proposée'}
          hint={current.available ? `${fmt(current.texts - current.covered)} texte${current.texts - current.covered > 1 ? 's' : ''} manquant${current.texts - current.covered > 1 ? 's' : ''}` : `langue absente ${SUPPORT_OF[v.support]}`}
          alert={!current.available || current.covered < current.texts}
        />
      </section>

      {!current.available && (
        <p className="iso">
          <strong>Écart ISO :</strong> {language?.name} n’est pas proposé {SUPPORT_IN[v.support]}
          {v.summary[v.support === 'web' ? 'native' : 'web'].available ? `, alors qu’il l’est ${SUPPORT_IN[v.support === 'web' ? 'native' : 'web']}` : ''}.
          Les textes ci-dessous sont ceux de la langue de référence ({v.languages.find(l => l.code === v.reference)?.name}).
          Pour l’ajouter : <code>design/i18n/languages.json</code>, puis <code>node design/generate.mjs</code>.
        </p>
      )}

      <div className="filters">
        <input
          type="search"
          placeholder="Composant, fichier, clé ou texte…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label="Rechercher"
        />
        <select value={group} onChange={e => setGroup(e.target.value)} aria-label="Famille">
          <option value="">Toutes les familles</option>
          {groups.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <label className="check">
          <input type="checkbox" checked={withTexts} onChange={e => setWithTexts(e.target.checked)} />
          Avec des textes
        </label>
        {current.available && (
          <label className="check">
            <input type="checkbox" checked={onlyMissing} onChange={e => setOnlyMissing(e.target.checked)} />
            Textes manquants
          </label>
        )}
      </div>

      <p className="count">
        {fmt(shown.length)} composant{shown.length > 1 ? 's' : ''} sur {fmt(v.components.length)}
      </p>

      {byGroup.map(([g, list]) => (
        <section key={g} className="group">
          <h2>{g} <span className="n">{list.length}</span></h2>
          {list.map(c => <ComponentRow key={c.file} c={c} v={v} />)}
        </section>
      ))}
      {!shown.length && <p className="empty">Aucun composant ne correspond.</p>}

      <p className="note">
        Inventaire tiré du code par <code>design/components.mjs</code> : clés passées à <code>t('…')</code> dans
        l’app, accès à <code>useCopy()</code> sur le site. Une clé construite à l’exécution (<code>status.*</code>)
        rattache tous les textes qu’elle peut viser. Un composant ajouté ou un texte modifié apparaît ici après
        <code> node design/generate.mjs</code>.
      </p>

      <style jsx>{`
        .page { max-width: 960px; margin: 0 auto; padding: 32px 16px 64px; font-family: var(--font-body); color: var(--ink); background: var(--white); }
        .head h1 { margin: 0; font-size: 28px; }
        .sub { margin: 6px 0 20px; color: var(--muted); font-size: 14px; line-height: 1.5; max-width: 640px; }
        .langs { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
        .tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 20px; }
        .tabs :global(.tab) { display: flex; flex-direction: column; gap: 2px; padding: 12px 14px; border: 1px solid var(--border); border-radius: 12px; text-decoration: none; color: var(--ink); background: var(--white); }
        .tabs :global(.tab.on) { border-color: var(--ink); box-shadow: inset 0 0 0 1px var(--ink); }
        .tabName { font-weight: 700; font-size: 15px; }
        .tabHint { font-size: 12px; color: var(--muted); }
        .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 16px; }
        .iso { background: var(--beige); border: 1px solid var(--border); border-radius: 12px; padding: 12px 14px; font-size: 14px; line-height: 1.5; margin: 0 0 16px; }
        .filters { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; margin: 8px 0 4px; }
        .filters input[type='search'] { flex: 1 1 240px; min-width: 0; padding: 10px 12px; border: 1px solid var(--border); border-radius: 10px; font: inherit; font-size: 14px; }
        .filters select { padding: 9px 10px; border: 1px solid var(--border); border-radius: 10px; font: inherit; font-size: 14px; background: var(--white); max-width: 100%; }
        .check { display: inline-flex; gap: 6px; align-items: center; font-size: 14px; color: var(--muted); cursor: pointer; }
        .check input { appearance: auto; -webkit-appearance: checkbox; width: 16px; height: 16px; margin: 0; accent-color: var(--orange); }
        .count { font-size: 13px; color: var(--muted); margin: 8px 0 0; }
        .group h2 { font-size: 18px; margin: 28px 0 10px; }
        .group .n { font-size: 13px; color: var(--text-tertiary); font-weight: 600; margin-left: 6px; }
        .empty { color: var(--muted); font-size: 14px; }
        .note { font-size: 13px; color: var(--muted); line-height: 1.5; margin-top: 32px; }
        code { font-size: 12px; background: var(--surface-subtle); border: 1px solid var(--border-light); border-radius: 6px; padding: 1px 5px; }
        @media (max-width: 520px) { .tabs { grid-template-columns: 1fr 1fr; } .head h1 { font-size: 24px; } }
      `}</style>
    </main>
  )
}

function LangPill({ l, active, support, reference }: { l: Language; active: boolean; support: Support; reference: string }) {
  const where = [l.app && 'App', l.site && 'Site'].filter(Boolean).join(' · ')
  return (
    <Link href={href(l.code, support)} className={`pill${active ? ' on' : ''}`} aria-current={active ? 'true' : undefined} lang={l.code}>
      <span className="pname">{l.name}</span>
      <span className="pwhere">
        {where}{l.fallback ? ` · repli ${l.fallback}` : ''}{l.code === reference ? ' · référence' : ''}
      </span>
      <style jsx>{`
        :global(.pill) { display: inline-flex; flex-direction: column; padding: 8px 12px; border: 1px solid var(--border); border-radius: 999px; text-decoration: none; color: var(--ink); background: var(--white); line-height: 1.2; }
        :global(.pill.on) { background: var(--ink); border-color: var(--ink); color: var(--white); }
        .pname { font-size: 14px; font-weight: 600; }
        .pwhere { font-size: 11px; opacity: 0.7; }
      `}</style>
    </Link>
  )
}

function ComponentRow({ c, v }: { c: ComponentView; v: DesignSystemView }) {
  const forThisLang = c.perLanguage === v.lang
  const otherLang = c.perLanguage && !forThisLang
  return (
    <details className={`comp${otherLang ? ' dim' : ''}`}>
      <summary>
        <span className="title">
          <span className="name">{c.name}</span>
          <span className={`kind k-${c.kind.replace(/[^a-z]/g, '')}`}>{c.kind}</span>
        </span>
        <span className="file">{c.file}</span>
        <span className="badges">
          <Badge>{c.texts.length} texte{c.texts.length > 1 ? 's' : ''}</Badge>
          {c.missing > 0 && <Badge tone="alert">{c.missing} manquant{c.missing > 1 ? 's' : ''}</Badge>}
          {c.hardcoded > 0 && !c.perLanguage && <Badge tone="warn">{c.hardcoded} en dur</Badge>}
          {c.perLanguage && <Badge tone={forThisLang ? 'ok' : undefined}>version {c.perLanguage}</Badge>}
          <Badge>{c.usedBy.length ? `utilisé par ${c.usedBy.length}` : c.entry ? 'point d’entrée' : 'utilisé nulle part'}</Badge>
        </span>
      </summary>

      <div className="body">
        {c.perLanguage && (
          <p className="meta">
            Texte écrit dans le composant, une version par langue : celle-ci est la version <strong>{c.perLanguage}</strong>
            {forThisLang ? ' (la langue choisie).' : '.'}
          </p>
        )}
        {(c.also?.length || c.sub?.length) ? (
          <p className="meta">
            {c.also?.length ? <>Exporte aussi : {c.also.join(', ')}. </> : null}
            {c.sub?.length ? <>Sous-composants : {c.sub.join(', ')}.</> : null}
          </p>
        ) : null}
        {c.dynamic?.length ? (
          <p className="meta">Clés construites à l’exécution : {c.dynamic.map(d => <code key={d}>{d}.*</code>)}</p>
        ) : null}
        {c.whole?.length ? (
          <p className="meta">Textes transmis en entier : {c.whole.map(d => <code key={d}>{d}</code>)}</p>
        ) : null}
        {c.usedBy.length > 0 && (
          <p className="meta">Utilisé par : {c.usedBy.map(f => <code key={f}>{f}</code>)}</p>
        )}
        {c.hardcoded > 0 && !c.perLanguage && (
          <p className="meta warn">
            Environ {c.hardcoded} texte{c.hardcoded > 1 ? 's' : ''} écrit{c.hardcoded > 1 ? 's' : ''} directement dans le composant,
            donc non traduit{c.hardcoded > 1 ? 's' : ''}{c.kind === 'back-office' ? ' (normal pour le back-office, en français seulement)' : ''}.
          </p>
        )}

        {c.texts.length > 0 ? (
          <ul className="texts" lang={v.summary[v.support].available ? v.lang : v.reference}>
            {c.texts.map(t => (
              <li key={t.key} className={t.value === null ? 'missing' : ''}>
                <code className="key">{t.key}</code>
                <span className="val">
                  {t.value === null ? <em>manquant dans cette langue</em> : t.value}
                  {t.from && <span className="from">repli {t.from}</span>}
                </span>
                {t.ref !== undefined && t.ref !== t.value && <span className="ref" lang={v.reference}>{t.ref}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="meta">Aucun texte traduit : {c.kind === 'composant' ? 'textes reçus de son parent, ou composant purement visuel.' : 'rien à traduire, ou textes écrits en dur.'}</p>
        )}
      </div>

      <style jsx>{`
        .comp { border: 1px solid var(--border-light); border-radius: 12px; margin-bottom: 8px; background: var(--white); }
        .comp[open] { border-color: var(--border); }
        .dim { opacity: 0.55; }
        summary { list-style: none; cursor: pointer; padding: 12px 14px; display: grid; gap: 4px; }
        summary::-webkit-details-marker { display: none; }
        .title { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
        .name { font-weight: 700; font-size: 15px; }
        .kind { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--muted); }
        .k-backoffice { color: var(--text-tertiary); }
        .file { font-size: 12px; color: var(--muted); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; overflow-wrap: anywhere; }
        .badges { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 2px; }
        .body { padding: 0 14px 14px; border-top: 1px solid var(--border-light); }
        .meta { font-size: 13px; color: var(--muted); line-height: 1.6; margin: 10px 0 0; }
        .meta code { margin-right: 4px; }
        .warn { color: var(--ink); }
        .texts { list-style: none; padding: 0; margin: 12px 0 0; display: grid; gap: 0; }
        .texts li { display: grid; grid-template-columns: minmax(0, 220px) minmax(0, 1fr); gap: 2px 14px; padding: 8px 0; border-bottom: 1px solid var(--border-light); font-size: 14px; line-height: 1.45; }
        .texts li:last-child { border-bottom: 0; }
        .key { font-size: 11px; align-self: start; overflow-wrap: anywhere; justify-self: start; }
        .val { white-space: pre-wrap; overflow-wrap: anywhere; }
        .ref { grid-column: 2; font-size: 12px; color: var(--text-tertiary); white-space: pre-wrap; overflow-wrap: anywhere; }
        .from { margin-left: 8px; font-size: 11px; color: var(--muted); border: 1px solid var(--border); border-radius: 999px; padding: 0 6px; white-space: nowrap; }
        .missing .val { color: var(--error); }
        @media (max-width: 560px) {
          .texts li { grid-template-columns: 1fr; }
          .ref { grid-column: 1; }
        }
      `}</style>
    </details>
  )
}

function Card({ label, value, hint, alert }: { label: string; value: string; hint: string; alert?: boolean }) {
  return (
    <div className={`card${alert ? ' alert' : ''}`}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      <div className="hint">{hint}</div>
      <style jsx>{`
        .card { background: var(--beige-2); border: 1px solid var(--border-light); border-radius: var(--radius); padding: 16px; }
        .alert .value { color: var(--orange-700); }
        .label { font-size: 13px; color: var(--muted); }
        .value { font-size: 26px; font-weight: 800; margin: 4px 0; }
        .hint { font-size: 12px; color: var(--text-tertiary); line-height: 1.4; }
      `}</style>
    </div>
  )
}

function Badge({ children, tone }: { children: React.ReactNode; tone?: 'alert' | 'warn' | 'ok' }) {
  return (
    <span className={`badge ${tone ?? ''}`}>
      {children}
      <style jsx>{`
        .badge { font-size: 12px; padding: 2px 8px; border-radius: 999px; background: var(--surface-subtle); border: 1px solid var(--border-light); color: var(--muted); white-space: nowrap; }
        .alert { background: var(--error-light); border-color: var(--error-light); color: var(--error); }
        .warn { background: var(--beige); border-color: var(--border); color: var(--ink); }
        .ok { background: var(--ink); border-color: var(--ink); color: var(--white); }
      `}</style>
    </span>
  )
}

// adminNav : lu par le header du back-office (_app.tsx), pas par la page.
export const getServerSideProps: GetServerSideProps<DesignSystemView & { adminNav: AdminNav }> = async ctx => {
  const guard = await requireAdminPage(ctx)
  if (!guard.ok) return guard.result
  return {
    props: {
      ...designSystemView(ctx.query.lang, ctx.query.support),
      adminNav: adminNavFor(guard.user, guard.isAdmin),
    },
  }
}
