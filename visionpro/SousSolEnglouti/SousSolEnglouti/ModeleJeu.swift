import Foundation
import Observation
import RealityKit

/// Le chef d'orchestre : il applique les règles (`EtatJeu`), puis fait
/// suivre la maquette, le son et la voix de Torix.
@MainActor
@Observable
final class ModeleJeu {
    private(set) var etat = EtatJeu(niveau: .niveau1)
    private(set) var enPause = false
    private(set) var voixActive = true
    private(set) var maquetteOuverte = false
    /// Dernière phrase de Torix, affichée aussi en toutes lettres.
    private(set) var phrase = ""
    /// Réglage du volume général, de 0 à 1. Le maximum reste modéré.
    var volume = 0.7

    @ObservationIgnored let scene = SceneMaquette(niveau: .niveau1)
    @ObservationIgnored private let sons = SonEnceintes()
    @ObservationIgnored private let voix = VoixTorix()
    @ObservationIgnored private var commencee = false
    /// Temps restant avant de pouvoir pincer à nouveau (animation en cours).
    @ObservationIgnored private var blocage = 0.0
    @ObservationIgnored private var inactivite = 0.0
    /// Depuis combien de temps chaque enceinte a été trouvée (nil : cachée).
    @ObservationIgnored private var depuisTrouvee: [Double?] = Array(repeating: nil, count: 5)

    var piece: Piece { etat.niveau.piece(de: etat.position) }

    // MARK: - Cycle de vie

    func maquetteApparait() {
        maquetteOuverte = true
        sons.installe(sur: scene.emetteurs)
        if !commencee {
            commencee = true
            scene.montrePas(etat.pasPossibles)
            dis(.depart)
        }
    }

    func maquetteDisparait() {
        maquetteOuverte = false
        metsEnPause(true)
    }

    func rejoue() {
        etat = EtatJeu(niveau: .niveau1)
        depuisTrouvee = Array(repeating: nil, count: etat.niveau.enceintes.count)
        blocage = 0
        inactivite = 0
        enPause = false
        scene.reinitialise()
        scene.montrePas(etat.pasPossibles)
        dis(.depart)
    }

    // MARK: - Commandes

    func metsEnPause(_ pause: Bool) {
        guard pause != enPause else { return }
        enPause = pause
        if pause { voix.pause() } else { voix.reprends() }
    }

    func activeVoix(_ active: Bool) {
        voixActive = active
        if !active { voix.tais() }
    }

    // MARK: - Pincement

    func touche(_ entite: Entity) {
        guard !enPause, blocage <= 0, !etat.termine else { return }
        var courante: Entity? = entite
        while let e = courante {
            if let cible = e.components[Cible.self] {
                switch cible.genre {
                case .pas: applique(etat.deplacer(vers: cible.position))
                case .enceinte: applique(etat.toucherEnceinte(cible.position))
                }
                return
            }
            courante = e.parent
        }
    }

    private func applique(_ evenements: [EtatJeu.Evenement]) {
        guard !evenements.isEmpty else { return }
        inactivite = 0
        for evenement in evenements {
            switch evenement {
            case .deplace(let c):
                scene.cachePas()
                scene.deplaceMessager(vers: c)
                blocage = max(blocage, 0.45)
            case .recharge:
                break
            case .enceinteTrouvee(let c, let total):
                scene.trouve(enceinte: c)
                if let i = etat.niveau.enceintes.firstIndex(of: c) { depuisTrouvee[i] = 0 }
                if let phrase = Phrase.trouvee(total) { dis(phrase) }
            case .lampeEteinte(let retour):
                scene.cachePas()
                scene.retourDoux(vers: retour)
                blocage = max(blocage, 2.0)
            case .termine:
                scene.cachePas()
                scene.eclaireTout()
                dis(.fin)
            }
        }
    }

    private func dis(_ phrase: Phrase) {
        self.phrase = phrase.texte
        guard voixActive else { return }
        voix.dis(phrase, volume: volume <= 0.01 ? 0 : Float(0.15 + 0.65 * volume))
    }

    // MARK: - À chaque image

    func tic(_ secondes: Double) {
        let dt = min(secondes, 0.1)
        sons.regle(cibles: gainsCibles(), dt: dt)
        // En pause, tout est figé : seul le son continue de baisser doucement.
        guard !enPause else { return }

        scene.miseAJour(dt: Float(dt))
        for i in depuisTrouvee.indices {
            if let t = depuisTrouvee[i] { depuisTrouvee[i] = t + dt }
        }
        if blocage > 0 {
            blocage -= dt
            if blocage <= 0 { scene.montrePas(etat.pasPossibles) }
        }
        guard !etat.termine else { return }
        inactivite += dt
        if inactivite >= Reglages.secondesAvantIndice {
            inactivite = 0
            if let indice = Phrase.indice(pour: etat) { dis(indice) }
        }
    }

    /// Volume voulu pour chaque enceinte, en décibels : plus fort quand le
    /// Messager s'approche, toujours modéré, plus bas en pause.
    private func gainsCibles() -> [Double] {
        let general = volume <= 0.01 ? SonEnceintes.silence : 30 * (volume - 1)
        let pause = enPause ? -20.0 : 0.0
        return etat.niveau.enceintes.enumerated().map { i, c in
            var gain: Double
            if etat.termine {
                // À la fin, les cinq mélodies jouent ensemble, tout bas.
                gain = -20
            } else if let t = depuisTrouvee[i] {
                // Trouvée : sa mélodie s'entend bien une fois, puis se tait.
                gain = t < 4.8 ? -12 : SonEnceintes.silence
            } else {
                let ecart = c.ecart(etat.position)
                gain = ecart > 9 ? SonEnceintes.silence : -10 - 3.5 * ecart
            }
            gain += general + pause
            return max(SonEnceintes.silence, gain)
        }
    }
}
