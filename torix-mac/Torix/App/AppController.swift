import AppKit
import SwiftUI
import TorixCore
import TorixUI
import KeyboardShortcuts

/// Assemble l'appli : archive, cerveau, conversation, barre flottante, fenêtre d'exploration.
@MainActor
final class AppController: NSObject, NSWindowDelegate {
    static let shared = AppController()

    let settings: TorixSettings
    let archive: ArchiveStore
    let store: ConversationStore
    private let panel: FloatingPanelController
    private var explorationWindow: NSWindow?
    private var started = false

    private override init() {
        let settings = TorixSettings.shared
        let archive = ArchiveStore(path: settings.archivePath)
        // Le moteur se choisit ici. `OllamaBrain()` est l'emplacement du second moteur.
        let brain: any TorixBrain = AppleFoundationBrain(archive: archive)
        let store = ConversationStore(archive: archive, settings: settings, brain: brain)
        self.settings = settings
        self.archive = archive
        self.store = store
        self.panel = FloatingPanelController(store: store, settings: settings)
        super.init()
    }

    func start() {
        guard !started else { return }
        started = true

        archive.prepareAndLoad()
        store.checkBrain()
        store.prewarm()

        panel.onExpand = { [weak self] in
            self?.showExploration(fullScreen: true)
        }
        store.onNeedsExploration = { [weak self] in
            self?.panel.hide(silence: false)
            self?.showExploration(fullScreen: false)
        }
        KeyboardShortcuts.onKeyDown(for: .toggleTorix) { [weak self] in
            self?.toggleBar()
        }

        showExploration(fullScreen: false)
    }

    // MARK: Barre flottante

    func toggleBar() {
        panel.toggle()
    }

    func showBar() {
        panel.show()
    }

    // MARK: Fenêtre d'exploration

    /// `fullScreen` : passer en vrai plein écran (bouton « agrandir » de la barre).
    func showExploration(fullScreen: Bool) {
        let window = explorationWindow ?? makeExplorationWindow()
        explorationWindow = window
        NSApp.activate()
        window.makeKeyAndOrderFront(nil)
        if fullScreen, !window.styleMask.contains(.fullScreen) {
            window.toggleFullScreen(nil)
        }
    }

    private func makeExplorationWindow() -> NSWindow {
        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1240, height: 780),
            styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        window.title = "Torix"
        window.titleVisibility = .hidden
        window.titlebarAppearsTransparent = true
        window.isReleasedWhenClosed = false
        window.collectionBehavior = [.fullScreenPrimary]
        window.appearance = NSAppearance(named: .darkAqua)
        window.backgroundColor = NSColor.torixNight
        window.contentViewController = NSHostingController(rootView: ExplorationView(store: store))
        window.setContentSize(NSSize(width: 1240, height: 780))
        window.center()
        window.setFrameAutosaveName("TorixExploration")
        window.delegate = self
        return window
    }

    func windowWillClose(_ notification: Notification) {
        // Fenêtre fermée et barre cachée : plus rien à l'écran, Torix se tait.
        if !panel.isVisible {
            store.stopEverything()
        }
        store.media.stop()
    }
}
