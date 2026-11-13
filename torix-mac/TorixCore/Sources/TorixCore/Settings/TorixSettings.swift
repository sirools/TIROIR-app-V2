import Foundation
import Observation

/// Réglages de Torix, gardés dans les préférences de l'utilisateur (UserDefaults).
@MainActor
@Observable
public final class TorixSettings {
    public static let shared = TorixSettings()

    private enum Keys {
        static let autoListen = "autoListen"
        static let speakReplies = "speakReplies"
        static let voiceIdentifier = "voiceIdentifier"
        static let speechRate = "speechRate"
        static let archivePath = "archivePath"
    }

    /// Démarrer l'écoute dès que Torix s'ouvre (barre flottante sur Mac, appli sur iPhone).
    public var autoListen: Bool { didSet { defaults.set(autoListen, forKey: Keys.autoListen) } }
    /// Lire les réponses à voix haute.
    public var speakReplies: Bool { didSet { defaults.set(speakReplies, forKey: Keys.speakReplies) } }
    /// Identifiant de la voix choisie ; vide = meilleure voix française disponible.
    public var voiceIdentifier: String { didSet { defaults.set(voiceIdentifier, forKey: Keys.voiceIdentifier) } }
    /// Vitesse de parole (échelle AVSpeechUtterance : 0 lent … 1 rapide, 0,5 normal).
    public var speechRate: Double { didSet { defaults.set(speechRate, forKey: Keys.speechRate) } }
    /// Dossier de l'archive (Mac seulement : sur iPhone, l'archive est dans Documents).
    public var archivePath: String { didSet { defaults.set(archivePath, forKey: Keys.archivePath) } }

    @ObservationIgnored private let defaults: UserDefaults

    public init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        autoListen = defaults.object(forKey: Keys.autoListen) as? Bool ?? true
        speakReplies = defaults.object(forKey: Keys.speakReplies) as? Bool ?? true
        voiceIdentifier = defaults.string(forKey: Keys.voiceIdentifier) ?? ""
        speechRate = defaults.object(forKey: Keys.speechRate) as? Double ?? 0.5
        archivePath = defaults.string(forKey: Keys.archivePath) ?? ArchiveStore.defaultPath
    }
}
