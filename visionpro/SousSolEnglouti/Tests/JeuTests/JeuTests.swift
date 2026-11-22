import XCTest
@testable import Jeu

final class JeuTests: XCTestCase {
    private let niveau = Niveau.niveau1

    /// Avance le long du plus court chemin jusqu'à `cible`.
    @discardableResult
    private func marche(_ etat: inout EtatJeu, vers cible: Case) -> [EtatJeu.Evenement] {
        var tous: [EtatJeu.Evenement] = []
        let pas = niveau.labyrinthe.distances(depuis: cible)
        while etat.position != cible {
            guard let suivante = etat.pasPossibles.min(by: { (pas[$0] ?? .max) < (pas[$1] ?? .max) }) else { break }
            let evenements = etat.deplacer(vers: suivante)
            tous += evenements
            if evenements.contains(where: { if case .lampeEteinte = $0 { return true } else { return false } }) { break }
        }
        return tous
    }

    func testLePlanFigeEstCeluiDeLaGraine() {
        let genere = Labyrinthe.genere(colonnes: Reglages.colonnes, lignes: Reglages.lignes, graine: Reglages.graine)
        XCTAssertEqual(genere, niveau.labyrinthe)
    }

    func testLeNiveauACinqEnceintesEtTroisBornes() {
        XCTAssertEqual(niveau.labyrinthe.colonnes, 13)
        XCTAssertEqual(niveau.labyrinthe.lignes, 9)
        XCTAssertEqual(niveau.enceintes.count, 5)
        XCTAssertEqual(niveau.bornes.count, 3)
        XCTAssertEqual(niveau.depart, Case(0, 0))
        XCTAssertEqual(niveau.labyrinthe.distances(depuis: niveau.depart).count, 13 * 9)
    }

    func testOnNeTraversePasLesMurs() {
        var etat = EtatJeu(niveau: niveau)
        XCTAssertEqual(etat.deplacer(vers: Case(1, 0)), [])
        XCTAssertEqual(etat.deplacer(vers: Case(5, 5)), [])
        XCTAssertEqual(etat.position, niveau.depart)
        XCTAssertEqual(etat.deplacer(vers: Case(0, 1)), [.deplace(Case(0, 1))])
    }

    func testUnePileDureSixCases() {
        var etat = EtatJeu(niveau: niveau)
        XCTAssertEqual(etat.piles, 4)
        marche(&etat, vers: Case(3, 1))
        XCTAssertEqual(etat.energie, Reglages.autonomie - 6)
        XCTAssertEqual(etat.piles, 3)
    }

    func testLaLampeEteinteRameneSansEchec() {
        var etat = EtatJeu(niveau: niveau)
        let borne = Case(1, 7)
        // Borne, puis 8 + 12 pas sans recharge : il reste 4 cases de lampe.
        marche(&etat, vers: borne)
        marche(&etat, vers: Case(0, 2))
        marche(&etat, vers: niveau.depart)
        XCTAssertEqual(etat.energie, 4)
        let evenements = marche(&etat, vers: Case(0, 2))
        XCTAssertEqual(evenements.last, .lampeEteinte(retour: borne))
        XCTAssertEqual(etat.position, borne)
        XCTAssertEqual(etat.piles, 4)
    }

    func testUneBorneRechargeEtDevientLePointDeRetour() {
        var etat = EtatJeu(niveau: niveau)
        let borne = Case(1, 7)
        let evenements = marche(&etat, vers: borne)
        XCTAssertTrue(evenements.contains(.recharge))
        XCTAssertEqual(etat.energie, Reglages.autonomie)
        XCTAssertEqual(etat.dernierRecharge, borne)
    }

    func testChaqueEnceinteEstAUnAllerRetourDUneBorne() {
        for enceinte in niveau.enceintes {
            let pas = niveau.labyrinthe.distances(depuis: enceinte)
            let plusProche = niveau.bornes.compactMap { pas[$0] }.min() ?? .max
            XCTAssertLessThanOrEqual(plusProche * 2, Reglages.autonomie, "enceinte \(enceinte)")
        }
    }

    func testOnTrouveLesCinqEnceintes() {
        var etat = EtatJeu(niveau: niveau)
        // De borne en borne, avec un aller-retour vers chaque enceinte.
        let trajet: [Case] = [
            Case(0, 2), Case(1, 7), Case(6, 0), Case(4, 0), Case(6, 0),
            Case(5, 6), Case(5, 2), Case(5, 6), Case(0, 8), Case(5, 6), Case(7, 5),
        ]
        var tous: [EtatJeu.Evenement] = []
        for etape in trajet {
            tous += marche(&etat, vers: etape)
            XCTAssertEqual(etat.position, etape)
        }
        XCTAssertTrue(etat.termine)
        XCTAssertEqual(tous.last, .termine)
        XCTAssertFalse(tous.contains { if case .lampeEteinte = $0 { return true } else { return false } })
        XCTAssertEqual(etat.pasPossibles, [])
    }

    func testToucherUneEnceinteDemandeDeLEclairer() {
        var etat = EtatJeu(niveau: niveau)
        XCTAssertEqual(etat.toucherEnceinte(Case(0, 2)), [])
        marche(&etat, vers: Case(0, 3))
        XCTAssertEqual(etat.toucherEnceinte(Case(0, 2)), [.enceinteTrouvee(Case(0, 2), total: 1)])
        XCTAssertEqual(etat.toucherEnceinte(Case(0, 2)), [])
    }

    func testLesIndicesDeTorix() {
        var etat = EtatJeu(niveau: niveau)
        // Au départ, l'enceinte la plus proche est en (0, 2) : de ton côté.
        XCTAssertEqual(Phrase.indice(pour: etat), .resonneDevant)
        marche(&etat, vers: Case(0, 3))
        XCTAssertEqual(Phrase.indice(pour: etat), .toutPres)
        XCTAssertEqual(Phrase.trouvee(1), .trouvee1)
        XCTAssertNil(Phrase.trouvee(5))
    }
}
