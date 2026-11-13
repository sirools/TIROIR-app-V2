import Foundation

/// Le moteur est-il utilisable ? Sinon, pourquoi — en clair, pour l'afficher tel quel.
enum BrainAvailability: Equatable {
    case available
    case unavailable(String)
}

/// Ce qu'un moteur émet pendant qu'il répond.
enum BrainEvent {
    /// Texte complet de la réponse jusqu'ici (cumulatif, pas un fragment).
    case text(String)
    /// Éléments d'archive trouvés par `searchArchive`.
    case found([ArchiveItem])
    /// Élément que Torix demande d'afficher ou de jouer (`openItem`).
    case opened(ArchiveItem)
}

enum BrainError: LocalizedError {
    case notImplemented(String)
    case unavailable(String)

    var errorDescription: String? {
        switch self {
        case .notImplemented(let name): return "Le moteur « \(name) » n'est pas encore branché."
        case .unavailable(let reason): return reason
        }
    }
}

/// Un « cerveau » de Torix : tout moteur capable de répondre en flux et d'appeler les outils d'archive.
/// Aujourd'hui `AppleFoundationBrain` ; `OllamaBrain` est l'emplacement du second moteur.
@MainActor
protocol TorixBrain: AnyObject {
    /// Nom lisible du moteur (affiché dans les réglages).
    var name: String { get }
    var availability: BrainAvailability { get }
    /// Répond à un message de la conversation en cours. Le flux se termine avec la réponse.
    func respond(to prompt: String) -> AsyncThrowingStream<BrainEvent, Error>
    /// Oublie la conversation (nouvelle session).
    func reset()
    /// Prépare le modèle pour que la première réponse soit rapide. Facultatif.
    func prewarm()
}

extension TorixBrain {
    func prewarm() {}
}
