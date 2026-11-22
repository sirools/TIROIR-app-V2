/// L'état d'une partie et ses règles. Aucune notion d'échec : la lampe
/// éteinte ramène simplement le Messager au dernier point de recharge.
public struct EtatJeu: Sendable {
    public enum Evenement: Equatable, Sendable {
        case deplace(Case)
        case recharge
        case enceinteTrouvee(Case, total: Int)
        /// La lampe s'est éteinte : retour doux à cette case, piles pleines.
        case lampeEteinte(retour: Case)
        case termine
    }

    public let niveau: Niveau
    public private(set) var position: Case
    /// Cases que la lampe peut encore éclairer.
    public private(set) var energie: Int
    public private(set) var trouvees: Set<Case> = []
    /// Dernière borne visitée, ou l'escalier tant qu'aucune ne l'a été.
    public private(set) var dernierRecharge: Case

    public init(niveau: Niveau) {
        self.niveau = niveau
        position = niveau.depart
        dernierRecharge = niveau.depart
        energie = Reglages.autonomie
    }

    /// Piles encore allumées sur la jauge (0 à 4).
    public var piles: Int {
        (energie + Reglages.casesParPile - 1) / Reglages.casesParPile
    }

    public var termine: Bool {
        trouvees.count == niveau.enceintes.count
    }

    /// Les cases où le Messager peut aller en un pincement.
    public var pasPossibles: [Case] {
        termine ? [] : niveau.labyrinthe.voisinesAccessibles(position)
    }

    /// Éclairage d'une case par la lampe, de 0 (noir) à 1.
    public func lumiere(_ c: Case) -> Double {
        let ecart = c.ecart(position)
        if ecart > Reglages.rayonLampe { return 0 }
        return ecart <= 1 ? 1 : 0.75
    }

    /// Avance d'une case. Sans effet si la case n'est pas voisine et accessible.
    public mutating func deplacer(vers c: Case) -> [Evenement] {
        guard pasPossibles.contains(c) else { return [] }
        position = c
        energie -= 1
        var evenements: [Evenement] = [.deplace(c)]
        if niveau.bornes.contains(c) {
            energie = Reglages.autonomie
            dernierRecharge = c
            evenements.append(.recharge)
        }
        evenements += trouver(c)
        if energie <= 0, !termine {
            position = dernierRecharge
            energie = Reglages.autonomie
            evenements.append(.lampeEteinte(retour: dernierRecharge))
        }
        return evenements
    }

    /// Touche une enceinte : elle compte si la lampe l'éclaire.
    public mutating func toucherEnceinte(_ c: Case) -> [Evenement] {
        guard lumiere(c) > 0 else { return [] }
        return trouver(c)
    }

    private mutating func trouver(_ c: Case) -> [Evenement] {
        guard niveau.enceintes.contains(c), !trouvees.contains(c) else { return [] }
        trouvees.insert(c)
        var evenements: [Evenement] = [.enceinteTrouvee(c, total: trouvees.count)]
        if termine { evenements.append(.termine) }
        return evenements
    }
}
