import SwiftUI

/// Les règles, montrées avant de jouer : toujours les mêmes, en pictogrammes.
struct VueRegles: View {
    @Environment(ModeleJeu.self) private var modele
    @Environment(\.openWindow) private var ouvreFenetre
    @Environment(\.dismissWindow) private var fermeFenetre

    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            Text("Le sous-sol englouti")
                .font(.largeTitle)

            regle("figure.walk", .primary, "Voici le Messager. Il avance d'une case à la fois.")
            regle("hand.tap.fill", Couleurs.swiftUI(Couleurs.pas), "Regarde une case bleu clair à côté de lui, puis pince tes doigts.")
            regle("flashlight.on.fill", .primary, "Sa lampe éclaire juste autour de lui.")
            regle("hifispeaker.fill", Couleurs.swiftUI(Couleurs.enceinte), "Cherche les 5 enceintes jaunes. Écoute : leur musique te guide.")
            regle("battery.100", Couleurs.swiftUI(Couleurs.borne), "La lampe a 4 piles. Une borne verte les recharge.")
            regle("stairs", .primary, "Si la lampe s'éteint, le Messager retourne à la dernière borne. Ce n'est pas grave.")
            regle("pause.fill", .primary, "Le bouton Pause arrête tout, quand tu veux.")

            HStack {
                Spacer()
                Button {
                    if modele.maquetteOuverte {
                        modele.metsEnPause(false)
                    } else {
                        ouvreFenetre(id: Fenetres.maquette)
                    }
                    fermeFenetre(id: Fenetres.regles)
                } label: {
                    Text(modele.maquetteOuverte ? "Reprendre" : "Jouer")
                        .font(.title2)
                        .padding(.horizontal, 24)
                }
                Spacer()
            }
            .padding(.top, 8)
        }
        .padding(40)
    }

    private func regle(_ pictogramme: String, _ couleur: Color, _ texte: String) -> some View {
        HStack(spacing: 20) {
            Image(systemName: pictogramme)
                .font(.system(size: 40))
                .foregroundStyle(couleur)
                .frame(width: 64)
                .accessibilityHidden(true)
            Text(texte)
                .font(.title3)
        }
    }
}
