// Mise en forme des deux e-mails de la campagne. Textes : design/i18n/email/fr.json
// (section ulule). Volontairement sobre : un message d'une personne à une autre.
import { ULULE_EMAIL_TEXTS as T } from '../locales/ulule.generated'
import { CROWDFUNDING } from './crowdfunding'
import { formatEuros, PARIS } from './ulule'

export type RenderedEmail = { subject: string; html: string; text: string }

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Une variable absente fait échouer le rendu plutôt que de partir telle quelle. */
function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    if (values[key] === undefined) throw new Error(`VARIABLE_MANQUANTE: ${key}`)
    return values[key]
  })
}

const link = (url: string, label: string) => `<a href="${esc(url)}">${esc(label)}</a>`
const page = (body: string) =>
  `<!doctype html><html lang="fr"><body style="font-size:16px;line-height:1.5">${body}</body></html>`
const para = (html: string) => `<p>${html}</p>`

type Prelaunch = { prenom: string; date: string; lien: string; desinscription: string; adresse: string }

export function renderPrelaunch(v: Prelaunch): RenderedEmail {
  const t = T.prelaunch
  const asText = { prenom: v.prenom, date: v.date, lien: v.lien, desinscription: v.desinscription }
  const asHtml = {
    prenom: esc(v.prenom), date: esc(v.date), lien: link(v.lien, v.lien),
    desinscription: link(v.desinscription, t.unsubscribeLabel),
  }
  const h = (s: string) => fill(esc(s), asHtml)
  const x = (s: string) => fill(s, asText)
  const adresseHtml = v.adresse ? `<br>${esc(v.adresse)}` : ''
  const footerSize = 'font-size:13px'

  return {
    subject: t.subject,
    html: page([
      para(h(t.greeting)),
      ...t.intro.map(s => para(h(s))),
      `<ul>${t.list.map(s => `<li>${h(s)}</li>`).join('')}</ul>`,
      ...t.closing.map(s => para(h(s))),
      para(h(t.signature)),
      `<p style="${footerSize}">${h(t.footer)}${adresseHtml}</p>`,
    ].join('')),
    text: [
      x(t.greeting), '',
      ...t.intro.flatMap(s => [x(s), '']),
      ...t.list.map(s => `- ${x(s)}`), '',
      ...t.closing.flatMap(s => [x(s), '']),
      x(t.signature), '', '--',
      x(t.footer),
      ...(v.adresse ? [v.adresse] : []),
    ].join('\n'),
  }
}

export function renderThanks(v: { prenom: string }): RenderedEmail {
  const t = T.thanks
  const greeting = v.prenom ? fill(t.greeting, { prenom: v.prenom }) : t.greetingAnonymous
  return {
    subject: t.subject,
    html: page([para(esc(greeting)), ...t.body.map(s => para(esc(s))), para(esc(t.signature))].join('')),
    text: [greeting, '', ...t.body.flatMap(s => [s, '']), t.signature].join('\n'),
  }
}

// ── Lancement, relance, dernières 48 h, bilan ─────────────────────

const parisDate = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('fr-FR', { ...options, timeZone: PARIS }).format(new Date(CROWDFUNDING.endDate))

/** Ce que les textes lisent dans la config de la collecte (lib/crowdfunding.ts). */
const COLLECTE = {
  objectif: formatEuros(CROWDFUNDING.goalEuros * 100),
  fin: parisDate({ day: 'numeric', month: 'long' }),
  finJour: parisDate({ weekday: 'long', day: 'numeric', month: 'long' }),
  contrepartieMin: formatEuros(CROWDFUNDING.rewardsEuros.min * 100),
  contrepartieMax: formatEuros(CROWDFUNDING.rewardsEuros.max * 100),
}

export type CampaignKind = 'launch' | 'reminder' | 'last48h' | 'recap'

type CampaignValues = {
  prenom: string
  /** Lien perso ; absent pour un contributeur qui n'est pas ambassadeur (bilan). */
  lien: string | null
  /** Montant collecté, déjà mis en forme ; null quand Ulule ne répond pas. */
  montant: string | null
  /** L'objectif de la collecte est atteint. */
  objectifAtteint: boolean
  /** Ambassadeur : lien de désinscription. Contributeur : null, pied « réponds stop ». */
  desinscription: string | null
  adresse: string
}

export function renderCampaign(kind: CampaignKind, v: CampaignValues): RenderedEmail {
  const t = T[kind] as {
    subject: string; greeting: string; greetingAnonymous?: string; body: readonly string[]
    list: readonly string[]; closing: readonly string[]; signature: string
    progress?: string; progressAllReached?: string
  }
  const jauge = v.montant === null
    ? null
    : fill(
      v.objectifAtteint ? t.progressAllReached ?? T.progressAllReached : t.progress ?? T.progress,
      { montant: v.montant, objectif: COLLECTE.objectif },
    )

  const asText: Record<string, string> = {
    ...COLLECTE, prenom: v.prenom, lien: v.lien ?? '',
    desinscription: v.desinscription ?? '',
  }
  const asHtml: Record<string, string> = {
    ...COLLECTE, prenom: esc(v.prenom), lien: v.lien ? link(v.lien, v.lien) : '',
    desinscription: v.desinscription ? link(v.desinscription, T.prelaunch.unsubscribeLabel) : '',
  }
  // Un paragraphe « {jauge} » devient la phrase de progression, ou disparaît.
  const keep = (s: string) => s !== '{jauge}' || jauge !== null
  const swap = (s: string) => (s === '{jauge}' ? jauge! : s)
  // Sans lien perso, les lignes qui en parlent n'ont pas de sens.
  const list = t.list.filter(s => v.lien || !s.includes('{lien}'))
  const greeting = !v.prenom && t.greetingAnonymous ? t.greetingAnonymous : t.greeting

  const h = (s: string) => fill(esc(swap(s)), asHtml)
  const x = (s: string) => fill(swap(s), asText)
  const body = t.body.filter(keep)
  const footer = v.desinscription ? T.prelaunch.footer : T.footerContributor
  const footerSize = 'font-size:13px'
  const adresseHtml = v.adresse ? `<br>${esc(v.adresse)}` : ''

  return {
    subject: t.subject,
    html: page([
      para(h(greeting)),
      ...body.map(s => para(h(s))),
      ...(list.length ? [`<ul>${list.map(s => `<li>${h(s)}</li>`).join('')}</ul>`] : []),
      ...t.closing.map(s => para(h(s))),
      para(h(t.signature)),
      `<p style="${footerSize}">${h(footer)}${adresseHtml}</p>`,
    ].join('')),
    text: [
      x(greeting), '',
      ...body.flatMap(s => [x(s), '']),
      ...(list.length ? [...list.map(s => `- ${x(s)}`), ''] : []),
      ...t.closing.flatMap(s => [x(s), '']),
      x(t.signature), '', '--',
      x(footer),
      ...(v.adresse ? [v.adresse] : []),
    ].join('\n'),
  }
}
