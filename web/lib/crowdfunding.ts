// La collecte Ulule de Tiroir : seule source de vérité pour son adresse,
// son état et sa date de fin. Le toast de l'accueil, la fiche de Torix et
// l'adresse de repli des liens d'ambassadeurs lisent tout ici.
//
// Sans dépendance, lisible par le navigateur comme par le serveur : rien de
// privé dans ce fichier.

export const CROWDFUNDING = {
  /** Interrupteur : false retire toute mention, quelle que soit la date. */
  active: true,
  url: 'https://fr.ulule.com/tiroir-app/',
  /** Mise en ligne, heure de Paris. */
  startDate: '2026-11-19T00:00:00+01:00',
  /**
   * Fin de la collecte telle qu'Ulule la publie (api.ulule.com, `date_end`),
   * heure de Paris. Passé cet instant, le toast disparaît tout seul.
   */
  endDate: '2026-12-21T23:59:24+01:00',
  /** Collecte « tout ou rien ». */
  goalEuros: 4000,
  /** Contreparties, toutes numériques, livrées en décembre 2026. */
  rewardsEuros: { min: 5, max: 450 },
} as const

/** Vrai tant que la collecte est ouverte. */
export function crowdfundingLive(now: number = Date.now()): boolean {
  return CROWDFUNDING.active
    && now >= Date.parse(CROWDFUNDING.startDate)
    && now < Date.parse(CROWDFUNDING.endDate)
}

/**
 * Adresse de la collecte avec son suivi. Ulule ne remonte dans son export
 * que la source et le support : `medium` dit d'où vient le clic sur le site
 * (« toast »…).
 */
export function crowdfundingLink(medium: string): string {
  const url = new URL(CROWDFUNDING.url)
  url.searchParams.set('utm_source', 'tiroir.app')
  url.searchParams.set('utm_medium', medium)
  url.searchParams.set('utm_campaign', 'ulule')
  return url.toString()
}
