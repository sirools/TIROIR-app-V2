import Foundation
import FoundationModels

/// Moteur par défaut : le modèle d'Apple, sur l'appareil (framework Foundation Models).
/// Rien ne quitte le Mac.
@MainActor
final class AppleFoundationBrain: TorixBrain {
    let name = "Apple Intelligence (sur ce Mac)"

    private let archive: ArchiveStore
    private let toolbox: ArchiveToolbox
    private var session: LanguageModelSession?

    init(archive: ArchiveStore) {
        self.archive = archive
        self.toolbox = ArchiveToolbox(archive: archive)
    }

    var availability: BrainAvailability {
        switch SystemLanguageModel.default.availability {
        case .available:
            return .available
        case .unavailable(let reason):
            switch reason {
            case .deviceNotEligible:
                return .unavailable("Ce Mac ne peut pas faire tourner Apple Intelligence : Torix n'a pas de modèle pour répondre.")
            case .appleIntelligenceNotEnabled:
                return .unavailable("Apple Intelligence n'est pas activée. Ouvre Réglages Système › Apple Intelligence et Siri, active-la, puis reviens : Torix pourra répondre.")
            case .modelNotReady:
                return .unavailable("Le modèle d'Apple Intelligence est encore en cours de téléchargement ou de préparation. Réessaie dans quelques minutes.")
            @unknown default:
                return .unavailable("Le modèle d'Apple Intelligence n'est pas disponible pour l'instant.")
            }
        }
    }

    func prewarm() {
        guard availability == .available else { return }
        currentSession().prewarm()
    }

    func reset() {
        session = nil
    }

    func respond(to prompt: String) -> AsyncThrowingStream<BrainEvent, Error> {
        AsyncThrowingStream { continuation in
            let task = Task { @MainActor in
                if case .unavailable(let reason) = self.availability {
                    continuation.finish(throwing: BrainError.unavailable(reason))
                    return
                }
                self.toolbox.onEvent = { continuation.yield($0) }
                defer { self.toolbox.onEvent = nil }
                do {
                    try await self.stream(prompt, into: continuation)
                    continuation.finish()
                } catch let error as LanguageModelSession.GenerationError {
                    // La fenêtre de contexte du modèle est petite : quand elle déborde,
                    // on repart d'une session neuve et on repose la question une fois.
                    if case .exceededContextWindowSize = error {
                        self.session = nil
                        do {
                            try await self.stream(prompt, into: continuation)
                            continuation.finish()
                        } catch {
                            continuation.finish(throwing: error)
                        }
                    } else {
                        continuation.finish(throwing: error)
                    }
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    private func stream(_ prompt: String, into continuation: AsyncThrowingStream<BrainEvent, Error>.Continuation) async throws {
        let stream = currentSession().streamResponse(to: prompt)
        for try await snapshot in stream {
            try Task.checkCancellation()
            continuation.yield(.text(snapshot.content))
        }
    }

    private func currentSession() -> LanguageModelSession {
        if let session { return session }
        let fresh = LanguageModelSession(
            tools: [SearchArchiveTool(toolbox: toolbox), OpenItemTool(toolbox: toolbox)],
            instructions: TorixPersonality.instructions(archiveSummary: archive.summaryForModel)
        )
        session = fresh
        return fresh
    }
}
