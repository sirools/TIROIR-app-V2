import Foundation
import Observation
import KeyboardShortcuts

extension KeyboardShortcuts.Name {
    /// Ouvre ou ferme la barre flottante. Par défaut : Option + Espace.
    static let toggleTorix = Self("toggleTorix", default: .init(.space, modifiers: [.option]))
}

/// Réglages de Torix, gardés dans les préférences de l'utilisateur (UserDefaults).
@MainActor
@Observable
final class TorixSettings {
    static let shared = TorixSettings()

    private enum Keys {
        static let autoListen = "autoListen"
        static let speakReplies = "speakReplies"
        static let voiceIdentifier = "voiceIdentifier"
        static let speechRate = "speechRate"
        static let archivePath = "archivePath"
    }

    /// Démarrer l'écoute dès que la barre s'ouvre.
    var autoListen: Bool { didSet { defaults.set(autoListen, forKey: Keys.autoListen) } }
    /// Lire les réponses à voix haute.
    var speakReplies: Bool { didSet { defaults.set(speakReplies, forKey: Keys.speakReplies) } }
    /// Identifiant de la voix choisie ; vide = meilleure voix française disponible.
    var voiceIdentifier: String { didSet { defaults.set(voiceIdentifier, forKey: Keys.voiceIdentifier) } }
    /// Vitesse de parole (échelle AVSpeechUtterance : 0 lent … 1 rapide, 0,5 normal).
    var speechRate: Double { didSet { defaults.set(speechRate, forKey: Keys.speechRate) } }
    /// Dossier de l'archive.
    var archivePath: String { didSet { defaults.set(archivePath, forKey: Keys.archivePath) } }

    @ObservationIgnored private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        autoListen = defaults.object(forKey: Keys.autoListen) as? Bool ?? true
        speakReplies = defaults.object(forKey: Keys.speakReplies) as? Bool ?? true
        voiceIdentifier = defaults.string(forKey: Keys.voiceIdentifier) ?? ""
        speechRate = defaults.object(forKey: Keys.speechRate) as? Double ?? 0.5
        archivePath = defaults.string(forKey: Keys.archivePath) ?? ArchiveStore.defaultPath
    }
}
