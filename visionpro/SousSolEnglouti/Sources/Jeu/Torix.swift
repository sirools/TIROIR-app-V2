/// Les phrases de Torix : une liste fixe, toujours les mêmes mots.
///
/// Pour chaque phrase, l'app lit `torix_<nom>.m4a` (ou `.wav`) s'il est dans
/// le projet ; sinon, la voix française de l'appareil dit le texte.
public enum Phrase: String, CaseIterable, Sendable {
    case depart
    case trouvee1, trouvee2, trouvee3, trouvee4
    case fin
    case resonneDroite, resonneGauche, resonneFond, resonneDevant
    case toutPres
    case borneProche

    public var texte: String {
        switch self {
        case .depart:
            return "Bonjour, je suis Torix. Cinq enceintes sont cachées sous l'eau. Écoute bien, et avance case par case."
        case .trouvee1: return "Bravo, une enceinte. Il en reste quatre."
        case .trouvee2: return "Bravo, deux enceintes. Il en reste trois."
        case .trouvee3: return "Bravo, trois enceintes. Il en reste deux."
        case .trouvee4: return "Bravo, quatre enceintes. Il en reste une."
        case .fin: return "Bravo, tu as retrouvé les 5 enceintes."
        case .resonneDroite: return "Ça résonne à droite."
        case .resonneGauche: return "Ça résonne à gauche."
        case .resonneFond: return "Ça résonne vers le fond."
        case .resonneDevant: return "Ça résonne de ton côté."
        case .toutPres: return "Tu es tout près. Regarde bien autour de ta lampe."
        case .borneProche: return "Tu entends l'eau ? Il y a une borne pas loin."
        }
    }

    public var nomFichier: String { "torix_\(rawValue)" }

    /// La phrase dite quand la n-ième enceinte est trouvée (hors la dernière).
    public static func trouvee(_ total: Int) -> Phrase? {
        switch total {
        case 1: return .trouvee1
        case 2: return .trouvee2
        case 3: return .trouvee3
        case 4: return .trouvee4
        default: return nil
        }
    }

    /// L'indice à donner après un long moment sans déplacement.
    public static func indice(pour etat: EtatJeu) -> Phrase? {
        if etat.termine { return nil }
        let pas = etat.niveau.labyrinthe.distances(depuis: etat.position)

        // Lampe presque vide et borne à portée : on oriente vers la borne.
        if etat.piles <= 1 {
            let proche = etat.niveau.bornes.contains { borne in
                borne != etat.position && (pas[borne] ?? Int.max) <= etat.energie
            }
            if proche { return .borneProche }
        }

        let restantes = etat.niveau.enceintes.filter { !etat.trouvees.contains($0) }
        guard let cible = restantes.min(by: { (pas[$0] ?? Int.max) < (pas[$1] ?? Int.max) }) else {
            return nil
        }
        if cible.ecart(etat.position) <= Reglages.rayonLampe { return .toutPres }
        let dx = cible.x - etat.position.x
        let dy = cible.y - etat.position.y
        if abs(dx) >= abs(dy) {
            return dx > 0 ? .resonneDroite : .resonneGauche
        }
        return dy > 0 ? .resonneDevant : .resonneFond
    }
}
