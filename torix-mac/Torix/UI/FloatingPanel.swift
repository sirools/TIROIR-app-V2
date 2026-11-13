import AppKit
import SwiftUI

/// Panneau flottant non activant : il passe devant tout sans voler le premier plan à l'appli en cours,
/// mais peut recevoir le clavier (champ de texte).
final class FloatingPanel: NSPanel {
    var onCancel: (() -> Void)?

    init() {
        super.init(
            contentRect: NSRect(x: 0, y: 0, width: BarView.width, height: 60),
            styleMask: [.nonactivatingPanel, .borderless, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        isFloatingPanel = true
        level = .floating
        collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary, .transient]
        isOpaque = false
        backgroundColor = .clear
        hasShadow = true
        hidesOnDeactivate = false
        isMovableByWindowBackground = true
        isReleasedWhenClosed = false
        animationBehavior = .utilityWindow
        appearance = NSAppearance(named: .darkAqua)
    }

    override var canBecomeKey: Bool { true }
    override var canBecomeMain: Bool { false }

    /// Échap ferme la barre.
    override func cancelOperation(_ sender: Any?) {
        onCancel?()
    }
}

/// Montre, cache et dimensionne la barre flottante.
@MainActor
final class FloatingPanelController {
    private let panel = FloatingPanel()
    private let store: ConversationStore
    private let settings: TorixSettings
    var onExpand: (() -> Void)?

    init(store: ConversationStore, settings: TorixSettings) {
        self.store = store
        self.settings = settings
        let root = BarView(
            store: store,
            onClose: { [weak self] in self?.hide(silence: true) },
            onExpand: { [weak self] in self?.expand() },
            onHeightChange: { [weak self] height in self?.resize(to: height) }
        )
        let hosting = NSHostingView(rootView: root)
        hosting.sizingOptions = []
        panel.contentView = hosting
        panel.onCancel = { [weak self] in self?.hide(silence: true) }
    }

    var isVisible: Bool { panel.isVisible }

    func toggle() {
        if panel.isVisible {
            hide(silence: true)
        } else {
            show()
        }
    }

    func show() {
        store.checkBrain()
        position()
        panel.makeKeyAndOrderFront(nil)
        panel.orderFrontRegardless()
        focusTextField()
        if settings.autoListen {
            store.startListening()
        }
    }

    /// `silence` : couper aussi la voix et la réponse en cours (fermeture par Échap ou raccourci).
    func hide(silence: Bool) {
        guard panel.isVisible else { return }
        if silence {
            store.stopEverything()
        } else {
            store.listener.stop(send: false)
        }
        panel.orderOut(nil)
    }

    private func expand() {
        // On garde la voix et la réponse : la conversation continue en grand.
        hide(silence: false)
        onExpand?()
    }

    /// Met le curseur dans le champ de texte à chaque ouverture.
    private func focusTextField() {
        func find(in view: NSView) -> NSTextField? {
            if let field = view as? NSTextField, field.isEditable { return field }
            for child in view.subviews {
                if let found = find(in: child) { return found }
            }
            return nil
        }
        if let content = panel.contentView, let field = find(in: content) {
            panel.makeFirstResponder(field)
        }
    }

    /// Centré en haut de l'écran où se trouve la souris.
    private func position() {
        let mouse = NSEvent.mouseLocation
        let screen = NSScreen.screens.first { $0.frame.contains(mouse) } ?? NSScreen.main ?? NSScreen.screens.first
        guard let visible = screen?.visibleFrame else { return }
        let size = panel.frame.size
        let topEdge = visible.maxY - 90
        let x = visible.midX - size.width / 2
        panel.setFrame(NSRect(x: x, y: topEdge - size.height, width: size.width, height: size.height), display: true)
    }

    private func resize(to height: CGFloat) {
        guard height > 1 else { return }
        var frame = panel.frame
        guard abs(frame.height - height) > 0.5 else { return }
        // Le bord haut reste fixe : la barre grandit vers le bas.
        let topEdge = frame.maxY
        frame.origin.y = topEdge - height
        frame.size.height = height
        frame.size.width = BarView.width
        panel.setFrame(frame, display: true, animate: false)
        panel.invalidateShadow()
    }
}
