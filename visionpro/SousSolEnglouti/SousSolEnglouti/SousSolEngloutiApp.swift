import SwiftUI

/// Deux scènes : la fenêtre des règles (montrée d'abord), puis la maquette
/// en volume, à poser sur une table. Pas de mode immersif.
@main
struct SousSolEngloutiApp: App {
    @State private var modele = ModeleJeu()

    var body: some Scene {
        WindowGroup(id: Fenetres.regles) {
            VueRegles()
                .environment(modele)
        }
        .defaultSize(width: 640, height: 760)

        WindowGroup(id: Fenetres.maquette) {
            VueMaquette()
                .environment(modele)
        }
        .windowStyle(.volumetric)
        .defaultSize(width: 0.80, height: 0.40, depth: 0.60, in: .meters)
    }
}

enum Fenetres {
    static let regles = "regles"
    static let maquette = "maquette"
}
