// Textes de l'e-mail de partage, dans les langues du site.
//
// La langue est celle de l'app de l'expéditeur (envoyée par le mobile) :
// on suppose qu'on écrit à quelqu'un qui parle sa langue. Sans langue
// reconnue — anciennes versions de l'app —, l'e-mail part en français,
// comme avant. Traductions da/de/es à faire relire par un natif.

export const SHARE_EMAIL_LANGS = ['fr', 'en', 'da', 'de', 'es'] as const
export type ShareEmailLang = (typeof SHARE_EMAIL_LANGS)[number]

export function shareEmailLang(value: unknown): ShareEmailLang {
  const code = typeof value === 'string' ? value.trim().toLowerCase().slice(0, 2) : ''
  return (SHARE_EMAIL_LANGS as readonly string[]).includes(code) ? (code as ShareEmailLang) : 'fr'
}

/** Lien de l'e-mail : préfixé par la langue, pour que la page suive l'e-mail. */
export function shareEmailUrl(lang: ShareEmailLang, token: string): string {
  return lang === 'fr' ? `https://tiroir.app/s/${token}` : `https://tiroir.app/${lang}/s/${token}`
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

export const SHARE_EMAIL_COPY: Record<ShareEmailLang, ShareEmailCopy> = {
  fr: {
    greeting: (name) => (name ? `Bonjour ${name},` : 'Bonjour,'),
    objects: (n) => (n > 1 ? `${n} objets` : '1 objet'),
    body: (sender, objects, title) => `${sender} vient de partager une liste de ${objects}${title} avec vous sur Tiroir.`,
    quote: (title) => ` « ${title} »`,
    button: 'VOIR LES OBJETS PARTAGÉS',
    password: '🔒 Ce lien est protégé par un mot de passe que vous devez avoir reçu séparément.',
    fallback: 'Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :',
    footer: "Tiroir — l'inventaire de vos objets, simplement.",
    subject: (sender) => `${sender} a partagé des objets avec vous sur Tiroir`,
    anonymousSender: 'Un utilisateur Tiroir',
  },
  en: {
    greeting: (name) => (name ? `Hi ${name},` : 'Hi,'),
    objects: (n) => (n > 1 ? `${n} items` : '1 item'),
    body: (sender, objects, title) => `${sender} has just shared a list of ${objects}${title} with you on Tiroir.`,
    quote: (title) => ` “${title}”`,
    button: 'VIEW THE SHARED ITEMS',
    password: '🔒 This link is protected by a password, which you should have received separately.',
    fallback: 'If the button doesn’t work, copy this link into your browser:',
    footer: 'Tiroir — an inventory of your things, made simple.',
    subject: (sender) => `${sender} shared some items with you on Tiroir`,
    anonymousSender: 'A Tiroir user',
  },
  da: {
    greeting: (name) => (name ? `Hej ${name},` : 'Hej,'),
    objects: (n) => (n > 1 ? `${n} genstande` : '1 genstand'),
    body: (sender, objects, title) => `${sender} har lige delt en liste med ${objects}${title} med dig på Tiroir.`,
    quote: (title) => ` „${title}“`,
    button: 'SE DE DELTE GENSTANDE',
    password: '🔒 Linket er beskyttet med en adgangskode, som du skal have modtaget separat.',
    fallback: 'Hvis knappen ikke virker, så kopiér dette link ind i din browser:',
    footer: 'Tiroir — overblik over dine ting, helt enkelt.',
    subject: (sender) => `${sender} har delt nogle genstande med dig på Tiroir`,
    anonymousSender: 'En Tiroir-bruger',
  },
  de: {
    greeting: (name) => (name ? `Hallo ${name},` : 'Hallo,'),
    objects: (n) => (n > 1 ? `${n} Gegenständen` : '1 Gegenstand'),
    body: (sender, objects, title) => `${sender} hat gerade eine Liste mit ${objects}${title} auf Tiroir mit Ihnen geteilt.`,
    quote: (title) => ` „${title}“`,
    button: 'GETEILTE GEGENSTÄNDE ANSEHEN',
    password: '🔒 Dieser Link ist durch ein Passwort geschützt, das Sie separat erhalten haben sollten.',
    fallback: 'Falls der Button nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:',
    footer: 'Tiroir — das Inventar Ihrer Dinge, ganz einfach.',
    subject: (sender) => `${sender} hat Gegenstände auf Tiroir mit Ihnen geteilt`,
    anonymousSender: 'Ein Tiroir-Nutzer',
  },
  es: {
    greeting: (name) => (name ? `Hola, ${name}:` : 'Hola:'),
    objects: (n) => (n > 1 ? `${n} objetos` : '1 objeto'),
    body: (sender, objects, title) => `${sender} acaba de compartir contigo en Tiroir una lista de ${objects}${title}.`,
    quote: (title) => ` «${title}»`,
    button: 'VER LOS OBJETOS COMPARTIDOS',
    password: '🔒 Este enlace está protegido con una contraseña que deberías haber recibido por separado.',
    fallback: 'Si el botón no funciona, copia este enlace en tu navegador:',
    footer: 'Tiroir — el inventario de tus cosas, así de fácil.',
    subject: (sender) => `${sender} ha compartido objetos contigo en Tiroir`,
    anonymousSender: 'Un usuario de Tiroir',
  },
}
