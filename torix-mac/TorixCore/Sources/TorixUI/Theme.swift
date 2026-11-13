import SwiftUI

#if canImport(UIKit)
import UIKit
public typealias PlatformImage = UIImage
#elseif canImport(AppKit)
import AppKit
public typealias PlatformImage = NSImage
#endif

/// Identité visuelle de Torix : bleu nuit profond, bleu flamme lumineux, texte blanc cassé.
/// Les bleus de la flamme reprennent ceux de la flamme du Torix Lab (web/components/torix/palette.ts, cap nord).
public enum Theme {
    public static let night = Color(red: 0.027, green: 0.043, blue: 0.118)
    public static let nightSoft = Color(red: 0.063, green: 0.094, blue: 0.212)
    public static let nightDeep = Color(red: 0.012, green: 0.02, blue: 0.063)

    public static let flame = Color(red: 85 / 255, green: 175 / 255, blue: 1)
    public static let flameCore = Color(red: 185 / 255, green: 238 / 255, blue: 1)
    public static let flameDeep = Color(red: 34 / 255, green: 96 / 255, blue: 240 / 255)

    public static let text = Color(red: 0.95, green: 0.94, blue: 0.90)
    public static let textDim = Color(red: 0.95, green: 0.94, blue: 0.90).opacity(0.62)
}

public extension Image {
    /// Image SwiftUI à partir d'une image de la plateforme (UIImage sur iPhone, NSImage sur Mac).
    init(platformImage: PlatformImage) {
        #if canImport(UIKit)
        self.init(uiImage: platformImage)
        #else
        self.init(nsImage: platformImage)
        #endif
    }
}

public enum PlatformImages {
    /// Image du catalogue de l'appli (pas du package), ou `nil` si elle n'y est pas.
    public static func named(_ name: String) -> PlatformImage? {
        #if canImport(UIKit)
        return UIImage(named: name, in: .main, compatibleWith: nil)
        #else
        return Bundle.main.image(forResource: name)
        #endif
    }

    public static func file(_ url: URL) -> PlatformImage? {
        #if canImport(UIKit)
        return UIImage(contentsOfFile: url.path)
        #else
        return NSImage(contentsOf: url)
        #endif
    }
}
