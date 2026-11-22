import SwiftUI
import UIKit

/// Les couleurs du jeu : bleus et crème, et seulement deux couleurs vives,
/// le jaune (enceintes) et le vert (bornes).
enum Couleurs {
    /// Crème des murs : le beige du design system Tiroir (#FFF4E6).
    static let mur = SIMD3<Float>(1.00, 0.957, 0.902)
    static let sol = SIMD3<Float>(0.07, 0.16, 0.34)
    static let eau = SIMD3<Float>(0.22, 0.46, 0.72)
    static let enceinte = SIMD3<Float>(1.00, 0.80, 0.12)
    static let borne = SIMD3<Float>(0.27, 0.74, 0.42)
    static let messager = SIMD3<Float>(0.96, 0.95, 0.92)
    static let pas = SIMD3<Float>(0.66, 0.82, 0.95)

    /// La couleur assombrie selon l'éclairage (0 = noir, 1 = pleine couleur).
    static func ui(_ couleur: SIMD3<Float>, lumiere: Float = 1) -> UIColor {
        let l = CGFloat(max(0, min(1, lumiere)))
        return UIColor(
            red: CGFloat(couleur.x) * l,
            green: CGFloat(couleur.y) * l,
            blue: CGFloat(couleur.z) * l,
            alpha: 1
        )
    }

    static func swiftUI(_ couleur: SIMD3<Float>) -> Color {
        Color(uiColor: ui(couleur))
    }
}
