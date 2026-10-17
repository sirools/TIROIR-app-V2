// Textes de la homepage V2 (prototype, route /v2). Tous provisoires : la
// page les affiche suivis de « [PLACEHOLDER] » (masqué avec /v2?clean)
// tant qu'ils ne sont pas réécrits. Les prix, eux, viennent de lib/offers.ts.

export const COPY = {
  hero: {
    eyebrow: 'Pour les créatifs et les pros',
    title: 'Une photo. Une fiche. Sa valeur.',
    sub: 'Photographiez un objet : Tiroir rédige sa fiche, le range dans la bonne collection et estime ce qu’il vaut.',
    steps: ['Photo', 'Fiche', 'Valeur'],
    object: {
      badge: 'Fiche créée par l’IA',
      name: 'Montre automatique',
      meta: 'Années 1970 · acier',
      rows: [
        ['Catégorie', 'Horlogerie'],
        ['Collection', 'Atelier — vitrine'],
        ['État', 'Très bon'],
      ],
      valueLabel: 'Estimation de valeur',
      value: '380 – 460 €',
    },
  },
  camille: {
    eyebrow: 'Cas d’usage',
    title: 'Camille, décoratrice freelance',
    sub: 'Trois cents objets chinés, répartis entre un box et l’atelier. Un client attend une sélection pour vendredi.',
    steps: [
      {
        label: 'Retrouvé',
        title: 'Son stock, retrouvé en une recherche',
        text: 'Elle tape « fauteuil rotin » : Tiroir lui dit qu’il est dans le box 2, étagère B.',
      },
      {
        label: 'Valorisé',
        title: 'Chaque pièce a son prix',
        text: 'Tiroir estime chaque objet d’après le marché. Camille sait enfin ce que vaut son stock.',
      },
      {
        label: 'Partagé',
        title: 'Une sélection, un lien privé',
        text: 'Elle envoie au client un lien privé vers sa sélection. Pas de PDF, pas de photos en vrac.',
      },
    ],
    items: [
      { name: 'Fauteuil rotin', place: 'Box 2 · étagère B', value: '≈ 240 €' },
      { name: 'Lampe laiton', place: 'Atelier · vitrine', value: '≈ 90 €' },
      { name: 'Miroir soleil', place: 'Box 1 · mur', value: '≈ 160 €' },
    ],
    search: 'fauteuil rotin',
    total: 'Stock valorisé ≈ 12 480 €',
    share: {
      title: 'Sélection — Projet Hôtel Marceau',
      link: 'tiroir.app/s/k7Q2…',
      private: 'Lien privé',
      seen: 'Vu par le client · il y a 2 min',
      reply: 'Le fauteuil est parfait, on le prend !',
    },
  },
  values: {
    eyebrow: 'Ce que Tiroir change',
    title: 'Trois gestes, zéro tableur',
    cards: [
      { title: 'Retrouver', text: 'Chaque objet a sa fiche, sa photo et sa place. Une recherche suffit.' },
      { title: 'Estimer', text: 'Une estimation de valeur fondée sur le marché, mise à jour quand vous voulez.' },
      { title: 'Partager', text: 'Une collection, un lien privé. Votre client voit ce que vous choisissez de montrer.' },
    ],
  },
  public: {
    eyebrow: 'Et pour tout le monde',
    title: 'Pas besoin d’être pro',
    sub: 'Tout ce qui compte pour vous mérite une fiche.',
    examples: [
      { title: 'Votre cave', text: 'Bouteilles, millésimes, et ce qu’elles valent.' },
      { title: 'Une collection', text: 'Vinyles, montres, cartes : tout au même endroit.' },
      { title: 'Un déménagement', text: 'Quel carton, quelle pièce, rien ne se perd.' },
      { title: 'L’assurance', text: 'Un inventaire daté et chiffré, prêt en cas de sinistre.' },
    ],
  },
  offers: {
    eyebrow: 'Offres',
    title: 'Commencez gratuitement',
    sub: 'Passez à la formule supérieure quand vous en avez besoin.',
    recommended: 'Recommandé',
    details: 'Voir le détail des offres',
    soon: 'Bientôt disponible',
    contact: 'Nous contacter',
    plans: {
      free: { tagline: 'Pour cataloguer tout ce que vous possédez.', features: ['Objets et collections illimités', 'Partage en lecture seule'] },
      premium: { tagline: 'Pour suivre la valeur de votre collection.', features: ['Estimation automatique', 'Courbe de valeur', 'Liens protégés par mot de passe'] },
      pro: { tagline: 'Pour ceux qui vivent de leurs objets.', features: ['IA incluse, sans recharge', 'Estimation en lot', 'Export assurance'] },
      business: { tagline: 'Pour gérer un stock en équipe.', features: ['Tout le Pro, pour chaque membre', 'Rôles et comptes multiples'] },
    },
  },
  final: {
    title: 'Votre premier objet, dans dix secondes.',
    sub: 'Gratuit, sans carte bancaire.',
  },
} as const
