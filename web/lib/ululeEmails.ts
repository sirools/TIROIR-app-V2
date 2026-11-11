// Mise en forme des deux e-mails de la campagne. Textes : design/i18n/email/fr.json
// (section ulule). Volontairement sobre : un message d'une personne à une autre.
import { ULULE_EMAIL_TEXTS as T } from '../locales/ulule.generated'

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
