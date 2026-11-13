import Foundation
import Observation
import TorixCore

enum AppTab: Hashable {
    case conversation
    case stars
    case settings
}

/// Assemble l'appli iPhone : archive dans Documents, cerveau, conversation.
@MainActor
@Observable
final class AppModel {
    static let shared = AppModel()

    let settings: TorixSettings
    let archive: ArchiveStore
    let store: ConversationStore

    var selectedTab: AppTab = .conversation
    /// Import d'archive en cours (copie de fichiers).
    private(set) var isImporting = false
    /// Résultat du dernier import, à afficher dans les réglages.
    private(set) var importMessage: String?

    /// Une écoute a été demandée (raccourci, Siri, bouton Action) : elle démarre dès que l'appli est à l'écran.
    @ObservationIgnored private var pendingListen = false
    @ObservationIgnored private var isActive = false
    @ObservationIgnored private var didHandleLaunch = false

    /// L'archive vit dans Documents/Archive : visible dans Fichiers › Sur mon iPhone › Torix.
    static var archiveURL: URL {
        FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Archive", isDirectory: true)
    }

    private init() {
        let settings = TorixSettings.shared
        let archive = ArchiveStore(rootURL: AppModel.archiveURL)
        // Le moteur se choisit ici, comme sur Mac.
        let brain: any TorixBrain = AppleFoundationBrain(archive: archive)
        self.settings = settings
        self.archive = archive
        self.store = ConversationStore(archive: archive, settings: settings, brain: brain)
        archive.prepareAndLoad()   // crée l'archive d'exemple au premier lancement
        store.checkBrain()
        store.prewarm()
    }

    // MARK: Écoute en un geste

    /// Appelé par l'intent « Parler à Torix » et par le lien torix://ecouter.
    func requestListening() {
        selectedTab = .conversation
        pendingListen = true
        listenIfReady()
    }

    func sceneBecameActive() {
        isActive = true
        store.checkBrain()
        if !didHandleLaunch {
            didHandleLaunch = true
            if settings.autoListen { pendingListen = true }
        }
        listenIfReady()
    }

    func sceneLeftForeground() {
        isActive = false
        // Le micro ne reste jamais ouvert quand Torix n'est plus à l'écran.
        store.stopEverything()
    }

    private func listenIfReady() {
        guard isActive, pendingListen else { return }
        pendingListen = false
        store.startListening()
    }

    // MARK: Archive

    func reloadArchive() {
        archive.prepareAndLoad()
        store.archiveDidChange()
    }

    /// Remplace l'archive par le dossier choisi dans Fichiers ou iCloud Drive.
    /// L'ancienne archive est mise de côté dans Documents, jamais supprimée.
    func importArchive(from folder: URL) async {
        guard !isImporting else { return }
        isImporting = true
        importMessage = nil
        store.stopEverything()
        store.media.stop()
        let destination = AppModel.archiveURL

        let outcome: Result<URL?, Error> = await Task.detached(priority: .userInitiated) { () -> Result<URL?, Error> in
            let scoped = folder.startAccessingSecurityScopedResource()
            defer { if scoped { folder.stopAccessingSecurityScopedResource() } }
            var coordinationError: NSError?
            var result: Result<URL?, Error> = .failure(CocoaError(.fileReadUnknown))
            NSFileCoordinator().coordinate(readingItemAt: folder, options: [], error: &coordinationError) { readable in
                result = Result { try ArchiveImporter.importFolder(from: readable, to: destination) }
            }
            if let coordinationError { return .failure(coordinationError) }
            return result
        }.value

        reloadArchive()
        switch outcome {
        case .success(let backup):
            store.clear()
            var message = "Archive importée : \(archive.items.count) élément(s)."
            if let backup {
                message += " L'ancienne archive est gardée dans le dossier « \(backup.lastPathComponent) »."
            }
            importMessage = message
        case .failure(let error):
            importMessage = "L'import n'a pas abouti : \(error.localizedDescription) L'archive actuelle n'a pas été modifiée."
        }
        isImporting = false
    }
}
