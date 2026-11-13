import AVFoundation
import Speech

/// Micro + reconnaissance vocale, sur l'appareil uniquement, en français.
///
/// Classe volontairement hors de l'acteur principal : le micro et Speech rappellent sur leurs propres
/// fils d'exécution. Les résultats repartent vers l'interface par les fermetures `onResult` / `onError`.
public final class SpeechCapture: @unchecked Sendable {
    enum CaptureError: LocalizedError {
        case recognizerUnavailable
        case onDeviceUnsupported
        case noMicrophone

        var errorDescription: String? {
            switch self {
            case .recognizerUnavailable:
                return "La reconnaissance vocale en français n'est pas disponible \(Platform.onThisDevice) pour l'instant."
            case .onDeviceUnsupported:
                return "La reconnaissance vocale sur l'appareil n'est pas disponible en français. Vérifie dans \(Platform.systemSettings) › Clavier › Dictée que le français est installé. Torix n'envoie jamais ta voix sur Internet."
            case .noMicrophone:
                return "Aucun micro n'est disponible."
            }
        }
    }

    private let engine = AVAudioEngine()
    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "fr-FR"))
    private let lock = NSLock()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    private var active = false

    private var isActive: Bool {
        lock.lock()
        defer { lock.unlock() }
        return active
    }

    private func setActive(_ value: Bool) {
        lock.lock()
        active = value
        lock.unlock()
    }

    /// Demande les deux autorisations (micro, reconnaissance vocale).
    /// Renvoie `nil` si tout est accordé, sinon le message à afficher.
    public static func requestPermissions() async -> String? {
        let speech: SFSpeechRecognizerAuthorizationStatus = await withCheckedContinuation { continuation in
            SFSpeechRecognizer.requestAuthorization { status in
                continuation.resume(returning: status)
            }
        }
        guard speech == .authorized else {
            return "Torix n'a pas le droit de transcrire ta voix. Autorise-la dans \(Platform.systemSettings) › Confidentialité et sécurité › Reconnaissance vocale."
        }
        let microphone = await AVCaptureDevice.requestAccess(for: .audio)
        guard microphone else {
            return "Torix n'a pas accès au micro. Autorise-la dans \(Platform.systemSettings) › Confidentialité et sécurité › Microphone."
        }
        return nil
    }

    public func start(
        onResult: @escaping @Sendable (_ text: String, _ isFinal: Bool) -> Void,
        onError: @escaping @Sendable (_ message: String) -> Void
    ) throws {
        stop()
        guard let recognizer, recognizer.isAvailable else { throw CaptureError.recognizerUnavailable }
        guard recognizer.supportsOnDeviceRecognition else { throw CaptureError.onDeviceUnsupported }

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        request.requiresOnDeviceRecognition = true   // rien ne part chez Apple
        request.addsPunctuation = true

        AudioSession.activate()
        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        guard format.sampleRate > 0, format.channelCount > 0 else { throw CaptureError.noMicrophone }
        input.removeTap(onBus: 0)
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
            request.append(buffer)
        }
        engine.prepare()
        do {
            try engine.start()
        } catch {
            input.removeTap(onBus: 0)
            throw error
        }

        self.request = request
        setActive(true)
        task = recognizer.recognitionTask(with: request) { [weak self] result, error in
            // Après `stop()`, Speech signale encore une « annulation » : on l'ignore.
            guard let self, self.isActive else { return }
            if let result {
                onResult(result.bestTranscription.formattedString, result.isFinal)
            } else if let error {
                onError(error.localizedDescription)
            }
        }
    }

    public func stop() {
        guard isActive else { return }
        setActive(false)
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
        request?.endAudio()
        task?.cancel()
        request = nil
        task = nil
    }
}
