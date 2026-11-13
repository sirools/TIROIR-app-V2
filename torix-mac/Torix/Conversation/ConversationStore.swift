import Foundation
import Observation

/// L'état commun de la conversation, partagé par la barre flottante et la fenêtre d'exploration.
@MainActor
@Observable
final class ConversationStore {
    // MARK: État observé

    private(set) var messages: [Message] = []
    /// Texte en cours de saisie (ou de dictée), commun aux deux modes.
    var draft = ""
    /// Torix est en train de produire une réponse.
    private(set) var isGenerating = false
    /// Éléments allumés sur la carte stellaire, dans l'ordre où Torix les a cités.
    private(set) var litIDs: [String] = []
    /// Une constellation par réponse : les éléments cités ensemble sont reliés par des lignes.
    private(set) var constellations: [[String]] = []
    /// Dernier élément ouvert (mis en avant sur la carte).
    private(set) var focusedID: String?
    /// Photo (ou fiche) affichée en grand dans la fenêtre d'exploration.
    var previewItem: ArchiveItem?
    /// Indisponibilité du modèle, vérifiée au lancement. `nil` si tout va bien.
    private(set) var brainProblem: String?

    // MARK: Dépendances

    let archive: ArchiveStore
    let settings: TorixSettings
    let listener = SpeechListener()
    let speaker = SpeechSpeaker()
    let media = MediaPlayer()
    @ObservationIgnored private(set) var brain: any TorixBrain
    /// Demande d'ouvrir la fenêtre d'exploration (pour montrer une photo, par exemple).
    @ObservationIgnored var onNeedsExploration: (() -> Void)?
    @ObservationIgnored private var replyTask: Task<Void, Never>?

    init(archive: ArchiveStore, settings: TorixSettings, brain: any TorixBrain) {
        self.archive = archive
        self.settings = settings
        self.brain = brain
        listener.onTranscript = { [weak self] text in
            self?.draft = text
        }
        listener.onFinished = { [weak self] text in
            self?.send(text)
        }
    }

    // MARK: État de Torix

    var state: TorixState {
        if listener.isListening { return .listening }
        if speaker.isSpeaking { return .speaking }
        if isGenerating { return .thinking }
        return .idle
    }

    /// Message à montrer en bandeau : modèle indisponible, micro refusé, archive illisible.
    var notice: String? {
        brainProblem ?? listener.problem ?? archive.problem
    }

    /// Dernière question posée.
    var lastQuestion: Message? {
        messages.last { $0.role == .user }
    }

    /// Réponse à la dernière question (affichée sous la barre).
    var lastReply: Message? {
        guard let last = messages.last, last.role != .user else { return nil }
        return last
    }

    /// Vérifie que le modèle est utilisable ; à appeler au lancement et à chaque ouverture.
    func checkBrain() {
        switch brain.availability {
        case .available:
            brainProblem = nil
        case .unavailable(let reason):
            brainProblem = reason
        }
    }

    func prewarm() {
        brain.prewarm()
    }

    // MARK: Parler à Torix

    func sendDraft() {
        if listener.isListening {
            listener.stop(send: false)
        }
        send(draft)
    }

    func send(_ raw: String) {
        let text = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        draft = ""
        listener.stop(send: false)
        replyTask?.cancel()
        closeStreamingMessages()
        speaker.beginReply()

        messages.append(Message(role: .user, text: text))

        checkBrain()
        if let brainProblem {
            messages.append(Message(role: .info, text: brainProblem))
            return
        }

        let reply = Message(role: .torix, text: "", isStreaming: true)
        let replyID = reply.id
        messages.append(reply)
        isGenerating = true

        replyTask = Task { [weak self] in
            guard let self else { return }
            // Éléments cités dans cette réponse, dans l'ordre : ils forment une constellation.
            var cited: [String] = []
            do {
                for try await event in self.brain.respond(to: text) {
                    if Task.isCancelled { return }
                    switch event {
                    case .text(let full):
                        self.update(replyID) { $0.text = full }
                        self.speakIfWanted(full, final: false)
                    case .found(let items):
                        self.update(replyID) { message in
                            for item in items where !message.items.contains(item) {
                                message.items.append(item)
                            }
                        }
                        for item in items where !cited.contains(item.id) {
                            cited.append(item.id)
                        }
                        self.light(cited, replacingLast: self.constellationOpen)
                        self.constellationOpen = true
                    case .opened(let item):
                        self.update(replyID) { message in
                            if !message.items.contains(item) { message.items.append(item) }
                        }
                        if !cited.contains(item.id) { cited.append(item.id) }
                        self.light(cited, replacingLast: self.constellationOpen)
                        self.constellationOpen = true
                        self.open(item, byTorix: true)
                    }
                }
                if Task.isCancelled { return }
                let finalText = self.messages.first { $0.id == replyID }?.text ?? ""
                if finalText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    self.update(replyID) { $0.text = "Je n'ai pas réussi à formuler de réponse. Tu peux reposer ta question autrement ?" }
                }
                self.speakIfWanted(self.messages.first { $0.id == replyID }?.text ?? "", final: true)
            } catch is CancellationError {
                return   // nouvelle question ou fermeture : rien à dire
            } catch {
                if Task.isCancelled { return }
                self.update(replyID) { message in
                    message.role = .info
                    message.text = "Torix n'a pas pu répondre : \(error.localizedDescription)"
                }
            }
            // Une tâche annulée ne touche plus à l'état : une autre réponse a peut-être déjà commencé.
            if Task.isCancelled { return }
            self.update(replyID) { $0.isStreaming = false }
            self.isGenerating = false
            self.constellationOpen = false
        }
    }

    /// Efface la conversation et repart d'une session neuve.
    func clear() {
        stopEverything()
        messages.removeAll()
        litIDs.removeAll()
        constellations.removeAll()
        focusedID = nil
        previewItem = nil
        brain.reset()
    }

    /// Coupe la réponse en cours, la voix et l'écoute.
    func stopEverything() {
        replyTask?.cancel()
        replyTask = nil
        closeStreamingMessages()
        isGenerating = false
        constellationOpen = false
        listener.stop(send: false)
        speaker.stop()
    }

    // MARK: Écoute

    func startListening() {
        guard !listener.isListening else { return }
        speaker.stop()
        draft = ""
        listener.start()
    }

    func toggleListening() {
        if listener.isListening {
            listener.stop(send: true)
        } else {
            startListening()
        }
    }

    // MARK: Archive

    /// Affiche ou joue un élément (outil `openItem`, clic sur une étoile ou sur une carte).
    /// `byTorix` : ouverture demandée par le modèle. Dans ce cas, une fiche sans fichier est seulement
    /// mise en avant — on ne dérange pas avec une fenêtre pour dire « fichier absent ».
    func open(_ item: ArchiveItem, byTorix: Bool = false) {
        focusedID = item.id
        if !litIDs.contains(item.id) { litIDs.append(item.id) }
        let url = archive.fileURL(for: item)
        if item.type.isAudio, let url {
            media.play(item, url: url)
        } else if byTorix, url == nil {
            return
        } else {
            // Photo, ou fiche sans fichier : on la montre en grand dans la fenêtre d'exploration.
            previewItem = item
            onNeedsExploration?()
        }
    }

    /// L'archive a changé (autre dossier, rechargement) : on repart proprement.
    func archiveDidChange() {
        let known = Set(archive.items.map(\.id))
        litIDs.removeAll { !known.contains($0) }
        constellations = constellations.map { $0.filter { known.contains($0) } }.filter { !$0.isEmpty }
        brain.reset()
    }

    // MARK: Interne

    /// Une constellation est en cours de construction pour la réponse actuelle.
    @ObservationIgnored private var constellationOpen = false

    private func light(_ cited: [String], replacingLast: Bool) {
        for id in cited where !litIDs.contains(id) {
            litIDs.append(id)
        }
        if replacingLast, !constellations.isEmpty {
            constellations[constellations.count - 1] = cited
        } else {
            constellations.append(cited)
        }
    }

    private func speakIfWanted(_ text: String, final: Bool) {
        guard settings.speakReplies else { return }
        speaker.feed(text, final: final, voiceIdentifier: settings.voiceIdentifier, rate: settings.speechRate)
    }

    private func update(_ id: UUID, _ change: (inout Message) -> Void) {
        guard let index = messages.lastIndex(where: { $0.id == id }) else { return }
        change(&messages[index])
    }

    private func closeStreamingMessages() {
        for index in messages.indices where messages[index].isStreaming {
            messages[index].isStreaming = false
        }
    }
}
