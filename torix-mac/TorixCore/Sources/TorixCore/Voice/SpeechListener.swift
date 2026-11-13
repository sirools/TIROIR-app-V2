import Foundation
import Observation

/// L'oreille de Torix : écoute, transcrit en direct, et s'arrête d'elle-même après un silence.
@MainActor
@Observable
public final class SpeechListener {
    public private(set) var isListening = false
    /// Problème à afficher (autorisation refusée, dictée française absente…).
    public var problem: String?

    /// Transcription en cours, à chaque mot reconnu.
    @ObservationIgnored public var onTranscript: ((String) -> Void)?
    /// Phrase terminée, à envoyer à Torix.
    @ObservationIgnored public var onFinished: ((String) -> Void)?
    /// L'écoute vient de s'arrêter (après `onFinished` s'il y avait quelque chose à envoyer).
    @ObservationIgnored public var onStopped: (() -> Void)?

    @ObservationIgnored private let capture = SpeechCapture()
    @ObservationIgnored private var transcript = ""
    @ObservationIgnored private var silenceTask: Task<Void, Never>?
    /// Numéro de la séance d'écoute : les rappels d'une séance précédente sont ignorés.
    @ObservationIgnored private var generation = 0

    /// Silence après lequel la phrase est considérée comme finie.
    private let endOfSpeechDelay: Duration = .seconds(1.6)
    /// Silence toléré avant le premier mot.
    private let noSpeechDelay: Duration = .seconds(12)

    public func start() {
        guard !isListening else { return }
        problem = nil
        transcript = ""
        isListening = true
        generation += 1
        let gen = generation
        Task {
            let refusal = await SpeechCapture.requestPermissions()
            guard gen == self.generation, self.isListening else { return }
            if let refusal {
                self.fail(refusal)
                return
            }
            do {
                try self.capture.start(
                    onResult: { [weak self] text, isFinal in
                        Task { @MainActor in self?.handle(text: text, isFinal: isFinal, gen: gen) }
                    },
                    onError: { [weak self] message in
                        Task { @MainActor in self?.handleError(message, gen: gen) }
                    }
                )
                self.armSilenceTimer(self.noSpeechDelay, gen: gen)
            } catch {
                self.fail(error.localizedDescription)
            }
        }
    }

    /// Arrête l'écoute. `send` : envoyer ce qui a été entendu.
    public func stop(send: Bool) {
        guard isListening else { return }
        generation += 1
        silenceTask?.cancel()
        silenceTask = nil
        capture.stop()
        isListening = false
        let heard = transcript.trimmingCharacters(in: .whitespacesAndNewlines)
        transcript = ""
        if send, !heard.isEmpty {
            onFinished?(heard)
        }
        onStopped?()
    }

    private func handle(text: String, isFinal: Bool, gen: Int) {
        guard gen == generation, isListening else { return }
        transcript = text
        onTranscript?(text)
        if isFinal {
            stop(send: true)
        } else {
            armSilenceTimer(endOfSpeechDelay, gen: gen)
        }
    }

    private func handleError(_ message: String, gen: Int) {
        guard gen == generation, isListening else { return }
        // Une erreur après quelques mots (fin de flux) : on envoie ce qu'on a entendu.
        if transcript.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            stop(send: false)
        } else {
            stop(send: true)
        }
    }

    private func armSilenceTimer(_ delay: Duration, gen: Int) {
        silenceTask?.cancel()
        silenceTask = Task { [weak self] in
            try? await Task.sleep(for: delay)
            guard !Task.isCancelled, let self, gen == self.generation else { return }
            self.stop(send: true)
        }
    }

    private func fail(_ message: String) {
        generation += 1
        silenceTask?.cancel()
        capture.stop()
        isListening = false
        problem = message
        onStopped?()
    }
}
