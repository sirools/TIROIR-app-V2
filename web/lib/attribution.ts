// D'où viennent les inscrits : la source du tout premier passage sur le site
// (lien utm_… d'une campagne, sinon le site d'où l'on arrive), gardée dans
// le navigateur, puis rattachée au compte à l'inscription
// (user_metadata.acq). Lue par la page Marketing du back-office, en chiffres
// agrégés seulement.
//
// Module sans dépendance, testable.

export type Acquisition = {
  source: string
  medium?: string | null
  campaign?: string | null
  /** Première page vue (chemin, sans les paramètres). */
  landing?: string | null
  /** Date du premier passage (ISO). */
  at?: string | null
}

export const FIRST_TOUCH_KEY = 'tiroir_first_touch'

/** Libellé court d'un site d'origine. */
export function sourceFromReferrer(referrer: string | null | undefined, ownHost?: string | null): string {
  if (!referrer) return 'direct'
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '').toLowerCase()
    if (ownHost && (host === ownHost || host.endsWith(`.${ownHost}`))) return 'direct'
    if (host.includes('producthunt.com')) return 'producthunt'
    if (host.includes('linkedin.com') || host === 'lnkd.in') return 'linkedin'
    if (host.includes('google.')) return 'google'
    if (host.includes('instagram.com')) return 'instagram'
    if (host.includes('tiktok.com')) return 'tiktok'
    if (host.includes('facebook.com') || host === 'fb.me' || host === 'l.facebook.com') return 'facebook'
    if (host === 't.co' || host.includes('twitter.com') || host === 'x.com') return 'x'
    if (host.includes('youtube.com') || host === 'youtu.be') return 'youtube'
    if (host.includes('bing.com')) return 'bing'
    return host
  } catch {
    return 'unknown'
  }
}

const clean = (v: string | null | undefined, max = 80) => {
  const t = (v ?? '').trim().toLowerCase().slice(0, max)
  return t || null
}

/**
 * Source d'une visite : les paramètres utm_… d'abord (campagnes, liens en
 * bio), sinon le site d'origine. `search` est la partie « ?… » de l'adresse.
 */
export function acquisitionFrom(
  search: string,
  referrer: string | null | undefined,
  ownHost?: string | null,
): Acquisition {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const utmSource = clean(params.get('utm_source'))
  if (utmSource) {
    return { source: utmSource, medium: clean(params.get('utm_medium')), campaign: clean(params.get('utm_campaign')) }
  }
  return { source: sourceFromReferrer(referrer, ownHost), medium: null, campaign: null }
}

/** Lit une acquisition stockée (navigateur ou user_metadata), ou null. */
export function parseAcquisition(raw: unknown): Acquisition | null {
  const v = typeof raw === 'string' ? (() => { try { return JSON.parse(raw) } catch { return null } })() : raw
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const source = typeof o.source === 'string' ? clean(o.source) : null
  if (!source) return null
  const str = (x: unknown, max = 200) => (typeof x === 'string' && x.trim() ? x.trim().slice(0, max) : null)
  return { source, medium: clean(str(o.medium)), campaign: clean(str(o.campaign)), landing: str(o.landing), at: str(o.at, 40) }
}

export type SourceRow = { source: string; comptes: number; actives: number; taux: number }

/**
 * Comptes par source, et combien sont « activés » (au moins un objet).
 * Les comptes sans source connue viennent de l'app (stores) ou d'avant ce
 * suivi : on les compte à part, sans deviner.
 */
export function signupsBySource(
  users: { id: string; acq: Acquisition | null }[],
  activeIds: Set<string>,
): SourceRow[] {
  const map = new Map<string, { comptes: number; actives: number }>()
  for (const u of users) {
    const key = u.acq?.source ?? 'app ou inconnue'
    const row = map.get(key) ?? { comptes: 0, actives: 0 }
    row.comptes += 1
    if (activeIds.has(u.id)) row.actives += 1
    map.set(key, row)
  }
  return Array.from(map.entries())
    .map(([source, r]) => ({ source, ...r, taux: r.comptes ? Math.round((r.actives / r.comptes) * 100) : 0 }))
    .sort((a, b) => b.comptes - a.comptes || a.source.localeCompare(b.source))
}
