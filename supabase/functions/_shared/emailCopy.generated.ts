// Généré par design/generate.mjs depuis design/i18n/email/ — ne pas modifier à la main.
/** Langues dans lesquelles partent les e-mails. */
export const EMAIL_LANGUAGES = ["fr","en","es","de","pt-BR","pt-PT","da"] as const
export type EmailLanguage = (typeof EMAIL_LANGUAGES)[number]

export interface ShareEmailTexts {
  greeting: string
  greetingAnonymous: string
  objects_one: string
  objects_other: string
  body: string
  quote: string
  button: string
  password: string
  fallback: string
  footer: string
  subject: string
  anonymousSender: string
}

/** E-mail de partage. Marqueurs {name}, {n}, {sender}, {objects}, {title}. */
export const SHARE_EMAIL_TEXTS: Record<EmailLanguage, ShareEmailTexts> = {
  "fr": {
    "greeting": "Bonjour {name},",
    "greetingAnonymous": "Bonjour,",
    "objects_one": "1 objet",
    "objects_other": "{n} objets",
    "body": "{sender} vient de partager une liste de {objects}{title} avec vous sur Tiroir.",
    "quote": " « {title} »",
    "button": "VOIR LES OBJETS PARTAGÉS",
    "password": "🔒 Ce lien est protégé par un mot de passe que vous devez avoir reçu séparément.",
    "fallback": "Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :",
    "footer": "Tiroir — l'inventaire de vos objets, simplement.",
    "subject": "{sender} a partagé des objets avec vous sur Tiroir",
    "anonymousSender": "Un utilisateur Tiroir"
  },
  "en": {
    "greeting": "Hi {name},",
    "greetingAnonymous": "Hi,",
    "objects_one": "1 item",
    "objects_other": "{n} items",
    "body": "{sender} has just shared a list of {objects}{title} with you on Tiroir.",
    "quote": " “{title}”",
    "button": "VIEW THE SHARED ITEMS",
    "password": "🔒 This link is protected by a password, which you should have received separately.",
    "fallback": "If the button doesn’t work, copy this link into your browser:",
    "footer": "Tiroir — an inventory of your things, made simple.",
    "subject": "{sender} shared some items with you on Tiroir",
    "anonymousSender": "A Tiroir user"
  },
  "es": {
    "greeting": "Hola, {name}:",
    "greetingAnonymous": "Hola:",
    "objects_one": "1 objeto",
    "objects_other": "{n} objetos",
    "body": "{sender} acaba de compartir contigo en Tiroir una lista de {objects}{title}.",
    "quote": " «{title}»",
    "button": "VER LOS OBJETOS COMPARTIDOS",
    "password": "🔒 Este enlace está protegido con una contraseña que deberías haber recibido por separado.",
    "fallback": "Si el botón no funciona, copia este enlace en tu navegador:",
    "footer": "Tiroir — el inventario de tus cosas, así de fácil.",
    "subject": "{sender} ha compartido objetos contigo en Tiroir",
    "anonymousSender": "Un usuario de Tiroir"
  },
  "de": {
    "greeting": "Hallo {name},",
    "greetingAnonymous": "Hallo,",
    "objects_one": "1 Gegenstand",
    "objects_other": "{n} Gegenständen",
    "body": "{sender} hat gerade eine Liste mit {objects}{title} auf Tiroir mit Ihnen geteilt.",
    "quote": " „{title}“",
    "button": "GETEILTE GEGENSTÄNDE ANSEHEN",
    "password": "🔒 Dieser Link ist durch ein Passwort geschützt, das Sie separat erhalten haben sollten.",
    "fallback": "Falls der Button nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:",
    "footer": "Tiroir — das Inventar Ihrer Dinge, ganz einfach.",
    "subject": "{sender} hat Gegenstände auf Tiroir mit Ihnen geteilt",
    "anonymousSender": "Ein Tiroir-Nutzer"
  },
  "pt-BR": {
    "greeting": "Olá, {name},",
    "greetingAnonymous": "Olá,",
    "objects_one": "1 objeto",
    "objects_other": "{n} objetos",
    "body": "{sender} acabou de compartilhar com você no Tiroir uma lista de {objects}{title}.",
    "quote": " “{title}”",
    "button": "VER OS OBJETOS COMPARTILHADOS",
    "password": "🔒 Este link é protegido por uma senha, que você deve ter recebido separadamente.",
    "fallback": "Se o botão não funcionar, copie este link no seu navegador:",
    "footer": "Tiroir — o inventário das suas coisas, de um jeito simples.",
    "subject": "{sender} compartilhou objetos com você no Tiroir",
    "anonymousSender": "Um usuário do Tiroir"
  },
  "pt-PT": {
    "greeting": "Olá, {name},",
    "greetingAnonymous": "Olá,",
    "objects_one": "1 objeto",
    "objects_other": "{n} objetos",
    "body": "{sender} acabou de partilhar consigo no Tiroir uma lista de {objects}{title}.",
    "quote": " «{title}»",
    "button": "VER OS OBJETOS PARTILHADOS",
    "password": "🔒 Esta ligação está protegida por uma palavra-passe, que deverá ter recebido em separado.",
    "fallback": "Se o botão não funcionar, copie esta ligação para o seu navegador:",
    "footer": "Tiroir — o inventário das suas coisas, de forma simples.",
    "subject": "{sender} partilhou objetos consigo no Tiroir",
    "anonymousSender": "Um utilizador do Tiroir"
  },
  "da": {
    "greeting": "Hej {name},",
    "greetingAnonymous": "Hej,",
    "objects_one": "1 genstand",
    "objects_other": "{n} genstande",
    "body": "{sender} har lige delt en liste med {objects}{title} med dig på Tiroir.",
    "quote": " „{title}“",
    "button": "SE DE DELTE GENSTANDE",
    "password": "🔒 Linket er beskyttet med en adgangskode, som du skal have modtaget separat.",
    "fallback": "Hvis knappen ikke virker, så kopiér dette link ind i din browser:",
    "footer": "Tiroir — overblik over dine ting, helt enkelt.",
    "subject": "{sender} har delt nogle genstande med dig på Tiroir",
    "anonymousSender": "En Tiroir-bruger"
  }
}

export interface PresentationTexts {
  subject: string
  opening: Record<string, string>
  text: { lines: string[] }
}

/** E-mail de présentation : objet, première phrase, version texte (le HTML est dans emailPresentation.ts). */
export const PRESENTATION_TEXTS: Partial<Record<EmailLanguage, PresentationTexts>> = {
  "fr": {
    "subject": "On ne s’est jamais vraiment présentés",
    "opening": {
      "j3": "Vous avez créé un compte Tiroir il y a trois jours.",
      "backfill": "Vous avez créé un compte Tiroir — il y a un moment déjà."
    },
    "text": {
      "lines": [
        "ON NE S’EST JAMAIS VRAIMENT PRÉSENTÉS",
        "",
        "{ouverture} C’est le premier message que je vous envoie, et il n’y en aura pas trente : je voulais simplement vous dire à quoi sert cette application.",
        "",
        "Vous possédez des centaines d’objets. Vous n’en avez la liste nulle part. Ce n’est pas gênant au quotidien — ça le devient le jour d’un cambriolage, d’un dégât des eaux, d’un déménagement, d’une succession.",
        "",
        "Tiroir fabrique cette liste à votre place. Vous photographiez un objet, l’application le reconnaît et rédige sa fiche : titre, description, caractéristiques, valeur estimée. Rien à saisir au clavier. Si la photo montre toute une étagère, Tiroir crée une fiche par objet qu’il y reconnaît.",
        "",
        "Commencer : {site}",
        "",
        "Tiroir est développé par une seule personne, et je lis tout ce qui arrive dans cette boîte. Répondez à ce message si quelque chose ne va pas.",
        "",
        "Clément, fondateur de Tiroir",
        "",
        "—",
        "Vous recevez ce message parce que vous avez créé un compte sur tiroir.app.",
        "Au plus un message par mois.",
        "{adresse}",
        "Me désinscrire : {desinscription}"
      ]
    }
  }
}
