import SwiftUI
import AppKit

extension NSColor {
    /// Le bleu nuit de Torix, pour le fond des fenêtres AppKit.
    static let torixNight = NSColor(srgbRed: 0.027, green: 0.043, blue: 0.118, alpha: 1)
}

/// Fond translucide sombre (matériau système) pour la barre flottante.
struct VisualEffectBackground: NSViewRepresentable {
    var material: NSVisualEffectView.Material = .hudWindow

    func makeNSView(context: Context) -> NSVisualEffectView {
        let view = NSVisualEffectView()
        view.material = material
        view.blendingMode = .behindWindow
        view.state = .active
        view.appearance = NSAppearance(named: .vibrantDark)
        return view
    }

    func updateNSView(_ view: NSVisualEffectView, context: Context) {
        view.material = material
    }
}
