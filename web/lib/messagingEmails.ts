// Mise en forme des e-mails de la messagerie. Textes : design/i18n/site/
// (section messages.email), dans la langue du destinataire.
//
// Règle : aucun e-mail ne porte l'adresse de l'autre partie — seulement
// son prénom, le titre de la vente, le texte du message et un lien vers
// le fil. Tout ce qui vient d'un utilisateur est échappé.
import type { Copy } from '../locales'
import type { RenderedEmail } from './ululeEmails'

type EmailCopy = Copy['messages']['email']

export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const fill = (text: string, vars: Record<string, string>) =>
  text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? vars[k] : m))

/** Un nom ou un titre dans un objet d'e-mail : une seule ligne. */
const oneLine = (s: string) => s.replace(/[\r\n]+/g, ' ').trim()

/**
 * Couleurs de la marque, recopiées de design/tokens.json (un e-mail ne lit
 * pas de variables CSS). Le test messaging.test.ts casse si elles s'en écartent.
 */
export const EMAIL_COLORS = { orange: '#F26900', 'beige-2': '#FFF8EF', ink: '#121212', muted: '#5b5b5b', white: '#FFFFFF' } as const
const C = EMAIL_COLORS

function layout(lang: string, blocks: string[]): string {
  return `<!doctype html><html lang="${esc(lang)}"><body style="margin:0;padding:24px;background:${C['beige-2']};font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.5;color:${C.ink}">`
    + `<div style="max-width:520px;margin:0 auto;background:${C.white};border-radius:14px;padding:24px">${blocks.join('')}</div></body></html>`
}
const para = (html: string, style = '') => `<p style="margin:0 0 16px;${style}">${html}</p>`
const button = (url: string, label: string) =>
  `<p style="margin:0 0 16px"><a href="${esc(url)}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:${C.orange};color:${C.white};font-weight:700;text-decoration:none">${esc(label)}</a></p>`
const quote = (text: string) =>
  `<blockquote style="margin:0 0 16px;padding:12px 16px;border-left:3px solid ${C.orange};background:${C['beige-2']};border-radius:6px;white-space:pre-wrap;overflow-wrap:anywhere">${esc(text)}</blockquote>`
const small = (html: string) => para(html, `font-size:13px;color:${C.muted}`)

/** À l'invité : « confirme ton adresse pour que ton message parte ». */
export function renderVerify(t: EmailCopy, lang: string, v: { name: string; seller: string; title: string; text: string; link: string }): RenderedEmail {
  const vars = { name: v.name, seller: v.seller, title: v.title }
  const html = { name: esc(v.name), seller: esc(v.seller), title: esc(v.title) }
  return {
    subject: oneLine(fill(t.verifySubject, vars)),
    html: layout(lang, [
      para(fill(esc(t.greeting), html)),
      para(fill(esc(t.verifyBody), html)),
      quote(v.text),
      button(v.link, t.verifyButton),
      small(`${esc(t.linkFallback)}<br><a href="${esc(v.link)}">${esc(v.link)}</a>`),
      small(esc(t.verifyIgnore)),
    ]),
    text: [fill(t.greeting, vars), '', fill(t.verifyBody, vars), '', v.text, '', v.link, '', t.verifyIgnore].join('\n'),
  }
}

/** Au destinataire d'un message : qui écrit, à propos de quoi, le texte, le lien vers le fil. */
export function renderNewMessage(t: EmailCopy, lang: string, v: { from: string; title: string; text: string; link: string }): RenderedEmail {
  const vars = { name: v.from, title: v.title }
  const html = { name: esc(v.from), title: esc(v.title) }
  return {
    subject: oneLine(fill(t.newSubject, vars)),
    html: layout(lang, [
      para(fill(esc(t.newBody), html)),
      quote(v.text),
      button(v.link, t.replyButton),
      small(`${esc(t.linkFallback)}<br><a href="${esc(v.link)}">${esc(v.link)}</a>`),
      small(esc(t.footer)),
    ]),
    text: [fill(t.newBody, vars), '', v.text, '', `${t.replyButton} : ${v.link}`, '', '--', t.footer].join('\n'),
  }
}
