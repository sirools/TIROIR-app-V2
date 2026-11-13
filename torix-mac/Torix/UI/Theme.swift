import SwiftUI
import AppKit

/// Identité visuelle de Torix : bleu nuit profond, bleu flamme lumineux, texte blanc cassé.
/// Les bleus de la flamme reprennent ceux de la flamme du Torix Lab (web/components/torix/palette.ts, cap nord).
enum Theme {
    static let night = Color(red: 0.027, green: 0.043, blue: 0.118)
    static let nightSoft = Color(red: 0.063, green: 0.094, blue: 0.212)
    static let nightDeep = Color(red: 0.012, green: 0.02, blue: 0.063)

    static let flame = Color(red: 85 / 255, green: 175 / 255, blue: 1)
    static let flameCore = Color(red: 185 / 255, green: 238 / 255, blue: 1)
    static let flameDeep = Color(red: 34 / 255, green: 96 / 255, blue: 240 / 255)

    static let text = Color(red: 0.95, green: 0.94, blue: 0.90)
    static let textDim = Color(red: 0.95, green: 0.94, blue: 0.90).opacity(0.62)

    static let nightNS = NSColor(srgbRed: 0.027, green: 0.043, blue: 0.118, alpha: 1)
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
