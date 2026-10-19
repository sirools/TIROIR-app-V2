// Textes du site en français — langue de référence : les autres fichiers
// (en, da, de, es) suivent exactement cette structure (type `Copy`).
// Les marqueurs {n}, {price}… sont remplacés à l'affichage.
//
// Positionnement : on vend un résultat, pas de l'IA. L'IA n'apparaît
// jamais dans un titre, seulement comme explication discrète (home.why).

const fr = {
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
    footerTagline: 'Photographiez vos objets, Tiroir rédige la fiche. Votre inventaire, enfin tenu à jour.',
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

  // Achats dans l'app (page Tarifs) : Premium et crédits passent par les stores.
  inApp: {
    subscribe: 'S’abonner dans l’app',
    buyCredits: 'Acheter des crédits dans l’app',
    subscriptionNote: 'L’abonnement se gère depuis l’app.',
    creditsNote: 'Les crédits s’achètent depuis l’app.',
  },

  home: {
    meta: {
      title: 'Tiroir — une photo, et vos objets sont rangés',
      description: 'Photographiez un objet : Tiroir rédige sa fiche, le range et estime sa valeur. Pour les créatifs, les pros et tous ceux qui veulent savoir ce qu’ils possèdent.',
    },
    hero: {
      badge: 'Disponible sur iOS et Android',
      // Trois accroches ; la variante active se choisit dans locales/index.ts.
      variants: [
        {
          title: 'Une photo, et tout ce que vous possédez est rangé.',
          sub: 'Tiroir rédige la fiche de chaque objet à votre place, catégorie, état et valeur comprises.',
        },
        {
          title: 'Sachez enfin ce que vous avez, et ce que ça vaut.',
          sub: 'Tiroir rédige la fiche de chaque objet à votre place, catégorie, état et valeur comprises.',
        },
        {
          title: 'Votre inventaire se fait tout seul.',
          sub: 'Prenez une photo, Tiroir s’occupe du reste. Aucune compétence technique requise.',
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
    how: {
      eyebrow: 'Comment ça marche',
      title: 'Trois gestes, aucun réglage.',
      steps: [
        { title: 'Photographiez', text: 'Un objet, une photo. Ou cent d’un coup, en mode rafale.' },
        { title: 'La fiche s’écrit', text: 'Nom, catégorie, matière, état : tout est rempli. Vous corrigez si besoin.' },
        { title: 'C’est rangé', text: 'Collections, recherche, statut : vous retrouvez tout, à tout moment.' },
      ],
      fiche: { name: 'Veste en jean', rows: [['Catégorie', 'Vêtements'], ['Matière', 'Denim'], ['État', 'Bon']] },
      collections: ['Dressing', 'À vendre', 'Studio'],
      search: 'veste bleue',
    },
    pros: {
      eyebrow: 'Pour les créatifs et les pros',
      title: 'Moins de saisie, plus de métier.',
      sub: 'Votre matériel, votre stock, vos collections : documentés en quelques photos, pendant que vous travaillez.',
      personas: [
        { who: 'Styliste', text: 'Chaque pièce photographiée, rangée par shooting. Vous savez ce qui est sorti et ce qui est revenu.', chip: 'Prêtée · retour vendredi' },
        { who: 'Régisseur', text: 'Le matériel inventorié avant le tournage, vérifié au retour. Tout le parc tient dans votre poche.', chip: '42 pièces · 3 prêtées' },
        { who: 'Brocanteur', text: 'Un déballage entier en une session grâce au mode rafale, avec un prix de départ pour chaque pièce.', chip: 'Rafale · 60 objets' },
        { who: 'Musicien', text: 'Instruments et accessoires documentés, factures jointes : prêts pour l’assurance ou la revente.', chip: 'Valeur ≈ {price}' },
      ],
    },
    everyone: {
      eyebrow: 'Et pour tout le monde',
      title: 'Pas besoin d’être pro. Ni technicien.',
      sub: 'Si vous savez prendre une photo, vous savez utiliser Tiroir.',
      points: [
        { title: 'Aucune compétence requise', text: 'Pas de tableau ni de formulaire vide. Vous photographiez, Tiroir remplit.' },
        { title: 'Vos données restent à vous', text: 'Pas de publicité, rien n’est revendu ni utilisé pour entraîner des modèles. Supprimer votre compte efface tout, immédiatement.' },
        { title: 'Partage en lecture seule', text: 'Un lien vers une collection : la personne regarde, sans compte ni application. Vous coupez le lien quand vous voulez.' },
      ],
      usesTitle: 'Ça sert aussi à…',
      uses: ['Préparer un dossier d’assurance', 'Déménager sans rien perdre', 'Fixer les prix d’un vide-grenier', 'Faire le tri dans un dressing'],
      why: 'Pourquoi ça marche : une intelligence artificielle de reconnaissance d’image décrit chaque photo. Le résultat reste une proposition — chaque champ se modifie, et vos corrections priment toujours.',
    },
    value: {
      eyebrow: 'La valeur de vos objets',
      title: 'Sachez ce que ça vaut, et suivez-le.',
      sub: 'Une estimation fondée sur des annonces comparables, pas un chiffre sorti d’un chapeau.',
      items: [
        { title: 'Estimer', text: 'Une fourchette de prix, et les annonces qui l’ont produite.' },
        { title: 'Suivre', text: 'La valeur de chaque objet et de chaque collection, actualisée quand vous voulez.' },
        { title: 'Revendre', text: 'Marquez « Vendu » avec le prix réel : l’objet reste dans votre historique.' },
      ],
      note: 'Ce n’est pas une expertise : pour une pièce rare, c’est un ordre de grandeur.',
      demo: { comparable: 'Annonce similaire', sold: 'Vendu', trend: 'Valeur de la collection' },
    },
    pricing: {
      eyebrow: 'Tarifs',
      title: 'Gratuit pour commencer.',
      sub: 'Passez à la formule supérieure quand vous en avez besoin.',
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
        { q: 'Faut-il s’y connaître en technologie ?', a: 'Non. Vous prenez une photo, Tiroir remplit la fiche. Tout se corrige d’un geste.' },
        { q: 'Et si la fiche se trompe ?', a: 'Chaque champ est modifiable, et vos corrections priment toujours. La marque exacte ou le prix d’achat, c’est vous qui les connaissez.' },
        { q: 'Mes photos sont-elles privées ?', a: 'Oui. Rien n’est public tant que vous ne partagez pas un lien, et vous pouvez le désactiver à tout moment.' },
        { q: 'L’estimation est-elle fiable ?', a: 'Elle s’appuie sur des annonces comparables : un prix de départ fiable pour un objet courant, un ordre de grandeur pour une pièce rare.' },
      ],
    },
    final: {
      title: 'Votre premier objet, rangé en une photo.',
      sub: 'Gratuit, sans carte bancaire.',
    },
  },
}

export type Copy = typeof fr
export default fr
