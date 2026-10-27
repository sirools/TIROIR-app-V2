// Textes de l'e-mail de partage — mise en forme seulement. Les textes
// viennent de design/i18n/email/ (seule source, emailCopy.generated.ts) ;
// la liste des langues de design/i18n/languages.json.
//
// La langue est celle de l'app de l'expéditeur (envoyée par le mobile) :
// on suppose qu'on écrit à quelqu'un qui parle sa langue. Sans langue
// reconnue — anciennes versions de l'app —, l'e-mail part en français,
// comme avant. Traductions da/de/es/pt à faire relire par un natif.
import { EMAIL_LANGUAGES, SHARE_EMAIL_TEXTS, type EmailLanguage, type ShareEmailTexts } from './emailCopy.generated.ts'
import { REGIONAL_VARIANTS, SITE_LANGUAGES } from './languages.generated.ts'

export const SHARE_EMAIL_LANGS = EMAIL_LANGUAGES
export type ShareEmailLang = EmailLanguage

const isEmailLang = (code: string): code is ShareEmailLang => (EMAIL_LANGUAGES as readonly string[]).includes(code)

/** « de-DE » → de, « pt-PT » / « pt_PT » → pt-PT, « pt » → pt-BR ; inconnue → français. */
export function shareEmailLang(value: unknown): ShareEmailLang {
  const raw = typeof value === 'string' ? value.trim().replace('_', '-') : ''
  const base = raw.slice(0, 2).toLowerCase()
  const variants = REGIONAL_VARIANTS[base]
  if (variants) {
    const code = variants.byRegion[raw.slice(3, 5).toUpperCase()] ?? variants.default
    if (isEmailLang(code)) return code
  }
  return isEmailLang(base) ? base : 'fr'
}

/** Lien de l'e-mail : préfixé par la langue, pour que la page suive l'e-mail
 *  (en anglais si le site n'existe pas encore dans cette langue). */
export function shareEmailUrl(lang: ShareEmailLang, token: string): string {
  const page = (SITE_LANGUAGES as readonly string[]).includes(lang) ? lang : 'en'
  return page === 'fr' ? `https://tiroir.app/s/${token}` : `https://tiroir.app/${page}/s/${token}`
}

interface ShareEmailCopy {
  /** Formule d'appel, avec ou sans prénom. */
  greeting: (name: string) => string
  objects: (n: number) => string
  /** Corps : expéditeur (déjà en <strong>), nombre d'objets, « titre » éventuel. */
  body: (sender: string, objects: string, title: string) => string
  /** Titre de collection entre guillemets, avec l'espace qui le précède. */
  quote: (title: string) => string
  button: string
  password: string
  fallback: string
  footer: string
  subject: (sender: string) => string
  anonymousSender: string
}

/** Remplace les marqueurs {clé} ; les valeurs insérées ne sont pas relues. */
const fill = (text: string, vars: Record<string, string | number>) =>
  text.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))

function copyFor(t: ShareEmailTexts): ShareEmailCopy {
  return {
    greeting: (name) => (name ? fill(t.greeting, { name }) : t.greetingAnonymous),
    objects: (n) => (n > 1 ? fill(t.objects_other, { n }) : t.objects_one),
    body: (sender, objects, title) => fill(t.body, { sender, objects, title }),
    quote: (title) => fill(t.quote, { title }),
    button: t.button,
    password: t.password,
    fallback: t.fallback,
    footer: t.footer,
    subject: (sender) => fill(t.subject, { sender }),
    anonymousSender: t.anonymousSender,
  }
}

export const SHARE_EMAIL_COPY = Object.fromEntries(
  EMAIL_LANGUAGES.map(l => [l, copyFor(SHARE_EMAIL_TEXTS[l])]),
) as Record<ShareEmailLang, ShareEmailCopy>
