import RealityKit
import SwiftUI

/// Le volume : la maquette, les pincements et le bandeau de commandes.
///
/// Le regard n'est pas accessible aux apps : visionOS met seulement en
/// évidence ce que l'enfant regarde (`HoverEffectComponent`), puis nous
/// transmet le pincement. C'est suffisant ici, sans suivi des mains.
struct VueMaquette: View {
    @Environment(ModeleJeu.self) private var modele
    @Environment(\.scenePhase) private var phase
    @State private var abonnement: EventSubscription?

    var body: some View {
        RealityView { contenu in
            contenu.add(modele.scene.racine)
            abonnement = contenu.subscribe(to: SceneEvents.Update.self) { evenement in
                let secondes = evenement.deltaTime
                MainActor.assumeIsolated {
                    modele.tic(secondes)
                }
            }
        }
        .gesture(
            SpatialTapGesture()
                .targetedToAnyEntity()
                .onEnded { valeur in
                    modele.touche(valeur.entity)
                }
        )
        .ornament(attachmentAnchor: .scene(.bottomFront)) {
            VueCommandes()
                .environment(modele)
        }
        .onAppear { modele.maquetteApparait() }
        .onDisappear { modele.maquetteDisparait() }
        .onChange(of: phase) { _, nouvelle in
            if nouvelle != .active { modele.metsEnPause(true) }
        }
    }
}
