// Cycle de vie d'un prêt d'objet.
// Doit rester aligné avec v3/supabase/drafts/0002_object_loans.sql.

export type StatutPret = 'demande' | 'accepte' | 'en_cours' | 'rendu' | 'refuse' | 'annule'

export type EvenementPret = 'accepter' | 'refuser' | 'annuler' | 'remettre' | 'rendre'

const TRANSITIONS: Record<StatutPret, Partial<Record<EvenementPret, StatutPret>>> = {
  demande: { accepter: 'accepte', refuser: 'refuse', annuler: 'annule' },
  accepte: { remettre: 'en_cours', annuler: 'annule' },
  en_cours: { rendre: 'rendu' },
  rendu: {},
  refuse: {},
  annule: {},
}

export function estTermine(statut: StatutPret): boolean {
  return Object.keys(TRANSITIONS[statut]).length === 0
}

export function transition(statut: StatutPret, evenement: EvenementPret): StatutPret {
  const suivant = TRANSITIONS[statut][evenement]
  if (!suivant) {
    throw new Error(`Transition de prêt impossible : « ${evenement} » depuis « ${statut} »`)
  }
  return suivant
}

/** Un prêt remis dont l'échéance (jour inclus) est dépassée. */
export function estEnRetard(
  pret: { statut: StatutPret; echeance: Date | null },
  maintenant: Date = new Date(),
): boolean {
  if (pret.statut !== 'en_cours' || pret.echeance === null) return false
  const finEcheance = new Date(pret.echeance)
  finEcheance.setHours(23, 59, 59, 999)
  return maintenant.getTime() > finEcheance.getTime()
}

/**
 * Statut V2 de l'objet (objects.status) pendant le prêt : 'loaned' tant que
 * l'objet est entre les mains de l'emprunteur, inchangé sinon.
 */
export function statutObjetPendant(statut: StatutPret): 'loaned' | null {
  return statut === 'en_cours' ? 'loaned' : null
}
