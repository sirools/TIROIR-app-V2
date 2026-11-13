import AVFoundation
import Observation

/// La voix de Torix : lit la réponse phrase par phrase, au fil du flux.
@MainActor
@Observable
final class SpeechSpeaker {
    private(set) var isSpeaking = false

    @ObservationIgnored private let synthesizer = AVSpeechSynthesizer()
    @ObservationIgnored private let relay = SpeakerDelegate()
    /// Nombre de caractères de la réponse en cours déjà confiés à la synthèse.
    @ObservationIgnored private var spokenCount = 0
    /// Phrases en attente ou en cours de lecture. Les rappels d'une parole interrompue,
    /// absents de cet ensemble, sont ignorés.
    @ObservationIgnored private var pending: Set<ObjectIdentifier> = []

    init() {
        synthesizer.delegate = relay
        relay.onEnd = { [weak self] id in
            Task { @MainActor in self?.utteranceEnded(id) }
        }
    }

    // MARK: Voix disponibles

    /// Voix françaises installées, de la meilleure qualité à la moins bonne, fr-FR d'abord.
    static func frenchVoices() -> [AVSpeechSynthesisVoice] {
        AVSpeechSynthesisVoice.speechVoices()
            .filter { $0.language.hasPrefix("fr") }
            .sorted { a, b in
                if a.quality.rawValue != b.quality.rawValue { return a.quality.rawValue > b.quality.rawValue }
                let aFrance = a.language == "fr-FR", bFrance = b.language == "fr-FR"
                if aFrance != bFrance { return aFrance }
                return a.name < b.name
            }
    }

    static func label(for voice: AVSpeechSynthesisVoice) -> String {
        let quality: String
        switch voice.quality {
        case .premium: quality = "premium"
        case .enhanced: quality = "améliorée"
        default: quality = "standard"
        }
        return "\(voice.name) — \(quality) (\(voice.language))"
    }

    private static func voice(identifier: String) -> AVSpeechSynthesisVoice? {
        if !identifier.isEmpty, let chosen = AVSpeechSynthesisVoice(identifier: identifier) {
            return chosen
        }
        return frenchVoices().first ?? AVSpeechSynthesisVoice(language: "fr-FR")
    }

    // MARK: Parole

    /// À appeler au début de chaque réponse.
    func beginReply() {
        stop()
    }

    /// Reçoit le texte cumulé de la réponse ; lit les phrases complètes pas encore dites.
    /// `final` : la réponse est terminée, lire aussi le reste.
    func feed(_ fullText: String, final: Bool, voiceIdentifier: String, rate: Double) {
        let characters = Array(fullText)
        guard characters.count > spokenCount else { return }
        let rest = characters[spokenCount...]
        var end = rest.endIndex
        if !final {
            guard let lastStop = rest.lastIndex(where: { ".!?…\n".contains($0) }) else { return }
            end = rest.index(after: lastStop)
        }
        let chunk = String(rest[rest.startIndex..<end])
        spokenCount += end - rest.startIndex
        speak(chunk, voiceIdentifier: voiceIdentifier, rate: rate)
    }

    /// Lit un texte entier (aperçu de la voix dans les réglages, messages de l'appli).
    func say(_ text: String, voiceIdentifier: String, rate: Double) {
        stop()
        speak(text, voiceIdentifier: voiceIdentifier, rate: rate)
    }

    func stop() {
        spokenCount = 0
        pending.removeAll()
        isSpeaking = false
        if synthesizer.isSpeaking {
            synthesizer.stopSpeaking(at: .immediate)
        }
    }

    private func speak(_ text: String, voiceIdentifier: String, rate: Double) {
        let clean = SpeechSpeaker.speakable(text)
        guard !clean.isEmpty else { return }
        let utterance = AVSpeechUtterance(string: clean)
        utterance.voice = SpeechSpeaker.voice(identifier: voiceIdentifier)
        let span = AVSpeechUtteranceMaximumSpeechRate - AVSpeechUtteranceMinimumSpeechRate
        utterance.rate = AVSpeechUtteranceMinimumSpeechRate + Float(min(max(rate, 0), 1)) * span
        pending.insert(ObjectIdentifier(utterance))
        isSpeaking = true
        synthesizer.speak(utterance)
    }

    private func utteranceEnded(_ id: ObjectIdentifier) {
        guard pending.remove(id) != nil else { return }
        if pending.isEmpty { isSpeaking = false }
    }

    /// Retire ce qui se lit mal à voix haute (mise en forme Markdown, puces).
    static func speakable(_ text: String) -> String {
        var out = text
        for mark in ["**", "__", "*", "#", "`", "•"] {
            out = out.replacingOccurrences(of: mark, with: "")
        }
        return out.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

/// Relais du délégué AVSpeechSynthesizer (appelé hors de l'acteur principal).
private final class SpeakerDelegate: NSObject, AVSpeechSynthesizerDelegate, @unchecked Sendable {
    private let lock = NSLock()
    private var handler: (@Sendable (ObjectIdentifier) -> Void)?

    var onEnd: (@Sendable (ObjectIdentifier) -> Void)? {
        get { lock.lock(); defer { lock.unlock() }; return handler }
        set { lock.lock(); handler = newValue; lock.unlock() }
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        onEnd?(ObjectIdentifier(utterance))
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        onEnd?(ObjectIdentifier(utterance))
    }
}
