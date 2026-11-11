// Généré par design/generate.mjs depuis design/i18n/site/fr.json — ne pas modifier à la main.
//
// Textes du site en français — langue de référence : les autres fichiers
// (en, da, de, es) suivent exactement cette structure (type `Copy`).
// Les marqueurs {n}, {price}… sont remplacés à l'affichage.
//
// Positionnement : on vend un résultat, pas de l'IA. L'IA n'apparaît
// jamais dans un titre, seulement comme explication discrète (home.why).
import share from './share/fr'
import account from './account/fr'
import about from './about/fr'
import legal from './legal/fr'

const fr = {
  share,
  account,
  about,
  legal,
  layout: {
    pricing: 'Tarifs',
    download: 'Télécharger l’app',
    myProfile: 'Mon profil',
    myAccount: 'Mon compte',
    myShares: 'Mes partages',
    signOut: 'Se déconnecter',
    signUp: 'Créer un compte',
    signIn: 'Se connecter',
    newHere: 'Pas encore inscrit ?',
    openMenu: 'Ouvrir le menu',
    closeMenu: 'Fermer le menu',
    footerTagline: 'Photographie tes objets, Tiroir rédige la fiche. Ton inventaire, enfin tenu à jour.',
    product: 'Produit',
    project: 'Le projet',
    about: 'À propos',
    bookSlot: 'Réserver un créneau',
    bookSubject: 'Parler de Tiroir',
    legal: 'Légal',
    terms: 'CGU',
    privacy: 'Confidentialité',
    madeIn: 'Fait en France',
    contact: 'Contact',
    language: 'Langue',
  },
  home: {
    meta: {
      title: 'Tiroir — une photo, et tes objets sont rangés',
      description: 'Photographie un objet : Tiroir rédige sa fiche, le range et estime sa valeur. Pour les créatifs, les pros et tous ceux qui veulent savoir ce qu’ils possèdent.',
    },
    hero: {
      badge: 'Disponible sur iOS et Android',
      // Trois accroches ; la variante active se choisit dans locales/index.ts.
      variants: [
        {
          title: 'Une photo, et tout ce que tu possèdes est rangé.',
          sub: 'Tiroir rédige la fiche de chaque objet à ta place, catégorie, état et valeur comprises.',
        },
        {
          title: 'Sache enfin ce que tu as, et ce que ça vaut.',
          sub: 'Tiroir rédige la fiche de chaque objet à ta place, catégorie, état et valeur comprises.',
        },
        {
          title: 'Ton inventaire se fait tout seul.',
          sub: 'Prends une photo, Tiroir s’occupe du reste. Aucune compétence technique requise.',
        },
      ],
      free: 'Gratuit pour commencer',
      demoLabel: 'Démonstration : une photo de montre devient une fiche complète, avec sa valeur estimée.',
      steps: ['Photo', 'Fiche', 'Valeur'],
      object: {
        ready: 'Fiche prête',
        name: 'Montre vintage',
        meta: 'Années 1970 · acier',
        rows: [
          ['Catégorie', 'Horlogerie'],
          ['Collection', 'Vitrine'],
          ['État', 'Très bon'],
        ],
        valueLabel: 'Valeur estimée',
      },
    },
    photo: {
      title: 'Une photo, c’est tout.',
      sub: 'Torix, l’IA de Tiroir, reconnaît ton objet et remplit sa fiche. Toi, tu choisis juste le tiroir.',
      steps: [
        {
          title: 'Tu prends la photo',
          text: 'Un objet, une photo. Aucun formulaire à remplir.',
        },
        {
          title: 'Torix remplit la fiche',
          text: 'Nom, catégorie, état : tout s’écrit tout seul. Tu corriges si tu veux.',
        },
        {
          title: 'C’est rangé',
          text: 'Tu choisis le tiroir pendant que Torix travaille. Ensuite, tu retrouves tout en un instant.',
        },
      ],
      fiche: {
        name: 'Veste en jean',
        rows: [
          ['Catégorie', 'Vêtements'],
          ['État', 'Bon'],
        ],
        estimate: 'Valeur',
        estimateCta: '✦ Estimer',
      },
      drawer: 'Dressing',
      stored: 'Rangée',
      video: {
        label: 'Vidéo de démonstration : la photo d’un objet devient une fiche complète, rangée dans un tiroir.',
        badge: '10 secondes',
        play: 'Lire la vidéo',
        pause: 'Mettre la vidéo en pause',
      },
      reassure: 'Gratuit, sans carte bancaire. {n} actions IA par mois incluses.',
      cta: 'Essayer gratuitement',
    },
    pros: {
      eyebrow: 'Pour les créatifs et les pros',
      title: 'Moins de saisie, plus de métier.',
      sub: 'Ton matériel, ton stock, tes collections : documentés en quelques photos, pendant que tu travailles.',
      personas: [
        {
          who: 'Styliste',
          text: 'Chaque pièce photographiée, rangée par shooting. Tu sais ce qui est sorti et ce qui est revenu.',
          chip: 'Prêtée · retour vendredi',
        },
        {
          who: 'Régisseur',
          text: 'Le matériel inventorié avant le tournage, vérifié au retour. Tout le parc tient dans ta poche.',
          chip: '42 pièces · 3 prêtées',
        },
        {
          who: 'Brocanteur',
          text: 'Un déballage entier en une session grâce au mode rafale, avec un prix de départ pour chaque pièce.',
          chip: 'Rafale · 60 objets',
        },
        {
          who: 'Musicien',
          text: 'Instruments et accessoires documentés, factures jointes : prêts pour l’assurance ou la revente.',
          chip: 'Valeur ≈ {price}',
        },
      ],
    },
    everyone: {
      eyebrow: 'Et pour tout le monde',
      title: 'Pas besoin d’être pro. Ni technicien.',
      sub: 'Si tu sais prendre une photo, tu sais utiliser Tiroir.',
      points: [
        {
          title: 'Aucune compétence requise',
          text: 'Pas de tableau ni de formulaire vide. Tu photographies, Tiroir remplit.',
        },
        {
          title: 'Tes données restent à toi',
          text: 'Pas de publicité, rien n’est revendu ni utilisé pour entraîner des modèles. Supprimer ton compte efface tout, immédiatement.',
        },
        {
          title: 'Partage en lecture seule',
          text: 'Un lien vers une collection : la personne regarde, sans compte ni application. Tu coupes le lien quand tu veux.',
        },
      ],
      usesTitle: 'Ça sert aussi à…',
      uses: [
        'Préparer un dossier d’assurance',
        'Déménager sans rien perdre',
        'Fixer les prix d’un vide-grenier',
        'Faire le tri dans un dressing',
      ],
      why: 'Pourquoi ça marche : une intelligence artificielle de reconnaissance d’image décrit chaque photo. Le résultat reste une proposition — chaque champ se modifie, et tes corrections priment toujours.',
    },
    value: {
      eyebrow: 'La valeur de tes objets',
      title: 'Sache ce que ça vaut, et suis-le.',
      sub: 'Une estimation fondée sur des annonces comparables, pas un chiffre sorti d’un chapeau.',
      items: [
        {
          title: 'Estimer',
          text: 'Une fourchette de prix, et les annonces qui l’ont produite.',
        },
        {
          title: 'Suivre',
          text: 'La valeur de chaque objet et de chaque collection, actualisée quand tu veux.',
        },
        {
          title: 'Revendre',
          text: 'Marque « Vendu » avec le prix réel : l’objet reste dans ton historique.',
        },
      ],
      note: 'Ce n’est pas une expertise : pour une pièce rare, c’est un ordre de grandeur.',
      demo: {
        comparable: 'Annonce similaire',
        sold: 'Vendu',
        trend: 'Valeur de la collection',
      },
    },
    pricing: {
      eyebrow: 'Tarifs',
      title: 'Gratuit pour commencer.',
      sub: 'Passe à la formule supérieure quand tu en as besoin.',
      perMonth: '/mois',
      perSeat: 'par siège/mois',
      plans: {
        free: 'Objets et collections illimités, {n} analyses par mois.',
        premium: 'Pour suivre la valeur de votre collection.',
        pro: 'Pour ceux qui vivent de leurs objets.',
        business: 'Pour gérer un stock en équipe.',
      },
      note: 'Prix TTC.',
      details: 'Voir le détail des offres',
    },
    faq: {
      title: 'Questions fréquentes',
      items: [
        {
          q: 'Faut-il s’y connaître en technologie ?',
          a: 'Non. Tu prends une photo, Tiroir remplit la fiche. Tout se corrige d’un geste.',
        },
        {
          q: 'Et si la fiche se trompe ?',
          a: 'Chaque champ est modifiable, et tes corrections priment toujours. La marque exacte ou le prix d’achat, c’est toi qui les connais.',
        },
        {
          q: 'Mes photos sont-elles privées ?',
          a: 'Oui. Rien n’est public tant que tu ne partages pas un lien, et tu peux le désactiver à tout moment.',
        },
        {
          q: 'L’estimation est-elle fiable ?',
          a: 'Elle s’appuie sur des annonces comparables : un prix de départ fiable pour un objet courant, un ordre de grandeur pour une pièce rare.',
        },
      ],
    },
    final: {
      title: 'Ton premier objet, rangé en une photo.',
      sub: 'Gratuit, sans carte bancaire.',
    },
    ululeInvite: {
      label: 'Campagne Ulule',
      close: 'Fermer',
      title: 'Noël avant Noël',
      textBefore: 'Le {date}, Tiroir de famille arrive sur Ulule : un mois avant Noël, pour donner à Tiroir les moyens de grandir.',
      textLive: 'Jusqu’au 15 décembre, soutiens Tiroir sur Ulule. Les contreparties s’offrent : un cadeau à glisser sous le sapin.',
      raised: '{amount} collectés',
      next: 'Prochain palier : {amount}',
      allReached: 'Tous les paliers sont atteints. Merci !',
      milestones: 'Paliers',
      cta: 'Voir la campagne',
    },
  },
  pricing: {
    meta: {
      title: 'Tarifs — Tiroir',
      description: 'Tiroir est gratuit, avec {free} actions IA par mois. Crédits IA dès {pack}, Premium à {premium} par mois, Pro à {pro} par mois, Business sur devis.',
    },
    badge: 'Tarifs',
    title: 'Range tout. Sache ce que ça vaut.',
    sub: 'Tiroir est gratuit pour tout le monde. Tu ne paies que si tu vas plus loin.',
    perMonth: '/mois',
    perYear: 'ou {price} par an',
    perSeat: 'par siège/mois',
    soon: 'Bientôt disponible',
    free: {
      tagline: 'Pour cataloguer tout ce que tu possèdes.',
      features: [
        'Objets et collections illimités',
        '{n} actions IA par mois (identification, estimation)',
        'Partage de collections en lecture seule',
        'Crédits IA en plus, à la demande',
      ],
      start: 'Commencer gratuitement',
      afterQuota: 'Quota IA mensuel, puis achat de crédits',
    },
    premium: {
      tagline: 'Pour suivre la valeur de votre collection.',
      features: [
        'Estimation automatique avec quota mensuel',
        'Courbe de suivi de valeur et bouton Actualiser',
        'Sources résumées en une ligne',
        'Liens de partage protégés par mot de passe',
      ],
      cta: 'Passer Premium',
    },
    pro: {
      tagline: 'Pour ceux qui vivent de leurs objets.',
      features: [
        'IA incluse, sans recharge',
        'Estimation en lot',
        'Détail des sources et comparaison marché',
        'Export assurance',
      ],
      cta: 'Passer Pro',
    },
    business: {
      tagline: 'Pour gérer un stock en équipe.',
      features: [
        'Tout le Pro, pour chaque membre',
        'Rôles et comptes multiples',
        'Facturation mensuelle, virement ou prélèvement',
      ],
      cta: 'Nous contacter',
      quote: 'Sur devis',
      billing: 'Facture mensuelle',
    },
    note: 'Prix TTC. Business se règle sur facture.',
    credits: {
      title: 'Crédits IA',
      sub: 'Besoin de plus ? Recharge quand tu veux, sans abonnement.',
      unit: '{n} crédits',
      popular: 'Le plus choisi',
      note: 'Paiement sécurisé par carte. Les crédits n’expirent pas.',
      cta: 'Acheter des crédits',
    },
    faqTitle: 'Questions fréquentes',
    faq: [
      {
        q: 'Qu’est-ce qu’une action IA ?',
        a: 'Une identification ou une estimation d’objet.',
      },
      {
        q: 'Que se passe-t-il quand mon quota est épuisé ?',
        a: 'Tiroir reste utilisable ; seules les actions IA demandent des crédits.',
      },
      {
        q: 'Les estimations sont-elles influencées par des partenaires ?',
        a: 'Non. Les estimations ne sont jamais influencées par nos partenaires : les offres marchandes sont séparées de l’estimation de valeur.',
      },
      {
        q: 'Puis-je résilier ?',
        a: 'À tout moment, depuis l’App Store, le Play Store ou votre compte.',
      },
    ],
    final: {
      title: 'Commence gratuitement.',
      sub: 'Objets et collections illimités, {n} actions IA par mois. Aucune carte bancaire requise.',
    },
    // Mention de l'annuel : 10 mois payés pour 12 (grille du 08/11/2026).
    twoMonthsFree: 'Deux mois offerts',
    // Après un prix TTC (assujetti à la TVA) ; vatExcl : le même prix hors taxes.
    vatIncl: 'TTC',
    vatExcl: 'soit {price} HT',
  },
  errors: {
    notFoundTitle: 'Page introuvable',
    notFoundText: 'La page demandée n’existe pas ou a été déplacée.',
    serverTitle: 'Erreur interne',
    serverText: 'Un problème est survenu de notre côté. Réessaie dans un instant.',
    back: 'Retour à l’accueil',
  },
}

export type Copy = typeof fr
export default fr
