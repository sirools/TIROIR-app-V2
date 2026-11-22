import RealityKit
import UIKit

/// Ce qu'on peut pincer dans la maquette : une case voisine ou une enceinte.
struct Cible: Component {
    enum Genre {
        case pas, enceinte
    }

    var genre: Genre
    var x: Int
    var y: Int

    var position: Case { Case(x, y) }
}

/// La maquette 3D du sous-sol : environ 60 × 40 cm, construite en code à
/// partir de la grille. Tout est en matériaux non éclairés : c'est le jeu,
/// et non la lumière de la pièce, qui décide de ce qui est visible.
@MainActor
final class SceneMaquette {
    /// À ajouter au volume. Le sol de la maquette est en bas du volume.
    let racine = Entity()
    /// Un émetteur de son par enceinte, toujours actif même quand
    /// l'enceinte est encore cachée dans le noir.
    private(set) var emetteurs: [Entity] = []

    private let niveau: Niveau

    // Dimensions, en mètres.
    private let cote: Float = 0.046
    private let epaisseurSol: Float = 0.004
    private let hauteurMur: Float = 0.034
    private let epaisseurMur: Float = 0.006
    private let niveauEau: Float = 0.016

    // Éclairage.
    private let noir: Float = 0.05
    private let souvenir: Float = 0.22
    private let secondesFondu: Float = 0.6

    private var sols: [ModelEntity] = []
    private var eaux: [ModelEntity] = []
    private var murs: [(entite: ModelEntity, cases: [Int], lumiere: Float)] = []
    private var bornes: [(entite: ModelEntity, indice: Int)] = []
    private var enceintes: [ModelEntity] = []
    private var halos: [ModelEntity] = []
    private var pas: [ModelEntity] = []
    private let messager = Entity()

    private var lumiere: [Float]
    private var lumiereCible: [Float]
    /// Cases déjà éclairées une fois : elles gardent une trace très sombre.
    private var vues: [Bool]
    private var trouvees: [Bool]
    private var elevation: [Float]

    private var positionAffichee: Case
    private var lampeAllumee = true
    private var toutEclaire = false
    private var retour: Case?
    private var opacite: Float = 1
    private var horloge: Float = 0

    private var materiaux: [String: UnlitMaterial] = [:]

    init(niveau: Niveau) {
        self.niveau = niveau
        let nombre = niveau.labyrinthe.colonnes * niveau.labyrinthe.lignes
        lumiere = Array(repeating: 0, count: nombre)
        lumiereCible = Array(repeating: 0, count: nombre)
        vues = Array(repeating: false, count: nombre)
        trouvees = Array(repeating: false, count: niveau.enceintes.count)
        elevation = Array(repeating: 0, count: niveau.enceintes.count)
        positionAffichee = niveau.depart
        Cible.registerComponent()
        racine.position = [0, -0.17, 0]
        construis()
        reinitialise()
    }

    // MARK: - Construction

    private func centre(_ c: Case, y: Float = 0) -> SIMD3<Float> {
        let colonnes = Float(niveau.labyrinthe.colonnes)
        let lignes = Float(niveau.labyrinthe.lignes)
        return [
            (Float(c.x) - (colonnes - 1) / 2) * cote,
            y,
            (Float(c.y) - (lignes - 1) / 2) * cote,
        ]
    }

    private func construis() {
        let labyrinthe = niveau.labyrinthe
        let dalle = MeshResource.generateBox(size: [cote, epaisseurSol, cote])
        let nappe = MeshResource.generateBox(size: [cote, 0.001, cote])

        for c in labyrinthe.cases {
            let sol = ModelEntity(mesh: dalle, materials: [materiau(Couleurs.sol, noir)])
            sol.position = centre(c, y: epaisseurSol / 2)
            racine.addChild(sol)
            sols.append(sol)

            let eau = ModelEntity(mesh: nappe, materials: [materiauEau(noir)])
            eau.position = centre(c, y: niveauEau)
            racine.addChild(eau)
            eaux.append(eau)
        }

        // Murs : un segment par bord fermé.
        let murHorizontal = MeshResource.generateBox(size: [cote + epaisseurMur, hauteurMur, epaisseurMur])
        let murVertical = MeshResource.generateBox(size: [epaisseurMur, hauteurMur, cote + epaisseurMur])
        func mur(_ maillage: MeshResource, _ position: SIMD3<Float>, _ cases: [Case]) {
            let entite = ModelEntity(mesh: maillage, materials: [materiau(Couleurs.mur, noir)])
            entite.position = position
            racine.addChild(entite)
            murs.append((entite, cases.filter(labyrinthe.contient).map(labyrinthe.indice), -1))
        }
        let y = epaisseurSol + hauteurMur / 2
        for c in labyrinthe.cases {
            let p = centre(c, y: y)
            if !labyrinthe.passage(c, .nord) {
                mur(murHorizontal, p + [0, 0, -cote / 2], [c, c.voisine(.nord)])
            }
            if !labyrinthe.passage(c, .ouest) {
                mur(murVertical, p + [-cote / 2, 0, 0], [c, c.voisine(.ouest)])
            }
            if c.y == labyrinthe.lignes - 1 {
                mur(murHorizontal, p + [0, 0, cote / 2], [c])
            }
            if c.x == labyrinthe.colonnes - 1 {
                mur(murVertical, p + [cote / 2, 0, 0], [c])
            }
        }

        // Escalier de départ : trois marches crème, toujours visibles.
        for marche in 0..<3 {
            let hauteur = Float(marche + 1) * 0.008
            let entite = ModelEntity(
                mesh: .generateBox(size: [cote * 0.7, hauteur, cote * 0.13]),
                materials: [materiau(Couleurs.mur, 1)]
            )
            entite.position = centre(niveau.depart, y: epaisseurSol + hauteur / 2)
                + [0, 0, -cote * (0.1 + 0.13 * Float(marche))]
            racine.addChild(entite)
        }

        // Bornes de recharge : des colonnes vertes.
        let colonne = MeshResource.generateBox(size: [0.014, 0.036, 0.014], cornerRadius: 0.004)
        for c in niveau.bornes {
            let entite = ModelEntity(mesh: colonne, materials: [materiau(Couleurs.borne, noir)])
            entite.position = centre(c, y: epaisseurSol + 0.018) + [cote * 0.25, 0, -cote * 0.25]
            entite.isEnabled = false
            racine.addChild(entite)
            bornes.append((entite, labyrinthe.indice(c)))
        }

        // Enceintes : des boîtes jaunes sous l'eau, avec un halo doux.
        let boite = MeshResource.generateBox(size: [0.024, 0.014, 0.020], cornerRadius: 0.003)
        let sphere = MeshResource.generateSphere(radius: 0.026)
        for c in niveau.enceintes {
            let entite = ModelEntity(mesh: boite, materials: [materiau(Couleurs.enceinte, 1)])
            entite.position = centre(c, y: hauteurEnceinte(0))
            entite.components.set(Cible(genre: .enceinte, x: c.x, y: c.y))
            entite.components.set(InputTargetComponent())
            entite.components.set(CollisionComponent(shapes: [.generateBox(size: [cote * 0.9, 0.05, cote * 0.9])]))
            entite.components.set(HoverEffectComponent())
            entite.isEnabled = false
            racine.addChild(entite)
            enceintes.append(entite)

            var voile = UnlitMaterial(color: Couleurs.ui(Couleurs.enceinte))
            voile.blending = .transparent(opacity: .init(floatLiteral: 0.3))
            let halo = ModelEntity(mesh: sphere, materials: [voile])
            halo.components.set(OpacityComponent(opacity: 0))
            entite.addChild(halo)
            halos.append(halo)

            let emetteur = Entity()
            emetteur.position = centre(c, y: niveauEau)
            racine.addChild(emetteur)
            emetteurs.append(emetteur)
        }

        // Le Messager : un petit personnage crème, sa lampe à la main.
        let corps = ModelEntity(
            mesh: .generateBox(size: [0.012, 0.020, 0.012], cornerRadius: 0.005),
            materials: [materiau(Couleurs.messager, 1)]
        )
        corps.position = [0, 0.010, 0]
        let tete = ModelEntity(mesh: .generateSphere(radius: 0.007), materials: [materiau(Couleurs.messager, 1)])
        tete.position = [0, 0.026, 0]
        let lampe = ModelEntity(mesh: .generateSphere(radius: 0.003), materials: [materiau(Couleurs.pas, 1)])
        lampe.position = [0.009, 0.014, 0]
        messager.addChild(corps)
        messager.addChild(tete)
        messager.addChild(lampe)
        racine.addChild(messager)

        // Les pas possibles : jusqu'à 4 pastilles bleu pâle à pincer.
        let pastille = MeshResource.generateBox(size: [cote * 0.55, 0.002, cote * 0.55], cornerRadius: 0.001)
        for _ in 0..<4 {
            let entite = ModelEntity(mesh: pastille, materials: [materiau(Couleurs.pas, 0.9)])
            entite.components.set(InputTargetComponent())
            entite.components.set(CollisionComponent(shapes: [.generateBox(size: [cote * 0.9, 0.05, cote * 0.9])]))
            entite.components.set(HoverEffectComponent())
            entite.isEnabled = false
            racine.addChild(entite)
            pas.append(entite)
        }
    }

    private func hauteurEnceinte(_ elevation: Float) -> Float {
        let immergee = epaisseurSol + 0.007
        let sortie = niveauEau + 0.016
        return immergee + (sortie - immergee) * elevation
    }

    // MARK: - Matériaux

    /// Les éclairages sont rangés en 25 paliers, pour réutiliser les matériaux.
    private func palier(_ lumiere: Float) -> Int {
        Int((max(0, min(1, lumiere)) * 24).rounded())
    }

    private func materiau(_ couleur: SIMD3<Float>, _ lumiere: Float) -> UnlitMaterial {
        let p = palier(lumiere)
        let cle = "\(couleur.x)-\(couleur.y)-\(couleur.z)-\(p)"
        if let existant = materiaux[cle] { return existant }
        let nouveau = UnlitMaterial(color: Couleurs.ui(couleur, lumiere: Float(p) / 24))
        materiaux[cle] = nouveau
        return nouveau
    }

    private func materiauEau(_ lumiere: Float) -> UnlitMaterial {
        let p = palier(lumiere)
        let cle = "eau-\(p)"
        if let existant = materiaux[cle] { return existant }
        var nouveau = UnlitMaterial(color: Couleurs.ui(Couleurs.eau, lumiere: Float(p) / 24))
        nouveau.blending = .transparent(opacity: .init(floatLiteral: 0.38))
        materiaux[cle] = nouveau
        return nouveau
    }

    // MARK: - Ce que le jeu demande

    /// Remet la maquette dans l'état du début de partie.
    func reinitialise() {
        positionAffichee = niveau.depart
        lampeAllumee = true
        toutEclaire = false
        retour = nil
        opacite = 1
        for i in vues.indices { vues[i] = false }
        for i in trouvees.indices {
            trouvees[i] = false
            elevation[i] = 0
        }
        messager.stopAllAnimations()
        messager.position = centre(niveau.depart, y: epaisseurSol)
        messager.components.set(OpacityComponent(opacity: 1))
        cachePas()
        calculeLumiere()
    }

    func deplaceMessager(vers c: Case) {
        positionAffichee = c
        messager.move(
            to: Transform(translation: centre(c, y: epaisseurSol)),
            relativeTo: racine,
            duration: 0.4,
            timingFunction: .easeInOut
        )
        calculeLumiere()
    }

    /// Lampe éteinte : le Messager s'efface doucement et réapparaît à `c`.
    func retourDoux(vers c: Case) {
        retour = c
        lampeAllumee = false
        calculeLumiere()
    }

    func trouve(enceinte c: Case) {
        if let i = niveau.enceintes.firstIndex(of: c) { trouvees[i] = true }
    }

    /// Fin de partie : tout le sous-sol s'éclaire lentement.
    func eclaireTout() {
        toutEclaire = true
        calculeLumiere()
    }

    func montrePas(_ cases: [Case]) {
        for (i, entite) in pas.enumerated() {
            if i < cases.count {
                let c = cases[i]
                entite.position = centre(c, y: niveauEau + 0.003)
                entite.components.set(Cible(genre: .pas, x: c.x, y: c.y))
                entite.isEnabled = true
            } else {
                entite.isEnabled = false
            }
        }
    }

    func cachePas() {
        for entite in pas { entite.isEnabled = false }
    }

    private func calculeLumiere() {
        let labyrinthe = niveau.labyrinthe
        for c in labyrinthe.cases {
            let i = labyrinthe.indice(c)
            var l: Float = 0
            if lampeAllumee {
                let ecart = c.ecart(positionAffichee)
                if ecart <= 1 {
                    l = 1
                } else if ecart <= Reglages.rayonLampe {
                    l = 0.75
                }
            }
            if l > 0 { vues[i] = true }
            if c == niveau.depart { l = 1 }
            if toutEclaire { l = 1 }
            lumiereCible[i] = max(l, vues[i] ? souvenir : noir)
        }
    }

    // MARK: - À chaque image

    func miseAJour(dt: Float) {
        horloge += dt
        let labyrinthe = niveau.labyrinthe

        // Fondu de l'éclairage : jamais de changement brusque.
        let pasLumiere = dt / (toutEclaire ? 3 : secondesFondu)
        for i in lumiere.indices {
            let ecart = lumiereCible[i] - lumiere[i]
            if abs(ecart) > 0.0005 {
                lumiere[i] += max(-pasLumiere, min(pasLumiere, ecart))
                sols[i].model?.materials = [materiau(Couleurs.sol, lumiere[i])]
                eaux[i].model?.materials = [materiauEau(lumiere[i])]
            }
        }
        for i in murs.indices {
            let l = murs[i].cases.map { lumiere[$0] }.max() ?? 0
            if abs(l - murs[i].lumiere) > 0.0005 {
                murs[i].lumiere = l
                murs[i].entite.model?.materials = [materiau(Couleurs.mur, l)]
            }
        }

        // Bornes : visibles dès qu'on les a éclairées une fois.
        for borne in bornes {
            let l = lumiere[borne.indice]
            borne.entite.isEnabled = l > 0.12
            borne.entite.model?.materials = [materiau(Couleurs.borne, max(l, 0.35))]
        }

        // Enceintes : visibles sous la lampe ; trouvées, elles sortent de
        // l'eau lentement et gardent un halo fixe (aucun clignotement).
        for i in enceintes.indices {
            let l = lumiere[labyrinthe.indice(niveau.enceintes[i])]
            enceintes[i].isEnabled = trouvees[i] || l > 0.5
            let cible: Float = trouvees[i] ? 1 : 0
            let ecart = cible - elevation[i]
            if abs(ecart) > 0.0005 {
                elevation[i] += max(-dt / 1.5, min(dt / 1.5, ecart))
                enceintes[i].position.y = hauteurEnceinte(elevation[i])
                halos[i].components.set(OpacityComponent(opacity: elevation[i]))
            }
        }

        // Ondulation lente de l'eau : une vague de 1 mm, toutes les 7 secondes.
        for c in labyrinthe.cases {
            let phase = horloge * (2 * .pi / 7) + Float(c.x + c.y) * 0.55
            eaux[labyrinthe.indice(c)].position.y = niveauEau + 0.001 * sin(phase)
        }

        // Retour doux à la borne : fondu, déplacement, fondu.
        let opaciteCible: Float = retour == nil ? 1 : 0
        let ecartOpacite = opaciteCible - opacite
        if abs(ecartOpacite) > 0.0005 {
            opacite += max(-dt / 0.8, min(dt / 0.8, ecartOpacite))
            messager.components.set(OpacityComponent(opacity: opacite))
        }
        if let c = retour, opacite <= 0.01 {
            messager.stopAllAnimations()
            messager.position = centre(c, y: epaisseurSol)
            positionAffichee = c
            lampeAllumee = true
            retour = nil
            calculeLumiere()
        }
    }
}
