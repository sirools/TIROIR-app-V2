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
            if lampeEteinte(evenements) { break }
        }
        return tous
    }

    private func lampeEteinte(_ evenements: [EtatJeu.Evenement]) -> Bool {
        evenements.contains { if case .lampeEteinte = $0 { return true } else { return false } }
    }

    func testLeNiveauEstCeluiDuPlanFigma() {
        XCTAssertEqual(niveau.labyrinthe.colonnes, 13)
        XCTAssertEqual(niveau.labyrinthe.lignes, 9)
        XCTAssertEqual(niveau.depart, Case(0, 0))
        XCTAssertEqual(Set(niveau.enceintes), [Case(8, 0), Case(0, 1), Case(12, 5), Case(8, 6), Case(0, 8)])
        XCTAssertEqual(Set(niveau.bornes), [Case(4, 0), Case(9, 4), Case(3, 5)])
        // Toutes les cases sont reliées à l'escalier.
        XCTAssertEqual(niveau.labyrinthe.distances(depuis: niveau.depart).count, 13 * 9)
    }

    func testLesPieces() {
        XCTAssertEqual(niveau.piece(de: Case(10, 0)), .chaufferie)
        XCTAssertEqual(niveau.piece(de: Case(6, 3)), .atelier)
        XCTAssertEqual(niveau.piece(de: Case(1, 6)), .caveAVin)
        XCTAssertEqual(niveau.piece(de: Case(11, 7)), .localServeur)
        XCTAssertNil(niveau.piece(de: niveau.depart))
    }

    func testOnNeTraversePasLesMurs() {
        var etat = EtatJeu(niveau: niveau)
        XCTAssertEqual(etat.deplacer(vers: Case(0, 1)), [])
        XCTAssertEqual(etat.deplacer(vers: Case(5, 5)), [])
        XCTAssertEqual(etat.position, niveau.depart)
        XCTAssertEqual(etat.deplacer(vers: Case(1, 0)), [.deplace(Case(1, 0))])
    }

    func testUnePileDureSixCases() {
        var etat = EtatJeu(niveau: niveau)
        XCTAssertEqual(etat.piles, 4)
        marche(&etat, vers: Case(3, 1))
        XCTAssertEqual(etat.energie, Reglages.autonomie - 6)
        XCTAssertEqual(etat.piles, 3)
    }

    func testSansBorneLaLampeEteinteRameneALEscalier() {
        var etat = EtatJeu(niveau: niveau)
        // 24 pas sans croiser de borne.
        let evenements = marche(&etat, vers: Case(0, 2))
        XCTAssertEqual(evenements.last, .lampeEteinte(retour: niveau.depart))
        XCTAssertEqual(etat.position, niveau.depart)
        XCTAssertEqual(etat.piles, 4)
    }

    func testLaLampeEteinteRameneALaDerniereBorne() {
        var etat = EtatJeu(niveau: niveau)
        let borne = Case(3, 5)
        for etape in [Case(4, 0), Case(9, 4), borne, Case(0, 1), Case(0, 8)] {
            XCTAssertFalse(lampeEteinte(marche(&etat, vers: etape)))
        }
        XCTAssertEqual(etat.energie, 2)
        XCTAssertEqual(etat.dernierRecharge, borne)
        let evenements = marche(&etat, vers: Case(12, 8))
        XCTAssertEqual(evenements.last, .lampeEteinte(retour: borne))
        XCTAssertEqual(etat.position, borne)
        XCTAssertEqual(etat.piles, 4)
    }

    func testUneBorneRecharge() {
        var etat = EtatJeu(niveau: niveau)
        let evenements = marche(&etat, vers: Case(4, 0))
        XCTAssertTrue(evenements.contains(.recharge))
        XCTAssertEqual(etat.energie, Reglages.autonomie)
        XCTAssertEqual(etat.dernierRecharge, Case(4, 0))
    }

    func testChaqueEnceinteEstAPorteeDUneBorne() {
        for enceinte in niveau.enceintes {
            let pas = niveau.labyrinthe.distances(depuis: enceinte)
            let plusProche = niveau.bornes.compactMap { pas[$0] }.min() ?? .max
            XCTAssertLessThanOrEqual(plusProche, Reglages.autonomie, "enceinte \(enceinte)")
        }
    }

    func testOnTrouveLesCinqEnceintes() {
        var etat = EtatJeu(niveau: niveau)
        // De borne en borne. La lampe s'éteint deux fois en route : le
        // Messager repart de la borne (3, 5), et la partie continue.
        let trajet: [Case] = [
            Case(4, 0), Case(9, 4), Case(8, 0), Case(9, 4), Case(3, 5),
            Case(0, 1), Case(0, 8), Case(3, 5), Case(8, 6), Case(12, 5), Case(12, 5),
        ]
        var tous: [EtatJeu.Evenement] = []
        for etape in trajet {
            tous += marche(&etat, vers: etape)
        }
        XCTAssertTrue(etat.termine)
        XCTAssertEqual(tous.last, .termine)
        XCTAssertEqual(etat.pasPossibles, [])
    }

    func testUneEnceinteDerriereUnMurNeSeTouchePas() {
        var etat = EtatJeu(niveau: niveau)
        let enceinte = Case(0, 1)
        // Dès l'escalier, la lampe l'éclaire à travers le mur : pas à portée.
        XCTAssertGreaterThan(etat.lumiere(enceinte), 0)
        XCTAssertEqual(etat.enceintesAPortee, [])
        XCTAssertEqual(etat.toucherEnceinte(enceinte), [])
        // Une fois dans la case voisine, on peut la toucher.
        for etape in [Case(4, 0), Case(9, 4), Case(3, 5), Case(0, 2)] {
            marche(&etat, vers: etape)
        }
        XCTAssertEqual(etat.enceintesAPortee, [enceinte])
        XCTAssertEqual(etat.toucherEnceinte(enceinte), [.enceinteTrouvee(enceinte, total: 1)])
        XCTAssertEqual(etat.toucherEnceinte(enceinte), [])
    }

    func testLesIndicesDeTorix() {
        var etat = EtatJeu(niveau: niveau)
        // Au départ, l'enceinte la plus proche par les couloirs est en (8, 0).
        XCTAssertEqual(Phrase.indice(pour: etat), .resonneDroite)
        for etape in [Case(4, 0), Case(9, 4), Case(3, 5), Case(0, 2)] {
            marche(&etat, vers: etape)
        }
        XCTAssertEqual(Phrase.indice(pour: etat), .toutPres)
        XCTAssertEqual(Phrase.trouvee(1), .trouvee1)
        XCTAssertNil(Phrase.trouvee(5))
    }
}
