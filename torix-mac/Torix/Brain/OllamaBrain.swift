import Foundation

/// Emplacement du second moteur : un modèle servi par Ollama sur ce Mac (http://localhost:11434).
/// Volontairement non implémenté dans ce prototype.
///
/// TODO: brancher l'API locale d'Ollama (`/api/chat`, réponses en flux, appels d'outils)
/// en réutilisant `ArchiveToolbox` pour `searchArchive` et `openItem`. Rester en local :
/// aucune requête ne doit sortir de la machine.
@MainActor
final class OllamaBrain: TorixBrain {
    let name = "Ollama (non branché)"

    var availability: BrainAvailability {
        .unavailable("Le moteur Ollama n'est pas encore branché dans ce prototype.")
    }

    func respond(to prompt: String) -> AsyncThrowingStream<BrainEvent, Error> {
        AsyncThrowingStream { continuation in
            continuation.finish(throwing: BrainError.notImplemented(name))
        }
    }

    func reset() {}
}
