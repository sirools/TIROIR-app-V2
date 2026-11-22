import RealityKit

/// Le son spatial des enceintes : une boucle par enceinte, placée dans la
/// maquette. Le volume ne change jamais d'un coup : il glisse vers sa cible.
@MainActor
final class SonEnceintes {
    static let silence = -80.0
    private let decibelsParSeconde = 24.0

    private var lecteurs: [AudioPlaybackController?] = []
    private var gains: [Double] = []

    /// Charge les boucles `enceinte_1.wav` … et les lance, en silence.
    func installe(sur emetteurs: [Entity]) {
        guard lecteurs.isEmpty else { return }
        for (i, emetteur) in emetteurs.enumerated() {
            gains.append(Self.silence)
            guard let boucle = try? AudioFileResource.load(
                named: "enceinte_\(i + 1).wav",
                configuration: .init(shouldLoop: true)
            ) else {
                lecteurs.append(nil)
                continue
            }
            emetteur.components.set(SpatialAudioComponent())
            let lecteur = emetteur.prepareAudio(boucle)
            lecteur.gain = Self.silence
            lecteur.play()
            lecteurs.append(lecteur)
        }
    }

    /// Rapproche chaque volume de sa cible (en décibels).
    func regle(cibles: [Double], dt: Double) {
        let pas = decibelsParSeconde * dt
        for i in lecteurs.indices where i < cibles.count {
            let ecart = cibles[i] - gains[i]
            guard abs(ecart) > 0.05 else { continue }
            gains[i] += max(-pas, min(pas, ecart))
            lecteurs[i]?.gain = gains[i]
        }
    }
}
