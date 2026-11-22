import SwiftUI

/// Le bandeau sous la maquette : compteur, piles, pause (toujours visible),
/// voix de Torix, volume, et la phrase de Torix en toutes lettres.
struct VueCommandes: View {
    @Environment(ModeleJeu.self) private var modele
    @Environment(\.openWindow) private var ouvreFenetre

    var body: some View {
        @Bindable var modele = modele
        let etat = modele.etat

        VStack(spacing: 14) {
            if etat.termine {
                Text("Bravo, tu as retrouvé les 5 enceintes")
                    .font(.title)
                Button("Rejouer") { modele.rejoue() }
            } else {
                HStack(spacing: 28) {
                    Label("\(etat.trouvees.count) / \(etat.niveau.enceintes.count)", systemImage: "hifispeaker.fill")
                        .font(.title)
                        .foregroundStyle(Couleurs.swiftUI(Couleurs.enceinte))
                        .accessibilityLabel("\(etat.trouvees.count) enceintes trouvées sur \(etat.niveau.enceintes.count)")

                    HStack(spacing: 6) {
                        ForEach(0..<Reglages.piles, id: \.self) { i in
                            Image(systemName: i < etat.piles ? "battery.100" : "battery.0")
                                .font(.title2)
                                .foregroundStyle(i < etat.piles ? Couleurs.swiftUI(Couleurs.borne) : .secondary)
                        }
                    }
                    .accessibilityElement()
                    .accessibilityLabel("\(etat.piles) piles sur \(Reglages.piles)")

                    Text("Tu es dans \(modele.piece.nom)")
                        .foregroundStyle(.secondary)
                }
            }

            Text(modele.enPause ? "Pause" : modele.phrase)
                .font(.title3)
                .multilineTextAlignment(.center)
                .frame(minHeight: 56)

            HStack(spacing: 20) {
                Button {
                    modele.metsEnPause(!modele.enPause)
                } label: {
                    Label(modele.enPause ? "Reprendre" : "Pause", systemImage: modele.enPause ? "play.fill" : "pause.fill")
                }

                Button {
                    modele.activeVoix(!modele.voixActive)
                } label: {
                    Label(
                        modele.voixActive ? "Couper la voix de Torix" : "Remettre la voix de Torix",
                        systemImage: modele.voixActive ? "speaker.wave.2.fill" : "speaker.slash.fill"
                    )
                }

                HStack {
                    Image(systemName: "speaker.fill")
                    Slider(value: $modele.volume, in: 0...1)
                        .frame(width: 160)
                        .accessibilityLabel("Volume")
                    Image(systemName: "speaker.wave.3.fill")
                }

                Button {
                    modele.metsEnPause(true)
                    ouvreFenetre(id: Fenetres.regles)
                } label: {
                    Label("Règles", systemImage: "questionmark.circle")
                }
            }
        }
        .padding(24)
        .frame(width: 860)
        .glassBackgroundEffect()
    }
}
